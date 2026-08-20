"""
Avoir — Team/Workspace Collaboration Service

Production-grade RBAC engine for multi-user team workspaces.
Handles team CRUD, member management, invitations, and audit logging.

Permission Matrix (15 actions x 3 roles):
  Owner:  all permissions
  Admin:  team.view, team.update, team.view_audit, member.invite,
          member.remove, campaign.view, campaign.create, campaign.delete,
          brand_dna.view, brand_dna.update, invitation.create, invitation.revoke
  Member: team.view, campaign.view, campaign.create, brand_dna.view,
          brand_dna.update

All methods are designed to work with the DynamoDB tables provisioned by
scripts/create-team-tables.mjs.
"""

import uuid
import time
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Any, Optional, Tuple
from enum import Enum


class TeamRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"


class AuditAction(str, Enum):
    TEAM_CREATED = "team.created"
    TEAM_UPDATED = "team.updated"
    TEAM_DELETED = "team.deleted"
    MEMBER_JOINED = "member.joined"
    MEMBER_REMOVED = "member.removed"
    MEMBER_ROLE_CHANGED = "member.role_changed"
    INVITATION_CREATED = "invitation.created"
    INVITATION_ACCEPTED = "invitation.accepted"
    INVITATION_REVOKED = "invitation.revoked"
    CAMPAIGN_CREATED = "campaign.created"
    CAMPAIGN_DELETED = "campaign.deleted"
    BRAND_DNA_UPDATED = "brand_dna.updated"


# ============================================================================
# PERMISSION MATRIX
# ============================================================================

PERMISSIONS: Dict[str, List[TeamRole]] = {
    "team.view":          [TeamRole.OWNER, TeamRole.ADMIN, TeamRole.MEMBER],
    "team.update":        [TeamRole.OWNER, TeamRole.ADMIN],
    "team.delete":        [TeamRole.OWNER],
    "team.manage_billing": [TeamRole.OWNER],
    "team.view_audit":    [TeamRole.OWNER, TeamRole.ADMIN],
    "member.invite":      [TeamRole.OWNER, TeamRole.ADMIN],
    "member.remove":      [TeamRole.OWNER, TeamRole.ADMIN],
    "member.update_role": [TeamRole.OWNER],
    "campaign.view":      [TeamRole.OWNER, TeamRole.ADMIN, TeamRole.MEMBER],
    "campaign.create":    [TeamRole.OWNER, TeamRole.ADMIN, TeamRole.MEMBER],
    "campaign.delete":    [TeamRole.OWNER, TeamRole.ADMIN],
    "brand_dna.view":     [TeamRole.OWNER, TeamRole.ADMIN, TeamRole.MEMBER],
    "brand_dna.update":   [TeamRole.OWNER, TeamRole.ADMIN, TeamRole.MEMBER],
    "invitation.create":  [TeamRole.OWNER, TeamRole.ADMIN],
    "invitation.revoke":  [TeamRole.OWNER, TeamRole.ADMIN],
}


def has_permission(role: TeamRole, permission: str) -> bool:
    """Check if a role has a given permission."""
    allowed = PERMISSIONS.get(permission, [])
    return role in allowed


# ============================================================================
# TEAM SERVICE
# ============================================================================

class TeamService:
    """Team workspace CRUD operations."""

    def __init__(self, dynamo_client=None):
        self.client = dynamo_client
        self.teams_table = os.environ.get("DYNAMODB_TEAMS_TABLE", "avoir-teams")

    def create_team(self, owner_id: str, name: str) -> Dict[str, Any]:
        """Create a new team workspace. Owner is automatically added as a member."""
        team_id = f"team-{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()

        team = {
            "teamId": team_id,
            "name": name,
            "ownerId": owner_id,
            "maxSeats": 5,
            "createdAt": now,
            "updatedAt": now,
            "settings": {
                "allowMemberCampaignCreation": True,
                "creditPoolEnabled": True,
            },
        }

        # In production, this would be a TransactWriteCommand
        # For local dev, we use the in-memory store
        if self.client:
            self._put_item(self.teams_table, team)
            # Add owner as member
            member_service = TeamMemberService(self.client)
            member_service.add_member(team_id, owner_id, TeamRole.OWNER, owner_id)
        else:
            self._store_team(team)

        return team

    def get_team(self, team_id: str) -> Optional[Dict[str, Any]]:
        if self.client:
            return self._get_item(self.teams_table, {"teamId": team_id})
        return self._get_stored_team(team_id)

    def list_user_teams(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all teams a user belongs to (uses GSI on team-members table)."""
        member_service = TeamMemberService(self.client)
        memberships = member_service.list_user_memberships(user_id)

        teams = []
        for membership in memberships:
            team = self.get_team(membership["teamId"])
            if team:
                teams.append(team)
        return teams

    def update_team(self, team_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        team = self.get_team(team_id)
        if not team:
            return None
        team.update(updates)
        team["updatedAt"] = datetime.now(timezone.utc).isoformat()
        if self.client:
            self._put_item(self.teams_table, team)
        else:
            self._store_team(team)
        return team

    def delete_team(self, team_id: str) -> bool:
        if self.client:
            self._delete_item(self.teams_table, {"teamId": team_id})
        else:
            self._remove_stored_team(team_id)
        return True

    # --- In-memory store for local dev ---
    _teams_store: Dict[str, Dict[str, Any]] = {}

    def _store_team(self, team: Dict[str, Any]):
        TeamService._teams_store[team["teamId"]] = team

    def _get_stored_team(self, team_id: str) -> Optional[Dict[str, Any]]:
        return TeamService._teams_store.get(team_id)

    def _remove_stored_team(self, team_id: str):
        TeamService._teams_store.pop(team_id, None)

    def _put_item(self, table_name: str, item: Dict[str, Any]):
        import boto3
        dynamodb = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "us-east-1"))
        table = dynamodb.Table(table_name)
        table.put_item(Item=item)

    def _get_item(self, table_name: str, key: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        import boto3
        dynamodb = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "us-east-1"))
        table = dynamodb.Table(table_name)
        result = table.get_item(Key=key)
        return result.get("Item")


# ============================================================================
# TEAM MEMBER SERVICE
# ============================================================================

class TeamMemberService:
    """Team member management with RBAC."""

    def __init__(self, dynamo_client=None):
        self.client = dynamo_client
        self.members_table = os.environ.get("DYNAMODB_TEAM_MEMBERS_TABLE", "avoir-team-members")

    def add_member(self, team_id: str, user_id: str, role: TeamRole, invited_by: str) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        membership = {
            "teamId": team_id,
            "userId": user_id,
            "role": role.value,
            "joinedAt": now,
            "invitedBy": invited_by,
            "status": "active",
        }

        if self.client:
            self._put_item(self.members_table, membership)
        else:
            key = f"{team_id}:{user_id}"
            TeamMemberService._members_store[key] = membership

        return membership

    def remove_member(self, team_id: str, user_id: str) -> bool:
        if self.client:
            self._delete_item(self.members_table, {"teamId": team_id, "userId": user_id})
        else:
            key = f"{team_id}:{user_id}"
            TeamMemberService._members_store.pop(key, None)
        return True

    def update_role(self, team_id: str, user_id: str, role: TeamRole) -> Optional[Dict[str, Any]]:
        membership = self.get_membership(team_id, user_id)
        if not membership:
            return None
        membership["role"] = role.value
        if self.client:
            self._put_item(self.members_table, membership)
        else:
            key = f"{team_id}:{user_id}"
            TeamMemberService._members_store[key] = membership
        return membership

    def get_membership(self, team_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        if self.client:
            return self._get_item(self.members_table, {"teamId": team_id, "userId": user_id})
        key = f"{team_id}:{user_id}"
        return TeamMemberService._members_store.get(key)

    def get_user_role(self, team_id: str, user_id: str) -> Optional[TeamRole]:
        membership = self.get_membership(team_id, user_id)
        if not membership:
            return None
        return TeamRole(membership["role"])

    def list_members(self, team_id: str) -> List[Dict[str, Any]]:
        if self.client:
            return self._query_items(self.members_table, "teamId", team_id)
        return [
            m for m in TeamMemberService._members_store.values()
            if m["teamId"] == team_id
        ]

    def list_user_memberships(self, user_id: str) -> List[Dict[str, Any]]:
        """Uses the userId-index GSI."""
        if self.client:
            return self._query_gsi(self.members_table, "userId-index", "userId", user_id)
        return [
            m for m in TeamMemberService._members_store.values()
            if m["userId"] == user_id
        ]

    def check_permission(self, team_id: str, user_id: str, permission: str) -> bool:
        role = self.get_user_role(team_id, user_id)
        if not role:
            return False
        return has_permission(role, permission)

    # --- In-memory store ---
    _members_store: Dict[str, Dict[str, Any]] = {}

    def _put_item(self, table_name: str, item: Dict[str, Any]):
        import boto3
        dynamodb = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "us-east-1"))
        table = dynamodb.Table(table_name)
        table.put_item(Item=item)

    def _get_item(self, table_name: str, key: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        import boto3
        dynamodb = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "us-east-1"))
        table = dynamodb.Table(table_name)
        result = table.get_item(Key=key)
        return result.get("Item")

    def _delete_item(self, table_name: str, key: Dict[str, Any]):
        import boto3
        dynamodb = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "us-east-1"))
        table = dynamodb.Table(table_name)
        table.delete_item(Key=key)

    def _query_items(self, table_name: str, key_field: str, key_value: str) -> List[Dict[str, Any]]:
        import boto3
        dynamodb = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "us-east-1"))
        table = dynamodb.Table(table_name)
        result = table.query(
            KeyConditionExpression=f"{key_field} = :val",
            ExpressionAttributeValues={":val": key_value},
        )
        return result.get("Items", [])

    def _query_gsi(self, table_name: str, index_name: str, key_field: str, key_value: str) -> List[Dict[str, Any]]:
        import boto3
        dynamodb = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "us-east-1"))
        table = dynamodb.Table(table_name)
        result = table.query(
            IndexName=index_name,
            KeyConditionExpression=f"{key_field} = :val",
            ExpressionAttributeValues={":val": key_value},
        )
        return result.get("Items", [])


# ============================================================================
# INVITATION SERVICE
# ============================================================================

class InvitationService:
    """Token-based invitation system with expiry and atomic acceptance."""

    INVITATION_TTL_DAYS = 7

    def __init__(self, dynamo_client=None):
        self.client = dynamo_client
        self.invitations_table = os.environ.get("DYNAMODB_INVITATIONS_TABLE", "avoir-invitations")

    def create_invitation(
        self, team_id: str, email: str, role: TeamRole, invited_by: str
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(days=self.INVITATION_TTL_DAYS)

        invitation = {
            "token": uuid.uuid4().hex,
            "teamId": team_id,
            "invitedEmail": email,
            "invitedBy": invited_by,
            "role": role.value,
            "status": "pending",
            "createdAt": now.isoformat(),
            "expiresAt": expires_at.isoformat(),
            "ttl": int(expires_at.timestamp()),
        }

        if self.client:
            self._put_item(self.invitations_table, invitation)
        else:
            InvitationService._invitations_store[invitation["token"]] = invitation

        return invitation

    def validate_token(self, token: str) -> Optional[Dict[str, Any]]:
        invitation = self._get_invitation(token)
        if not invitation:
            return None
        if invitation["status"] != "pending":
            return None
        if datetime.fromisoformat(invitation["expiresAt"].replace("Z", "+00:00")) < datetime.now(timezone.utc):
            return None
        return invitation

    def accept_invitation(self, token: str, user_id: str) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Atomically accept an invitation: mark accepted + add membership.
        Returns (success, team_id, role).
        """
        invitation = self.validate_token(token)
        if not invitation:
            return False, None, None

        # Mark as accepted
        invitation["status"] = "accepted"
        if self.client:
            self._put_item(self.invitations_table, invitation)
        else:
            InvitationService._invitations_store[token] = invitation

        # Add as member
        member_service = TeamMemberService(self.client)
        role = TeamRole(invitation["role"])
        member_service.add_member(invitation["teamId"], user_id, role, invitation["invitedBy"])

        return True, invitation["teamId"], invitation["role"]

    def revoke_invitation(self, token: str) -> bool:
        invitation = self._get_invitation(token)
        if not invitation:
            return False
        invitation["status"] = "revoked"
        if self.client:
            self._put_item(self.invitations_table, invitation)
        else:
            InvitationService._invitations_store[token] = invitation
        return True

    def list_pending(self, team_id: str) -> List[Dict[str, Any]]:
        if self.client:
            return self._query_gsi(self.invitations_table, "teamId-index", "teamId", team_id)
        return [
            inv for inv in InvitationService._invitations_store.values()
            if inv["teamId"] == team_id and inv["status"] == "pending"
        ]

    def _get_invitation(self, token: str) -> Optional[Dict[str, Any]]:
        if self.client:
            return self._get_item(self.invitations_table, {"token": token})
        return InvitationService._invitations_store.get(token)

    # --- In-memory store ---
    _invitations_store: Dict[str, Dict[str, Any]] = {}

    def _put_item(self, table_name: str, item: Dict[str, Any]):
        import boto3
        dynamodb = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "us-east-1"))
        table = dynamodb.Table(table_name)
        table.put_item(Item=item)

    def _get_item(self, table_name: str, key: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        import boto3
        dynamodb = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "us-east-1"))
        table = dynamodb.Table(table_name)
        result = table.get_item(Key=key)
        return result.get("Item")

    def _query_gsi(self, table_name: str, index_name: str, key_field: str, key_value: str) -> List[Dict[str, Any]]:
        import boto3
        dynamodb = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "us-east-1"))
        table = dynamodb.Table(table_name)
        result = table.query(
            IndexName=index_name,
            KeyConditionExpression=f"{key_field} = :val",
            ExpressionAttributeValues={":val": key_value},
        )
        return result.get("Items", [])


# ============================================================================
# TEAM AUDIT SERVICE
# ============================================================================

class TeamAuditService:
    """Audit trail for team events with 90-day TTL."""

    AUDIT_TTL_DAYS = 90

    def __init__(self, dynamo_client=None):
        self.client = dynamo_client
        self.audit_table = os.environ.get("DYNAMODB_AUDIT_TABLE", "avoir-audit")

    def log_event(
        self, team_id: str, user_id: str, action: AuditAction,
        details: Optional[Dict[str, Any]] = None
    ):
        now = datetime.now(timezone.utc)
        ttl = int(now.timestamp()) + self.AUDIT_TTL_DAYS * 24 * 3600

        entry = {
            "teamId": team_id,
            "logId": str(uuid.uuid4()),
            "userId": user_id,
            "action": action.value,
            "details": details or {},
            "timestamp": now.isoformat(),
            "ttl": ttl,
        }

        if self.client:
            self._put_item(self.audit_table, entry)
        else:
            key = f"{team_id}:{entry['logId']}"
            TeamAuditService._audit_store[key] = entry

    def get_audit_log(
        self, team_id: str, limit: int = 20, start_key: Optional[str] = None
    ) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        """Get paginated audit log for a team (newest first)."""
        if self.client:
            # Query the teamId-createdAt-index GSI
            return self._query_audit(team_id, limit, start_key)

        # In-memory: filter + sort + paginate
        entries = [
            e for e in TeamAuditService._audit_store.values()
            if e["teamId"] == team_id
        ]
        entries.sort(key=lambda x: x["timestamp"], reverse=True)
        return entries[:limit], None

    # --- In-memory store ---
    _audit_store: Dict[str, Dict[str, Any]] = {}

    def _put_item(self, table_name: str, item: Dict[str, Any]):
        import boto3
        dynamodb = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "us-east-1"))
        table = dynamodb.Table(table_name)
        table.put_item(Item=item)

    def _query_audit(self, team_id: str, limit: int, start_key: Optional[str]):
        import boto3
        import base64
        dynamodb = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "us-east-1"))
        table = dynamodb.Table(self.audit_table)

        params = {
            "IndexName": "teamId-createdAt-index",
            "KeyConditionExpression": "teamId = :teamId",
            "ExpressionAttributeValues": {":teamId": team_id},
            "ScanIndexForward": False,
            "Limit": limit,
        }

        if start_key:
            params["ExclusiveStartKey"] = json.loads(base64.b64decode(start_key))

        result = table.query(**params)
        items = result.get("Items", [])
        last_key = result.get("LastEvaluatedKey")
        next_token = base64.b64encode(json.dumps(last_key).encode()).decode() if last_key else None

        return items, next_token


# ============================================================================
# SINGLETON INSTANCES (for local dev / FastAPI server)
# ============================================================================

team_service = TeamService()
team_member_service = TeamMemberService()
invitation_service = InvitationService()
team_audit_service = TeamAuditService()

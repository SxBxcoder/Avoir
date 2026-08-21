"""
Avoir — FastAPI Team Routes

All team collaboration endpoints for local development.
In production, these map to AWS Lambda + API Gateway.

Routes:
  POST   /api/teams                    → Create team
  GET    /api/teams                    → List user's teams
  GET    /api/teams/{teamId}           → Get team details
  PATCH  /api/teams/{teamId}           → Update team
  DELETE /api/teams/{teamId}           → Delete team
  GET    /api/teams/{teamId}/members   → List members
  POST   /api/teams/{teamId}/members   → Add member directly
  PATCH  /api/teams/{teamId}/members/{userId} → Update role
  DELETE /api/teams/{teamId}/members/{userId} → Remove member
  POST   /api/teams/{teamId}/invitations       → Create invite
  GET    /api/teams/{teamId}/invitations       → List pending invites
  DELETE /api/teams/{teamId}/invitations/{token} → Revoke invite
  POST   /api/invitations/{token}/accept       → Accept invite (public)
  GET    /api/invitations/{token}/validate      → Validate invite (public)
  GET    /api/teams/{teamId}/audit             → Audit log
"""

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional, List
import uuid

from team_service import (
    TeamService, TeamMemberService, InvitationService, TeamAuditService,
    TeamRole, AuditAction, has_permission,
    team_service, team_member_service, invitation_service, team_audit_service,
)

router = APIRouter()


# ============================================================================
# REQUEST MODELS
# ============================================================================

class CreateTeamRequest(BaseModel):
    name: str

class UpdateTeamRequest(BaseModel):
    name: Optional[str] = None

class InviteMemberRequest(BaseModel):
    email: str
    role: str = "member"

class UpdateMemberRoleRequest(BaseModel):
    role: str

class AcceptInvitationRequest(BaseModel):
    user_id: str


# ============================================================================
# TEAM CRUD
# ============================================================================

@router.post("/api/teams")
async def create_team(req: CreateTeamRequest, x_user_id: str = Header(...)):
    team = team_service.create_team(x_user_id, req.name)
    team_audit_service.log_event(
        team["teamId"], x_user_id, AuditAction.TEAM_CREATED,
        {"teamName": req.name}
    )
    return team


@router.get("/api/teams")
async def list_teams(x_user_id: str = Header(...)):
    teams = team_service.list_user_teams(x_user_id)
    return {"teams": teams, "count": len(teams)}


@router.get("/api/teams/{team_id}")
async def get_team(team_id: str, x_user_id: str = Header(...)):
    role = team_member_service.get_user_role(team_id, x_user_id)
    if not role:
        raise HTTPException(status_code=403, detail="Not a member of this team")

    team = team_service.get_team(team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    members = team_member_service.list_members(team_id)
    pending = invitation_service.list_pending(team_id)

    return {
        "team": team,
        "members": members,
        "pendingInvitations": pending,
        "yourRole": role.value,
    }


@router.patch("/api/teams/{team_id}")
async def update_team(team_id: str, req: UpdateTeamRequest, x_user_id: str = Header(...)):
    role = team_member_service.get_user_role(team_id, x_user_id)
    if not role or not has_permission(role, "team.update"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    updates = {}
    if req.name is not None:
        updates["name"] = req.name

    team = team_service.update_team(team_id, updates)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    team_audit_service.log_event(team_id, x_user_id, AuditAction.TEAM_UPDATED, updates)
    return team


@router.delete("/api/teams/{team_id}")
async def delete_team(team_id: str, x_user_id: str = Header(...)):
    role = team_member_service.get_user_role(team_id, x_user_id)
    if not role or not has_permission(role, "team.delete"):
        raise HTTPException(status_code=403, detail="Only the owner can delete a team")

    team_service.delete_team(team_id)
    team_audit_service.log_event(team_id, x_user_id, AuditAction.TEAM_DELETED)
    return {"deleted": True}


# ============================================================================
# MEMBER MANAGEMENT
# ============================================================================

@router.get("/api/teams/{team_id}/members")
async def list_members(team_id: str, x_user_id: str = Header(...)):
    role = team_member_service.get_user_role(team_id, x_user_id)
    if not role:
        raise HTTPException(status_code=403, detail="Not a member")

    members = team_member_service.list_members(team_id)
    return {"members": members, "count": len(members)}


@router.post("/api/teams/{team_id}/members")
async def add_member_direct(team_id: str, req: InviteMemberRequest, x_user_id: str = Header(...)):
    role = team_member_service.get_user_role(team_id, x_user_id)
    if not role or not has_permission(role, "member.invite"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    target_role = TeamRole(req.role)
    membership = team_member_service.add_member(team_id, req.email, target_role, x_user_id)
    team_audit_service.log_event(
        team_id, x_user_id, AuditAction.MEMBER_JOINED,
        {"addedUserId": req.email, "role": req.role}
    )
    return membership


@router.patch("/api/teams/{team_id}/members/{user_id}")
async def update_member_role(team_id: str, user_id: str, req: UpdateMemberRoleRequest, x_user_id: str = Header(...)):
    role = team_member_service.get_user_role(team_id, x_user_id)
    if not role or not has_permission(role, "member.update_role"):
        raise HTTPException(status_code=403, detail="Only the owner can change roles")

    new_role = TeamRole(req.role)
    membership = team_member_service.update_role(team_id, user_id, new_role)
    if not membership:
        raise HTTPException(status_code=404, detail="Member not found")

    team_audit_service.log_event(
        team_id, x_user_id, AuditAction.MEMBER_ROLE_CHANGED,
        {"targetUserId": user_id, "newRole": req.role}
    )
    return membership


@router.delete("/api/teams/{team_id}/members/{user_id}")
async def remove_member(team_id: str, user_id: str, x_user_id: str = Header(...)):
    role = team_member_service.get_user_role(team_id, x_user_id)
    if not role or not has_permission(role, "member.remove"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    team_member_service.remove_member(team_id, user_id)
    team_audit_service.log_event(
        team_id, x_user_id, AuditAction.MEMBER_REMOVED,
        {"removedUserId": user_id}
    )
    return {"removed": True}


# ============================================================================
# INVITATIONS
# ============================================================================

@router.post("/api/teams/{team_id}/invitations")
async def create_invitation(team_id: str, req: InviteMemberRequest, x_user_id: str = Header(...)):
    role = team_member_service.get_user_role(team_id, x_user_id)
    if not role or not has_permission(role, "invitation.create"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    # Check seat limit
    team = team_service.get_team(team_id)
    if team:
        members = team_member_service.list_members(team_id)
        pending = invitation_service.list_pending(team_id)
        total = len(members) + len(pending)
        if total >= team.get("maxSeats", 5):
            raise HTTPException(status_code=400, detail="Team has reached its seat limit")

    target_role = TeamRole(req.role)
    invitation = invitation_service.create_invitation(team_id, req.email, target_role, x_user_id)
    team_audit_service.log_event(
        team_id, x_user_id, AuditAction.INVITATION_CREATED,
        {"email": req.email, "role": req.role, "token": invitation["token"]}
    )
    return invitation


@router.get("/api/teams/{team_id}/invitations")
async def list_invitations(team_id: str, x_user_id: str = Header(...)):
    role = team_member_service.get_user_role(team_id, x_user_id)
    if not role:
        raise HTTPException(status_code=403, detail="Not a member")

    invitations = invitation_service.list_pending(team_id)
    return {"invitations": invitations, "count": len(invitations)}


@router.delete("/api/teams/{team_id}/invitations/{token}")
async def revoke_invitation(team_id: str, token: str, x_user_id: str = Header(...)):
    role = team_member_service.get_user_role(team_id, x_user_id)
    if not role or not has_permission(role, "invitation.revoke"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    success = invitation_service.revoke_invitation(token)
    if not success:
        raise HTTPException(status_code=404, detail="Invitation not found")

    team_audit_service.log_event(
        team_id, x_user_id, AuditAction.INVITATION_REVOKED,
        {"token": token}
    )
    return {"revoked": True}


@router.post("/api/invitations/{token}/accept")
async def accept_invitation(token: str, req: AcceptInvitationRequest):
    success, team_id, role = invitation_service.accept_invitation(token, req.user_id)
    if not success:
        raise HTTPException(status_code=400, detail="Invalid or expired invitation")

    team_audit_service.log_event(
        team_id, req.user_id, AuditAction.INVITATION_ACCEPTED,
        {"token": token, "role": role}
    )
    return {"teamId": team_id, "role": role}


@router.get("/api/invitations/{token}/validate")
async def validate_invitation(token: str):
    invitation = invitation_service.validate_token(token)
    if not invitation:
        raise HTTPException(status_code=404, detail="Invalid or expired invitation")

    team = team_service.get_team(invitation["teamId"])
    return {
        "valid": True,
        "teamName": team["name"] if team else "Unknown Team",
        "role": invitation["role"],
        "invitedBy": invitation["invitedBy"],
    }


# ============================================================================
# AUDIT LOG
# ============================================================================

@router.get("/api/teams/{team_id}/audit")
async def get_audit_log(team_id: str, limit: int = 20, next_token: Optional[str] = None,
                        x_user_id: str = Header(...)):
    role = team_member_service.get_user_role(team_id, x_user_id)
    if not role or not has_permission(role, "team.view_audit"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    entries, new_token = team_audit_service.get_audit_log(team_id, limit, next_token)
    return {"entries": entries, "nextToken": new_token, "count": len(entries)}

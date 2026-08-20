import pytest
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from team_service import (
    TeamService, TeamMemberService, InvitationService, TeamAuditService,
    TeamRole, AuditAction, has_permission,
)


ALL_PERMISSIONS = [
    "team.view", "team.update", "team.delete", "team.manage_billing",
    "team.view_audit", "member.invite", "member.remove", "member.update_role",
    "campaign.view", "campaign.create", "campaign.delete",
    "brand_dna.view", "brand_dna.update",
    "invitation.create", "invitation.revoke",
]

OWNER_ALLOWED = ALL_PERMISSIONS

ADMIN_ALLOWED = [
    "team.view", "team.update", "team.view_audit",
    "member.invite", "member.remove",
    "campaign.view", "campaign.create", "campaign.delete",
    "brand_dna.view", "brand_dna.update",
    "invitation.create", "invitation.revoke",
]

MEMBER_ALLOWED = [
    "team.view", "campaign.view", "campaign.create",
    "brand_dna.view", "brand_dna.update",
]


# ============================================================================
# 1. Permission Matrix
# ============================================================================

class TestPermissionMatrix:
    def test_owner_has_all_15_permissions(self):
        for perm in ALL_PERMISSIONS:
            assert has_permission(TeamRole.OWNER, perm) is True, f"Owner missing {perm}"

    def test_owner_permission_count(self):
        count = sum(1 for p in ALL_PERMISSIONS if has_permission(TeamRole.OWNER, p))
        assert count == 15

    def test_admin_has_12_permissions(self):
        for perm in ADMIN_ALLOWED:
            assert has_permission(TeamRole.ADMIN, perm) is True, f"Admin missing {perm}"

    def test_admin_denied_three_permissions(self):
        denied = ["team.delete", "team.manage_billing", "member.update_role"]
        for perm in denied:
            assert has_permission(TeamRole.ADMIN, perm) is False, f"Admin should not have {perm}"

    def test_admin_permission_count(self):
        count = sum(1 for p in ALL_PERMISSIONS if has_permission(TeamRole.ADMIN, p))
        assert count == 12

    def test_member_has_5_permissions(self):
        for perm in MEMBER_ALLOWED:
            assert has_permission(TeamRole.MEMBER, perm) is True, f"Member missing {perm}"

    def test_member_permission_count(self):
        count = sum(1 for p in ALL_PERMISSIONS if has_permission(TeamRole.MEMBER, p))
        assert count == 5

    def test_member_denied_permissions(self):
        denied = [p for p in ALL_PERMISSIONS if p not in MEMBER_ALLOWED]
        for perm in denied:
            assert has_permission(TeamRole.MEMBER, perm) is False, f"Member should not have {perm}"

    def test_unknown_permission_returns_false(self):
        assert has_permission(TeamRole.OWNER, "nonexistent.permission") is False
        assert has_permission(TeamRole.ADMIN, "nonexistent.permission") is False
        assert has_permission(TeamRole.MEMBER, "nonexistent.permission") is False

    def test_role_not_in_permission_list(self):
        assert has_permission(TeamRole.MEMBER, "team.delete") is False
        assert has_permission(TeamRole.MEMBER, "team.manage_billing") is False
        assert has_permission(TeamRole.MEMBER, "member.update_role") is False
        assert has_permission(TeamRole.MEMBER, "member.invite") is False
        assert has_permission(TeamRole.MEMBER, "member.remove") is False
        assert has_permission(TeamRole.MEMBER, "campaign.delete") is False
        assert has_permission(TeamRole.MEMBER, "team.update") is False
        assert has_permission(TeamRole.MEMBER, "team.view_audit") is False
        assert has_permission(TeamRole.MEMBER, "invitation.create") is False
        assert has_permission(TeamRole.MEMBER, "invitation.revoke") is False


# ============================================================================
# 2. Team CRUD
# ============================================================================

class TestTeamService:
    def setup_method(self):
        self.ts = TeamService()
        self.ms = TeamMemberService()
        TeamService._teams_store.clear()
        TeamMemberService._members_store.clear()

    def test_create_team_returns_correct_fields(self):
        team = self.ts.create_team("user-1", "Test Team")
        assert team["name"] == "Test Team"
        assert team["ownerId"] == "user-1"
        assert team["teamId"].startswith("team-")
        assert team["maxSeats"] == 5
        assert "createdAt" in team
        assert "updatedAt" in team
        assert "settings" in team

    def test_create_team_owner_not_auto_added_in_memory(self):
        team = self.ts.create_team("user-1", "Test Team")
        role = self.ms.get_user_role(team["teamId"], "user-1")
        assert role is None

    def test_create_team_with_explicit_owner_membership(self):
        team = self.ts.create_team("user-1", "Test Team")
        self.ms.add_member(team["teamId"], "user-1", TeamRole.OWNER, "user-1")
        role = self.ms.get_user_role(team["teamId"], "user-1")
        assert role == TeamRole.OWNER

    def test_get_team(self):
        team = self.ts.create_team("user-1", "Test Team")
        fetched = self.ts.get_team(team["teamId"])
        assert fetched is not None
        assert fetched["teamId"] == team["teamId"]

    def test_get_team_not_found(self):
        assert self.ts.get_team("team-nonexistent") is None

    def test_list_user_teams(self):
        t1 = self.ts.create_team("user-1", "Team A")
        t2 = self.ts.create_team("user-1", "Team B")
        self.ms.add_member(t1["teamId"], "user-1", TeamRole.OWNER, "user-1")
        self.ms.add_member(t2["teamId"], "user-1", TeamRole.OWNER, "user-1")
        teams = self.ts.list_user_teams("user-1")
        ids = [t["teamId"] for t in teams]
        assert t1["teamId"] in ids
        assert t2["teamId"] in ids

    def test_list_user_teams_empty(self):
        assert self.ts.list_user_teams("user-nobody") == []

    def test_update_team(self):
        team = self.ts.create_team("user-1", "Old Name")
        original_updated = team["updatedAt"]
        updated = self.ts.update_team(team["teamId"], {"name": "New Name"})
        assert updated["name"] == "New Name"
        assert updated["updatedAt"] >= original_updated

    def test_update_team_not_found(self):
        result = self.ts.update_team("team-nonexistent", {"name": "X"})
        assert result is None

    def test_delete_team(self):
        team = self.ts.create_team("user-1", "Doomed")
        assert self.ts.delete_team(team["teamId"]) is True
        assert self.ts.get_team(team["teamId"]) is None

    def test_delete_team_returns_true(self):
        assert self.ts.delete_team("team-already-gone") is True


# ============================================================================
# 3. Team Member Service
# ============================================================================

class TestTeamMemberService:
    def setup_method(self):
        self.ms = TeamMemberService()
        TeamMemberService._members_store.clear()

    def test_add_member(self):
        m = self.ms.add_member("team-1", "user-2", TeamRole.MEMBER, "user-1")
        assert m["teamId"] == "team-1"
        assert m["userId"] == "user-2"
        assert m["role"] == "member"
        assert m["invitedBy"] == "user-1"
        assert m["status"] == "active"

    def test_get_membership(self):
        self.ms.add_member("team-1", "user-2", TeamRole.ADMIN, "user-1")
        m = self.ms.get_membership("team-1", "user-2")
        assert m is not None
        assert m["role"] == "admin"

    def test_get_membership_not_found(self):
        assert self.ms.get_membership("team-1", "nobody") is None

    def test_get_user_role(self):
        self.ms.add_member("team-1", "user-2", TeamRole.MEMBER, "user-1")
        assert self.ms.get_user_role("team-1", "user-2") == TeamRole.MEMBER

    def test_get_user_role_not_found(self):
        assert self.ms.get_user_role("team-1", "nobody") is None

    def test_update_role(self):
        self.ms.add_member("team-1", "user-2", TeamRole.MEMBER, "user-1")
        updated = self.ms.update_role("team-1", "user-2", TeamRole.ADMIN)
        assert updated["role"] == "admin"
        assert self.ms.get_user_role("team-1", "user-2") == TeamRole.ADMIN

    def test_update_role_nonexistent_member(self):
        result = self.ms.update_role("team-1", "nobody", TeamRole.ADMIN)
        assert result is None

    def test_remove_member(self):
        self.ms.add_member("team-1", "user-2", TeamRole.MEMBER, "user-1")
        assert self.ms.remove_member("team-1", "user-2") is True
        assert self.ms.get_membership("team-1", "user-2") is None

    def test_remove_member_not_found(self):
        assert self.ms.remove_member("team-1", "nobody") is True

    def test_list_members(self):
        self.ms.add_member("team-1", "user-1", TeamRole.OWNER, "user-1")
        self.ms.add_member("team-1", "user-2", TeamRole.MEMBER, "user-1")
        self.ms.add_member("team-2", "user-3", TeamRole.ADMIN, "user-3")
        members = self.ms.list_members("team-1")
        assert len(members) == 2
        user_ids = {m["userId"] for m in members}
        assert "user-1" in user_ids
        assert "user-2" in user_ids

    def test_list_members_empty(self):
        assert self.ms.list_members("team-empty") == []

    def test_list_user_memberships(self):
        self.ms.add_member("team-1", "user-2", TeamRole.MEMBER, "user-1")
        self.ms.add_member("team-2", "user-2", TeamRole.ADMIN, "user-3")
        memberships = self.ms.list_user_memberships("user-2")
        assert len(memberships) == 2

    def test_check_permission_owner(self):
        self.ms.add_member("team-1", "user-1", TeamRole.OWNER, "user-1")
        assert self.ms.check_permission("team-1", "user-1", "team.delete") is True
        assert self.ms.check_permission("team-1", "user-1", "team.manage_billing") is True

    def test_check_permission_admin(self):
        self.ms.add_member("team-1", "user-2", TeamRole.ADMIN, "user-1")
        assert self.ms.check_permission("team-1", "user-2", "team.view") is True
        assert self.ms.check_permission("team-1", "user-2", "team.delete") is False
        assert self.ms.check_permission("team-1", "user-2", "team.manage_billing") is False
        assert self.ms.check_permission("team-1", "user-2", "member.update_role") is False

    def test_check_permission_member(self):
        self.ms.add_member("team-1", "user-3", TeamRole.MEMBER, "user-1")
        assert self.ms.check_permission("team-1", "user-3", "campaign.view") is True
        assert self.ms.check_permission("team-1", "user-3", "campaign.create") is True
        assert self.ms.check_permission("team-1", "user-3", "brand_dna.view") is True
        assert self.ms.check_permission("team-1", "user-3", "brand_dna.update") is True
        assert self.ms.check_permission("team-1", "user-3", "team.view") is True
        assert self.ms.check_permission("team-1", "user-3", "team.delete") is False
        assert self.ms.check_permission("team-1", "user-3", "campaign.delete") is False

    def test_check_permission_nonexistent_member(self):
        assert self.ms.check_permission("team-1", "nobody", "team.view") is False


# ============================================================================
# 4. Invitation Service
# ============================================================================

class TestInvitationService:
    def setup_method(self):
        self.is_ = InvitationService()
        self.ms = TeamMemberService()
        InvitationService._invitations_store.clear()
        TeamMemberService._members_store.clear()

    def test_create_invitation(self):
        inv = self.is_.create_invitation("team-1", "alice@example.com", TeamRole.MEMBER, "user-1")
        assert inv["teamId"] == "team-1"
        assert inv["invitedEmail"] == "alice@example.com"
        assert inv["role"] == "member"
        assert inv["invitedBy"] == "user-1"
        assert inv["status"] == "pending"
        assert inv["token"]
        assert inv["expiresAt"]
        assert inv["createdAt"]

    def test_validate_token_pending(self):
        inv = self.is_.create_invitation("team-1", "alice@example.com", TeamRole.MEMBER, "user-1")
        validated = self.is_.validate_token(inv["token"])
        assert validated is not None
        assert validated["token"] == inv["token"]

    def test_validate_token_nonexistent(self):
        assert self.is_.validate_token("fake-token") is None

    def test_accept_invitation(self):
        inv = self.is_.create_invitation("team-1", "alice@example.com", TeamRole.MEMBER, "user-1")
        success, team_id, role = self.is_.accept_invitation(inv["token"], "user-alice")
        assert success is True
        assert team_id == "team-1"
        assert role == "member"
        mem = self.ms.get_membership("team-1", "user-alice")
        assert mem is not None
        assert mem["role"] == "member"

    def test_accept_invitation_token_becomes_invalid(self):
        inv = self.is_.create_invitation("team-1", "alice@example.com", TeamRole.MEMBER, "user-1")
        self.is_.accept_invitation(inv["token"], "user-alice")
        assert self.is_.validate_token(inv["token"]) is None

    def test_accept_invitation_twice_fails(self):
        inv = self.is_.create_invitation("team-1", "alice@example.com", TeamRole.ADMIN, "user-1")
        self.is_.accept_invitation(inv["token"], "user-alice")
        success, _, _ = self.is_.accept_invitation(inv["token"], "user-alice")
        assert success is False

    def test_accept_invalid_token(self):
        success, team_id, role = self.is_.accept_invitation("bad-token", "user-x")
        assert success is False
        assert team_id is None
        assert role is None

    def test_revoke_invitation(self):
        inv = self.is_.create_invitation("team-1", "alice@example.com", TeamRole.MEMBER, "user-1")
        assert self.is_.revoke_invitation(inv["token"]) is True
        assert self.is_.validate_token(inv["token"]) is None

    def test_revoke_nonexistent_token(self):
        assert self.is_.revoke_invitation("bad-token") is False

    def test_accept_rejected_invitation(self):
        inv = self.is_.create_invitation("team-1", "alice@example.com", TeamRole.MEMBER, "user-1")
        self.is_.revoke_invitation(inv["token"])
        success, _, _ = self.is_.accept_invitation(inv["token"], "user-alice")
        assert success is False

    def test_list_pending(self):
        self.is_.create_invitation("team-1", "a@x.com", TeamRole.MEMBER, "user-1")
        self.is_.create_invitation("team-1", "b@x.com", TeamRole.ADMIN, "user-1")
        self.is_.create_invitation("team-2", "c@x.com", TeamRole.MEMBER, "user-2")
        pending = self.is_.list_pending("team-1")
        assert len(pending) == 2
        emails = {p["invitedEmail"] for p in pending}
        assert "a@x.com" in emails
        assert "b@x.com" in emails

    def test_list_pending_excludes_accepted(self):
        inv = self.is_.create_invitation("team-1", "a@x.com", TeamRole.MEMBER, "user-1")
        self.is_.accept_invitation(inv["token"], "user-a")
        pending = self.is_.list_pending("team-1")
        assert len(pending) == 0

    def test_list_pending_empty(self):
        assert self.is_.list_pending("team-empty") == []

    def test_accept_invitation_with_admin_role(self):
        inv = self.is_.create_invitation("team-1", "bob@example.com", TeamRole.ADMIN, "user-1")
        success, team_id, role = self.is_.accept_invitation(inv["token"], "user-bob")
        assert success is True
        assert role == "admin"
        mem = self.ms.get_membership("team-1", "user-bob")
        assert mem["role"] == "admin"


# ============================================================================
# 5. Audit Service
# ============================================================================

class TestAuditService:
    def setup_method(self):
        self.audit = TeamAuditService()
        TeamAuditService._audit_store.clear()

    def test_log_event(self):
        self.audit.log_event("team-1", "user-1", AuditAction.TEAM_CREATED, {"name": "X"})
        entries, _ = self.audit.get_audit_log("team-1")
        assert len(entries) == 1
        e = entries[0]
        assert e["teamId"] == "team-1"
        assert e["userId"] == "user-1"
        assert e["action"] == "team.created"
        assert e["details"] == {"name": "X"}
        assert e["logId"]
        assert e["timestamp"]
        assert e["ttl"]

    def test_log_event_no_details(self):
        self.audit.log_event("team-1", "user-1", AuditAction.MEMBER_JOINED)
        entries, _ = self.audit.get_audit_log("team-1")
        assert entries[0]["details"] == {}

    def test_team_isolation(self):
        self.audit.log_event("team-1", "user-1", AuditAction.TEAM_CREATED)
        self.audit.log_event("team-1", "user-2", AuditAction.MEMBER_JOINED)
        self.audit.log_event("team-2", "user-3", AuditAction.TEAM_CREATED)

        t1_logs, _ = self.audit.get_audit_log("team-1")
        t2_logs, _ = self.audit.get_audit_log("team-2")
        assert len(t1_logs) == 2
        assert len(t2_logs) == 1
        assert t2_logs[0]["userId"] == "user-3"

    def test_get_audit_log_empty(self):
        entries, _ = self.audit.get_audit_log("team-empty")
        assert entries == []

    def test_get_audit_log_sorted_newest_first(self):
        import time
        self.audit.log_event("team-1", "user-1", AuditAction.TEAM_CREATED)
        time.sleep(0.01)
        self.audit.log_event("team-1", "user-1", AuditAction.TEAM_UPDATED)
        time.sleep(0.01)
        self.audit.log_event("team-1", "user-1", AuditAction.TEAM_DELETED)
        entries, _ = self.audit.get_audit_log("team-1")
        assert len(entries) == 3
        actions = [e["action"] for e in entries]
        assert actions[0] == "team.deleted"
        assert actions[1] == "team.updated"
        assert actions[2] == "team.created"

    def test_get_audit_log_limit(self):
        for i in range(5):
            self.audit.log_event("team-1", f"user-{i}", AuditAction.MEMBER_JOINED)
        entries, _ = self.audit.get_audit_log("team-1", limit=3)
        assert len(entries) == 3

    def test_multiple_actions_logged(self):
        actions = [
            AuditAction.TEAM_CREATED,
            AuditAction.INVITATION_CREATED,
            AuditAction.INVITATION_ACCEPTED,
            AuditAction.MEMBER_JOINED,
            AuditAction.CAMPAIGN_CREATED,
            AuditAction.BRAND_DNA_UPDATED,
        ]
        for a in actions:
            self.audit.log_event("team-1", "user-1", a)
        entries, _ = self.audit.get_audit_log("team-1")
        assert len(entries) == len(actions)

    def test_audit_entries_have_unique_log_ids(self):
        self.audit.log_event("team-1", "user-1", AuditAction.TEAM_CREATED)
        self.audit.log_event("team-1", "user-1", AuditAction.TEAM_UPDATED)
        entries, _ = self.audit.get_audit_log("team-1")
        ids = [e["logId"] for e in entries]
        assert len(ids) == len(set(ids))

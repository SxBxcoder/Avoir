/**
 * Avoir — Team/Workspace Collaboration Types
 *
 * Single source of truth for all team-related data models.
 * Used by both frontend (React components, API routes) and backend (Python service).
 */

// ============================================================================
// CORE TYPES
// ============================================================================

export type TeamRole = 'owner' | 'admin' | 'member';

export interface Team {
  teamId: string;
  name: string;
  ownerId: string;
  maxSeats: number;
  createdAt: string;
  updatedAt: string;
  settings: TeamSettings;
}

export interface TeamSettings {
  defaultBrandId?: string;
  allowMemberCampaignCreation?: boolean;
  creditPoolEnabled?: boolean;
}

export interface TeamMembership {
  teamId: string;
  userId: string;
  role: TeamRole;
  joinedAt: string;
  invitedBy: string;
  status: 'active' | 'pending' | 'disabled';
  displayName?: string;
  email?: string;
}

export interface Invitation {
  token: string;
  teamId: string;
  invitedEmail: string;
  invitedBy: string;
  role: TeamRole;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  createdAt: string;
  expiresAt: string;
  ttl: number; // epoch seconds — DynamoDB TTL
}

export interface AuditEntry {
  /** Present on team-scoped events; omitted for user-scoped ones (billing, cascade). */
  teamId?: string;
  logId: string; // UUID
  userId: string;
  action: AuditAction;
  details: Record<string, unknown>;
  timestamp: string;
  ttl: number; // epoch seconds — auto-delete after 90 days
}

// ============================================================================
// AUDIT ACTIONS
// ============================================================================

export type AuditAction =
  | 'team.created'
  | 'team.updated'
  | 'team.deleted'
  | 'member.joined'
  | 'member.removed'
  | 'member.role_changed'
  | 'invitation.created'
  | 'invitation.accepted'
  | 'invitation.revoked'
  | 'campaign.created'
  | 'campaign.deleted'
  | 'brand_dna.updated'
  // Billing lifecycle (Stripe webhook). User-scoped — teamId is null.
  | 'billing.checkout_completed'
  | 'billing.payment_succeeded'
  | 'billing.payment_failed'
  | 'billing.subscription_updated'
  | 'billing.subscription_deleted'
  // LLM cascade visibility. User-scoped — teamId is null.
  | 'cascade.tier_transition';

// ============================================================================
// PERMISSION TYPES
// ============================================================================

export type PermissionAction =
  | 'team.view'
  | 'team.update'
  | 'team.delete'
  | 'team.manage_billing'
  | 'team.view_audit'
  | 'member.invite'
  | 'member.remove'
  | 'member.update_role'
  | 'campaign.view'
  | 'campaign.create'
  | 'campaign.delete'
  | 'brand_dna.view'
  | 'brand_dna.update'
  | 'invitation.create'
  | 'invitation.revoke';

// ============================================================================
// EXTENDED EXISTING TYPES (backward-compatible additions)
// ============================================================================

/**
 * Extended Campaign with optional team scope.
 * The `teamId` field is optional — existing campaigns without a team
 * continue to work unchanged.
 */
export interface TeamScopedCampaign {
  teamId?: string;
  createdBy?: string; // userId of the member who created it
}

/**
 * Extended Brand DNA with optional team scope.
 */
export interface TeamScopedBrandDNA {
  teamId?: string;
  lastEditedBy?: string;
  lastEditedAt?: string;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateTeamRequest {
  name: string;
}

export interface UpdateTeamRequest {
  name?: string;
  settings?: Partial<TeamSettings>;
}

export interface InviteMemberRequest {
  email: string;
  role: TeamRole;
}

export interface UpdateMemberRoleRequest {
  role: TeamRole;
}

export interface AcceptInvitationResponse {
  teamId: string;
  teamName: string;
  role: TeamRole;
}

export interface TeamDashboardData {
  team: Team;
  members: TeamMembership[];
  pendingInvitations: Invitation[];
  recentAudit: AuditEntry[];
  stats: {
    totalCampaigns: number;
    totalMembers: number;
    creditsUsed: number;
  };
}

'use client';

/**
 * Avoir — Team Context Provider
 *
 * Provides team state across the app: current team, user's teams,
 * members, role, and team-specific helpers.
 *
 * Usage:
 *   <TeamProvider>
 *     <App />
 *   </TeamProvider>
 *
 *   const { currentTeam, userRole, switchTeam } = useTeam();
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/lib/auth/provider';
import { isDemoMode } from '@/lib/mockShield';
import { logger } from '@/lib/logger';
import type { Team, TeamMembership, Invitation, TeamRole } from './types';

// ============================================================================
// TYPES
// ============================================================================

interface TeamContextValue {
  /** All teams the current user belongs to. */
  teams: Team[];
  /** The currently active team (set by switchTeam or localStorage). */
  currentTeam: Team | null;
  /** The user's role in the current team. */
  userRole: TeamRole | null;
  /** Members of the current team. */
  members: TeamMembership[];
  /** Pending invitations for the current team. */
  pendingInvitations: Invitation[];
  /** True while team data is loading. */
  isLoading: boolean;
  /** True if no teams exist (user hasn't created or joined one). */
  hasNoTeams: boolean;
  /** Switch to a different team. */
  switchTeam: (teamId: string) => void;
  /** Create a new team. */
  createTeam: (name: string) => Promise<Team>;
  /** Refresh team data from the API. */
  refreshTeam: () => Promise<void>;
  /** Refresh the list of all user teams. */
  refreshTeams: () => Promise<void>;
}

const TeamContext = createContext<TeamContextValue | null>(null);

// ============================================================================
// DEMO DATA
// ============================================================================

const DEMO_TEAMS: Team[] = [
  {
    teamId: 'team-demo-001',
    name: 'Avoir Marketing',
    ownerId: 'demo-user',
    maxSeats: 10,
    createdAt: '2025-01-15T00:00:00.000Z',
    updatedAt: '2025-01-15T00:00:00.000Z',
    settings: { allowMemberCampaignCreation: true, creditPoolEnabled: true },
  },
  {
    teamId: 'team-demo-002',
    name: 'Brand Lab',
    ownerId: 'demo-user',
    maxSeats: 5,
    createdAt: '2025-02-10T00:00:00.000Z',
    updatedAt: '2025-02-10T00:00:00.000Z',
    settings: { allowMemberCampaignCreation: true, creditPoolEnabled: false },
  },
];

const DEMO_MEMBERS: TeamMembership[] = [
  { teamId: 'team-demo-001', userId: 'demo-user', role: 'owner', joinedAt: '2025-01-15T00:00:00.000Z', invitedBy: 'system', status: 'active', displayName: 'Demo User', email: 'demo@avoir.ai' },
  { teamId: 'team-demo-001', userId: 'user-2', role: 'admin', joinedAt: '2025-02-01T00:00:00.000Z', invitedBy: 'demo-user', status: 'active', displayName: 'Sarah Chen', email: 'sarah@avoir.ai' },
  { teamId: 'team-demo-001', userId: 'user-3', role: 'member', joinedAt: '2025-02-10T00:00:00.000Z', invitedBy: 'demo-user', status: 'active', displayName: 'Marcus Johnson', email: 'marcus@avoir.ai' },
];

const DEMO_INVITATIONS: Invitation[] = [
  {
    token: 'inv-demo-abc',
    teamId: 'team-demo-001',
    invitedEmail: 'newuser@avoir.ai',
    invitedBy: 'demo-user',
    role: 'member',
    status: 'pending',
    createdAt: '2025-03-01T00:00:00.000Z',
    expiresAt: '2025-03-08T00:00:00.000Z',
    ttl: 0,
  },
];

// ============================================================================
// PROVIDER
// ============================================================================

const STORAGE_KEY = 'avoir-active-team';

export function TeamProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [userRole, setUserRole] = useState<TeamRole | null>(null);
  const [members, setMembers] = useState<TeamMembership[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const headers = useMemo(() => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) h['Authorization'] = `Bearer ${accessToken}`;
    if (currentTeam) h['x-team-id'] = currentTeam.teamId;
    return h;
  }, [accessToken, currentTeam?.teamId]);

  const refreshTeams = useCallback(async () => {
    if (!user) {
      setTeams([]);
      setCurrentTeam(null);
      setIsLoading(false);
      return;
    }

    if (isDemoMode()) {
      setTeams(DEMO_TEAMS);
      const savedTeamId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      const saved = savedTeamId ? DEMO_TEAMS.find(t => t.teamId === savedTeamId) : DEMO_TEAMS[0];
      setCurrentTeam(saved || DEMO_TEAMS[0]);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/teams', { headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) throw new Error('Failed to fetch teams');
      const data = await res.json();
      const fetchedTeams: Team[] = data.teams || [];
      setTeams(fetchedTeams);

      // Restore saved team or default to first
      const savedTeamId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      const saved = savedTeamId ? fetchedTeams.find(t => t.teamId === savedTeamId) : fetchedTeams[0];
      setCurrentTeam(saved || fetchedTeams[0] || null);
    } catch (err) {
      logger.error('TeamContext', 'Failed to fetch teams', { err });
      setTeams([]);
      setCurrentTeam(null);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const refreshTeam = useCallback(async () => {
    if (!currentTeam || isDemoMode()) {
      if (isDemoMode() && currentTeam) {
        setMembers(DEMO_MEMBERS.filter(m => m.teamId === currentTeam.teamId));
        setUserRole('owner');
        setPendingInvitations(DEMO_INVITATIONS.filter(i => i.teamId === currentTeam.teamId));
      }
      return;
    }

    try {
      const res = await fetch(`/api/teams/${currentTeam.teamId}`, { headers });
      if (!res.ok) throw new Error('Failed to fetch team details');
      const data = await res.json();
      if (data.team) setCurrentTeam(data.team);
      if (data.members) setMembers(data.members);
      if (data.yourRole) setUserRole(data.yourRole);
      if (data.pendingInvitations) setPendingInvitations(data.pendingInvitations);
    } catch (err) {
      logger.error('TeamContext', 'Failed to fetch team details', { teamId: currentTeam.teamId, err });
    }
  }, [currentTeam?.teamId, headers]);

  const switchTeam = useCallback((teamId: string) => {
    const team = teams.find(t => t.teamId === teamId);
    if (team) {
      setCurrentTeam(team);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, teamId);
      }
    }
  }, [teams]);

  const createTeam = useCallback(async (name: string): Promise<Team> => {
    const res = await fetch('/api/teams', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create team' }));
      throw new Error(err.error || 'Failed to create team');
    }
    const team: Team = await res.json();
    setTeams(prev => [...prev, team]);
    setCurrentTeam(team);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, team.teamId);
    }
    return team;
  }, [headers]);

  // Load teams on mount
  useEffect(() => {
    refreshTeams();
  }, [refreshTeams]);

  // Load team details when currentTeam changes
  useEffect(() => {
    refreshTeam();
  }, [refreshTeam]);

  const value = useMemo<TeamContextValue>(
    () => ({
      teams,
      currentTeam,
      userRole,
      members,
      pendingInvitations,
      isLoading,
      hasNoTeams: !isLoading && teams.length === 0,
      switchTeam,
      createTeam,
      refreshTeam,
      refreshTeams,
    }),
    [teams, currentTeam, userRole, members, pendingInvitations, isLoading, switchTeam, createTeam, refreshTeam, refreshTeams]
  );

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

// ============================================================================
// HOOKS
// ============================================================================

export function useTeam(): TeamContextValue {
  const ctx = useContext(TeamContext);
  if (!ctx) {
    throw new Error('useTeam must be used within <TeamProvider>.');
  }
  return ctx;
}

/**
 * Check if the current user has a specific permission in the current team.
 */
export function useTeamPermission(permission: string): boolean {
  const { userRole } = useTeam();
  if (!userRole) return false;

  const PERMISSIONS: Record<string, TeamRole[]> = {
    'team.view':          ['owner', 'admin', 'member'],
    'team.update':        ['owner', 'admin'],
    'team.delete':        ['owner'],
    'team.manage_billing': ['owner'],
    'team.view_audit':    ['owner', 'admin'],
    'member.invite':      ['owner', 'admin'],
    'member.remove':      ['owner', 'admin'],
    'member.update_role': ['owner'],
    'campaign.view':      ['owner', 'admin', 'member'],
    'campaign.create':    ['owner', 'admin', 'member'],
    'campaign.delete':    ['owner', 'admin'],
    'brand_dna.view':     ['owner', 'admin', 'member'],
    'brand_dna.update':   ['owner', 'admin', 'member'],
    'invitation.create':  ['owner', 'admin'],
    'invitation.revoke':  ['owner', 'admin'],
  };

  return PERMISSIONS[permission]?.includes(userRole) ?? false;
}

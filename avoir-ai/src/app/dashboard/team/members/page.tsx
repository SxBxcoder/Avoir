'use client';

/**
 * Avoir — Team Members Page
 *
 * Full member management: list, add, remove, change roles.
 * Route: /dashboard/team/members
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserPlus,
  Trash2,
  Loader2,
  ArrowLeft,
  Search,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTeam, useTeamPermission } from '@/lib/teams/TeamContext';
import MemberAvatar, { ROLE_CONFIG } from '@/components/teams/MemberAvatar';
import type { TeamRole } from '@/lib/teams/types';

const springSmooth = { type: 'spring' as const, stiffness: 100, damping: 30 };
const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: springSmooth },
};

export default function TeamMembersPage() {
  const router = useRouter();
  const { currentTeam, members, refreshTeam, isLoading } = useTeam();
  const canInvite = useTeamPermission('member.invite');
  const canRemove = useTeamPermission('member.remove');
  const canChangeRole = useTeamPermission('member.update_role');

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('member');
  const [inviting, setInviting] = useState(false);
  const [search, setSearch] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);

  const filtered = members.filter(
    m => m.email?.toLowerCase().includes(search.toLowerCase()) ||
         m.displayName?.toLowerCase().includes(search.toLowerCase()) ||
         m.userId.toLowerCase().includes(search.toLowerCase())
  );

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !currentTeam) return;
    setInviting(true);
    try {
      const res = await fetch(`/api/teams/${currentTeam.teamId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to send invitation');
      }
      setInviteEmail('');
      setShowInvite(false);
      await refreshTeam();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!currentTeam) return;
    if (!confirm('Remove this member from the team?')) return;
    setRemovingId(userId);
    try {
      await fetch(`/api/teams/${currentTeam.teamId}/members/${userId}`, { method: 'DELETE' });
      await refreshTeam();
    } catch {
      alert('Failed to remove member');
    } finally {
      setRemovingId(null);
    }
  };

  const handleRoleChange = async (userId: string, newRole: TeamRole) => {
    if (!currentTeam) return;
    try {
      await fetch(`/api/teams/${currentTeam.teamId}/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      await refreshTeam();
    } catch {
      alert('Failed to update role');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-info animate-spin" />
      </div>
    );
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="p-6 space-y-6">
      {/* Header */}
      <motion.div variants={staggerItem} className="flex items-center gap-3">
        <button onClick={() => router.push('/dashboard/team')} className="p-2 rounded-lg hover:bg-muted/50 transition-colors">
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">Team Members</h1>
          <p className="text-xs text-muted-foreground">{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>
        {canInvite && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-3 py-2 bg-info text-white rounded-lg text-sm font-medium hover:bg-info/90 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Invite
          </button>
        )}
      </motion.div>

      {/* Invite Modal */}
      <AnimatePresence>
        {showInvite && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setShowInvite(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-xl p-6 w-full max-w-md mx-4"
            >
              <h2 className="text-lg font-semibold text-foreground mb-4">Invite Team Member</h2>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                placeholder="Email address"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-info/50 mb-3"
                autoFocus
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as TeamRole)}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground outline-none focus:border-info/50 mb-4"
              >
                <option value="member">Member — Can create campaigns</option>
                <option value="admin">Admin — Can manage members</option>
              </select>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowInvite(false)} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.trim()}
                  className="px-4 py-2 bg-info text-white rounded-lg text-sm font-medium hover:bg-info/90 transition-colors disabled:opacity-50"
                >
                  {inviting ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <motion.div variants={staggerItem} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search members..."
          className="w-full pl-9 pr-8 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-info/50"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </motion.div>

      {/* Member List */}
      <motion.div variants={staggerItem} className="space-y-2">
        {filtered.map((member) => (
          <div key={member.userId} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-info/20 transition-colors">
            <MemberAvatar
              displayName={member.displayName}
              email={member.email || member.userId}
              role={member.role}
              size="lg"
              showRole={false}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">
                {member.displayName || member.email || member.userId}
              </div>
              <div className="text-xs text-muted-foreground truncate">{member.email || member.userId}</div>
            </div>

            {/* Role Badge */}
            <div className={`px-2 py-1 rounded text-[10px] font-medium border ${ROLE_CONFIG[member.role].color}`}>
              {ROLE_CONFIG[member.role].label}
            </div>

            {/* Actions */}
            {canChangeRole && member.userId !== currentTeam?.ownerId && (
              <select
                value={member.role}
                onChange={(e) => handleRoleChange(member.userId, e.target.value as TeamRole)}
                className="px-2 py-1 bg-background border border-border rounded text-xs text-foreground outline-none"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            )}
            {canRemove && member.userId !== currentTeam?.ownerId && (
              <button
                onClick={() => handleRemove(member.userId)}
                disabled={removingId === member.userId}
                className="p-1.5 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger transition-colors"
              >
                {removingId === member.userId ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {search ? 'No members match your search' : 'No members yet'}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

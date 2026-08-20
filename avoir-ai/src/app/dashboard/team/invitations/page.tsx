'use client';

/**
 * Avoir — Team Invitations Page
 *
 * Manage pending invitations: create, revoke, copy invite links.
 * Route: /dashboard/team/invitations
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  Copy,
  Check,
  Trash2,
  Loader2,
  ArrowLeft,
  Clock,
  Send,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTeam, useTeamPermission } from '@/lib/teams/TeamContext';

const springSmooth = { type: 'spring' as const, stiffness: 100, damping: 30 };
const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: springSmooth },
};

function expiresIn(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'expired';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

export default function TeamInvitationsPage() {
  const router = useRouter();
  const { currentTeam, pendingInvitations, refreshTeam, isLoading } = useTeam();
  const canCreate = useTeamPermission('invitation.create');
  const canRevoke = useTeamPermission('invitation.revoke');

  const [showCreate, setShowCreate] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [creating, setCreating] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);

  const getInviteLink = (token: string) => {
    return `${window.location.origin}/invite/${token}`;
  };

  const copyLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(getInviteLink(token));
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      // Clipboard API may fail
    }
  };

  const handleCreate = async () => {
    if (!email.trim() || !currentTeam) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/teams/${currentTeam.teamId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create invitation');
      }
      setEmail('');
      setShowCreate(false);
      await refreshTeam();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create invitation');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (token: string) => {
    if (!currentTeam) return;
    if (!confirm('Revoke this invitation?')) return;
    setRevokingToken(token);
    try {
      await fetch(`/api/teams/${currentTeam.teamId}/invitations/${token}`, { method: 'DELETE' });
      await refreshTeam();
    } catch {
      alert('Failed to revoke invitation');
    } finally {
      setRevokingToken(null);
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
          <h1 className="text-xl font-bold text-foreground">Invitations</h1>
          <p className="text-xs text-muted-foreground">{pendingInvitations.length} pending</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-3 py-2 bg-info text-white rounded-lg text-sm font-medium hover:bg-info/90 transition-colors"
          >
            <Send className="w-4 h-4" />
            Invite
          </button>
        )}
      </motion.div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-xl p-6 w-full max-w-md mx-4"
            >
              <h2 className="text-lg font-semibold text-foreground mb-4">Send Invitation</h2>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="Email address"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-info/50 mb-3"
                autoFocus
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground outline-none focus:border-info/50 mb-4"
              >
                <option value="member">Member — Can create campaigns</option>
                <option value="admin">Admin — Can manage members</option>
              </select>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowCreate(false)} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating || !email.trim()}
                  className="px-4 py-2 bg-info text-white rounded-lg text-sm font-medium hover:bg-info/90 transition-colors disabled:opacity-50"
                >
                  {creating ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invitations List */}
      <motion.div variants={staggerItem} className="space-y-2">
        {pendingInvitations.map((inv) => (
          <div key={inv.token} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
            <div className="w-9 h-9 rounded-lg bg-info/10 border border-info/20 flex items-center justify-center flex-shrink-0">
              <Mail className="w-4 h-4 text-info" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">{inv.invitedEmail}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>Expires {expiresIn(inv.expiresAt)}</span>
                <span>·</span>
                <span className="capitalize">{inv.role}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => copyLink(inv.token)}
                className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                title="Copy invite link"
              >
                {copiedToken === inv.token ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
              {canRevoke && (
                <button
                  onClick={() => handleRevoke(inv.token)}
                  disabled={revokingToken === inv.token}
                  className="p-1.5 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger transition-colors"
                  title="Revoke invitation"
                >
                  {revokingToken === inv.token ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          </div>
        ))}

        {pendingInvitations.length === 0 && (
          <div className="text-center py-12">
            <Mail className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No pending invitations</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Invite teammates to collaborate</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
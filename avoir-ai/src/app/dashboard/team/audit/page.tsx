'use client';

/**
 * Avoir — Team Audit Log Page
 *
 * Paginated audit trail of all team events.
 * Route: /dashboard/team/audit
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Users,
  Megaphone,
  Settings,
  Activity,
  Lock,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTeam } from '@/lib/teams/TeamContext';
import type { AuditEntry, AuditAction } from '@/lib/teams/types';

const springSmooth = { type: 'spring' as const, stiffness: 100, damping: 30 };
const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: springSmooth },
};

const ACTION_CONFIG: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  'team.created':          { label: 'Team Created', icon: Settings, color: 'text-info' },
  'team.updated':          { label: 'Team Updated', icon: Settings, color: 'text-info' },
  'team.deleted':          { label: 'Team Deleted', icon: Settings, color: 'text-danger' },
  'member.joined':         { label: 'Member Joined', icon: Users, color: 'text-green-500' },
  'member.removed':        { label: 'Member Removed', icon: Users, color: 'text-danger' },
  'member.role_changed':   { label: 'Role Changed', icon: Shield, color: 'text-warning' },
  'invitation.created':    { label: 'Invitation Sent', icon: Activity, color: 'text-info' },
  'invitation.accepted':   { label: 'Invitation Accepted', icon: Activity, color: 'text-green-500' },
  'invitation.revoked':    { label: 'Invitation Revoked', icon: Lock, color: 'text-warning' },
  'campaign.created':      { label: 'Campaign Created', icon: Megaphone, color: 'text-info' },
  'campaign.deleted':      { label: 'Campaign Deleted', icon: Megaphone, color: 'text-danger' },
  'brand_dna.updated':     { label: 'Brand DNA Updated', icon: Settings, color: 'text-purple-500' },
};

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDetails(action: AuditAction, details: Record<string, unknown>): string {
  switch (action) {
    case 'team.created':
      return `Created team "${details.teamName}"`;
    case 'team.updated':
      return `Updated ${Object.keys(details).join(', ')}`;
    case 'member.joined':
      return `Added ${details.addedUserId || 'member'} as ${details.role}`;
    case 'member.removed':
      return `Removed ${details.removedUserId || 'member'}`;
    case 'member.role_changed':
      return `Changed ${details.targetUserId} to ${details.newRole}`;
    case 'invitation.created':
      return `Invited ${details.email} as ${details.role}`;
    case 'invitation.accepted':
      return `Accepted invitation (role: ${details.role})`;
    case 'invitation.revoked':
      return 'Revoked invitation';
    case 'campaign.created':
      return 'Created a campaign';
    case 'campaign.deleted':
      return 'Deleted a campaign';
    case 'brand_dna.updated':
      return 'Updated brand DNA';
    default:
      return JSON.stringify(details);
  }
}

export default function TeamAuditLogPage() {
  const router = useRouter();
  const { currentTeam, isLoading } = useTeam();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loadingLog, setLoadingLog] = useState(false);
  const [pageStack, setPageStack] = useState<string[]>([]);

  const fetchLog = useCallback(async (token?: string) => {
    if (!currentTeam) return;
    setLoadingLog(true);
    try {
      const params = new URLSearchParams({ limit: '20' });
      if (token) params.set('nextToken', token);
      const res = await fetch(`/api/teams/${currentTeam.teamId}/audit?${params}`);
      if (!res.ok) throw new Error('Failed to fetch audit log');
      const data = await res.json();
      setEntries(data.entries || []);
      setNextToken(data.nextToken || null);
    } catch {
      setEntries([]);
    } finally {
      setLoadingLog(false);
    }
  }, [currentTeam]);

  useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  const goNext = () => {
    if (nextToken) {
      setPageStack(prev => [...prev, nextToken]);
      fetchLog(nextToken);
    }
  };

  const goPrev = () => {
    const prev = pageStack[pageStack.length - 1];
    if (prev !== undefined) {
      setPageStack(s => s.slice(0, -1));
      fetchLog(prev);
    } else {
      fetchLog();
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
        <div>
          <h1 className="text-xl font-bold text-foreground">Audit Log</h1>
          <p className="text-xs text-muted-foreground">All team activity · 90-day retention</p>
        </div>
      </motion.div>

      {/* Log Entries */}
      <motion.div variants={staggerItem} className="space-y-1">
        {loadingLog ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-info animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12">
            <Shield className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No activity recorded yet</p>
          </div>
        ) : (
          entries.map((entry) => {
            const config = ACTION_CONFIG[entry.action] || { label: entry.action, icon: Shield, color: 'text-muted-foreground' };
            const Icon = config.icon;
            return (
              <div key={entry.logId} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors">
                <div className={`w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <Icon className={`w-4 h-4 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground">{formatDetails(entry.action, entry.details)}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span>{entry.userId}</span>
                    <span>·</span>
                    <span>{formatTimestamp(entry.timestamp)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </motion.div>

      {/* Pagination */}
      <motion.div variants={staggerItem} className="flex items-center justify-between">
        <button
          onClick={goPrev}
          disabled={pageStack.length === 0}
          className="flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Previous
        </button>
        <button
          onClick={goNext}
          disabled={!nextToken}
          className="flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next <ArrowRight className="w-4 h-4" />
        </button>
      </motion.div>
    </motion.div>
  );
}

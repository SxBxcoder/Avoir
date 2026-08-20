'use client';

/**
 * Avoir — Team Dashboard Page
 *
 * Overview of the current team: stats, recent activity, members preview.
 * Route: /dashboard/team
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Megaphone,
  CreditCard,
  Activity,
  ArrowRight,
  Loader2,
  Settings,
  Shield,
  Crown,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTeam, useTeamPermission } from '@/lib/teams/TeamContext';
import MemberAvatar from '@/components/teams/MemberAvatar';

const springSmooth = { type: 'spring' as const, stiffness: 100, damping: 30 };
const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: springSmooth },
};

export default function TeamDashboardPage() {
  const router = useRouter();
  const { currentTeam, userRole, members, pendingInvitations, isLoading, hasNoTeams, createTeam } = useTeam();
  const canViewAudit = useTeamPermission('team.view_audit');
  const canManageBilling = useTeamPermission('team.manage_billing');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-info animate-spin" />
      </div>
    );
  }

  if (hasNoTeams) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-info/10 border border-info/20 flex items-center justify-center mx-auto mb-6">
            <Users className="w-8 h-8 text-info" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Create Your Team</h1>
          <p className="text-sm text-muted-foreground mb-8">
            Set up a workspace to collaborate with your team on campaigns, brand DNA, and more.
          </p>
          <div className="flex items-center gap-2 justify-center">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && newName.trim() && handleCreate()}
              placeholder="Team name..."
              className="px-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-info/50 w-64"
              disabled={creating}
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="px-4 py-2.5 bg-info text-white rounded-lg text-sm font-medium hover:bg-info/90 transition-colors disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Team'}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!currentTeam) return null;

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createTeam(newName.trim());
    } catch {
      // error handled by context
    } finally {
      setCreating(false);
    }
  }

  const stats = [
    { label: 'Members', value: members.length, icon: Users, color: 'text-info' },
    { label: 'Pending Invites', value: pendingInvitations.length, icon: Activity, color: 'text-warning' },
    { label: 'Max Seats', value: currentTeam.maxSeats, icon: CreditCard, color: 'text-purple-500' },
    { label: 'Your Role', value: userRole?.charAt(0).toUpperCase() + (userRole?.slice(1) || ''), icon: userRole === 'owner' ? Crown : Shield, color: 'text-amber-500', isText: true },
  ];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="p-6 space-y-6">
      {/* Header */}
      <motion.div variants={staggerItem} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{currentTeam.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Team workspace · {members.length} member{members.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard/team?tab=settings')}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-muted/50 transition-colors text-sm text-muted-foreground hover:text-foreground"
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={staggerItem} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="p-4 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <div className="text-xl font-bold text-foreground">
              {stat.isText ? stat.value : stat.value}
            </div>
          </div>
        ))}
      </motion.div>

      {/* Members Preview */}
      <motion.div variants={staggerItem} className="p-5 rounded-xl bg-card border border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">Team Members</h2>
          <button
            onClick={() => router.push('/dashboard/team/members')}
            className="flex items-center gap-1 text-xs text-info hover:text-info/80 transition-colors"
          >
            View all <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="space-y-3">
          {members.slice(0, 5).map((member) => (
            <MemberAvatar
              key={member.userId}
              displayName={member.displayName}
              email={member.email || member.userId}
              role={member.role}
              size="md"
            />
          ))}
          {members.length > 5 && (
            <div className="text-xs text-muted-foreground pl-10">
              +{members.length - 5} more
            </div>
          )}
        </div>
      </motion.div>

      {/* Quick Links */}
      <motion.div variants={staggerItem} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => router.push('/dashboard/team/members')}
          className="p-4 rounded-xl bg-card border border-border hover:border-info/30 transition-colors text-left group"
        >
          <Users className="w-5 h-5 text-info mb-2 group-hover:scale-110 transition-transform" />
          <div className="text-sm font-medium text-foreground">Manage Members</div>
          <div className="text-xs text-muted-foreground mt-0.5">Add, remove, change roles</div>
        </button>
        <button
          onClick={() => router.push('/dashboard/team/invitations')}
          className="p-4 rounded-xl bg-card border border-border hover:border-info/30 transition-colors text-left group"
        >
          <Activity className="w-5 h-5 text-info mb-2 group-hover:scale-110 transition-transform" />
          <div className="text-sm font-medium text-foreground">Invitations</div>
          <div className="text-xs text-muted-foreground mt-0.5">Invite teammates by email</div>
        </button>
        {canViewAudit && (
          <button
            onClick={() => router.push('/dashboard/team/audit')}
            className="p-4 rounded-xl bg-card border border-border hover:border-info/30 transition-colors text-left group"
          >
            <Shield className="w-5 h-5 text-info mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-sm font-medium text-foreground">Audit Log</div>
            <div className="text-xs text-muted-foreground mt-0.5">Track all team activity</div>
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}

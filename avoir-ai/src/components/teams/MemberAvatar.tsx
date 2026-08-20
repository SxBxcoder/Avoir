'use client';

/**
 * Avoir — MemberAvatar + RoleBadge
 *
 * Displays a team member with their avatar, name, and role badge.
 * Used in team member lists, campaign activity feeds, etc.
 */

import { Shield, ShieldCheck, ShieldAlert } from 'lucide-react';
import type { TeamRole } from '@/lib/teams/types';

interface MemberAvatarProps {
  displayName?: string;
  email: string;
  role: TeamRole;
  size?: 'sm' | 'md' | 'lg';
  showRole?: boolean;
}

const ROLE_CONFIG: Record<TeamRole, { label: string; color: string; icon: typeof Shield }> = {
  owner: {
    label: 'Owner',
    color: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    icon: ShieldAlert,
  },
  admin: {
    label: 'Admin',
    color: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    icon: ShieldCheck,
  },
  member: {
    label: 'Member',
    color: 'bg-info/10 text-info border-info/20',
    icon: Shield,
  },
};

const SIZE_CLASSES = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
};

export default function MemberAvatar({
  displayName,
  email,
  role,
  size = 'md',
  showRole = true,
}: MemberAvatarProps) {
  const config = ROLE_CONFIG[role];
  const initials = (displayName || email)
    .split(' ')
    .map(w => w.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`${SIZE_CLASSES[size]} rounded-full bg-info/10 border border-info/20 flex items-center justify-center font-medium text-info flex-shrink-0`}
      >
        {initials}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-foreground truncate">
          {displayName || email.split('@')[0]}
        </div>
        {showRole && (
          <div className={`inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium border ${config.color}`}>
            <config.icon className="w-2.5 h-2.5" />
            {config.label}
          </div>
        )}
      </div>
    </div>
  );
}

export { ROLE_CONFIG };

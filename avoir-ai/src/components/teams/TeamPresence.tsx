'use client';

/**
 * Avoir — Team Presence Indicator
 *
 * Shows a row of online member avatars with a green dot indicator.
 * Used in the team dashboard and campaign pages.
 */

import { useState, useEffect } from 'react';
import { useTeam } from '@/lib/teams/TeamContext';
import { isDemoMode } from '@/lib/mockShield';
import { logger } from '@/lib/logger';
import type { TeamMembership } from '@/lib/teams/types';

interface OnlineMember {
  userId: string;
  displayName?: string;
  email?: string;
}

const DEMO_ONLINE: OnlineMember[] = [
  { userId: 'demo-user', displayName: 'Demo User', email: 'demo@avoir.ai' },
  { userId: 'user-2', displayName: 'Sarah Chen', email: 'sarah@avoir.ai' },
];

export default function TeamPresence() {
  const { currentTeam, members } = useTeam();
  const [online, setOnline] = useState<OnlineMember[]>([]);

  useEffect(() => {
    if (!currentTeam) return;

    if (isDemoMode()) {
      setOnline(DEMO_ONLINE);
      return;
    }

    const fetchPresence = async () => {
      try {
        // In production, this would call a presence API endpoint
        // For now, we show all members as potentially online
        setOnline(members.map(m => ({
          userId: m.userId,
          displayName: m.displayName,
          email: m.email,
        })));
      } catch {
        // Presence is non-critical
      }
    };

    fetchPresence();
    const interval = setInterval(fetchPresence, 30000);
    return () => clearInterval(interval);
  }, [currentTeam?.teamId, members]);

  if (online.length === 0) return null;

  const shown = online.slice(0, 5);
  const extra = online.length - shown.length;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex -space-x-2">
        {shown.map((member) => {
          const initials = (member.displayName || member.email || '?')
            .split(' ')
            .map(w => w.charAt(0))
            .join('')
            .toUpperCase()
            .slice(0, 2);

          return (
            <div key={member.userId} className="relative" title={member.displayName || member.email}>
              <div className="w-7 h-7 rounded-full bg-info/10 border-2 border-background flex items-center justify-center text-[10px] font-medium text-info">
                {initials}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-background" />
            </div>
          );
        })}
      </div>
      {extra > 0 && (
        <span className="text-[10px] text-muted-foreground">+{extra}</span>
      )}
      <span className="text-[10px] text-green-500 font-medium ml-1">
        {online.length} online
      </span>
    </div>
  );
}

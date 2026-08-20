'use client';

/**
 * Avoir — Team Switcher Component
 *
 * Dropdown menu in the sidebar that shows the current team name,
 * lets users switch between teams, and create new teams.
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ChevronDown, Plus, Check, Loader2 } from 'lucide-react';
import { useTeam } from '@/lib/teams/TeamContext';

export default function TeamSwitcher() {
  const { teams, currentTeam, switchTeam, createTeam, isLoading } = useTeam();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    setIsCreating(true);
    try {
      await createTeam(newTeamName.trim());
      setNewTeamName('');
      setIsOpen(false);
    } catch {
      // Error handled by TeamContext
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="px-3 py-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Loading teams...</span>
      </div>
    );
  }

  if (teams.length === 0) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 flex items-center gap-2 rounded-lg hover:bg-muted/50 transition-colors text-left group"
      >
        <div className="w-7 h-7 rounded-md bg-info/10 border border-info/20 flex items-center justify-center flex-shrink-0">
          <Users className="w-3.5 h-3.5 text-info" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-foreground truncate">
            {currentTeam?.name || 'Select Team'}
          </div>
          <div className="text-[10px] text-muted-foreground capitalize">
            {currentTeam ? 'Active workspace' : 'No team selected'}
          </div>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-lg overflow-hidden"
          >
            <div className="p-1">
              <div className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Workspaces
              </div>

              {teams.map((team) => (
                <button
                  key={team.teamId}
                  onClick={() => {
                    switchTeam(team.teamId);
                    setIsOpen(false);
                  }}
                  className="w-full px-2 py-1.5 flex items-center gap-2 rounded-md hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="w-6 h-6 rounded bg-info/10 border border-info/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-info">
                      {team.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="flex-1 text-xs text-foreground truncate">{team.name}</span>
                  {currentTeam?.teamId === team.teamId && (
                    <Check className="w-3 h-3 text-info flex-shrink-0" />
                  )}
                </button>
              ))}

              <div className="border-t border-border my-1" />

              {/* Create new team */}
              <div className="px-2 py-1">
                <div className="flex items-center gap-1.5">
                  <Plus className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <input
                    type="text"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateTeam()}
                    placeholder="New workspace..."
                    className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
                    disabled={isCreating}
                  />
                  {newTeamName.trim() && (
                    <button
                      onClick={handleCreateTeam}
                      disabled={isCreating}
                      className="px-2 py-0.5 text-[10px] font-medium bg-info/10 text-info rounded hover:bg-info/20 transition-colors"
                    >
                      {isCreating ? '...' : 'Create'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, LogOut, MessageSquare, Clock, Trash2, ChevronRight, Flame,
} from 'lucide-react';
import { type UserSubscription, PLANS } from '@/lib/stripe';
import { type CampaignHistoryItem } from './types';
import { smoothSpring, staggerContainer, staggerItem } from './configs';

interface CampaignSidebarProps {
  collapsed: boolean;
  onToggleSidebarCollapse: () => void;
  onLogout?: () => void;
  userEmail: string;
  isPaidUser: boolean;
  planName: string;
  subscription: UserSubscription | null;
  remaining: number;
  campaignHistory: CampaignHistoryItem[];
  activeCampaignId: string | null;
  onLoadCampaign: (campaign: CampaignHistoryItem) => void;
  onDeleteCampaign: (campaignId: string) => void;
  onNewDirective: () => void;
  onMobileClose: () => void;
  isMobileSidebarOpen: boolean;
}

export function CampaignSidebar({
  collapsed,
  onToggleSidebarCollapse,
  onLogout,
  userEmail,
  isPaidUser,
  planName,
  subscription,
  remaining,
  campaignHistory,
  activeCampaignId,
  onLoadCampaign,
  onDeleteCampaign,
  onNewDirective,
  onMobileClose,
  isMobileSidebarOpen,
}: CampaignSidebarProps) {
  return (
    <motion.aside
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
      animate={{ width: collapsed ? 72 : 300 }}
      transition={smoothSpring}
      className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-card/80 backdrop-blur-2xl border-r border-border/50 overflow-hidden
        lg:sticky lg:top-0 lg:h-screen lg:translate-x-0
        ${isMobileSidebarOpen ? 'translate-x-0 w-[80%] max-w-[300px]' : '-translate-x-full lg:translate-x-0'}
        transition-transform duration-300 lg:transition-none
      `}
    >
      <div className="p-4 border-b border-border/50 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2.5"
              >
                <div className="w-8 h-8 rounded-lg bg-info/10 border border-info flex items-center justify-center flex-shrink-0">
                  <Flame className="w-4 h-4 text-info" />
                </div>
                <h2 className="text-sm font-tactical font-bold text-foreground tracking-wider whitespace-nowrap">COMMAND CENTER</h2>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={onToggleSidebarCollapse}
              className="hidden lg:block p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <motion.div animate={{ rotate: collapsed ? 0 : 180 }} transition={smoothSpring}>
                <ChevronRight className="w-4 h-4" />
              </motion.div>
            </button>
            {onLogout && (
              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-danger"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onMobileClose}
              className="lg:hidden p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {!collapsed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground font-medium truncate">{userEmail}</p>
              <span className={`text-[10px] font-tactical font-bold px-2 py-0.5 rounded-md whitespace-nowrap ${
                isPaidUser ? 'bg-info/15 text-info border border-info' : 'bg-muted text-muted-foreground border border-border'
              }`}>
                {planName.toUpperCase()}
              </span>
            </div>

            {!isPaidUser && remaining >= 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-[10px] font-tactical text-muted-foreground mb-1.5">
                  <span>CAMPAIGNS</span>
                  <span className={remaining === 0 ? 'text-danger' : ''}>{subscription?.campaignsUsedThisMonth || 0}/{PLANS.free.campaignsPerMonth}</span>
                </div>
                <div className="w-full h-1.5 bg-muted/80 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${((subscription?.campaignsUsedThisMonth || 0) / PLANS.free.campaignsPerMonth) * 100}%` }}
                    transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                    className={`h-full rounded-full ${
                      remaining === 0 ? 'bg-gradient-to-r from-red-500 to-orange-500' :
                      remaining === 1 ? 'bg-gradient-to-r from-amber-500 to-yellow-500' :
                      'bg-gradient-to-r from-indigo-500 to-purple-500'
                    }`}
                  />
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-1.5">
          <motion.div variants={staggerItem}>
            <button
              onClick={onNewDirective}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl glass-card hover:border-info cursor-pointer transition-all group"
              title="New Directive"
            >
              <Plus className="w-4 h-4 text-info group-hover:text-info transition-colors flex-shrink-0" />
              {!collapsed && <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors whitespace-nowrap">New Directive</span>}
            </button>
          </motion.div>

          {!collapsed && (
            <motion.div variants={staggerItem} className="pt-3">
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-[10px] font-tactical text-muted-foreground tracking-widest">CAMPAIGN LIBRARY</span>
                <span className="text-[10px] text-zinc-600 font-mono">{campaignHistory.length}</span>
              </div>

              {campaignHistory.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <MessageSquare className="w-5 h-5 text-zinc-700 mx-auto mb-2" />
                  <p className="text-[11px] text-zinc-600">No campaigns yet.</p>
                  <p className="text-[10px] text-zinc-700 mt-0.5">Generate your first directive above.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {campaignHistory.map((campaign) => {
                    const isActive = activeCampaignId === campaign.campaignId;
                    const createdDate = new Date(campaign.createdAt);
                    const now = new Date();
                    const diffMs = now.getTime() - createdDate.getTime();
                    const diffMins = Math.floor(diffMs / 60000);
                    const diffHours = Math.floor(diffMins / 60);
                    const diffDays = Math.floor(diffHours / 24);
                    const timeAgo = diffMins < 1 ? 'Just now' :
                      diffMins < 60 ? `${diffMins}m ago` :
                      diffHours < 24 ? `${diffHours}h ago` :
                      diffDays < 7 ? `${diffDays}d ago` :
                      createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                    return (
                      <motion.button
                        key={campaign.campaignId}
                        whileHover={{ x: 2 }}
                        onClick={() => onLoadCampaign(campaign)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all group relative ${
                          isActive
                            ? 'bg-info/10 border-info shadow-[0_0_12px_rgba(99,102,241,0.08)]'
                            : 'bg-transparent border-transparent hover:bg-card/60 hover:border-border'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className={`text-[12px] font-medium leading-snug truncate ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {campaign.goal.length > 45 ? campaign.goal.slice(0, 45) + '\u2026' : campaign.goal}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] text-zinc-600 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {timeAgo}
                              </span>
                              <span className={`text-[8px] font-tactical font-bold px-1.5 py-0.5 rounded ${
                                campaign.tier?.includes('GEMINI') ? 'bg-cyan/10 text-cyan border border-cyan' :
                                campaign.tier?.includes('GPT') ? 'bg-success/10 text-success border border-success' :
                                'bg-muted text-muted-foreground border border-border'
                              }`}>
                                {campaign.tier?.replace('TIER_1_', '').replace('TIER_2_', '') || 'AI'}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); onDeleteCampaign(campaign.campaignId); }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-danger/20 rounded-lg transition-all flex-shrink-0 mt-0.5"
                            title="Delete campaign"
                          >
                            <Trash2 className="w-3 h-3 text-zinc-600 hover:text-danger" />
                          </button>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </motion.div>
      </div>

      <div className="flex-shrink-0 p-3 border-t border-border/50">
        <div className="px-3 py-2 rounded-lg bg-card/50 border border-border/50">
          <div className="flex items-center gap-2">
            <Flame className="w-3 h-3 text-warning" />
            <span className="text-[10px] font-tactical text-muted-foreground tracking-widest">AVOIR AI</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Quantitative Marketing Engine</p>
        </div>
      </div>
    </motion.aside>
  );
}

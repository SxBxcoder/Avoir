'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useSpring, useTransform, LayoutGroup } from 'framer-motion';
import { Send, Sparkles, Terminal, Activity, Database, Globe, Copy, Check, Zap, LogOut, Menu, X, Plus, Download, BookOpen, Crown, CreditCard, Flame, Radio, ChevronRight, MessageSquare, Target, Rocket, TrendingUp, Shield, Eye, PlayCircle, Video, Loader2, Trash2, Clock, Cpu, Share2 } from 'lucide-react';
import UpgradeModal from './UpgradeModal';
import NeuralNetworkCanvas from './NeuralNetworkCanvas';
import InteractivePlasmaCanvas from './InteractivePlasmaCanvas';
import CampaignGenome from './CampaignGenome';
import StrategicInterrogationPanel from './StrategicInterrogationPanel';
import OnboardingTour from './OnboardingTour';
import PerformanceReportPanel from './PerformanceReportPanel';
import { PlatformExportPanel } from './PlatformExportPanel';
import CompetitorIntelPanel from './CompetitorIntelPanel';
import TrendRadar from './TrendRadar';
import { clientLog } from '@/lib/logClient';
import { LiveArbitrageFeed } from './LiveArbitrageFeed';
import { CapitalDeploymentSimulator } from './CapitalDeploymentSimulator';
import { type UserSubscription, canGenerateCampaign, getRemainingCampaigns, PLANS, DEFAULT_SUBSCRIPTION } from '@/lib/stripe';

// ============================================================================
// TYPES
// ============================================================================

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  displayContent?: string;
}

interface CampaignReasoning {
  hook_rationale: string;
  offer_rationale: string;
  cta_rationale: string;
  confidence_score: number;
  audience_insight: string;
}

interface CampaignAsset {
  hook: string;
  offer: string;
  cta: string;
  reasoning?: CampaignReasoning;
  funnel?: {
    top: string;
    bottom: string;
  };
}

interface GenomePredictedScores {
  virality: number;
  conversion: number;
  retention: number;
  brand_trust: number;
  shareability: number;
}

interface GenomeVariant {
  genome_type: 'virality' | 'conversion' | 'authority';
  plan: CampaignAsset;
  captions: string[];
  predicted_scores: GenomePredictedScores;
}

interface CampaignData {
  campaignId?: string;
  plan: CampaignAsset;
  captions: string[];
  image_url?: string;
  messages?: Message[];
  status?: string;
}

interface CampaignHistoryItem {
  campaignId: string;
  goal: string;
  plan: CampaignAsset;
  captions: string[];
  imageUrl?: string;
  image_url?: string;
  messages: Array<{ role: string; content: string; displayContent?: string }>;
  tier: string;
  status: 'completed' | 'failed' | 'pending';
  createdAt: string;
  updatedAt: string;
  isWinner?: boolean; // P1: Campaign Memory Flywheel flag
}

interface CampaignDashboardProps {
  accessToken: string;
  userEmail: string;
  onLogout?: () => void;
  /** When true, renders only the chat/canvas content without sidebar, mobile header, or status bar. Use inside the dashboard layout. */
  embedded?: boolean;
}

// ============================================================================
// SPRING ANIMATION CONFIGS
// ============================================================================

const springConfig = { type: 'spring' as const, stiffness: 300, damping: 30 };
const bouncySpring = { type: 'spring' as const, stiffness: 400, damping: 20 };
const gentleSpring = { type: 'spring' as const, stiffness: 200, damping: 25 };
const smoothSpring = { type: 'spring' as const, stiffness: 100, damping: 30 };

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: springConfig },
};

// ============================================================================
// ANIMATED GRID BACKGROUND
// ============================================================================

function AnimatedGridBG() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {/* Radial gradient orbs */}
      <motion.div
        animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/4 left-1/3 w-[600px] h-[600px] bg-gradient-radial from-indigo-500/8 via-purple-500/4 to-transparent rounded-full blur-3xl"
      />
      <motion.div
        animate={{ x: [0, -30, 0], y: [0, 40, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-gradient-radial from-cyan-500/5 via-transparent to-transparent rounded-full blur-3xl"
      />
      <motion.div
        animate={{ x: [0, 20, 0], y: [0, -20, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/2 right-1/3 w-[400px] h-[400px] bg-gradient-radial from-purple-500/5 via-transparent to-transparent rounded-full blur-3xl"
      />
      {/* Subtle grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--grid-color)_1px,transparent_1px),linear-gradient(to_bottom,var(--grid-color)_1px,transparent_1px)] bg-[size:48px_48px]" />
    </div>
  );
}

// ============================================================================
// FLOATING PARTICLES
// ============================================================================

function FloatingParticles() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {[...Array(15)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-info/20"
          style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
          animate={{
            y: [0, -40, 0],
            opacity: [0.1, 0.4, 0.1],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: 4 + Math.random() * 5,
            repeat: Infinity,
            delay: Math.random() * 3,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// COOKING STATUS COMPONENT
// ============================================================================

function CookingStatus({ messages }: { messages: string[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={bouncySpring}
      className="flex justify-start"
    >
      <div className="max-w-[90%] sm:max-w-[85%] lg:max-w-[70%] rounded-2xl p-4 sm:p-5 glass-card glow-border-active overflow-hidden">
        <div className="flex items-center gap-3 mb-4">
          <div className="pulse-ring relative w-3 h-3 rounded-full bg-info flex-shrink-0" />
          <span className="text-sm font-tactical tracking-widest text-info font-bold">
            DIAMOND CASCADE ACTIVE
          </span>
        </div>
        
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {messages.map((msg, idx) => (
              <motion.div
                key={`${idx}-${msg}`}
                initial={{ opacity: 0, x: -20, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                transition={{ ...gentleSpring, delay: idx * 0.05 }}
                className="flex items-center gap-2"
              >
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={bouncySpring}
                  className={`text-xs ${idx === messages.length - 1 ? 'text-info' : 'text-zinc-600'}`}
                >
                  {msg}
                </motion.span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Cooking dots */}
        <div className="cooking-loader mt-4">
          <div className="cooking-dots">
            <span /><span /><span />
          </div>
          <span className="text-xs font-tactical text-muted-foreground">Processing...</span>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// MAGNETIC BUTTON COMPONENT
// ============================================================================

function MagneticButton({
  children,
  onClick,
  disabled,
  className = '',
  variant = 'primary',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  variant?: 'primary' | 'ghost';
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useSpring(0, { stiffness: 300, damping: 20 });
  const y = useSpring(0, { stiffness: 300, damping: 20 });

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current || disabled) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set((e.clientX - centerX) * 0.15);
    y.set((e.clientY - centerY) * 0.15);
  }, [disabled, x, y]);

  const handleMouseLeave = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  return (
    <motion.button
      ref={ref}
      style={{ x, y }}
      onClick={onClick}
      disabled={disabled}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileTap={{ scale: 0.97 }}
      className={`magnetic-btn ${variant === 'primary' ? 'btn-primary' : 'btn-ghost'} ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
    >
      {children}
    </motion.button>
  );
}

// ============================================================================
// WELCOME SCREEN — Shown when no messages
// ============================================================================

function WelcomeScreen({ onQuickAction }: { onQuickAction: (text: string) => void }) {
  const quickActions = [
    { icon: <Rocket className="w-4 h-4" />, label: 'Product Launch', prompt: 'Create a viral campaign for my new product launch targeting global Gen-Z', color: 'from-indigo-500/20 to-purple-500/20', border: 'border-info', iconColor: 'text-info' },
    { icon: <TrendingUp className="w-4 h-4" />, label: 'Brand Awareness', prompt: 'Generate a high-converting brand awareness campaign for Instagram and YouTube', color: 'from-purple-500/20 to-pink-500/20', border: 'border-primary', iconColor: 'text-primary' },
    { icon: <Target className="w-4 h-4" />, label: 'Event Promotion', prompt: 'Create a social media campaign to promote my upcoming event in New York', color: 'from-cyan-500/20 to-blue-500/20', border: 'border-cyan', iconColor: 'text-cyan' },
    { icon: <Flame className="w-4 h-4" />, label: 'Viral Content', prompt: 'Generate viral meme-worthy captions for my streetwear brand', color: 'from-orange-500/20 to-red-500/20', border: 'border-orange-500/20', iconColor: 'text-orange-400' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="absolute inset-0 flex flex-col items-center justify-center px-4 sm:px-6 overflow-auto"
    >
      <NeuralNetworkCanvas />
      
      <div className="relative z-10 flex flex-col items-center w-full max-w-4xl">

      {/* Animated logo */}
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={bouncySpring}
        className="mb-8"
      >
        <motion.div
          animate={{ 
            boxShadow: [
              '0 0 20px rgba(99,102,241,0.1)',
              '0 0 40px rgba(99,102,241,0.2)',
              '0 0 20px rgba(99,102,241,0.1)',
            ]
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-info flex items-center justify-center"
        >
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Sparkles className="w-10 h-10 text-info" />
          </motion.div>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...smoothSpring, delay: 0.2 }}
        className="text-center mb-10"
      >
        <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-3">
          What would you like to{' '}
          <span className="fluid-text-hero">create?</span>
        </h2>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Enter your campaign goal below or pick a quick action to get started
        </p>
      </motion.div>

      {/* Quick Action Cards */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg"
      >
        {quickActions.map((action) => (
          <motion.button
            key={action.label}
            variants={staggerItem}
            whileHover={{ y: -4, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onQuickAction(action.prompt)}
            className={`group glass-card glow-border rounded-xl p-4 text-left cursor-pointer transition-all hover:border-border`}
          >
            <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${action.color} flex items-center justify-center mb-3 border ${action.border} ${action.iconColor}`}>
              {action.icon}
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">{action.label}</p>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{action.prompt}</p>
          </motion.button>
        ))}
      </motion.div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// JSON PARSER — Extract campaign data
// ============================================================================

function extractCampaignData(text: string): { campaign: CampaignData | null; displayMessage: string } {
  try {
    let jsonStr = text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];
    
    const parsed = JSON.parse(jsonStr);
    const hook = parsed.plan?.hook || parsed.hook || '';
    const offer = parsed.plan?.offer || parsed.offer || '';
    const cta = parsed.plan?.cta || parsed.cta || '';
    const captions = parsed.captions || [];
    
    if (hook || captions.length > 0) {
      return {
        campaign: {
          plan: { hook, offer, cta },
          captions,
          image_url: parsed.imageUrl || parsed.image_url,
          campaignId: parsed.campaignId,
          status: parsed.status,
        },
        displayMessage: '✅ Strategic Campaign Compiled. See the Canvas below.',
      };
    }
  } catch (e) { /* not JSON */ }
  
  return { campaign: null, displayMessage: text };
}

// ============================================================================
// MAIN DASHBOARD
// ============================================================================

export default function CampaignDashboard({ accessToken, userEmail, onLogout, embedded = false }: CampaignDashboardProps) {
  // Chat States
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Campaign States
  const [currentCampaign, setCurrentCampaign] = useState<CampaignData | null>(null);
  
  // Subscription States
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  
  // SSE Streaming States
  const [cookingMessages, setCookingMessages] = useState<string[]>([]);
  
  // UI States
  const [copied, setCopied] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState({
    tier: 'STANDBY',
    dbSync: 'OK',
    region: 'US-EAST-1',
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Synthetic Focus Group States
  const [simulationPhase, setSimulationPhase] = useState<'idle' | 'running' | 'complete'>('idle');
  const [simulationData, setSimulationData] = useState<{
    simulation: Array<{ name: string, role: string, critique: string, approved: boolean }>;
    predicted_score: number;
  } | null>(null);
  
  // Shadow Clone States
  const [shadowCloneStatus, setShadowCloneStatus] = useState<{step: number, message: string} | null>(null);
  const [shadowCloneVideo, setShadowCloneVideo] = useState<string | null>(null);
  const [isShadowModalOpen, setIsShadowModalOpen] = useState(false);

  // Client Approval Sharing State
  const [isSharing, setIsSharing] = useState(false);

  // P0-A: Reasoning Engine States
  const [reasoningExpanded, setReasoningExpanded] = useState<Record<string, boolean>>({});

  // P0-B: Campaign Genome States
  const [genomeMode, setGenomeMode] = useState(false);
  const [genomeVariants, setGenomeVariants] = useState<GenomeVariant[] | null>(null);

  // P1-B: Strategic Interrogation States
  const [showInterrogation, setShowInterrogation] = useState(false);
  const [interrogationAnswers, setInterrogationAnswers] = useState<{
    audience: string | null;
    platform: string[] | null;
    objective: string | null;
  }>({ audience: null, platform: null, objective: null });
  const [pendingDirective, setPendingDirective] = useState<string>('');
  const [intelligenceLevel, setIntelligenceLevel] = useState<string>('BRONZE');

  // P0: Moat Building States
  const [showPerformanceReport, setShowPerformanceReport] = useState(false);
  const [showPlatformExport, setShowPlatformExport] = useState(false);
  
  // P2: Competitor Intel
  const [showCompetitorIntel, setShowCompetitorIntel] = useState(false);

  // P4: Campaign Library States
  const [campaignHistory, setCampaignHistory] = useState<CampaignHistoryItem[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [showDeploymentSimulator, setShowDeploymentSimulator] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // P4: Fetch campaign list
  const refreshCampaignList = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns?limit=30`, {
        headers: accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setCampaignHistory(prev => {
          const apiCampaigns = data.campaigns || [];
          const apiIds = new Set(apiCampaigns.map((c: any) => c.campaignId));
          const merged = [...apiCampaigns];
          // Keep local fallback campaigns that aren't in DynamoDB yet (or ever, in local dev)
          prev.forEach(p => {
            if (!apiIds.has(p.campaignId)) {
              merged.push(p);
            }
          });
          return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        });
      }
    } catch (err) {
      clientLog.error('Failed to load campaign history:', err);
    }
  }, [accessToken]);

  // P4: Load a past campaign into the active canvas
  const loadCampaign = useCallback((campaign: CampaignHistoryItem) => {
    setActiveCampaignId(campaign.campaignId);
    setCurrentCampaign({
      campaignId: campaign.campaignId,
      plan: campaign.plan,
      captions: campaign.captions,
      image_url: campaign.imageUrl || campaign.image_url,
      messages: campaign.messages as Message[],
      status: campaign.status,
    });
    // Restore messages
    if (campaign.messages && campaign.messages.length > 0) {
      setMessages(campaign.messages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        displayContent: m.displayContent,
      })));
    } else {
      // Rebuild minimal message thread from goal
      setMessages([
        { role: 'user', content: campaign.goal },
        { role: 'assistant', content: '✅ Strategic Campaign Compiled.', displayContent: '✅ Strategic Campaign Compiled. See the Canvas below.' },
      ]);
    }
    setGenomeVariants(null);
    setCookingMessages([]);
    setSystemStatus(prev => ({ ...prev, tier: 'ACTIVE', dbSync: 'SYNCED' }));
    setIsMobileSidebarOpen(false);
  }, []);

  // P4: Delete a campaign
  const deleteCampaign = useCallback(async (campaignId: string) => {
    try {
      await fetch(`/api/campaigns?campaignId=${encodeURIComponent(campaignId)}`, {
        method: 'DELETE',
        headers: accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {},
      });
      setCampaignHistory(prev => prev.filter(c => c.campaignId !== campaignId));
      if (activeCampaignId === campaignId) {
        setActiveCampaignId(null);
        setMessages([]);
        setCurrentCampaign(null);
      }
    } catch (err) {
      clientLog.error('Failed to delete campaign:', err);
    }
  }, [activeCampaignId, accessToken]);

  // Fetch subscription, intelligence state, and campaign history on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [subRes, intelRes] = await Promise.all([
          fetch(`/api/stripe/subscription`, {
            headers: accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {},
          }),
          fetch(`/api/intelligence`, {
            headers: accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {},
          })
        ]);

        if (subRes.ok) {
          const subData = await subRes.json();
          setSubscription(subData);
        }
        
        if (intelRes.ok) {
          const intelData = await intelRes.json();
          if (intelData.brief) {
            setIntelligenceLevel(intelData.brief.level);
          }
        }
      } catch (err) {
        clientLog.error('Failed to fetch data:', err);
        setSubscription({ ...DEFAULT_SUBSCRIPTION, userId: '' });
      }
    };
    fetchData();
    refreshCampaignList();
  }, [accessToken, refreshCampaignList]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, cookingMessages]);

  // Handle Trend Snipe Redirect
  useEffect(() => {
    const snipe = localStorage.getItem('trend_snipe');
    if (snipe) {
      setInputValue(snipe);
      localStorage.removeItem('trend_snipe');
    }
  }, []);

  // Derived subscription info
  const currentTier = subscription?.tier || 'free';
  const isPaidUser = currentTier !== 'free';
  const remaining = subscription ? getRemainingCampaigns(subscription) : 3;
  const planName = PLANS[currentTier]?.name || 'Starter';
  const sidebarWidth = sidebarCollapsed ? 'w-[72px]' : 'w-[300px]';

  // ========================================================================
  // SSE STREAMING GENERATE
  // ========================================================================
  const shouldInterrogate = (goal: string) => {
    // If the prompt is less than 30 characters or 5 words, trigger interrogation
    return goal.length < 30 || goal.split(' ').length < 5;
  };

  const handleMarkWinner = async () => {
    if (!activeCampaignId) return;
    
    // Update local state immediately
    setCampaignHistory(prev => 
      prev.map(c => c.campaignId === activeCampaignId ? { ...c, isWinner: true } : c)
    );

    // Call API (silent fail if offline)
    try {
      await fetch('/api/campaigns/score', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          campaignId: activeCampaignId,
          isWinner: true
        })
      });
    } catch (err) {
      clientLog.warn("Could not save winner status to DB (local dev).");
    }
  };

  const handleShareWithClient = async () => {
    if (!currentCampaign) return;
    setIsSharing(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/agency/share-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_data: {
            hook: currentCampaign.plan.hook,
            offer: currentCampaign.plan.offer,
            cta: currentCampaign.plan.cta,
            captions: currentCampaign.captions,
            image_url: currentCampaign.image_url,
          }
        })
      });
      const data = await res.json();
      const fullUrl = `${window.location.origin}${data.share_url}`;
      
      await navigator.clipboard.writeText(fullUrl);
      window.open(fullUrl, '_blank');
      setCopied('share-link');
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      clientLog.error("Failed to share:", err);
    } finally {
      setIsSharing(false);
    }
  };

  const handleGenerate = async (overrideInput?: string) => {
    const goal = overrideInput || inputValue;
    if (!goal.trim() || isGenerating) return;

    if (subscription && !canGenerateCampaign(subscription)) {
      setShowUpgradeModal(true);
      return;
    }

    if (!overrideInput && shouldInterrogate(goal)) {
      setPendingDirective(goal);
      setShowInterrogation(true);
      return;
    }

    const finalGoal = overrideInput || goal;
    const userMessage: Message = { role: 'user', content: finalGoal };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsGenerating(true);
    setCurrentCampaign(null);
    setGenomeVariants(null);
    setSimulationPhase('idle');
    setSimulationData(null);
    setShowInterrogation(false);
    setCookingMessages(['🔥 Initializing Diamond Cascade Engine...']);
    setSystemStatus(prev => ({ ...prev, tier: 'TIER_1' }));

    try {
      // 1. Pre-Trade Research Simulation (AI Hedge Fund flow)
      setSystemStatus(prev => ({ ...prev, dbSync: 'SCANNING' }));
      
      const researchSteps = [
        '📡 Establishing connection to Global Ad Exchanges...',
        '🔍 Scraping TikTok API for trending audio anomalies...',
        '📊 Analyzing Reddit sentiment on subcultures...',
        '🧠 Formulating Investment Thesis...',
        '⚡ Deploying Diamond Cascade Engine...'
      ];

      for (const step of researchSteps) {
        setCookingMessages([step]);
        await new Promise(r => setTimeout(r, 700));
      }
      
      setSystemStatus(prev => ({ ...prev, dbSync: 'SYNCED' }));

      // P1: Campaign Memory Flywheel — Inject past winners
      const winningCampaigns = campaignHistory.filter(c => c.isWinner);
      const pastWinningContext = winningCampaigns.length > 0 
        ? winningCampaigns.map(c => `WINNING HOOK: "${c.plan?.hook}" | WINNING OFFER: "${c.plan?.offer}"`).join('\n')
        : undefined;

      const response = await fetch('/api/generate/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          goal: finalGoal,
          messages: messages.concat(userMessage),
          genome_mode: genomeMode,
          pastWinningContext,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.upgradeRequired) {
          setShowUpgradeModal(true);
          setIsGenerating(false);
          return;
        }
        throw new Error(errorData.error || 'Generation failed');
      }

      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('text/event-stream') && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('event: ')) {
              const eventType = line.slice(7).trim();
              const nextLine = lines[i + 1];
              if (nextLine?.startsWith('data: ')) {
                try {
                  const data = JSON.parse(nextLine.slice(6));
                  clientLog.debug(`[SSE] Received event: ${eventType}`, data);
                  
                  switch (eventType) {
                    case 'status':
                      setCookingMessages(prev => [...prev, data.message]);
                      break;
                    case 'simulation_start':
                      setSimulationPhase('running');
                      break;
                    case 'simulation_result':
                      setSimulationData({
                        simulation: data.simulation,
                        predicted_score: data.predicted_score
                      });
                      setSimulationPhase('complete');
                      break;
                    case 'campaign':
                      const campaignData: CampaignData = {
                        plan: {
                          hook: data.hook || '',
                          offer: data.offer || '',
                          cta: data.cta || '',
                          reasoning: data.reasoning || undefined,
                        },
                        captions: data.captions || [],
                        image_url: data.imageUrl,
                        campaignId: data.campaignId,
                        status: data.status,
                      };
                      setCurrentCampaign(campaignData);
                      // P4: Track in local history (works even without DynamoDB)
                      const localId = data.campaignId || `local-${Date.now()}`;
                      setActiveCampaignId(localId);
                      setCampaignHistory(prev => {
                        // Don't duplicate if already in list
                        if (prev.some(c => c.campaignId === localId)) return prev;
                        const newItem: CampaignHistoryItem = {
                          campaignId: localId,
                          goal: finalGoal,
                          plan: campaignData.plan,
                          captions: campaignData.captions,
                          imageUrl: data.imageUrl,
                          messages: [],
                          tier: 'TIER_1_GEMINI',
                          status: 'completed',
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                        };
                        return [newItem, ...prev];
                      });
                      if (subscription) {
                        setSubscription((prev) => prev ? { ...prev, credits: Math.max(0, prev.credits - (genomeMode ? 2 : 1)) } : prev);
                      }
                      setSystemStatus(prev => ({ ...prev, tier: 'ACTIVE', dbSync: 'SYNCED' }));
                      break;
                    case 'genome':
                      if (data.variants && Array.isArray(data.variants)) {
                        setGenomeVariants(data.variants);
                        if (subscription) {
                          setSubscription((prev) => prev ? { ...prev, credits: Math.max(0, prev.credits - 2) } : prev);
                        }
                      }
                      break;
                    case 'error':
                      throw new Error(data.message);
                    case 'done':
                      // P4: Refresh campaign list after successful generation
                      refreshCampaignList();
                      break;
                  }
                } catch (parseErr) { /* skip */ }
              }
            }
          }
        }

        const assistantMessage: Message = {
          role: 'assistant',
          content: '✅ Strategic Campaign Compiled.',
          displayContent: '✅ Strategic Campaign Compiled. See the Canvas below.',
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        const data = await response.json();
        handleNonStreamingResponse(data, userMessage);
      }
    } catch (error: any) {
      clientLog.error('Generation failed:', error);
      
      try {
        const fallbackResponse = await fetch('/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            goal: goal || messages[messages.length - 1]?.content,
            messages: messages,
          }),
        });

        if (fallbackResponse.ok) {
          const data = await fallbackResponse.json();
          handleNonStreamingResponse(data, userMessage);
        } else {
          throw error;
        }
      } catch (fallbackErr) {
        const errorMessage: Message = {
          role: 'assistant',
          content: 'System Overload. Retry command.',
          displayContent: '❌ System Overload. Retry command.',
        };
        setMessages(prev => [...prev, errorMessage]);
        setSystemStatus(prev => ({ ...prev, tier: 'ERROR' }));
      }
    } finally {
      setIsGenerating(false);
      setCookingMessages([]);
    }
  };

  // ========================================================================
  // SHADOW CLONE HANDLER
  // ========================================================================
  const handleSummonShadowClone = async () => {
    if (!currentCampaign) return;
    
    setIsShadowModalOpen(true);
    setShadowCloneVideo(null);
    setShadowCloneStatus({ step: 1, message: "INITIALIZING NEURAL CLONE ENGINE..." });
    
    try {
      const response = await fetch('/api/shadow-clone/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          script: currentCampaign.captions[0] || currentCampaign.plan.hook,
          image_url: currentCampaign.image_url || ""
        })
      });
      
      if (!response.ok) throw new Error("Shadow Clone generation failed");
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No readable stream");
      
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7).trim();
            const nextLine = lines[lines.indexOf(line) + 1];
            if (nextLine?.startsWith('data: ')) {
              try {
                const data = JSON.parse(nextLine.slice(6));
                if (eventType === 'status') {
                  setShadowCloneStatus(data);
                } else if (eventType === 'video') {
                  setShadowCloneVideo(data.video_url);
                  setShadowCloneStatus(null);
                }
              } catch (e) {
                clientLog.error(e);
              }
            }
          }
        }
      }
    } catch (err) {
      clientLog.error(err);
      setShadowCloneStatus({ step: 0, message: "ERROR: NEURAL CLONE SYNTHESIS FAILED" });
    }
  };

  const handleNonStreamingResponse = (data: any, userMessage: Message) => {
    let campaignData: CampaignData | null = null;
    let displayMessage = '';

    if (data.plan && data.captions) {
      campaignData = { plan: data.plan, captions: data.captions, image_url: data.imageUrl || data.image_url, campaignId: data.campaignId, status: data.status };
      displayMessage = '✅ Strategic Campaign Compiled. See the Canvas below.';
    } else if (data.hook && data.offer && data.cta) {
      campaignData = { plan: { hook: data.hook, offer: data.offer, cta: data.cta }, captions: data.captions || [], image_url: data.imageUrl || data.image_url, campaignId: data.campaignId, status: data.status };
      displayMessage = '✅ Strategic Campaign Compiled. See the Canvas below.';
    } else {
      const extracted = extractCampaignData(JSON.stringify(data));
      campaignData = extracted.campaign;
      displayMessage = extracted.displayMessage;
    }

    if (campaignData) {
      setCurrentCampaign(campaignData);
      if (subscription) {
        setSubscription(prev => prev ? { ...prev, campaignsUsedThisMonth: (prev.campaignsUsedThisMonth || 0) + 1 } : prev);
      }
      setSystemStatus(prev => ({ ...prev, tier: 'ACTIVE', dbSync: 'SYNCED' }));
    }

    const assistantMessage: Message = {
      role: 'assistant',
      content: JSON.stringify(data),
      displayContent: displayMessage,
    };
    setMessages(prev => [...prev, assistantMessage]);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleQuickAction = (prompt: string) => {
    setInputValue(prompt);
    handleGenerate(prompt);
  };

  // ========================================================================
  // RENDER
  // ========================================================================
  return (
    <LayoutGroup>
      <div className={`${embedded ? 'h-full' : 'h-screen'} bg-background text-foreground flex flex-col overflow-hidden`} style={{ fontFamily: "'Inter', sans-serif" }}>
        <InteractivePlasmaCanvas />
      <OnboardingTour />

      {/* Mobile Header — only when NOT embedded in dashboard layout */}
      {!embedded && (
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-card/90 backdrop-blur-2xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            {isMobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-info" />
            <span className="text-xs font-tactical font-bold fluid-text-hero">AVOIR</span>
            <span className="text-[10px] font-tactical text-muted-foreground">// COMMAND</span>
          </div>

          <div className="flex items-center gap-3 text-xs font-tactical">
            <div className="flex items-center gap-1">
              <Radio className={`w-3 h-3 ${systemStatus.tier === 'ACTIVE' ? 'text-success' : systemStatus.tier === 'ERROR' ? 'text-danger' : 'text-info'}`} />
              <span className={`font-bold ${
                systemStatus.tier === 'ACTIVE' ? 'text-success' :
                systemStatus.tier === 'ERROR' ? 'text-danger' :
                systemStatus.tier.startsWith('TIER') ? 'text-warning' :
                'text-muted-foreground'
              }`}>
                {systemStatus.tier === 'STANDBY' ? 'RDY' : systemStatus.tier.replace('TIER_', 'T')}
              </span>
            </div>
            
            <div className="h-3 w-px bg-muted" />
            
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-card border border-border">
              <Sparkles className={`w-3 h-3 ${
                intelligenceLevel === 'DIAMOND' ? 'text-info' :
                intelligenceLevel === 'GOLD' ? 'text-warning' :
                intelligenceLevel === 'SILVER' ? 'text-muted-foreground' :
                'text-orange-400'
              }`} />
              <span className={`font-bold tracking-wider ${
                intelligenceLevel === 'DIAMOND' ? 'text-info' :
                intelligenceLevel === 'GOLD' ? 'text-warning' :
                intelligenceLevel === 'SILVER' ? 'text-muted-foreground' :
                'text-orange-400'
              }`}>
                {intelligenceLevel} INTEL
              </span>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Mobile Overlay — only when NOT embedded */}
      {!embedded && (
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 z-40 lg:hidden"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
        )}
      </AnimatePresence>
      )}

      {/* MAIN LAYOUT */}
      <div className={`flex-1 ${embedded ? 'flex flex-col' : 'flex flex-row'} h-full w-full relative overflow-hidden ${embedded ? '!h-auto' : ''}`}>
        
        {/* Trend Radar */}
        <TrendRadar
          industry={systemStatus.dbSync === 'SYNCED' ? 'fashion' : 'general_commerce'} // Default for demo, dynamic later
          onInjectTrend={(trendDirective) => setInputValue(prev => prev ? `${prev}. ${trendDirective}` : trendDirective)}
        />

        {/* ================================================================
            SIDEBAR — only when NOT embedded in dashboard layout
            ================================================================ */}
        {!embedded && (
        <motion.aside 
          onClick={(e) => e.stopPropagation()}
          animate={{ width: sidebarCollapsed ? 72 : 300 }}
          transition={smoothSpring}
          className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-card/80 backdrop-blur-2xl border-r border-border/50 overflow-hidden
            lg:sticky lg:top-0 lg:h-screen lg:translate-x-0
            ${isMobileSidebarOpen ? 'translate-x-0 w-[80%] max-w-[300px]' : '-translate-x-full lg:translate-x-0'}
            transition-transform duration-300 lg:transition-none
          `}
        >
          {/* Sidebar Header */}
          <div className="p-4 border-b border-border/50 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <AnimatePresence mode="wait">
                {!sidebarCollapsed && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2.5"
                  >
                    <div className="w-8 h-8 rounded-lg bg-info/10 border border-info flex items-center justify-center flex-shrink-0">
                      <Terminal className="w-4 h-4 text-info" />
                    </div>
                    <h2 className="text-sm font-tactical font-bold text-foreground tracking-wider whitespace-nowrap">COMMAND CENTER</h2>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="hidden lg:block p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  <motion.div animate={{ rotate: sidebarCollapsed ? 0 : 180 }} transition={smoothSpring}>
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
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="lg:hidden p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {!sidebarCollapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground font-medium truncate">{userEmail}</p>
                  <span className={`text-[10px] font-tactical font-bold px-2 py-0.5 rounded-md whitespace-nowrap ${
                    isPaidUser ? 'bg-info/15 text-info border border-info' : 'bg-muted text-muted-foreground border border-border'
                  }`}>
                    {planName.toUpperCase()}
                  </span>
                </div>
                
                {/* Usage indicator */}
                {!isPaidUser && remaining >= 0 && (
                  <div id="tour-credits" className="mt-3">
                    <div className="flex items-center justify-between text-[10px] font-tactical text-muted-foreground mb-1.5">
                      <span>CAMPAIGNS</span>
                      <span className={remaining === 0 ? 'text-danger' : ''}>{subscription?.campaignsUsedThisMonth || 0}/{PLANS.free.campaignsPerMonth}</span>
                    </div>
                    <div className="w-full h-1.5 bg-muted/80 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${((subscription?.campaignsUsedThisMonth || 0) / PLANS.free.campaignsPerMonth) * 100}%` }}
                        transition={gentleSpring}
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

          {/* Scrollable Navigation + Campaign Library */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
            <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-1.5">
              {/* New Directive Button */}
              <motion.div variants={staggerItem}>
                <button 
                  onClick={() => {
                    setMessages([]);
                    setCurrentCampaign(null);
                    setInputValue('');
                    setCookingMessages([]);
                    setActiveCampaignId(null);
                    setGenomeVariants(null);
                    setShowInterrogation(false);
                    setInterrogationAnswers({ audience: null, platform: null, objective: null });
                    setPendingDirective('');
                    setIsMobileSidebarOpen(false);
                    setSystemStatus({ tier: 'STANDBY', dbSync: 'OK', region: 'US-EAST-1' });
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl glass-card hover:border-info cursor-pointer transition-all group"
                  title="New Directive"
                >
                  <Plus className="w-4 h-4 text-info group-hover:text-info transition-colors flex-shrink-0" />
                  {!sidebarCollapsed && <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors whitespace-nowrap">New Directive</span>}
                </button>
              </motion.div>

              {/* ── Campaign Library ── */}
              {!sidebarCollapsed && (
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
                            onClick={() => loadCampaign(campaign)}
                            className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all group relative ${
                              isActive 
                                ? 'bg-info/10 border-info shadow-[0_0_12px_rgba(99,102,241,0.08)]' 
                                : 'bg-transparent border-transparent hover:bg-card/60 hover:border-border'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className={`text-[12px] font-medium leading-snug truncate ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                                  {campaign.goal.length > 45 ? campaign.goal.slice(0, 45) + '…' : campaign.goal}
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
                              {/* Delete button — visible on hover */}
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteCampaign(campaign.campaignId); }}
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

              {/* ── Divider ── */}
              {!sidebarCollapsed && <div className="border-t border-border/50 my-2" />}

              {/* Action Buttons */}
              <motion.div variants={staggerItem}>
                <button 
                  onClick={() => {
                    if (messages.length > 0) {
                      const blob = new Blob([JSON.stringify(messages, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'avoir_campaign.json';
                      a.click();
                      URL.revokeObjectURL(url);
                      setIsMobileSidebarOpen(false);
                    }
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl glass-card hover:border-primary cursor-pointer transition-all group"
                  title="Export Campaign"
                >
                  <Download className="w-4 h-4 text-primary group-hover:text-primary transition-colors flex-shrink-0" />
                  {!sidebarCollapsed && <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors whitespace-nowrap">Export Campaign</span>}
                </button>
              </motion.div>
              
              <motion.div variants={staggerItem}>
                <button 
                  id="tour-omni-deck"
                  onClick={() => {
                    window.location.href = '/omnideck';
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl glass-card hover:border-danger cursor-pointer transition-all group"
                  title="Omni-Deck Command Center"
                >
                  <Target className="w-4 h-4 text-danger group-hover:text-danger transition-colors flex-shrink-0" />
                  {!sidebarCollapsed && <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors whitespace-nowrap">Omni-Deck</span>}
                </button>
              </motion.div>
              
              <motion.div variants={staggerItem}>
                <button 
                  onClick={() => {
                    window.open('https://github.com/SxBxcoder/Avoir', '_blank');
                    setIsMobileSidebarOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl glass-card hover:border-cyan cursor-pointer transition-all group"
                  title="View Architecture"
                >
                  <BookOpen className="w-4 h-4 text-cyan group-hover:text-cyan transition-colors flex-shrink-0" />
                  {!sidebarCollapsed && <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors whitespace-nowrap">View Architecture</span>}
                </button>
              </motion.div>
            </motion.div>
          </div>


          {/* Bottom Action — Upgrade / Billing */}
          <div className="flex-shrink-0 p-3 border-t border-border/50">
            {isPaidUser ? (
              <button 
                onClick={async () => {
                  if (subscription?.stripeCustomerId) {
                    try {
                      // The customer is derived server-side from the verified
                      // JWT — never send a customerId from the client.
                      const res = await fetch('/api/stripe/portal', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
                        },
                      });
                      const data = await res.json();
                      if (data.url) window.location.href = data.url;
                    } catch (err) {
                      clientLog.error('Portal error:', err);
                    }
                  }
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl glass-card hover:border-info cursor-pointer transition-all group"
                title="Manage Billing"
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="w-4 h-4 text-info flex-shrink-0" />
                  {!sidebarCollapsed && <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Manage Billing</span>}
                </div>
                {!sidebarCollapsed && <span className="text-[10px] bg-success/15 text-success px-2 py-0.5 rounded-md font-tactical font-bold border border-success">ACTIVE</span>}
              </button>
            ) : (
              <button 
                onClick={() => setShowUpgradeModal(true)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-info hover:border-info hover:from-indigo-500/20 hover:to-purple-500/20 cursor-pointer transition-all group"
                title="Upgrade to Pro"
              >
                <div className="flex items-center gap-3">
                  <Crown className="w-4 h-4 text-warning flex-shrink-0" />
                  {!sidebarCollapsed && <span className="text-sm font-medium text-foreground whitespace-nowrap">Pro Plan</span>}
                </div>
                {!sidebarCollapsed && <span className="text-xs bg-info text-white px-2.5 py-1 rounded-lg font-bold">Upgrade</span>}
              </button>
            )}
          </div>
        </motion.aside>
        )}

        {/* ================================================================
            MAIN CONTENT — Chat + Canvas + Input
            ================================================================ */}
        <div className={`${embedded ? 'flex-1 flex flex-col min-w-0 relative z-10 overflow-hidden h-full' : 'flex-1 flex flex-col min-w-0 relative z-10 overflow-hidden'}`}>
          
          {/* Chat / Canvas Area — Scrollable */}
          <div className="flex-1 overflow-y-auto relative flex flex-col">
            {messages.length === 0 && cookingMessages.length === 0 ? (
              <LiveArbitrageFeed onDeploy={handleQuickAction} />
            ) : (
              <div className="p-4 lg:p-8 space-y-4">
                {/* Feed header */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={springConfig}
                  className="flex items-center space-x-2 text-cyan mb-6"
                >
                  <Activity className="w-5 h-5" />
                  <span className="text-sm tracking-widest font-bold font-tactical">ACTIVE INTELLIGENCE FEED</span>
                </motion.div>
                
                {/* Messages */}
                <AnimatePresence mode="popLayout">
                  {messages.map((msg, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 15, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ ...springConfig, delay: idx * 0.03 }}
                      layout
                      className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
                    >
                      <div
                        className={`max-w-[90%] sm:max-w-[85%] lg:max-w-[70%] rounded-2xl p-3 sm:p-4 ${
                          msg.role === 'user'
                            ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white ml-auto shadow-lg shadow-indigo-500/10'
                            : 'glass-card text-zinc-100'
                        }`}
                      >
                        <p className="text-sm leading-relaxed">
                          {msg.displayContent || msg.content}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                  
                  {isGenerating && (
                    <CookingStatus key="cooking-status" messages={cookingMessages.length > 0 ? cookingMessages : ['🔥 Initializing Diamond Cascade Engine...']} />
                  )}

                  {/* P2: Synthetic Focus Group Backtesting UI */}
                  {simulationPhase !== 'idle' && (
                    <motion.div
                      key="simulation-ui"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full mt-4 bg-background/40 backdrop-blur-md rounded-2xl border border-info overflow-hidden relative"
                    >
                      {/* Matrix / Sci-Fi Header */}
                      <div className="bg-info/40 border-b border-info px-4 sm:px-6 py-3 flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <Activity className={`w-4 h-4 ${simulationPhase === 'running' ? 'text-info animate-pulse' : 'text-success'}`} />
                          <span className="text-xs font-tactical tracking-widest text-info">
                            {simulationPhase === 'running' ? 'SYNTHETIC BACKTESTING ACTIVE...' : 'VALIDATION COMPLETE'}
                          </span>
                        </div>
                        {simulationPhase === 'complete' && simulationData && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Predicted Success</span>
                            <span className={`text-sm font-black font-tactical px-2 py-0.5 rounded ${
                              simulationData.predicted_score >= 90 ? 'bg-success/20 text-success' :
                              simulationData.predicted_score >= 75 ? 'bg-warning/20 text-warning' :
                              'bg-danger/20 text-danger'
                            }`}>
                              {simulationData.predicted_score}%
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Content Grid */}
                      <div className="p-4 sm:p-6">
                        {simulationPhase === 'running' ? (
                          <div className="flex flex-col items-center justify-center py-8 space-y-6">
                            <div className="relative">
                              <div className="absolute inset-0 border border-info rounded-full animate-ping opacity-20"></div>
                              <div className="w-16 h-16 rounded-full border-2 border-t-indigo-500 border-r-indigo-500/30 border-b-indigo-500/10 border-l-indigo-500/30 animate-spin"></div>
                              <div className="absolute inset-0 flex items-center justify-center text-info">
                                <Database className="w-6 h-6" />
                              </div>
                            </div>
                            <div className="text-center">
                              <h4 className="text-sm font-bold text-info mb-1">Spawning AI Personas</h4>
                              <p className="text-xs text-info/60 font-mono">Running generated campaign against 3 distinct psychological profiles...</p>
                            </div>
                          </div>
                        ) : simulationData ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                            {simulationData.simulation.map((persona, idx) => (
                              <motion.div 
                                key={idx}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: idx * 0.15 }}
                                className={`rounded-xl p-4 border ${
                                  persona.approved 
                                    ? 'bg-success/10 border-success' 
                                    : 'bg-danger/10 border-danger'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <div>
                                    <h5 className={`text-xs font-bold font-tactical tracking-wider ${persona.approved ? 'text-success' : 'text-danger'}`}>
                                      {persona.name}
                                    </h5>
                                    <p className="text-[10px] text-muted-foreground uppercase">{persona.role}</p>
                                  </div>
                                  {persona.approved ? (
                                    <Check className="w-4 h-4 text-success" />
                                  ) : (
                                    <X className="w-4 h-4 text-danger" />
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground italic leading-relaxed">"{persona.critique}"</p>
                              </motion.div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div ref={chatEndRef} />

                {/* Campaign Genome View */}
                {genomeVariants && (
                  <CampaignGenome
                    variants={genomeVariants}
                    onSelectVariant={(variant) => {
                      setCurrentCampaign({
                        plan: variant.plan,
                        captions: variant.captions,
                        status: 'completed'
                      });
                      setGenomeVariants(null);
                    }}
                    onMergeVariants={(mergedPlan, captions) => {
                      setCurrentCampaign({
                        plan: mergedPlan,
                        captions: captions,
                        status: 'completed'
                      });
                      setGenomeVariants(null);
                    }}
                  />
                )}

                {/* Campaign Asset Canvas */}
                {currentCampaign && !genomeVariants && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="space-y-6 pt-8 border-t border-border/50 mt-8"
                  >
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={springConfig}
                      className="flex items-center justify-between mb-6"
                    >
                      <div className="flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-info" />
                        <h3 className="text-xs font-tactical text-info uppercase tracking-wider">TRADE EXECUTION TICKET</h3>
                      </div>
                      
                      {/* Hedge Fund Metrics */}
                      <div className="hidden sm:flex gap-4">
                        <div className="bg-card/80 border border-border rounded-lg px-3 py-1.5 flex flex-col items-center">
                          <span className="text-[9px] text-muted-foreground font-tactical">PRED. SHARPE</span>
                          <span className="text-sm font-mono text-success">{(simulationData?.predicted_score ? (simulationData.predicted_score / 35).toFixed(1) : '2.4')}</span>
                        </div>
                        <div className="bg-card/80 border border-border rounded-lg px-3 py-1.5 flex flex-col items-center">
                          <span className="text-[9px] text-muted-foreground font-tactical">VOLATILITY (RISK)</span>
                          <span className="text-sm font-mono text-warning">{Math.floor(Math.random() * 20) + 5}%</span>
                        </div>
                        <div className="bg-card/80 border border-border rounded-lg px-3 py-1.5 flex flex-col items-center">
                          <span className="text-[9px] text-muted-foreground font-tactical">EXPECTED ALPHA</span>
                          <span className="text-sm font-mono text-info">+{Math.floor(Math.random() * 15) + 5}%</span>
                        </div>
                      </div>
                    </motion.div>
                      
                    {/* Strategy Cards Grid */}
                    <motion.div
                      variants={staggerContainer}
                      initial="hidden"
                      animate="show"
                      className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4"
                    >
                      {/* Hook Card */}
                      <motion.div
                        variants={staggerItem}
                        whileHover={{ y: -4, transition: { duration: 0.2 } }}
                        className="group relative glass-card scan-line glow-border rounded-2xl p-6 cursor-default"
                      >
                        <div className="relative z-10">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-tactical text-info uppercase tracking-wider">THE HOOK</span>
                            <button
                              onClick={() => copyToClipboard(currentCampaign.plan.hook, 'hook')}
                              className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                            >
                              {copied === 'hook' ? (
                                <Check className="w-4 h-4 text-success" />
                              ) : (
                                <Copy className="w-4 h-4 text-muted-foreground" />
                              )}
                            </button>
                          </div>
                          <p className="text-lg font-bold text-foreground leading-tight">{currentCampaign.plan.hook}</p>
                          {/* Reasoning Toggle */}
                          {currentCampaign.plan.reasoning && (
                            <>
                              <button
                                onClick={() => setReasoningExpanded(prev => ({ ...prev, hook: !prev.hook }))}
                                className="flex items-center gap-1.5 mt-3 text-[11px] text-warning/80 hover:text-warning transition-colors font-medium"
                              >
                                <Sparkles className="w-3 h-3" />
                                Why this works
                                <ChevronRight className={`w-3 h-3 transition-transform ${reasoningExpanded.hook ? 'rotate-90' : ''}`} />
                              </button>
                              <AnimatePresence>
                                {reasoningExpanded.hook && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25 }}
                                    className="overflow-hidden"
                                  >
                                    <p className="text-xs text-muted-foreground italic mt-2 leading-relaxed border-t border-border/50 pt-2">
                                      {currentCampaign.plan.reasoning.hook_rationale}
                                    </p>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </>
                          )}
                        </div>
                      </motion.div>

                      {/* Offer Card */}
                      <motion.div
                        variants={staggerItem}
                        whileHover={{ y: -4, transition: { duration: 0.2 } }}
                        className="group relative glass-card scan-line glow-border rounded-2xl p-6 cursor-default"
                      >
                        <div className="relative z-10">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-tactical text-primary uppercase tracking-wider">THE OFFER</span>
                            <button
                              onClick={() => copyToClipboard(currentCampaign.plan.offer, 'offer')}
                              className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                            >
                              {copied === 'offer' ? (
                                <Check className="w-4 h-4 text-success" />
                              ) : (
                                <Copy className="w-4 h-4 text-muted-foreground" />
                              )}
                            </button>
                          </div>
                          <p className="text-base text-muted-foreground leading-tight">{currentCampaign.plan.offer}</p>
                          {/* Reasoning Toggle */}
                          {currentCampaign.plan.reasoning && (
                            <>
                              <button
                                onClick={() => setReasoningExpanded(prev => ({ ...prev, offer: !prev.offer }))}
                                className="flex items-center gap-1.5 mt-3 text-[11px] text-warning/80 hover:text-warning transition-colors font-medium"
                              >
                                <Sparkles className="w-3 h-3" />
                                Why this works
                                <ChevronRight className={`w-3 h-3 transition-transform ${reasoningExpanded.offer ? 'rotate-90' : ''}`} />
                              </button>
                              <AnimatePresence>
                                {reasoningExpanded.offer && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25 }}
                                    className="overflow-hidden"
                                  >
                                    <p className="text-xs text-muted-foreground italic mt-2 leading-relaxed border-t border-border/50 pt-2">
                                      {currentCampaign.plan.reasoning.offer_rationale}
                                    </p>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </>
                          )}
                        </div>
                      </motion.div>

                      {/* CTA Card */}
                      <motion.div
                        variants={staggerItem}
                        whileHover={{ y: -4, transition: { duration: 0.2 } }}
                        className="group relative glass-card scan-line glow-border rounded-2xl p-6 cursor-default"
                      >
                        <div className="relative z-10">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-tactical text-pink-400 uppercase tracking-wider">ACTION</span>
                            <button
                              onClick={() => copyToClipboard(currentCampaign.plan.cta, 'cta')}
                              className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                            >
                              {copied === 'cta' ? (
                                <Check className="w-4 h-4 text-success" />
                              ) : (
                                <Copy className="w-4 h-4 text-muted-foreground" />
                              )}
                            </button>
                          </div>
                          <p className="text-base text-muted-foreground leading-tight">{currentCampaign.plan.cta}</p>
                          {/* Reasoning Toggle */}
                          {currentCampaign.plan.reasoning && (
                            <>
                              <button
                                onClick={() => setReasoningExpanded(prev => ({ ...prev, cta: !prev.cta }))}
                                className="flex items-center gap-1.5 mt-3 text-[11px] text-warning/80 hover:text-warning transition-colors font-medium"
                              >
                                <Sparkles className="w-3 h-3" />
                                Why this works
                                <ChevronRight className={`w-3 h-3 transition-transform ${reasoningExpanded.cta ? 'rotate-90' : ''}`} />
                              </button>
                              <AnimatePresence>
                                {reasoningExpanded.cta && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25 }}
                                    className="overflow-hidden"
                                  >
                                    <p className="text-xs text-muted-foreground italic mt-2 leading-relaxed border-t border-border/50 pt-2">
                                      {currentCampaign.plan.reasoning.cta_rationale}
                                    </p>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </>
                          )}
                        </div>
                      </motion.div>
                    </motion.div>

                    {/* Funnel Matrix Canvas (P3) */}
                    {currentCampaign.plan.funnel && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, ...springConfig }}
                        className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4"
                      >
                        {/* Top of Funnel */}
                        <div className="glass-card rounded-2xl p-5 border border-cyan bg-cyan/5 relative overflow-hidden group">
                          <div className="absolute top-0 left-0 w-1 h-full bg-cyan/50" />
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Video className="w-4 h-4 text-cyan" />
                              <span className="text-xs font-tactical text-cyan uppercase tracking-widest">TOP OF FUNNEL (VIDEO)</span>
                            </div>
                            <button
                              onClick={() => copyToClipboard(currentCampaign.plan.funnel!.top, 'funnel-top')}
                              className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                            >
                              {copied === 'funnel-top' ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                            </button>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed font-mono whitespace-pre-wrap">{currentCampaign.plan.funnel.top}</p>
                        </div>
                        
                        {/* Bottom of Funnel */}
                        <div className="glass-card rounded-2xl p-5 border border-danger bg-danger/5 relative overflow-hidden group">
                          <div className="absolute top-0 left-0 w-1 h-full bg-danger/50" />
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <MessageSquare className="w-4 h-4 text-danger" />
                              <span className="text-xs font-tactical text-danger uppercase tracking-widest">BOTTOM OF FUNNEL (RETARGET)</span>
                            </div>
                            <button
                              onClick={() => copyToClipboard(currentCampaign.plan.funnel!.bottom, 'funnel-bottom')}
                              className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                            >
                              {copied === 'funnel-bottom' ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                            </button>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed font-mono whitespace-pre-wrap">{currentCampaign.plan.funnel.bottom}</p>
                        </div>
                      </motion.div>
                    )}

                    {/* Audience Insight + Confidence Banner */}
                    {currentCampaign.plan.reasoning && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, ...springConfig }}
                        className="glass-card rounded-2xl p-5 border border-info bg-info/5"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 p-2 bg-info/10 rounded-xl">
                            <Eye className="w-4 h-4 text-info" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] font-tactical text-info uppercase tracking-widest">AUDIENCE INSIGHT</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                currentCampaign.plan.reasoning.confidence_score >= 80
                                  ? 'bg-success/20 text-success border border-success'
                                  : currentCampaign.plan.reasoning.confidence_score >= 60
                                  ? 'bg-warning/20 text-warning border border-warning'
                                  : 'bg-danger/20 text-danger border border-danger'
                              }`}>
                                {currentCampaign.plan.reasoning.confidence_score}% CONFIDENCE
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {currentCampaign.plan.reasoning.audience_insight}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Captions Grid */}
                    {currentCampaign.captions && currentCampaign.captions.length > 0 && (
                      <motion.div
                        variants={staggerContainer}
                        initial="hidden"
                        animate="show"
                        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4"
                      >
                        {currentCampaign.captions.map((caption, idx) => (
                          <motion.div
                            key={idx}
                            variants={staggerItem}
                            whileHover={{ y: -4, scale: 1.02, transition: { duration: 0.2 } }}
                            className="group relative glass-card scan-line glow-border rounded-2xl p-6 cursor-default"
                          >
                            <div className="relative z-10">
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-tactical text-cyan uppercase tracking-wider">CAPTION {idx + 1}</span>
                                <button
                                  onClick={() => copyToClipboard(caption, `caption-${idx}`)}
                                  className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                                >
                                  {copied === `caption-${idx}` ? (
                                    <Check className="w-4 h-4 text-success" />
                                  ) : (
                                    <Copy className="w-4 h-4 text-muted-foreground" />
                                  )}
                                </button>
                              </div>
                              <p className="text-sm text-muted-foreground leading-relaxed">{caption}</p>
                            </div>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}

                    {/* Action Panel: Export, Performance, Shadow Clone */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="mt-8 pt-8 border-t border-border/50"
                    >
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
                        <button
                          onClick={handleShareWithClient}
                          disabled={isSharing}
                          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-r from-pink-600/20 to-rose-600/20 hover:from-pink-600/40 hover:to-rose-600/40 border border-pink-500/30 hover:border-pink-500/60 transition-all group overflow-hidden relative shadow-[0_0_30px_rgba(236,72,153,0.1)] hover:shadow-[0_0_40px_rgba(236,72,153,0.3)] disabled:opacity-50"
                        >
                          {isSharing ? (
                            <Loader2 className="w-5 h-5 text-pink-400 animate-spin" />
                          ) : copied === 'share-link' ? (
                            <Check className="w-5 h-5 text-success" />
                          ) : (
                            <Share2 className="w-5 h-5 text-pink-400 group-hover:scale-110 transition-transform" />
                          )}
                          <span className="text-xs sm:text-sm font-bold text-foreground font-tactical tracking-widest whitespace-nowrap">
                            {copied === 'share-link' ? 'PORTAL OPENED' : 'SHARE CLIENT'}
                          </span>
                        </button>

                        <button
                          onClick={handleMarkWinner}
                          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-r from-yellow-600/20 to-amber-600/20 hover:from-yellow-600/40 hover:to-amber-600/40 border border-warning hover:border-warning transition-all group overflow-hidden relative shadow-[0_0_30px_rgba(234,179,8,0.1)] hover:shadow-[0_0_40px_rgba(234,179,8,0.3)]"
                        >
                          <Rocket className="w-5 h-5 text-warning group-hover:scale-110 transition-transform" />
                          <span className="text-xs sm:text-sm font-bold text-foreground font-tactical tracking-widest">MARK AS WINNER</span>
                        </button>
                        
                        <button
                          onClick={() => {
                            setGenomeMode(true);
                            handleGenerate(`Auto-optimize this baseline campaign for A/B testing across 3 distinct psychological angles. Baseline: Hook: "${currentCampaign?.plan.hook}", Offer: "${currentCampaign?.plan.offer}"`);
                          }}
                          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-r from-cyan-600/20 to-blue-600/20 hover:from-cyan-600/40 hover:to-blue-600/40 border border-cyan hover:border-cyan transition-all group overflow-hidden relative shadow-[0_0_30px_rgba(6,182,212,0.1)] hover:shadow-[0_0_40px_rgba(6,182,212,0.3)]"
                        >
                          <Target className="w-5 h-5 text-cyan group-hover:scale-110 transition-transform" />
                          <span className="text-xs sm:text-sm font-bold text-foreground font-tactical tracking-widest">A/B OPTIMIZE</span>
                        </button>
                        
                        <button
                          onClick={() => setShowDeploymentSimulator(true)}
                          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-r from-indigo-600/20 to-blue-600/20 hover:from-indigo-600/40 hover:to-blue-600/40 border border-info hover:border-info transition-all group overflow-hidden relative shadow-[0_0_30px_rgba(99,102,241,0.1)] hover:shadow-[0_0_40px_rgba(99,102,241,0.3)]"
                        >
                          <Cpu className="w-5 h-5 text-info group-hover:scale-110 transition-transform" />
                          <span className="text-xs sm:text-sm font-bold text-foreground font-tactical tracking-widest">DEPLOY CAPITAL</span>
                        </button>
                        
                        <button
                          onClick={() => setShowPerformanceReport(true)}
                          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-r from-emerald-600/20 to-teal-600/20 hover:from-emerald-600/40 hover:to-teal-600/40 border border-success hover:border-success transition-all group overflow-hidden relative shadow-[0_0_30px_rgba(16,185,129,0.1)] hover:shadow-[0_0_40px_rgba(16,185,129,0.3)]"
                        >
                          <Activity className="w-5 h-5 text-success group-hover:scale-110 transition-transform" />
                          <span className="text-xs sm:text-sm font-bold text-foreground font-tactical tracking-widest">REPORT DATA</span>
                        </button>

                        <button
                          onClick={() => setShowCompetitorIntel(true)}
                          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-r from-orange-600/20 to-amber-600/20 hover:from-orange-600/40 hover:to-amber-600/40 border border-orange-500/30 hover:border-orange-500/60 transition-all group overflow-hidden relative shadow-[0_0_30px_rgba(249,115,22,0.1)] hover:shadow-[0_0_40px_rgba(249,115,22,0.3)]"
                        >
                          <Eye className="w-5 h-5 text-orange-400 group-hover:scale-110 transition-transform" />
                          <span className="text-xs sm:text-sm font-bold text-foreground font-tactical tracking-widest">COMPETITOR INTEL</span>
                        </button>
                        
                        <button
                          onClick={handleSummonShadowClone}
                          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-r from-purple-600/20 to-pink-600/20 hover:from-purple-600/40 hover:to-pink-600/40 border border-primary hover:border-primary transition-all group overflow-hidden relative shadow-[0_0_30px_rgba(168,85,247,0.1)] hover:shadow-[0_0_40px_rgba(168,85,247,0.3)]"
                        >
                          <Video className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                          <span className="text-xs sm:text-sm font-bold text-foreground font-tactical tracking-widest">SUMMON CLONE</span>
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </div>
            )}
            
            {/* P0 Modals */}
            <AnimatePresence>
              {showPlatformExport && currentCampaign && (
                <PlatformExportPanel
                  campaign={{
                    hook: currentCampaign.plan.hook,
                    offer: currentCampaign.plan.offer,
                    cta: currentCampaign.plan.cta,
                    captions: currentCampaign.captions
                  }}
                  onClose={() => setShowPlatformExport(false)}
                />
              )}
              {showPerformanceReport && currentCampaign && (
                <PerformanceReportPanel
                  campaignId={currentCampaign.campaignId || 'temp-id'}
                  campaignSnapshot={{
                    hook: currentCampaign.plan.hook,
                    offer: currentCampaign.plan.offer,
                    cta: currentCampaign.plan.cta,
                  }}
                  accessToken={accessToken}
                  onClose={() => setShowPerformanceReport(false)}
                  onReported={() => setShowPerformanceReport(false)}
                />
              )}
              {showCompetitorIntel && (
                <CompetitorIntelPanel
                  industry={systemStatus.dbSync === 'SYNCED' ? 'fashion' : 'general_commerce'}
                  onClose={() => setShowCompetitorIntel(false)}
                  onInjectGap={(gapDirective) => setInputValue(prev => prev ? `${prev}. ${gapDirective}` : gapDirective)}
                />
              )}
            </AnimatePresence>
          </div>

          {/* ================================================================
              BOTTOM INPUT BAR — Always visible, glassmorphism
              ================================================================ */}
          <div id="tour-input-bar" className="flex-shrink-0 border-t border-border/50 bg-card/60 backdrop-blur-2xl p-3 sm:p-4 relative z-20">
            <AnimatePresence>
              {showInterrogation && (
                <StrategicInterrogationPanel
                  baseDirective={pendingDirective}
                  onComplete={(enriched) => handleGenerate(enriched)}
                  onCancel={() => setShowInterrogation(false)}
                />
              )}
            </AnimatePresence>
            <div className="max-w-4xl mx-auto">
              <div className="flex gap-3 items-center">
                <div className="flex-1 relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-info font-mono text-sm font-bold">
                    <span>{'>_'}</span>
                  </div>
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleGenerate()}
                    placeholder="Enter your campaign directive..."
                    disabled={isGenerating}
                    className="w-full bg-card/50 border border-info rounded-xl px-4 py-4 pl-12 text-sm text-info placeholder-indigo-500/40 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-info disabled:opacity-50 transition-all font-mono shadow-inner"
                  />
                  {/* Glow effect on focus */}
                  <div className="absolute inset-0 rounded-xl border border-info group-focus-within:border-info group-focus-within:shadow-[0_0_15px_rgba(99,102,241,0.15)] pointer-events-none transition-all" />
                </div>
                <MagneticButton
                  onClick={() => handleGenerate()}
                  disabled={isGenerating || !inputValue.trim()}
                  className="!px-6 !py-4 !rounded-xl bg-info hover:bg-info text-white font-tactical tracking-wider"
                >
                  {isGenerating ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-5 h-5 border-2 border-border border-t-white rounded-full" />
                  ) : (
                    <span className="flex items-center gap-2">EXECUTE <Send className="w-4 h-4" /></span>
                  )}
                </MagneticButton>
              </div>
              {/* Hint text & Genome Toggle */}
              <div className="flex items-center justify-between mt-2 px-1">
                <div className="flex items-center gap-4">
                  <p className="text-[10px] text-zinc-600 font-tactical">POWERED BY DIAMOND CASCADE ENGINE</p>
                  <button
                    id="tour-genome-toggle"
                    onClick={() => setGenomeMode(!genomeMode)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold tracking-wider transition-colors border ${
                      genomeMode 
                        ? 'bg-primary/20 text-primary border-primary' 
                        : 'bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted'
                    }`}
                  >
                    <Sparkles className="w-3 h-3" />
                    GENOME MODE
                    <span className="text-[9px] opacity-70 ml-1">(2 CREDITS)</span>
                  </button>
                </div>
                <p className="text-[10px] text-zinc-600">Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-muted-foreground font-mono text-[9px]">Enter</kbd> to send</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Shadow Clone Rendering Modal */}
      <AnimatePresence>
        {isShadowModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-2xl bg-card border border-success rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.2)]"
            >
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Activity className="w-5 h-5 text-success animate-pulse" />
                  <h3 className="text-xl font-tactical font-bold text-foreground tracking-widest">NEURAL CLONE FACTORY</h3>
                </div>
                <button onClick={() => setIsShadowModalOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-8">
                {shadowCloneVideo ? (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                    <div className="aspect-video w-full bg-background rounded-xl overflow-hidden relative border border-border group">
                      <video src={shadowCloneVideo} className="w-full h-full object-cover" autoPlay loop muted playsInline />
                      <div className="absolute inset-0 bg-background/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <PlayCircle className="w-16 h-16 text-foreground/80 cursor-pointer hover:text-foreground hover:scale-110 transition-all" />
                      </div>
                    </div>
                    <p className="text-success font-tactical text-center animate-pulse">ASSET READY FOR DEPLOYMENT</p>
                  </motion.div>
                ) : (
                  <div className="space-y-8 py-8">
                    <div className="flex justify-center">
                      <div className="relative">
                        <div className="w-32 h-32 rounded-full border-4 border-border flex items-center justify-center relative overflow-hidden">
                          {currentCampaign?.image_url && <img src={currentCampaign.image_url} alt="Base" className="w-full h-full object-cover opacity-30" />}
                          <div className="absolute inset-0 bg-success/20 animate-pulse" />
                          <Loader2 className="w-10 h-10 text-success absolute animate-spin" />
                        </div>
                        <motion.div 
                          className="absolute -inset-4 border-2 border-success rounded-full"
                          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2 text-center">
                      <p className="text-2xl font-tactical text-success">STEP {shadowCloneStatus?.step || 1} / 5</p>
                      <p className="text-muted-foreground font-mono text-sm tracking-wider">{shadowCloneStatus?.message || "INITIALIZING..."}</p>
                    </div>
                    
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-success"
                        animate={{ width: `${((shadowCloneStatus?.step || 1) / 5) * 100}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status Bar — Desktop Only, hidden when embedded */}
      {!embedded && (
      <div className="hidden lg:flex h-[36px] z-[60] border-t border-border/50 bg-card/90 backdrop-blur-xl px-6 items-center justify-between text-xs font-tactical flex-shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Activity className="w-3 h-3 text-info" />
            <span className="text-muted-foreground">TIER:</span>
            <span className={`font-bold ${
              systemStatus.tier === 'ACTIVE' ? 'text-success' :
              systemStatus.tier === 'ERROR' ? 'text-danger' :
              systemStatus.tier.startsWith('TIER') ? 'text-warning' :
              'text-muted-foreground'
            }`}>
              {systemStatus.tier}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Database className="w-3 h-3 text-primary" />
            <span className="text-muted-foreground">DB_SYNC:</span>
            <span className={`font-bold ${
              systemStatus.dbSync === 'SYNCED' ? 'text-success' : 'text-muted-foreground'
            }`}>
              {systemStatus.dbSync}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Globe className="w-3 h-3 text-cyan" />
            <span className="text-muted-foreground">REGION:</span>
            <span className="text-cyan font-bold">{systemStatus.region}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
          </div>
          <span className="text-muted-foreground whitespace-nowrap">AVOIR // ONLINE</span>
        </div>
      </div>
      )}

      {/* Capital Deployment Simulator Modal */}
      <AnimatePresence>
        {showDeploymentSimulator && currentCampaign && (
          <CapitalDeploymentSimulator 
            onClose={() => setShowDeploymentSimulator(false)}
            campaignPlan={currentCampaign.plan}
          />
        )}
      </AnimatePresence>

      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} subscription={subscription} />
    </div>
    </LayoutGroup>
  );
}

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import { Send, Sparkles, Terminal, Activity, Database, Globe, Copy, Check, Zap, LogOut, Menu, X, Plus, Download, BookOpen, Crown, CreditCard, Flame, Radio } from 'lucide-react';
import UpgradeModal from './UpgradeModal';
import { type UserSubscription, canGenerateCampaign, getRemainingCampaigns, PLANS, DEFAULT_SUBSCRIPTION } from '@/lib/stripe';

// ============================================================================
// TYPES
// ============================================================================

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  displayContent?: string;
}

interface CampaignAsset {
  hook: string;
  offer: string;
  cta: string;
}

interface CampaignData {
  campaignId?: string;
  plan: CampaignAsset;
  captions: string[];
  image_url?: string;
  messages?: Message[];
  status?: string;
}

interface CampaignDashboardProps {
  accessToken: string;
  userEmail: string;
  onLogout?: () => void;
}

// ============================================================================
// SPRING ANIMATION CONFIGS (Framer Motion physics)
// ============================================================================

const springConfig = { type: 'spring' as const, stiffness: 300, damping: 30 };
const bouncySpring = { type: 'spring' as const, stiffness: 400, damping: 20 };
const gentleSpring = { type: 'spring' as const, stiffness: 200, damping: 25 };

// Stagger children
const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: springConfig },
};

// ============================================================================
// COOKING STATUS COMPONENT — The "AI is Cooking" experience
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
      <div className="max-w-[85%] lg:max-w-[70%] rounded-2xl p-5 glass-card glow-border-active overflow-hidden">
        <div className="flex items-center gap-3 mb-4">
          <div className="pulse-ring relative w-3 h-3 rounded-full bg-indigo-500 flex-shrink-0" />
          <span className="text-sm font-tactical tracking-widest text-indigo-400 font-bold">
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
                  className={`text-xs ${idx === messages.length - 1 ? 'text-indigo-300' : 'text-zinc-600'}`}
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
          <span className="text-xs font-tactical text-zinc-500">Processing...</span>
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

export default function CampaignDashboard({ accessToken, userEmail, onLogout }: CampaignDashboardProps) {
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
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch subscription state on mount
  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const userId = userEmail || 'anonymous';
        const res = await fetch(`/api/stripe/subscription?userId=${encodeURIComponent(userId)}`);
        if (res.ok) {
          const data = await res.json();
          setSubscription(data);
        }
      } catch (err) {
        console.error('Failed to fetch subscription:', err);
        setSubscription({ ...DEFAULT_SUBSCRIPTION, userId: userEmail || 'anonymous' });
      }
    };
    fetchSubscription();
  }, [userEmail]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, cookingMessages]);

  // Derived subscription info
  const currentTier = subscription?.tier || 'free';
  const isPaidUser = currentTier !== 'free';
  const remaining = subscription ? getRemainingCampaigns(subscription) : 3;
  const planName = PLANS[currentTier]?.name || 'Starter';

  // ========================================================================
  // SSE STREAMING GENERATE
  // ========================================================================
  const handleGenerate = async () => {
    if (!inputValue.trim() || isGenerating) return;

    if (subscription && !canGenerateCampaign(subscription)) {
      setShowUpgradeModal(true);
      return;
    }

    const userMessage: Message = { role: 'user', content: inputValue };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsGenerating(true);
    setCookingMessages([]);
    setSystemStatus(prev => ({ ...prev, tier: 'TIER_1' }));

    try {
      // Try SSE streaming first
      const response = await fetch('/api/generate/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          goal: inputValue,
          messages: messages.concat(userMessage),
          userId: userEmail || 'anonymous',
        }),
      });

      if (!response.ok) {
        // If stream endpoint fails, fall back to regular generate
        const errorData = await response.json();
        if (errorData.upgradeRequired) {
          setShowUpgradeModal(true);
          setIsGenerating(false);
          return;
        }
        throw new Error(errorData.error || 'Generation failed');
      }

      // Check if it's actually an SSE stream
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('text/event-stream') && response.body) {
        // SSE streaming mode
        const reader = response.body.getReader();
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
                  
                  switch (eventType) {
                    case 'status':
                      setCookingMessages(prev => [...prev, data.message]);
                      break;
                    case 'campaign':
                      const campaignData: CampaignData = {
                        plan: {
                          hook: data.hook || '',
                          offer: data.offer || '',
                          cta: data.cta || '',
                        },
                        captions: data.captions || [],
                        image_url: data.imageUrl,
                        campaignId: data.campaignId,
                        status: data.status,
                      };
                      setCurrentCampaign(campaignData);
                      if (subscription) {
                        setSubscription(prev => prev ? { ...prev, campaignsUsedThisMonth: prev.campaignsUsedThisMonth + 1 } : prev);
                      }
                      setSystemStatus(prev => ({ ...prev, tier: 'ACTIVE', dbSync: 'SYNCED' }));
                      break;
                    case 'error':
                      throw new Error(data.message);
                    case 'done':
                      break;
                  }
                } catch (parseErr) {
                  // Skip unparseable lines
                }
              }
            }
          }
        }

        // Add assistant message
        const assistantMessage: Message = {
          role: 'assistant',
          content: '✅ Strategic Campaign Compiled.',
          displayContent: '✅ Strategic Campaign Compiled. See the Canvas below.',
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        // Fallback: non-streaming JSON response
        const data = await response.json();
        handleNonStreamingResponse(data, userMessage);
      }
    } catch (error: any) {
      console.error('Generation failed:', error);
      
      // Try fallback to regular /api/generate
      try {
        const fallbackResponse = await fetch('/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            goal: inputValue || messages[messages.length - 1]?.content,
            messages: messages,
            userId: userEmail || 'anonymous',
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

  // Handle non-streaming response (fallback)
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
        setSubscription(prev => prev ? { ...prev, campaignsUsedThisMonth: prev.campaignsUsedThisMonth + 1 } : prev);
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

  // ========================================================================
  // RENDER
  // ========================================================================
  return (
    <div className="min-h-screen bg-black text-white flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Radial Glow Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-indigo-500/8 via-purple-500/4 to-transparent blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-gradient-radial from-cyan-500/5 via-transparent to-transparent blur-3xl"></div>
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-zinc-900/95 backdrop-blur-xl border-b border-zinc-800">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            {isMobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-tactical font-bold fluid-text-hero">PRACHAR.AI</span>
            <span className="text-[10px] font-tactical text-zinc-500">// WAR ROOM</span>
          </div>

          <div className="flex items-center gap-3 text-xs font-tactical">
            <div className="flex items-center gap-1">
              <Radio className={`w-3 h-3 ${systemStatus.tier === 'ACTIVE' ? 'text-green-400' : systemStatus.tier === 'ERROR' ? 'text-red-400' : 'text-indigo-400'}`} />
              <span className={`font-bold ${
                systemStatus.tier === 'ACTIVE' ? 'text-green-400' :
                systemStatus.tier === 'ERROR' ? 'text-red-400' :
                systemStatus.tier.startsWith('TIER') ? 'text-yellow-400' :
                'text-zinc-400'
              }`}>
                {systemStatus.tier === 'STANDBY' ? 'RDY' : systemStatus.tier.replace('TIER_', 'T')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Overlay */}
      {isMobileSidebarOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 z-40 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* LEFT SIDEBAR */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`fixed inset-y-0 lg:bottom-[44px] left-0 z-50 w-[80%] max-w-[400px] transform transition-transform duration-300 lg:fixed lg:translate-x-0 lg:w-[400px] border-r border-zinc-800/50 flex flex-col bg-zinc-900/80 lg:bg-zinc-900/40 backdrop-blur-2xl ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-5 border-b border-zinc-800/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Terminal className="w-4 h-4 text-indigo-400" />
              </div>
              <h2 className="text-sm font-tactical font-bold text-white tracking-wider">DIRECTOR'S TERMINAL</h2>
            </div>
            <div className="flex items-center gap-2">
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-red-400"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsMobileSidebarOpen(false)}
                className="lg:hidden p-1.5 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <p className="text-xs text-zinc-400 font-medium truncate">{userEmail}</p>
            <span className={`text-[10px] font-tactical font-bold px-2 py-0.5 rounded-md ${
              isPaidUser ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
            }`}>
              {planName.toUpperCase()}
            </span>
          </div>
          
          {/* Usage indicator */}
          {!isPaidUser && remaining >= 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[10px] font-tactical text-zinc-500 mb-1.5">
                <span>CAMPAIGNS</span>
                <span className={remaining === 0 ? 'text-red-400' : ''}>{subscription?.campaignsUsedThisMonth || 0}/{PLANS.free.campaignsPerMonth}</span>
              </div>
              <div className="w-full h-1.5 bg-zinc-800/80 rounded-full overflow-hidden">
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
        </div>

        {/* Navigation Menu */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="p-4 space-y-2"
        >
          <motion.div variants={staggerItem}>
            <button 
              onClick={() => {
                setMessages([]);
                setCurrentCampaign(null);
                setInputValue('');
                setCookingMessages([]);
                setIsMobileSidebarOpen(false);
                setSystemStatus({ tier: 'STANDBY', dbSync: 'OK', region: 'US-EAST-1' });
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl glass-card hover:border-indigo-500/30 cursor-pointer transition-all group"
            >
              <Plus className="w-4 h-4 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
              <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">New Directive</span>
            </button>
          </motion.div>
          
          <motion.div variants={staggerItem}>
            <button 
              onClick={() => {
                if (messages.length > 0) {
                  const blob = new Blob([JSON.stringify(messages, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'prachar_campaign.json';
                  a.click();
                  URL.revokeObjectURL(url);
                  setIsMobileSidebarOpen(false);
                }
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl glass-card hover:border-purple-500/30 cursor-pointer transition-all group"
            >
              <Download className="w-4 h-4 text-purple-400 group-hover:text-purple-300 transition-colors" />
              <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">Export Campaign</span>
            </button>
          </motion.div>
          
          <motion.div variants={staggerItem}>
            <button 
              onClick={() => {
                window.open('https://github.com/SxBxcoder/Prachar.ai', '_blank');
                setIsMobileSidebarOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl glass-card hover:border-cyan-500/30 cursor-pointer transition-all group"
            >
              <BookOpen className="w-4 h-4 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
              <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">View Architecture</span>
            </button>
          </motion.div>
          
          {/* Plan Action */}
          <motion.div variants={staggerItem} className="pt-2">
            {isPaidUser ? (
              <button 
                onClick={async () => {
                  if (subscription?.stripeCustomerId) {
                    try {
                      const res = await fetch('/api/stripe/portal', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ customerId: subscription.stripeCustomerId }),
                      });
                      const data = await res.json();
                      if (data.url) window.location.href = data.url;
                    } catch (err) {
                      console.error('Portal error:', err);
                    }
                  }
                }}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl glass-card hover:border-indigo-500/30 cursor-pointer transition-all group"
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm font-medium text-zinc-300">Manage Billing</span>
                </div>
                <span className="text-[10px] bg-green-500/15 text-green-400 px-2 py-0.5 rounded-md font-tactical font-bold border border-green-500/20">ACTIVE</span>
              </button>
            ) : (
              <button 
                onClick={() => setShowUpgradeModal(true)}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 hover:border-indigo-500/50 hover:from-indigo-500/20 hover:to-purple-500/20 cursor-pointer transition-all group"
              >
                <div className="flex items-center gap-3">
                  <Crown className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-medium text-white">Pro Plan</span>
                </div>
                <span className="text-xs bg-indigo-500 text-white px-2.5 py-1 rounded-lg font-bold">Upgrade</span>
              </button>
            )}
          </motion.div>
        </motion.div>

        {/* Spacer — Desktop Only */}
        <div className="hidden lg:flex flex-1 items-center justify-center p-6">
          <div className="text-center space-y-4">
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="w-16 h-16 rounded-2xl bg-indigo-500/8 border border-indigo-500/15 flex items-center justify-center mx-auto"
            >
              <Sparkles className="w-8 h-8 text-indigo-400/60" />
            </motion.div>
            <div className="space-y-2">
              <p className="text-sm font-tactical text-zinc-500">COMMAND CENTER</p>
              <p className="text-xs text-zinc-700">Enter directive below</p>
            </div>
          </div>
        </div>

        {/* Input Area — Desktop Only */}
        <div className="hidden lg:flex flex-col p-4 border-t border-zinc-800/50">
          <div className="space-y-3">
            <label className="text-xs font-tactical text-indigo-400/80 uppercase tracking-wider">Campaign Directive</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleGenerate()}
                placeholder="Enter campaign directive..."
                disabled={isGenerating}
                className="flex-1 bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/30 disabled:opacity-50 transition-all"
              />
              <MagneticButton
                onClick={handleGenerate}
                disabled={isGenerating || !inputValue.trim()}
                className="!px-4 !rounded-xl"
              >
                <Send className="w-5 h-5" />
              </MagneticButton>
            </div>
          </div>
        </div>
      </div>

      {/* Main Split-Pane Layout */}
      <div className="flex-1 flex relative z-10 pt-14 lg:pt-0 lg:pl-0 overflow-hidden">
        <div className="hidden lg:block w-[400px] flex-shrink-0"></div>

        {/* RIGHT CANVAS */}
        <div className="flex-1 h-full overflow-y-auto p-4 lg:p-8 pb-32 lg:pb-8 flex flex-col bg-black relative">
          {messages.length === 0 && cookingMessages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={gentleSpring}
              className="flex-1 flex flex-col items-center justify-center m-auto min-h-[50vh]"
            >
              <motion.div
                animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Sparkles className="w-12 h-12 mb-4 text-zinc-700" />
              </motion.div>
              <p className="tracking-widest text-sm text-zinc-600 font-tactical">AWAITING DIRECTIVE...</p>
              <p className="text-xs mt-2 text-zinc-700">Enter a campaign goal to begin</p>
            </motion.div>
          ) : (
            <div className="flex flex-col w-full h-auto">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={springConfig}
                className="flex items-center space-x-2 text-cyan-500 mb-8 shrink-0"
              >
                <Activity className="w-5 h-5" />
                <span className="text-sm tracking-widest font-bold font-tactical">ACTIVE INTELLIGENCE FEED</span>
              </motion.div>
              
              <div className="flex flex-col w-full space-y-4 shrink-0">
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
                        className={`max-w-[85%] lg:max-w-[70%] rounded-2xl p-4 ${
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
                  
                  {/* Cooking Status (SSE streaming) */}
                  {isGenerating && (
                    <CookingStatus messages={cookingMessages.length > 0 ? cookingMessages : ['🔥 Initializing Diamond Cascade Engine...']} />
                  )}
                </AnimatePresence>
                <div ref={chatEndRef} />
              </div>

              {/* Campaign Asset Canvas */}
              {currentCampaign && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-6 pt-8 border-t border-zinc-800/50 mt-8"
                >
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={springConfig}
                    className="flex items-center gap-2 mb-6"
                  >
                    <Zap className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-xs font-tactical text-indigo-400 uppercase tracking-wider">Campaign Assets</h3>
                  </motion.div>
                    
                  {/* Strategy Cards Grid */}
                  <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 md:grid-cols-3 gap-4"
                  >
                    {/* Hook Card */}
                    <motion.div
                      variants={staggerItem}
                      whileHover={{ y: -4, transition: { duration: 0.2 } }}
                      className="group relative glass-card scan-line glow-border rounded-2xl p-6 cursor-default"
                    >
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-tactical text-indigo-400 uppercase tracking-wider">THE HOOK</span>
                          <button
                            onClick={() => copyToClipboard(currentCampaign.plan.hook, 'hook')}
                            className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
                          >
                            {copied === 'hook' ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4 text-zinc-500" />
                            )}
                          </button>
                        </div>
                        <p className="text-lg font-bold text-white leading-tight">{currentCampaign.plan.hook}</p>
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
                          <span className="text-xs font-tactical text-purple-400 uppercase tracking-wider">THE OFFER</span>
                          <button
                            onClick={() => copyToClipboard(currentCampaign.plan.offer, 'offer')}
                            className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
                          >
                            {copied === 'offer' ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4 text-zinc-500" />
                            )}
                          </button>
                        </div>
                        <p className="text-base text-zinc-300 leading-tight">{currentCampaign.plan.offer}</p>
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
                            className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
                          >
                            {copied === 'cta' ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4 text-zinc-500" />
                            )}
                          </button>
                        </div>
                        <p className="text-base text-zinc-300 leading-tight">{currentCampaign.plan.cta}</p>
                      </div>
                    </motion.div>
                  </motion.div>

                  {/* Captions Grid */}
                  {currentCampaign.captions && currentCampaign.captions.length > 0 && (
                    <motion.div
                      variants={staggerContainer}
                      initial="hidden"
                      animate="show"
                      className="grid grid-cols-1 md:grid-cols-3 gap-4"
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
                              <span className="text-xs font-tactical text-cyan-400 uppercase tracking-wider">CAPTION {idx + 1}</span>
                              <button
                                onClick={() => copyToClipboard(caption, `caption-${idx}`)}
                                className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
                              >
                                {copied === `caption-${idx}` ? (
                                  <Check className="w-4 h-4 text-green-400" />
                                ) : (
                                  <Copy className="w-4 h-4 text-zinc-500" />
                                )}
                              </button>
                            </div>
                            <p className="text-sm text-zinc-300 leading-relaxed">{caption}</p>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Input Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800/50">
        <div className="p-4">
          <div className="space-y-3">
            <label className="text-xs font-tactical text-indigo-400/80 uppercase tracking-wider">Campaign Directive</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleGenerate()}
                placeholder="Enter campaign directive..."
                disabled={isGenerating}
                className="flex-1 bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50 transition-all"
              />
              <MagneticButton
                onClick={handleGenerate}
                disabled={isGenerating || !inputValue.trim()}
                className="!px-4 !rounded-xl"
              >
                <Send className="w-5 h-5" />
              </MagneticButton>
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar — Desktop Only */}
      <div className="hidden lg:flex fixed bottom-0 left-0 right-0 h-[44px] z-[60] border-t border-zinc-800/50 bg-zinc-900/90 backdrop-blur-xl px-6 items-center justify-between text-xs font-tactical overflow-hidden">
        <div className="flex items-center gap-6 shrink-0">
          <div className="flex items-center gap-2 shrink-0">
            <Activity className="w-3 h-3 text-indigo-400" />
            <span className="text-zinc-500">TIER:</span>
            <span className={`font-bold ${
              systemStatus.tier === 'ACTIVE' ? 'text-green-400' :
              systemStatus.tier === 'ERROR' ? 'text-red-400' :
              systemStatus.tier.startsWith('TIER') ? 'text-yellow-400' :
              'text-zinc-400'
            }`}>
              {systemStatus.tier}
            </span>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <Database className="w-3 h-3 text-purple-400" />
            <span className="text-zinc-500">DB_SYNC:</span>
            <span className={`font-bold ${
              systemStatus.dbSync === 'SYNCED' ? 'text-green-400' : 'text-zinc-400'
            }`}>
              {systemStatus.dbSync}
            </span>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <Globe className="w-3 h-3 text-cyan-400" />
            <span className="text-zinc-500">REGION:</span>
            <span className="text-cyan-400 font-bold">{systemStatus.region}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </div>
          <span className="text-zinc-500 whitespace-nowrap">PRACHAR.AI // ONLINE</span>
        </div>
      </div>

      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} subscription={subscription} />
    </div>
  );
}

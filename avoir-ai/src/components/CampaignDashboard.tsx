'use client';

import { useState, useEffect, useCallback } from 'react';
import { LayoutGroup, AnimatePresence, motion } from 'framer-motion';
import {
  Radio, Database, Globe, Sparkles, Flame, Shield, PlayCircle,
  Loader2, X, Activity, Cpu, Rocket, Target, Eye, Video,
} from 'lucide-react';
import UpgradeModal from './UpgradeModal';
import InteractivePlasmaCanvas from './InteractivePlasmaCanvas';
import CampaignGenome from './CampaignGenome';
import StrategicInterrogationPanel from './StrategicInterrogationPanel';
import OnboardingTour from './OnboardingTour';
import PerformanceReportPanel from './PerformanceReportPanel';
import { PlatformExportPanel } from './PlatformExportPanel';
import CompetitorIntelPanel from './CompetitorIntelPanel';
import TrendRadar from './TrendRadar';
import { LiveArbitrageFeed } from './LiveArbitrageFeed';
import { CapitalDeploymentSimulator } from './CapitalDeploymentSimulator';
import { type UserSubscription, canGenerateCampaign, PLANS, DEFAULT_SUBSCRIPTION } from '@/lib/stripe';
import { clientLog } from '@/lib/logClient';
import { CampaignSidebar } from './campaign/CampaignSidebar';
import { CampaignChat } from './campaign/CampaignChat';
import { CampaignCanvas } from './campaign/CampaignCanvas';
import { CampaignInputBar } from './campaign/CampaignInputBar';
import { type Message, type CampaignData, type CampaignHistoryItem, type GenomeVariant, type CampaignDashboardProps } from './campaign/types';
import { extractCampaignData } from './campaign/utils';

export default function CampaignDashboard({ accessToken, userEmail, onLogout, embedded = false }: CampaignDashboardProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentCampaign, setCurrentCampaign] = useState<CampaignData | null>(null);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [cookingMessages, setCookingMessages] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState({ tier: 'STANDBY', dbSync: 'OK', region: 'US-EAST-1' });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [simulationPhase, setSimulationPhase] = useState<'idle' | 'running' | 'complete'>('idle');
  const [simulationData, setSimulationData] = useState<{
    simulation: Array<{ name: string; role: string; critique: string; approved: boolean }>;
    predicted_score: number;
  } | null>(null);
  const [shadowCloneStatus, setShadowCloneStatus] = useState<{ step: number; message: string } | null>(null);
  const [shadowCloneVideo, setShadowCloneVideo] = useState<string | null>(null);
  const [isShadowModalOpen, setIsShadowModalOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [reasoningExpanded, setReasoningExpanded] = useState<Record<string, boolean>>({});
  const [genomeMode, setGenomeMode] = useState(false);
  const [genomeVariants, setGenomeVariants] = useState<GenomeVariant[] | null>(null);
  const [showInterrogation, setShowInterrogation] = useState(false);
  const [interrogationAnswers, setInterrogationAnswers] = useState<{
    audience: string | null;
    platform: string[] | null;
    objective: string | null;
  }>({ audience: null, platform: null, objective: null });
  const [pendingDirective, setPendingDirective] = useState('');
  const [intelligenceLevel, setIntelligenceLevel] = useState('BRONZE');
  const [showPerformanceReport, setShowPerformanceReport] = useState(false);
  const [showPlatformExport, setShowPlatformExport] = useState(false);
  const [showCompetitorIntel, setShowCompetitorIntel] = useState(false);
  const [campaignHistory, setCampaignHistory] = useState<CampaignHistoryItem[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [showDeploymentSimulator, setShowDeploymentSimulator] = useState(false);

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
          prev.forEach(p => { if (!apiIds.has(p.campaignId)) merged.push(p); });
          return merged.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        });
      }
    } catch (err) { clientLog.error('Failed to load campaign history:', err); }
  }, [accessToken]);

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
    if (campaign.messages && campaign.messages.length > 0) {
      setMessages(campaign.messages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        displayContent: m.displayContent,
      })));
    } else {
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
    } catch (err) { clientLog.error('Failed to delete campaign:', err); }
  }, [activeCampaignId, accessToken]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [subRes, intelRes] = await Promise.all([
          fetch('/api/stripe/subscription', { headers: accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {} }),
          fetch('/api/intelligence', { headers: accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {} }),
        ]);
        if (subRes.ok) setSubscription(await subRes.json());
        if (intelRes.ok) { const d = await intelRes.json(); if (d.brief) setIntelligenceLevel(d.brief.level); }
      } catch {
        setSubscription({ ...DEFAULT_SUBSCRIPTION, userId: '' });
      }
    };
    fetchData();
    refreshCampaignList();
  }, [accessToken, refreshCampaignList]);

  useEffect(() => {
    const snipe = localStorage.getItem('trend_snipe');
    if (snipe) { setInputValue(snipe); localStorage.removeItem('trend_snipe'); }
  }, []);

  const currentTier = subscription?.tier || 'free';
  const isPaidUser = currentTier !== 'free';
  const remaining = subscription ? subscription.credits : 3;
  const planName = PLANS[currentTier]?.name || 'Starter';

  const shouldInterrogate = (goal: string) => goal.length < 30 || goal.split(' ').length < 5;

  const handleMarkWinner = async () => {
    if (!activeCampaignId) return;
    setCampaignHistory(prev => prev.map(c => c.campaignId === activeCampaignId ? { ...c, isWinner: true } : c));
    try {
      await fetch('/api/campaigns/score', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify({ campaignId: activeCampaignId, isWinner: true }),
      });
    } catch { clientLog.warn("Could not save winner status to DB (local dev)."); }
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
        }),
      });
      const data = await res.json();
      const fullUrl = `${window.location.origin}${data.share_url}`;
      await navigator.clipboard.writeText(fullUrl);
      window.open(fullUrl, '_blank');
      setCopied('share-link');
      setTimeout(() => setCopied(null), 2000);
    } catch (err) { clientLog.error("Failed to share:", err); }
    finally { setIsSharing(false); }
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
      if (subscription) setSubscription(prev => prev ? { ...prev, campaignsUsedThisMonth: (prev.campaignsUsedThisMonth || 0) + 1 } : prev);
      setSystemStatus(prev => ({ ...prev, tier: 'ACTIVE', dbSync: 'SYNCED' }));
    }
    setMessages(prev => [...prev, { role: 'assistant', content: JSON.stringify(data), displayContent: displayMessage }]);
  };

  const handleGenerate = async (overrideInput?: string) => {
    const goal = overrideInput || inputValue;
    if (!goal.trim() || isGenerating) return;
    if (subscription && !canGenerateCampaign(subscription)) { setShowUpgradeModal(true); return; }
    if (!overrideInput && shouldInterrogate(goal)) { setPendingDirective(goal); setShowInterrogation(true); return; }

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
      setSystemStatus(prev => ({ ...prev, dbSync: 'SCANNING' }));
      const researchSteps = [
        '📡 Establishing connection to Global Ad Exchanges...',
        '🔍 Scraping TikTok API for trending audio anomalies...',
        '📊 Analyzing Reddit sentiment on subcultures...',
        '🧠 Formulating Investment Thesis...',
        '⚡ Deploying Diamond Cascade Engine...',
      ];
      for (const step of researchSteps) { setCookingMessages([step]); await new Promise(r => setTimeout(r, 700)); }
      setSystemStatus(prev => ({ ...prev, dbSync: 'SYNCED' }));

      const winningCampaigns = campaignHistory.filter(c => c.isWinner);
      const pastWinningContext = winningCampaigns.length > 0
        ? winningCampaigns.map(c => `WINNING HOOK: "${c.plan?.hook}" | WINNING OFFER: "${c.plan?.offer}"`).join('\n')
        : undefined;

      const response = await fetch('/api/generate/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({ goal: finalGoal, messages: messages.concat(userMessage), genome_mode: genomeMode, pastWinningContext }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.upgradeRequired) { setShowUpgradeModal(true); setIsGenerating(false); return; }
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
                  switch (eventType) {
                    case 'status':
                      setCookingMessages(prev => [...prev, data.message]);
                      break;
                    case 'simulation_start':
                      setSimulationPhase('running');
                      break;
                    case 'simulation_result':
                      setSimulationData({ simulation: data.simulation, predicted_score: data.predicted_score });
                      setSimulationPhase('complete');
                      break;
                    case 'campaign': {
                      const cd: CampaignData = {
                        plan: { hook: data.hook || '', offer: data.offer || '', cta: data.cta || '', reasoning: data.reasoning || undefined },
                        captions: data.captions || [],
                        image_url: data.imageUrl,
                        campaignId: data.campaignId,
                        status: data.status,
                      };
                      setCurrentCampaign(cd);
                      const localId = data.campaignId || `local-${Date.now()}`;
                      setActiveCampaignId(localId);
                      setCampaignHistory(prev => {
                        if (prev.some(c => c.campaignId === localId)) return prev;
                        return [{
                          campaignId: localId, goal: finalGoal, plan: cd.plan, captions: cd.captions,
                          imageUrl: data.imageUrl, messages: [], tier: 'TIER_1_GEMINI', status: 'completed',
                          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
                        }, ...prev];
                      });
                      if (subscription) setSubscription(prev => prev ? { ...prev, credits: Math.max(0, prev.credits - (genomeMode ? 2 : 1)) } : prev);
                      setSystemStatus(prev => ({ ...prev, tier: 'ACTIVE', dbSync: 'SYNCED' }));
                      break;
                    }
                    case 'genome':
                      if (data.variants && Array.isArray(data.variants)) {
                        setGenomeVariants(data.variants);
                        if (subscription) setSubscription(prev => prev ? { ...prev, credits: Math.max(0, prev.credits - 2) } : prev);
                      }
                      break;
                    case 'error':
                      throw new Error(data.message);
                    case 'done':
                      refreshCampaignList();
                      break;
                  }
                } catch { /* skip */ }
              }
            }
          }
        }
        setMessages(prev => [...prev, { role: 'assistant', content: '✅ Strategic Campaign Compiled.', displayContent: '✅ Strategic Campaign Compiled. See the Canvas below.' }]);
      } else {
        const data = await response.json();
        handleNonStreamingResponse(data, userMessage);
      }
    } catch (error: any) {
      clientLog.error('Generation failed:', error);
      try {
        const fallbackResponse = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
          body: JSON.stringify({ goal: goal || messages[messages.length - 1]?.content, messages }),
        });
        if (fallbackResponse.ok) { handleNonStreamingResponse(await fallbackResponse.json(), userMessage); }
        else throw error;
      } catch {
        setMessages(prev => [...prev, { role: 'assistant', content: 'System Overload. Retry command.', displayContent: '❌ System Overload. Retry command.' }]);
        setSystemStatus(prev => ({ ...prev, tier: 'ERROR' }));
      }
    } finally { setIsGenerating(false); setCookingMessages([]); }
  };

  const handleSummonShadowClone = async () => {
    if (!currentCampaign) return;
    setIsShadowModalOpen(true);
    setShadowCloneVideo(null);
    setShadowCloneStatus({ step: 1, message: "INITIALIZING NEURAL CLONE ENGINE..." });
    try {
      const response = await fetch('/api/shadow-clone/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify({ script: currentCampaign.captions[0] || currentCampaign.plan.hook, image_url: currentCampaign.image_url || "" }),
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
                if (eventType === 'status') setShadowCloneStatus(data);
                else if (eventType === 'video') { setShadowCloneVideo(data.video_url); setShadowCloneStatus(null); }
              } catch (e) { clientLog.error(e); }
            }
          }
        }
      }
    } catch (err) {
      clientLog.error(err);
      setShadowCloneStatus({ step: 0, message: "ERROR: NEURAL CLONE SYNTHESIS FAILED" });
    }
  };

  return (
    <LayoutGroup>
      <div className={`${embedded ? 'h-full' : 'h-screen'} bg-background text-foreground flex flex-col overflow-hidden`} style={{ fontFamily: "'Inter', sans-serif" }}>
        <InteractivePlasmaCanvas />
        <OnboardingTour />

        {!embedded && (
          <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-card/90 backdrop-blur-2xl border-b border-border/50">
            <div className="flex items-center justify-between px-4 py-3">
              <button onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                {isMobileSidebarOpen ? <X className="w-5 h-5" /> : <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>}
              </button>
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-info" />
                <span className="text-xs font-tactical font-bold fluid-text-hero">AVOIR</span>
                <span className="text-[10px] font-tactical text-muted-foreground">// COMMAND</span>
              </div>
              <div className="flex items-center gap-3 text-xs font-tactical">
                <div className="flex items-center gap-1">
                  <Radio className={`w-3 h-3 ${systemStatus.tier === 'ACTIVE' ? 'text-success' : systemStatus.tier === 'ERROR' ? 'text-danger' : 'text-info'}`} />
                  <span className={`font-bold ${systemStatus.tier === 'ACTIVE' ? 'text-success' : systemStatus.tier === 'ERROR' ? 'text-danger' : systemStatus.tier.startsWith('TIER') ? 'text-warning' : 'text-muted-foreground'}`}>
                    {systemStatus.tier === 'STANDBY' ? 'RDY' : systemStatus.tier.replace('TIER_', 'T')}
                  </span>
                </div>
                <div className="h-3 w-px bg-muted" />
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-card border border-border">
                  <Sparkles className={`w-3 h-3 ${intelligenceLevel === 'DIAMOND' ? 'text-info' : intelligenceLevel === 'GOLD' ? 'text-warning' : intelligenceLevel === 'SILVER' ? 'text-muted-foreground' : 'text-orange-400'}`} />
                  <span className={`font-bold tracking-wider ${intelligenceLevel === 'DIAMOND' ? 'text-info' : intelligenceLevel === 'GOLD' ? 'text-warning' : intelligenceLevel === 'SILVER' ? 'text-muted-foreground' : 'text-orange-400'}`}>
                    {intelligenceLevel} INTEL
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {!embedded && (
          <AnimatePresence>
            {isMobileSidebarOpen && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-background/80 z-40 lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />
            )}
          </AnimatePresence>
        )}

        <div className={`flex-1 ${embedded ? 'flex flex-col' : 'flex flex-row'} h-full w-full relative overflow-hidden ${embedded ? '!h-auto' : ''}`}>
          <TrendRadar
            industry={systemStatus.dbSync === 'SYNCED' ? 'fashion' : 'general_commerce'}
            onInjectTrend={(trendDirective) => setInputValue(prev => prev ? `${prev}. ${trendDirective}` : trendDirective)}
          />

          {!embedded && (
            <CampaignSidebar
              collapsed={sidebarCollapsed}
              onToggleSidebarCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
              onLogout={onLogout}
              userEmail={userEmail}
              isPaidUser={isPaidUser}
              planName={planName}
              subscription={subscription}
              remaining={remaining}
              campaignHistory={campaignHistory}
              activeCampaignId={activeCampaignId}
              onLoadCampaign={loadCampaign}
              onDeleteCampaign={deleteCampaign}
              onNewDirective={() => {
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
              onMobileClose={() => setIsMobileSidebarOpen(false)}
              isMobileSidebarOpen={isMobileSidebarOpen}
            />
          )}

          <div className={`${embedded ? 'flex-1 flex flex-col min-w-0 relative z-10 overflow-hidden h-full' : 'flex-1 flex flex-col min-w-0 relative z-10 overflow-hidden'}`}>
            <CampaignChat
              messages={messages}
              isGenerating={isGenerating}
              cookingMessages={cookingMessages}
              currentCampaign={currentCampaign}
              genomeVariants={genomeVariants}
              simulationPhase={simulationPhase}
              simulationData={simulationData}
              industry={systemStatus.dbSync === 'SYNCED' ? 'fashion' : 'general_commerce'}
              onQuickAction={(prompt) => { setInputValue(prompt); handleGenerate(prompt); }}
            >
              {genomeVariants && (
                <CampaignGenome
                  variants={genomeVariants}
                  onSelectVariant={(variant) => {
                    setCurrentCampaign({ plan: variant.plan, captions: variant.captions, status: 'completed' });
                    setGenomeVariants(null);
                  }}
                  onMergeVariants={(mergedPlan, captions) => {
                    setCurrentCampaign({ plan: mergedPlan, captions, status: 'completed' });
                    setGenomeVariants(null);
                  }}
                />
              )}

              {currentCampaign && !genomeVariants && (
                <>
                  <CampaignCanvas
                    currentCampaign={currentCampaign}
                    reasoningExpanded={reasoningExpanded}
                    onToggleReasoning={(key) => setReasoningExpanded(prev => ({ ...prev, [key]: !prev[key] }))}
                  />

                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                    className="mt-8 pt-8 border-t border-border/50"
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
                      <button onClick={handleShareWithClient} disabled={isSharing}
                        className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-r from-pink-600/20 to-rose-600/20 hover:from-pink-600/40 hover:to-rose-600/40 border border-pink-500/30 hover:border-pink-500/60 transition-all group overflow-hidden relative shadow-[0_0_30px_rgba(236,72,153,0.1)] hover:shadow-[0_0_40px_rgba(236,72,153,0.3)] disabled:opacity-50"
                      >
                        {isSharing ? <Loader2 className="w-5 h-5 text-pink-400 animate-spin" /> : copied === 'share-link' ? <svg className="w-5 h-5 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg> : <svg className="w-5 h-5 text-pink-400 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" /></svg>}
                        <span className="text-xs sm:text-sm font-bold text-foreground font-tactical tracking-widest whitespace-nowrap">
                          {copied === 'share-link' ? 'PORTAL OPENED' : 'SHARE CLIENT'}
                        </span>
                      </button>
                      <button onClick={handleMarkWinner}
                        className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-r from-yellow-600/20 to-amber-600/20 hover:from-yellow-600/40 hover:to-amber-600/40 border border-warning hover:border-warning transition-all group overflow-hidden relative shadow-[0_0_30px_rgba(234,179,8,0.1)] hover:shadow-[0_0_40px_rgba(234,179,8,0.3)]"
                      >
                        <Rocket className="w-5 h-5 text-warning group-hover:scale-110 transition-transform" />
                        <span className="text-xs sm:text-sm font-bold text-foreground font-tactical tracking-widest">MARK AS WINNER</span>
                      </button>
                      <button onClick={() => { setGenomeMode(true); handleGenerate(`Auto-optimize this baseline campaign for A/B testing across 3 distinct psychological angles. Baseline: Hook: "${currentCampaign?.plan.hook}", Offer: "${currentCampaign?.plan.offer}"`); }}
                        className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-r from-cyan-600/20 to-blue-600/20 hover:from-cyan-600/40 hover:to-blue-600/40 border border-cyan hover:border-cyan transition-all group overflow-hidden relative shadow-[0_0_30px_rgba(6,182,212,0.1)] hover:shadow-[0_0_40px_rgba(6,182,212,0.3)]"
                      >
                        <Target className="w-5 h-5 text-cyan group-hover:scale-110 transition-transform" />
                        <span className="text-xs sm:text-sm font-bold text-foreground font-tactical tracking-widest">A/B OPTIMIZE</span>
                      </button>
                      <button onClick={() => setShowDeploymentSimulator(true)}
                        className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-r from-indigo-600/20 to-blue-600/20 hover:from-indigo-600/40 hover:to-blue-600/40 border border-info hover:border-info transition-all group overflow-hidden relative shadow-[0_0_30px_rgba(99,102,241,0.1)] hover:shadow-[0_0_40px_rgba(99,102,241,0.3)]"
                      >
                        <Cpu className="w-5 h-5 text-info group-hover:scale-110 transition-transform" />
                        <span className="text-xs sm:text-sm font-bold text-foreground font-tactical tracking-widest">DEPLOY CAPITAL</span>
                      </button>
                      <button onClick={() => setShowPerformanceReport(true)}
                        className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-r from-emerald-600/20 to-teal-600/20 hover:from-emerald-600/40 hover:to-teal-600/40 border border-success hover:border-success transition-all group overflow-hidden relative shadow-[0_0_30px_rgba(16,185,129,0.1)] hover:shadow-[0_0_40px_rgba(16,185,129,0.3)]"
                      >
                        <Activity className="w-5 h-5 text-success group-hover:scale-110 transition-transform" />
                        <span className="text-xs sm:text-sm font-bold text-foreground font-tactical tracking-widest">REPORT DATA</span>
                      </button>
                      <button onClick={() => setShowCompetitorIntel(true)}
                        className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-r from-orange-600/20 to-amber-600/20 hover:from-orange-600/40 hover:to-amber-600/40 border border-orange-500/30 hover:border-orange-500/60 transition-all group overflow-hidden relative shadow-[0_0_30px_rgba(249,115,22,0.1)] hover:shadow-[0_0_40px_rgba(249,115,22,0.3)]"
                      >
                        <Eye className="w-5 h-5 text-orange-400 group-hover:scale-110 transition-transform" />
                        <span className="text-xs sm:text-sm font-bold text-foreground font-tactical tracking-widest">COMPETITOR INTEL</span>
                      </button>
                      <button onClick={handleSummonShadowClone}
                        className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-r from-purple-600/20 to-pink-600/20 hover:from-purple-600/40 hover:to-pink-600/40 border border-primary hover:border-primary transition-all group overflow-hidden relative shadow-[0_0_30px_rgba(168,85,247,0.1)] hover:shadow-[0_0_40px_rgba(168,85,247,0.3)]"
                      >
                        <Video className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                        <span className="text-xs sm:text-sm font-bold text-foreground font-tactical tracking-widest">SUMMON CLONE</span>
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </CampaignChat>

            <AnimatePresence>
              {showPlatformExport && currentCampaign && (
                <PlatformExportPanel campaign={{ hook: currentCampaign.plan.hook, offer: currentCampaign.plan.offer, cta: currentCampaign.plan.cta, captions: currentCampaign.captions }} onClose={() => setShowPlatformExport(false)} />
              )}
              {showPerformanceReport && currentCampaign && (
                <PerformanceReportPanel campaignId={currentCampaign.campaignId || 'temp-id'} campaignSnapshot={{ hook: currentCampaign.plan.hook, offer: currentCampaign.plan.offer, cta: currentCampaign.plan.cta }} accessToken={accessToken} onClose={() => setShowPerformanceReport(false)} onReported={() => setShowPerformanceReport(false)} />
              )}
              {showCompetitorIntel && (
                <CompetitorIntelPanel industry={systemStatus.dbSync === 'SYNCED' ? 'fashion' : 'general_commerce'} onClose={() => setShowCompetitorIntel(false)} onInjectGap={(gapDirective) => setInputValue(prev => prev ? `${prev}. ${gapDirective}` : gapDirective)} />
              )}
            </AnimatePresence>

            <CampaignInputBar
              inputValue={inputValue}
              onInputChange={setInputValue}
              onGenerate={() => handleGenerate()}
              isGenerating={isGenerating}
              genomeMode={genomeMode}
              onToggleGenomeMode={() => setGenomeMode(!genomeMode)}
            />
          </div>
        </div>

        <AnimatePresence>
          {isShadowModalOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
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
                          <motion.div className="absolute -inset-4 border-2 border-success rounded-full"
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
                        <motion.div className="h-full bg-success" animate={{ width: `${((shadowCloneStatus?.step || 1) / 5) * 100}%` }} transition={{ duration: 0.5 }} />
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {!embedded && (
          <div className="hidden lg:flex h-[36px] z-[60] border-t border-border/50 bg-card/90 backdrop-blur-xl px-6 items-center justify-between text-xs font-tactical flex-shrink-0">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Activity className="w-3 h-3 text-info" />
                <span className="text-muted-foreground">TIER:</span>
                <span className={`font-bold ${systemStatus.tier === 'ACTIVE' ? 'text-success' : systemStatus.tier === 'ERROR' ? 'text-danger' : systemStatus.tier.startsWith('TIER') ? 'text-warning' : 'text-muted-foreground'}`}>{systemStatus.tier}</span>
              </div>
              <div className="flex items-center gap-2">
                <Database className="w-3 h-3 text-primary" />
                <span className="text-muted-foreground">DB_SYNC:</span>
                <span className={`font-bold ${systemStatus.dbSync === 'SYNCED' ? 'text-success' : 'text-muted-foreground'}`}>{systemStatus.dbSync}</span>
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

        <AnimatePresence>
          {showDeploymentSimulator && currentCampaign && (
            <CapitalDeploymentSimulator onClose={() => setShowDeploymentSimulator(false)} campaignPlan={currentCampaign.plan} />
          )}
        </AnimatePresence>

        <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} subscription={subscription} />
      </div>
    </LayoutGroup>
  );
}

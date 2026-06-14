'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radar, Target, Instagram, Youtube, ArrowRight, Zap, RefreshCw, Send, CheckCircle2, Shield, MessageCircle, AlertCircle, User, MessageSquare, Building, Link as LinkIcon, Copy, CalendarClock } from 'lucide-react';
import { useRouter } from 'next/navigation';

// Spring physics
const springConfig = { type: 'spring' as const, stiffness: 300, damping: 30 };
const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: springConfig },
};

function AnimatedGridBG() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <motion.div
        animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/4 left-1/3 w-[600px] h-[600px] bg-gradient-radial from-red-500/10 via-orange-500/5 to-transparent rounded-full blur-3xl"
      />
      <motion.div
        animate={{ x: [0, -30, 0], y: [0, 40, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-gradient-radial from-indigo-500/10 via-transparent to-transparent rounded-full blur-3xl"
      />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px]" />
    </div>
  );
}

export default function OmniDeckPage() {
  const router = useRouter();
  const [isScanning, setIsScanning] = useState(false);
  const [trends, setTrends] = useState<any[]>([]);
  const [selectedTrend, setSelectedTrend] = useState<any | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  
  // Scheduling State
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleTime, setScheduleTime] = useState<string>('');
  const [scheduled, setScheduled] = useState(false);

  // Authority Defender Stream
  const [engagements, setEngagements] = useState<any[]>([]);

  // B2B Bridge / Agency Mode
  const [agencyMode, setAgencyMode] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (agencyMode) {
      fetch('http://localhost:8000/api/agency/clients')
        .then(res => res.json())
        .then(data => {
          setClients(data.clients);
          if (data.clients.length > 0) setSelectedClient(data.clients[0]);
        })
        .catch(console.error);
    } else {
      setShareLink(null);
    }
  }, [agencyMode]);

  useEffect(() => {
    const fetchCredits = async () => {
      try {
        const userId = localStorage.getItem('cognitoUserId') || 'anonymous';
        if (userId !== 'anonymous') {
          const res = await fetch(`/api/stripe/subscription?userId=${userId}`);
          const data = await res.json();
          if (data.credits !== undefined) {
            setCredits(data.credits);
          }
        } else {
          setCredits(10);
        }
      } catch(e) {}
    };
    fetchCredits();
  }, []);

  const handleGenerateShareLink = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/agency/share-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agency_id: 'default_agency',
          campaign_data: selectedTrend
        })
      });
      const data = await res.json();
      setShareLink(`http://localhost:3000${data.share_url}`);
    } catch(e) {}
  };

  const copyToClipboard = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  useEffect(() => {
    const eventSource = new EventSource('/api/engagement/stream');
    eventSource.onmessage = (event) => {
      try {
        const newEngagement = JSON.parse(event.data);
        setEngagements(prev => [newEngagement, ...prev].slice(0, 20)); // keep last 20
      } catch (err) {}
    };
    return () => eventSource.close();
  }, []);

  // Cross-platform toggles
  const [platforms, setPlatforms] = useState({
    instagram: true,
    tiktok: true,
    youtube: true
  });

  const scanTrends = async () => {
    setIsScanning(true);
    try {
      const res = await fetch('http://localhost:8000/api/trends');
      const data = await res.json();
      if (data.status === 'success') {
        setTrends(data.trends);
      }
    } catch (err) {
      console.error(err);
    } finally {
      // Fake a bit of loading for the "God-Tier" feel
      setTimeout(() => setIsScanning(false), 1500);
    }
  };

  const handleSnipe = (trend: any) => {
    setSelectedTrend(trend);
  };

  const handleAutoPublish = async () => {
    const userId = localStorage.getItem('cognitoUserId') || 'anonymous';
    setPublishing(true);
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          campaign_id: `campaign_${Date.now()}`,
          platforms: Object.keys(platforms).filter(k => platforms[k as keyof typeof platforms])
        }),
      });

      if (res.status === 402) {
        alert("Not enough credits! Publishing costs 5 credits.");
        setPublishing(false);
        return;
      }

      const data = await res.json();
      if (data.status === 'success') {
        setPublishing(false);
        setPublished(true);
        // fetch fresh credits
        if (userId !== 'anonymous') {
            const subRes = await fetch(`/api/stripe/subscription?userId=${userId}`);
            if (subRes.ok) {
                const subData = await subRes.json();
                setCredits(subData.credits);
            }
        } else {
            setCredits((prev) => prev !== null ? prev - 5 : 5);
        }
        setTimeout(() => {
          setPublished(false);
        }, 3000);
      }
    } catch (e) {
      console.error(e);
      setPublishing(false);
    }
  };

  const handleSchedulePublish = async () => {
    if (!scheduleTime) {
      alert("Please select a date and time first!");
      return;
    }
    const userId = localStorage.getItem('cognitoUserId') || 'anonymous';
    setPublishing(true);
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          campaign_id: `campaign_${Date.now()}_scheduled`,
          platforms: Object.keys(platforms).filter(k => platforms[k as keyof typeof platforms]),
          schedule_time: scheduleTime
        }),
      });

      if (res.status === 402) {
        alert("Not enough credits! Scheduling costs 5 credits.");
        setPublishing(false);
        return;
      }

      const data = await res.json();
      if (data.status === 'success') {
        setPublishing(false);
        setScheduled(true);
        setIsScheduling(false);
        if (userId !== 'anonymous') {
            const subRes = await fetch(`/api/stripe/subscription?userId=${userId}`);
            if (subRes.ok) {
                const subData = await subRes.json();
                setCredits(subData.credits);
            }
        } else {
            setCredits((prev) => prev !== null ? prev - 5 : 5);
        }
        setTimeout(() => {
          setScheduled(false);
        }, 4000);
      }
    } catch (e) {
      console.error(e);
      setPublishing(false);
    }
  };

  const handleEditInWarRoom = () => {
    if (!selectedTrend) return;
    const snipePrompt = `[TREND SNIPE] ${selectedTrend.trend_name} - ${selectedTrend.suggested_hook}`;
    localStorage.setItem('trend_snipe', snipePrompt);
    router.push('/');
  };

  // Initial scan
  useEffect(() => {
    scanTrends();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-red-500/30 overflow-x-hidden pt-20">
      <AnimatedGridBG />

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 flex items-center gap-4">
              <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20">
                <Radar className="w-8 h-8 text-red-400" />
              </div>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400">
                Omni-Deck Command Center
              </span>
            </h1>
            <p className="text-gray-400 text-lg font-tactical tracking-wider">
              PROACTIVE SOCIAL INTELLIGENCE & ZERO-CLICK PUBLISHING
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Credits Badge */}
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-xl glass-card">
              <Zap className="w-5 h-5 text-yellow-400" />
              <span className="text-sm font-bold text-yellow-400">
                {credits !== null ? `${credits.toLocaleString()} CREDITS` : 'LOADING...'}
              </span>
            </div>

            {/* Agency Mode Toggle */}
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-xl glass-card">
              <Building className={`w-5 h-5 ${agencyMode ? 'text-indigo-400' : 'text-gray-400'}`} />
              <span className={`text-sm font-bold ${agencyMode ? 'text-indigo-400' : 'text-gray-400'}`}>AGENCY MODE</span>
              <button
                onClick={() => setAgencyMode(!agencyMode)}
                className={`w-12 h-6 rounded-full relative transition-colors ${agencyMode ? 'bg-indigo-500' : 'bg-gray-700'}`}
              >
                <motion.div
                  animate={{ x: agencyMode ? 24 : 4 }}
                  className="w-4 h-4 bg-white rounded-full absolute top-1 shadow-sm"
                />
              </button>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => router.push('/')}
              className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-colors flex items-center gap-2 glass-card"
            >
              Back to War Room
            </motion.button>
          </div>
        </div>

        {/* Agency Client Selector */}
        <AnimatePresence>
          {agencyMode && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-8 overflow-hidden"
            >
              <div className="flex items-center gap-4 bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl">
                <span className="text-indigo-400 font-bold">ACTIVE CLIENT:</span>
                <div className="flex gap-2">
                  {clients.map(client => (
                    <button
                      key={client.id}
                      onClick={() => setSelectedClient(client)}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                        selectedClient?.id === client.id 
                          ? 'bg-indigo-500 text-white' 
                          : 'bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {client.name}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: Trend Radar */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Target className="w-6 h-6 text-red-400" />
                Live Trend Radar
              </h2>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={scanTrends}
                disabled={isScanning}
                className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors border border-red-500/20"
              >
                <RefreshCw className={`w-5 h-5 ${isScanning ? 'animate-spin' : ''}`} />
              </motion.button>
            </div>

            {isScanning ? (
              <div className="h-[500px] flex flex-col items-center justify-center glass-card rounded-2xl border border-white/5 relative overflow-hidden">
                {/* Radar pulse animation */}
                <motion.div
                  animate={{ scale: [1, 2, 3], opacity: [0.5, 0.2, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                  className="absolute w-32 h-32 border-2 border-red-500/50 rounded-full"
                />
                <motion.div
                  animate={{ scale: [1, 2, 3], opacity: [0.5, 0.2, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
                  className="absolute w-32 h-32 border-2 border-red-500/50 rounded-full"
                />
                <Radar className="w-12 h-12 text-red-400 animate-pulse relative z-10 mb-4" />
                <p className="text-red-400 font-tactical tracking-widest text-sm relative z-10">INTERCEPTING ALGORITHM SIGNALS...</p>
              </div>
            ) : (
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                className="space-y-4"
              >
                {trends.map((trend) => (
                  <motion.div
                    key={trend.id}
                    variants={staggerItem}
                    className="glass-card p-6 rounded-2xl border border-white/10 hover:border-red-500/30 transition-all group relative overflow-hidden"
                  >
                    {/* Hover glow */}
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/0 to-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    
                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="px-3 py-1 text-xs font-bold rounded-full bg-red-500/20 text-red-400 border border-red-500/20">
                            {trend.velocity}
                          </span>
                          <span className="text-gray-400 text-sm font-medium">{trend.platform}</span>
                        </div>
                        <h3 className="text-xl font-bold">{trend.trend_name}</h3>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-green-400 to-emerald-600">
                          {trend.virality_score}
                        </span>
                        <span className="text-xs text-gray-400 font-tactical">VIRALITY SCORE</span>
                      </div>
                    </div>

                    <p className="text-gray-400 text-sm mb-6 relative z-10">
                      {trend.description}
                    </p>

                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex gap-2">
                        {trend.mutator_tags?.map((tag: string) => (
                          <span key={tag} className="text-xs px-2 py-1 bg-white/5 rounded-md text-gray-300">
                            #{tag}
                          </span>
                        ))}
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleSnipe(trend)}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg font-bold text-sm shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_30px_rgba(239,68,68,0.5)] transition-all flex items-center gap-2"
                      >
                        Snipe Trend <ArrowRight className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>

          {/* RIGHT COLUMN: Cross-Platform Mutator (Omni-Deck) */}
          <div className="lg:col-span-5">
            <h2 className="text-2xl font-bold flex items-center gap-2 mb-6">
              <Zap className="w-6 h-6 text-indigo-400" />
              Auto-Sniper Mutator
            </h2>

            <div className="glass-card rounded-2xl border border-white/10 p-6 sticky top-24">
              <AnimatePresence mode="wait">
                {!selectedTrend ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-64 flex flex-col items-center justify-center text-center text-gray-500"
                  >
                    <Target className="w-12 h-12 mb-4 opacity-50" />
                    <p>Select a trend from the radar<br/>to initialize the Auto-Sniper sequence.</p>
                  </motion.div>
                ) : published ? (
                  <motion.div
                    key="success"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="h-64 flex flex-col items-center justify-center text-center"
                  >
                    <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-4 border border-green-500/30">
                      <CheckCircle2 className="w-10 h-10 text-green-400" />
                    </div>
                    <h3 className="text-xl font-bold text-green-400 mb-2">Trend Sniped Successfully</h3>
                    <p className="text-gray-400">Deployed 3 optimized variations to active platforms.</p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="selected"
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -20, opacity: 0 }}
                    className="space-y-6"
                  >
                    <div>
                      <h3 className="text-lg font-bold mb-1 text-white">{selectedTrend.trend_name}</h3>
                      <p className="text-sm text-gray-400">Suggested Hook: <span className="text-gray-200 italic">"{selectedTrend.suggested_hook}"</span></p>
                    </div>

                    <div className="space-y-4">
                      <p className="text-sm font-tactical text-gray-400">ACTIVE PLATFORM MUTATORS</p>
                      
                      {/* Instagram Toggle */}
                      <div 
                        onClick={() => setPlatforms(p => ({ ...p, instagram: !p.instagram }))}
                        className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${platforms.instagram ? 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 border-pink-500/30' : 'bg-white/5 border-white/10'}`}
                      >
                        <div className="flex items-center gap-3">
                          <Instagram className={`w-5 h-5 ${platforms.instagram ? 'text-pink-400' : 'text-gray-500'}`} />
                          <div>
                            <p className={`font-bold ${platforms.instagram ? 'text-white' : 'text-gray-400'}`}>Instagram Reels</p>
                            <p className="text-xs text-gray-500">Mutator: Aesthetic cover + Hashtag optimization</p>
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded border ${platforms.instagram ? 'bg-pink-500 border-pink-500' : 'border-gray-600'} flex items-center justify-center`}>
                          {platforms.instagram && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                      </div>

                      {/* TikTok Toggle */}
                      <div 
                        onClick={() => setPlatforms(p => ({ ...p, tiktok: !p.tiktok }))}
                        className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${platforms.tiktok ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-white/5 border-white/10'}`}
                      >
                        <div className="flex items-center gap-3">
                          <Zap className={`w-5 h-5 ${platforms.tiktok ? 'text-cyan-400' : 'text-gray-500'}`} />
                          <div>
                            <p className={`font-bold ${platforms.tiktok ? 'text-white' : 'text-gray-400'}`}>TikTok</p>
                            <p className="text-xs text-gray-500">Mutator: Aggressive 3s hook + Trending audio link</p>
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded border ${platforms.tiktok ? 'bg-cyan-500 border-cyan-500' : 'border-gray-600'} flex items-center justify-center`}>
                          {platforms.tiktok && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                      </div>

                      {/* YouTube Toggle */}
                      <div 
                        onClick={() => setPlatforms(p => ({ ...p, youtube: !p.youtube }))}
                        className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${platforms.youtube ? 'bg-red-500/10 border-red-500/30' : 'bg-white/5 border-white/10'}`}
                      >
                        <div className="flex items-center gap-3">
                          <Youtube className={`w-5 h-5 ${platforms.youtube ? 'text-red-400' : 'text-gray-500'}`} />
                          <div>
                            <p className={`font-bold ${platforms.youtube ? 'text-white' : 'text-gray-400'}`}>YouTube Shorts</p>
                            <p className="text-xs text-gray-500">Mutator: High retention editing + Search SEO description</p>
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded border ${platforms.youtube ? 'bg-red-500 border-red-500' : 'border-gray-600'} flex items-center justify-center`}>
                          {platforms.youtube && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-white/10 space-y-3">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleAutoPublish}
                        disabled={publishing || (!platforms.instagram && !platforms.tiktok && !platforms.youtube)}
                        className="w-full py-4 rounded-xl bg-gradient-to-r from-red-600 to-indigo-600 text-white font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {publishing ? (
                          <>
                            <RefreshCw className="w-5 h-5 animate-spin" /> Muting Assets & Publishing...
                          </>
                        ) : (
                          <>
                            <Send className="w-5 h-5" /> Execute Zero-Click Publish (5 Credits)
                          </>
                        )}
                      </motion.button>
                      
                      <AnimatePresence>
                        {isScheduling ? (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-3 overflow-hidden"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <CalendarClock className="w-4 h-4 text-purple-400" />
                              <span className="text-sm font-bold text-white">Select Broadcast Time</span>
                            </div>
                            <input
                              type="datetime-local"
                              value={scheduleTime}
                              onChange={(e) => setScheduleTime(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-purple-500/50 transition-colors"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => setIsScheduling(false)}
                                className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold transition-all text-gray-300"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleSchedulePublish}
                                disabled={publishing || !scheduleTime}
                                className="flex-1 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:shadow-[0_0_25px_rgba(168,85,247,0.5)] transition-all disabled:opacity-50"
                              >
                                {publishing ? "Scheduling..." : "Confirm Schedule (5 Credits)"}
                              </button>
                            </div>
                          </motion.div>
                        ) : scheduled ? (
                          <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="w-full py-3 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold flex items-center justify-center gap-2"
                          >
                            <CalendarClock className="w-5 h-5" /> Campaign Queued Successfully
                          </motion.div>
                        ) : (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setIsScheduling(true)}
                            disabled={publishing || (!platforms.instagram && !platforms.tiktok && !platforms.youtube)}
                            className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <CalendarClock className="w-5 h-5 text-purple-400" /> Schedule for Later
                          </motion.button>
                        )}
                      </AnimatePresence>
                      
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleEditInWarRoom}
                        disabled={publishing}
                        className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
                      >
                        Edit Campaign in War Room
                      </motion.button>

                      {agencyMode && (
                        <div className="mt-4 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                          <div className="flex items-center gap-2 mb-3">
                            <Building className="w-4 h-4 text-indigo-400" />
                            <span className="text-sm font-bold text-indigo-400">AGENCY ACTION:</span>
                          </div>
                          {!shareLink ? (
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={handleGenerateShareLink}
                              className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                            >
                              <LinkIcon className="w-4 h-4" /> Share for Client Approval
                            </motion.button>
                          ) : (
                            <div className="flex flex-col gap-2">
                              <span className="text-xs text-green-400 font-bold">✓ Share Link Generated</span>
                              <div className="flex items-center gap-2">
                                <input 
                                  readOnly 
                                  value={shareLink} 
                                  className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-300 outline-none"
                                />
                                <button 
                                  onClick={copyToClipboard}
                                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white"
                                >
                                  {copiedLink ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <p className="text-center text-xs text-gray-500 mt-3 font-tactical">DIAMOND CASCADE WILL AUTONOMOUSLY OPTIMIZE CAPTIONS FOR EACH PLATFORM</p>
                    </div>

                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

        </div>

        {/* ========================================================= */}
        {/* SPRINT 5: THE AUTHORITY DEFENDER - LIVE ENGAGEMENT RADAR */}
        {/* ========================================================= */}
        <div className="mt-8 glass-card rounded-2xl border border-white/10 p-6 relative overflow-hidden">
          {/* Animated scanline effect for the radar */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent h-20 w-full z-0 pointer-events-none"
            animate={{ y: [-100, 800] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          />
          
          <div className="flex items-center justify-between mb-6 relative z-10">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 text-cyan-400" />
              Authority Defender <span className="text-sm font-tactical text-gray-500 tracking-widest ml-2">LIVE LISTENING RADAR</span>
            </h2>
            <div className="flex items-center gap-2 text-xs font-tactical text-gray-400">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              SYSTEM ACTIVE
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            <AnimatePresence>
              {engagements.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="col-span-full h-40 flex flex-col items-center justify-center text-gray-500 border border-dashed border-white/10 rounded-xl"
                >
                  <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
                  <p>Monitoring Meta Webhooks for incoming comments...</p>
                </motion.div>
              ) : (
                engagements.map((eng) => (
                  <motion.div
                    key={eng.id}
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className={`rounded-xl border p-4 shadow-lg flex flex-col justify-between ${
                      eng.sentiment === 'NEGATIVE' || eng.sentiment === 'TROLL' 
                        ? 'bg-red-500/5 border-red-500/20' 
                        : eng.sentiment === 'POSITIVE' 
                          ? 'bg-green-500/5 border-green-500/20' 
                          : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="font-bold text-sm text-gray-300">@{eng.username}</span>
                        </div>
                        <span className={`text-[10px] px-2 py-1 rounded font-bold tracking-wider ${
                          eng.sentiment === 'NEGATIVE' || eng.sentiment === 'TROLL' 
                            ? 'bg-red-500/20 text-red-400' 
                            : eng.sentiment === 'POSITIVE' 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {eng.sentiment}
                        </span>
                      </div>
                      
                      <p className="text-sm text-white mb-4 italic">"{eng.comment}"</p>
                      
                      <div className="bg-black/30 rounded-lg p-3 border border-white/5">
                        <div className="flex items-center gap-2 mb-1">
                          <Shield className="w-3 h-3 text-indigo-400" />
                          <span className="text-[10px] text-gray-500 font-tactical">AI AUTO-REPLY DRAFT</span>
                        </div>
                        <p className="text-xs text-indigo-300 font-medium leading-relaxed">{eng.ai_reply}</p>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                      <span className="text-xs text-gray-500">{new Date(eng.timestamp).toLocaleTimeString()}</span>
                      <button className="text-xs font-bold bg-indigo-500/20 text-indigo-400 px-3 py-1.5 rounded hover:bg-indigo-500/30 transition-colors">
                        Approve & Send
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

      </main>
    </div>
  );
}

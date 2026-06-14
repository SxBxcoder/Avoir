'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radar, Target, Instagram, Youtube, ArrowRight, Zap, RefreshCw, Send, CheckCircle2 } from 'lucide-react';
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
    setPublishing(true);
    try {
      const activePlatforms = Object.entries(platforms)
        .filter(([_, active]) => active)
        .map(([key]) => key);

      const res = await fetch('http://localhost:8000/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: selectedTrend.id,
          platforms: activePlatforms
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setTimeout(() => {
          setPublishing(false);
          setPublished(true);
          setTimeout(() => {
            setPublished(false);
            setSelectedTrend(null);
          }, 3000);
        }, 2000);
      }
    } catch (err) {
      console.error(err);
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

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push('/')}
            className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-colors flex items-center gap-2 glass-card"
          >
            Back to War Room
          </motion.button>
        </div>

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
                            <Send className="w-5 h-5" /> Execute Zero-Click Publish
                          </>
                        )}
                      </motion.button>
                      
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleEditInWarRoom}
                        disabled={publishing}
                        className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
                      >
                        Edit Campaign in War Room
                      </motion.button>
                      <p className="text-center text-xs text-gray-500 mt-3 font-tactical">DIAMOND CASCADE WILL AUTONOMOUSLY OPTIMIZE CAPTIONS FOR EACH PLATFORM</p>
                    </div>

                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

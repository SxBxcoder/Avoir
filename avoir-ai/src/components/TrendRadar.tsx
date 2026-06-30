'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radar, TrendingUp, TrendingDown, Activity, ChevronRight, Sparkles, Loader2, Minimize2, Maximize2 } from 'lucide-react';

interface TrendTopic {
  keyword: string;
  momentum: 'rising' | 'peaking' | 'falling';
  searchVolume: string;
  sentiment: 'positive' | 'neutral' | 'mixed';
  context: string;
}

interface TrendRadarProps {
  industry: string;
  onInjectTrend: (trend: string) => void;
}

export default function TrendRadar({ industry, onInjectTrend }: TrendRadarProps) {
  const [trends, setTrends] = useState<TrendTopic[]>([]);
  const [viralHooks, setViralHooks] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [hoveredTrend, setHoveredTrend] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    const fetchTrends = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/trends?industry=${encodeURIComponent(industry)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.trends && mounted) {
            setTrends(data.trends.topTrends);
            setViralHooks(data.trends.viralHooks);
          }
        }
      } catch (err) {
        console.error('Failed to fetch trends:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    fetchTrends();

    return () => {
      mounted = false;
    };
  }, [industry]);

  if (isMinimized) {
    return (
      <motion.button
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => setIsMinimized(false)}
        className="fixed top-24 right-4 z-40 p-3 bg-zinc-950/80 backdrop-blur-xl border border-rose-500/30 rounded-xl shadow-[0_0_20px_rgba(244,63,94,0.1)] group transition-all hover:border-rose-500/60 flex items-center gap-3"
      >
        <Radar className="w-5 h-5 text-rose-400 group-hover:animate-[spin_4s_linear_infinite]" />
        <span className="text-xs font-tactical tracking-widest text-white">TREND RADAR</span>
        <Maximize2 className="w-4 h-4 text-zinc-500" />
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="fixed top-24 right-4 z-40 w-80 bg-zinc-950/90 backdrop-blur-xl border border-zinc-800/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-120px)]"
    >
      {/* Header */}
      <div className="p-4 border-b border-zinc-800/50 bg-gradient-to-r from-rose-500/5 to-transparent flex items-center justify-between sticky top-0 backdrop-blur-xl z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Radar className="w-5 h-5 text-rose-400 animate-[spin_4s_linear_infinite]" />
            <div className="absolute inset-0 bg-rose-500/20 blur-md rounded-full" />
          </div>
          <div>
            <h3 className="text-xs font-bold font-tactical tracking-widest text-rose-400">TREND RADAR</h3>
            <p className="text-[10px] text-zinc-500 uppercase">Live: {industry}</p>
          </div>
        </div>
        <button onClick={() => setIsMinimized(true)} className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors">
          <Minimize2 className="w-4 h-4 text-zinc-500" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-4">
            <Loader2 className="w-6 h-6 text-rose-400 animate-spin" />
            <p className="text-xs text-zinc-500 font-tactical tracking-wider">SCANNING THE ZEITGEIST...</p>
          </div>
        ) : (
          <>
            {/* Top Trends */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" />
                Cultural Momentum
              </h4>
              <div className="space-y-2">
                {trends.map((trend, idx) => (
                  <motion.div
                    key={trend.keyword}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    onMouseEnter={() => setHoveredTrend(trend.keyword)}
                    onMouseLeave={() => setHoveredTrend(null)}
                    className="relative p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/30 hover:bg-zinc-900/80 hover:border-rose-500/30 transition-all cursor-default group"
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {trend.momentum === 'rising' && <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
                        {trend.momentum === 'peaking' && <Activity className="w-3.5 h-3.5 text-rose-400" />}
                        {trend.momentum === 'falling' && <TrendingDown className="w-3.5 h-3.5 text-zinc-500" />}
                        <span className="text-sm font-bold text-white capitalize">{trend.keyword}</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        {trend.searchVolume}
                      </span>
                    </div>
                    
                    <AnimatePresence>
                      {hoveredTrend === trend.keyword ? (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-xs text-zinc-400 leading-relaxed mt-2"
                        >
                          {trend.context}
                        </motion.p>
                      ) : (
                        <motion.p
                          initial={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="text-xs text-zinc-500 line-clamp-1"
                        >
                          {trend.context}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    <button
                      onClick={() => onInjectTrend(`Incorporate the current trend of "${trend.keyword}" (${trend.context})`)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 bg-rose-500/20 hover:bg-rose-500/40 text-rose-400 rounded-lg transition-all translate-y-2 group-hover:translate-y-0"
                      title="Inject into Prompt"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Viral Formats */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" />
                Viral Formats
              </h4>
              <div className="space-y-2">
                {viralHooks.map((hook, idx) => (
                  <button
                    key={idx}
                    onClick={() => onInjectTrend(`Use this viral hook format: "${hook}"`)}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg border border-zinc-800 hover:border-rose-500/30 hover:bg-rose-500/5 text-left group transition-all"
                  >
                    <span className="text-xs text-zinc-300 font-medium truncate pr-2">"{hook}"</span>
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-rose-400 transition-colors flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radar, TrendingUp, TrendingDown, Activity, ChevronRight, Sparkles, Loader2, Minimize2, Maximize2, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/auth/provider';
import { clientLog } from '@/lib/logClient';

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
  const { accessToken } = useAuth();
  const [trends, setTrends] = useState<TrendTopic[]>([]);
  const [viralHooks, setViralHooks] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [hoveredTrend, setHoveredTrend] = useState<string | null>(null);
  const [source, setSource] = useState<string>('mock');
  const [cachedUntil, setCachedUntil] = useState<string | undefined>();

  const fetchTrends = useCallback(async (fresh = false) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ industry });
      if (fresh) params.set('fresh', 'true');

      const res = await fetch(`/api/trends?${params}`, {
        headers: accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.trends) {
          setTrends(data.trends.topTrends || []);
          setViralHooks(data.trends.viralHooks || []);
          setSource(data.source || data.trends.source || 'mock');
          setCachedUntil(data.trends.cachedUntil || data.cachedUntil);
        }
      }
    } catch (err) {
      clientLog.error('Failed to fetch trends:', err);
    } finally {
      setIsLoading(false);
    }
  }, [industry, accessToken]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  const handleRefresh = () => fetchTrends(true);

  if (isMinimized) {
    return (
      <motion.button
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => setIsMinimized(false)}
        className="fixed top-24 right-4 z-40 p-3 bg-card/80 backdrop-blur-xl border border-danger rounded-xl shadow-[0_0_20px_rgba(244,63,94,0.1)] group transition-all hover:border-danger flex items-center gap-3"
      >
        <Radar className="w-5 h-5 text-danger group-hover:animate-[spin_4s_linear_infinite]" />
        <span className="text-xs font-tactical tracking-widest text-foreground">TREND RADAR</span>
        <Maximize2 className="w-4 h-4 text-muted-foreground" />
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="fixed top-24 right-4 z-40 w-80 bg-card/90 backdrop-blur-xl border border-border/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-120px)]"
    >
      {/* Header */}
      <div className="p-4 border-b border-border/50 bg-gradient-to-r from-rose-500/5 to-transparent flex items-center justify-between sticky top-0 backdrop-blur-xl z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Radar className="w-5 h-5 text-danger animate-[spin_4s_linear_infinite]" />
            <div className="absolute inset-0 bg-danger/20 blur-md rounded-full" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold font-tactical tracking-widest text-danger">TREND RADAR</h3>
              <SourceBadge source={source} cachedUntil={cachedUntil} />
            </div>
            <p className="text-[10px] text-muted-foreground uppercase">Live: {industry}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-1.5 hover:bg-muted rounded-lg transition-colors"
            title="Force refresh trends"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setIsMinimized(true)} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
            <Minimize2 className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-4">
            <Loader2 className="w-6 h-6 text-danger animate-spin" />
            <p className="text-xs text-muted-foreground font-tactical tracking-wider">SCANNING THE ZEITGEIST...</p>
          </div>
        ) : trends.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-3">
            <Radar className="w-8 h-8 text-zinc-700" />
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              No trend data available.<br />
              Configure <span className="text-danger font-mono">SERPAPI_KEY</span> in the backend for real-time Google Trends.
            </p>
          </div>
        ) : (
          <>
            {/* Top Trends */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
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
                    className="relative p-3 rounded-xl border border-border/80 bg-card/30 hover:bg-card/80 hover:border-danger transition-all cursor-default group"
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {trend.momentum === 'rising' && <TrendingUp className="w-3.5 h-3.5 text-success" />}
                        {trend.momentum === 'peaking' && <Activity className="w-3.5 h-3.5 text-danger" />}
                        {trend.momentum === 'falling' && <TrendingDown className="w-3.5 h-3.5 text-muted-foreground" />}
                        <span className="text-sm font-bold text-foreground capitalize">{trend.keyword}</span>
                      </div>
                      <span className="text-[10px] font-mono text-success bg-success/10 px-1.5 py-0.5 rounded border border-success">
                        {trend.searchVolume}
                      </span>
                    </div>
                    
                    <AnimatePresence>
                      {hoveredTrend === trend.keyword ? (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-xs text-muted-foreground leading-relaxed mt-2"
                        >
                          {trend.context}
                        </motion.p>
                      ) : (
                        <motion.p
                          initial={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="text-xs text-muted-foreground line-clamp-1"
                        >
                          {trend.context}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    <button
                      onClick={() => onInjectTrend(`Incorporate the current trend of "${trend.keyword}" (${trend.context})`)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 bg-danger/20 hover:bg-danger/40 text-danger rounded-lg transition-all translate-y-2 group-hover:translate-y-0"
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
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" />
                Viral Formats
              </h4>
              <div className="space-y-2">
                {viralHooks.map((hook, idx) => (
                  <button
                    key={idx}
                    onClick={() => onInjectTrend(`Use this viral hook format: "${hook}"`)}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg border border-border hover:border-danger hover:bg-danger/5 text-left group transition-all"
                  >
                    <span className="text-xs text-muted-foreground font-medium truncate pr-2">&ldquo;{hook}&rdquo;</span>
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-danger transition-colors flex-shrink-0" />
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

// ============================================================================
// SOURCE BADGE
// ============================================================================

function SourceBadge({ source, cachedUntil }: { source: string; cachedUntil?: string }) {
  if (source === 'serpapi' || source === 'pytrends') {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono tracking-widest border border-emerald-500/30">
        LIVE
      </span>
    );
  }
  if (source === 'reddit') {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 font-mono tracking-widest border border-orange-500/30">
        LIVE · Reddit
      </span>
    );
  }
  if (source === 'cache') {
    const timeLeft = cachedUntil
      ? `${Math.max(0, Math.round((new Date(cachedUntil).getTime() - Date.now()) / (1000 * 60 * 60)))}h left`
      : '';
    return (
      <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono tracking-widest border border-blue-500/30">
        CACHED {timeLeft && `· ${timeLeft}`}
      </span>
    );
  }
  return (
    <span className="text-[10px] px-2 py-0.5 rounded bg-muted/80 text-muted-foreground font-mono tracking-widest border border-border">
      DEMO
    </span>
  );
}

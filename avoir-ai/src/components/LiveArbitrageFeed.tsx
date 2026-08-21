'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, ShieldAlert, BarChart2, Cpu } from 'lucide-react';

interface ArbitrageOpportunity {
  id: string;
  topic: string;
  niche: string;
  competition: number; // 0-100
  predictedRoas: number;
  momentum: number; // 0-100
  directive: string;
}

/**
 * Fallback used only when the live feed is unreachable or returns nothing.
 * The SIMULATED DATA badge stays visible whenever this is on screen.
 */
const MOCK_OPPORTUNITIES: ArbitrageOpportunity[] = [
  {
    id: 'opp-1',
    topic: 'Corporate Villain Era',
    niche: 'Fashion / Streetwear',
    competition: 12,
    predictedRoas: 4.2,
    momentum: 94,
    directive: 'Viral campaign for streetwear capitalizing on the Corporate Villain Era trend',
  },
  {
    id: 'opp-2',
    topic: 'Authentic Lo-Fi Over Polish',
    niche: 'Beauty / Skincare',
    competition: 28,
    predictedRoas: 3.8,
    momentum: 88,
    directive: 'Raw, unedited TikTok style lo-fi campaign for skincare avoiding overproduced aesthetics',
  },
  {
    id: 'opp-3',
    topic: 'Anti-Hustle Culture',
    niche: 'Beverage / Energy',
    competition: 18,
    predictedRoas: 5.1,
    momentum: 97,
    directive: 'Energy drink campaign targeting anti-hustle culture and sustainable focus',
  }
];

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function LiveArbitrageFeed({
  onDeploy,
  industry = 'general',
}: {
  onDeploy: (directive: string) => void;
  industry?: string;
}) {
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const fetchSeq = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const seq = ++fetchSeq.current;
      try {
        const res = await fetch(`/api/arbitrage?industry=${encodeURIComponent(industry)}`);
        if (!res.ok) throw new Error(`API responded ${res.status}`);
        const data = await res.json();
        if (cancelled || seq !== fetchSeq.current) return;

        const items: ArbitrageOpportunity[] = Array.isArray(data.opportunities)
          ? data.opportunities
          : [];

        if (items.length > 0) {
          setOpportunities(items);
          setIsLive(true);
          setSource(data.source ?? null);
        } else {
          // Backend reachable but no trend keys configured — stay honest.
          setOpportunities(MOCK_OPPORTUNITIES);
          setIsLive(false);
          setSource(null);
        }
      } catch {
        if (cancelled || seq !== fetchSeq.current) return;
        setOpportunities(MOCK_OPPORTUNITIES);
        setIsLive(false);
        setSource(null);
      } finally {
        if (!cancelled && seq === fetchSeq.current) setIsLoading(false);
      }
    }

    setIsLoading(true);
    setActiveIdx(0);
    load();
    const interval = setInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [industry]);

  // Auto-rotate the highlighted opportunity
  useEffect(() => {
    if (opportunities.length < 2) return;
    const interval = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % opportunities.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [opportunities]);

  const hasData = opportunities.length > 0;

  return (
    <div className="w-full max-w-5xl mx-auto p-4 lg:p-8 flex flex-col items-center justify-center min-h-[70vh]">

      {/* Header */}
      <div className="text-center mb-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-danger/10 border border-danger mb-4"
        >
          <div className="w-2 h-2 rounded-full bg-danger animate-pulse" />
          <span className="text-[10px] font-tactical text-danger tracking-widest">LIVE MARKET DATA</span>
        </motion.div>
        {/* Honesty badge: only shown when mock fallback data is on screen */}
        {!isLive && !isLoading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/80 border border-border mb-4 ml-3"
          >
            <span className="text-[10px] font-mono text-muted-foreground tracking-widest">SIMULATED DATA</span>
          </motion.div>
        )}
        {isLive && source && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success/10 border border-success mb-4 ml-3"
          >
            <span className="text-[10px] font-mono text-success tracking-widest uppercase">SOURCE · {source}</span>
          </motion.div>
        )}
        <h1 className="text-4xl lg:text-5xl font-bold font-tactical tracking-wider text-foreground mb-4">
          CULTURAL <span className="text-transparent bg-clip-text bg-gradient-to-r from-info to-cyan">ARBITRAGE</span>
        </h1>
        <p className="text-muted-foreground text-sm max-w-xl mx-auto font-mono">
          Our AI Quants are scanning global social networks for mispriced attention.
          Deploy capital into high-momentum trends before market saturation.
        </p>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[0, 1, 2].map((idx) => (
            <div key={idx} className="rounded-2xl border border-border/50 bg-card/40 p-6 animate-pulse min-h-[220px]" />
          ))}
        </div>
      )}

      {/* Main Radar Display */}
      {!isLoading && hasData && (
        <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
          {/* Background grid effect */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none" />

          {opportunities.map((opp, idx) => {
            const isActive = idx === activeIdx;
            return (
              <motion.div
                layout
                key={opp.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1, type: "spring", stiffness: 300, damping: 30 }}
                onClick={() => setActiveIdx(idx)}
                className={`relative rounded-2xl border p-6 cursor-pointer transition-all duration-300 ${
                  isActive
                    ? 'bg-card/80 border-info shadow-[0_0_30px_rgba(99,102,241,0.15)] scale-105 z-10'
                    : 'bg-card/50 border-border/50 hover:border-border hover:bg-card/50 scale-100 z-0 opacity-60 hover:opacity-100'
                }`}
              >
                {/* Active Indicator */}
                {isActive && (
                  <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-1/3 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
                )}

                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-tactical text-info mb-1 tracking-widest">OPPORTUNITY</span>
                    <h3 className="text-lg font-bold text-foreground leading-tight">{opp.topic}</h3>
                  </div>
                  <div className="p-2 rounded-lg bg-white/5">
                    <TrendingUp className={`w-5 h-5 ${isActive ? 'text-success' : 'text-muted-foreground'}`} />
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-background/50 rounded-lg p-3 border border-border">
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] text-muted-foreground font-mono">
                      <ShieldAlert className="w-3 h-3" /> COMPETITION
                    </div>
                    <div className="text-lg font-tactical text-success">{opp.competition}%</div>
                  </div>
                  <div className="bg-background/50 rounded-lg p-3 border border-border">
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] text-muted-foreground font-mono">
                      <BarChart2 className="w-3 h-3" /> PRED. ROAS
                    </div>
                    <div className="text-lg font-tactical text-info">{opp.predictedRoas}x</div>
                  </div>
                </div>

                {/* Action Button */}
                <AnimatePresence>
                  {isActive && (
                    <motion.button
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeploy(opp.directive);
                      }}
                      className="w-full py-3 rounded-xl bg-info text-white font-tactical text-sm tracking-wider hover:bg-info transition-colors flex items-center justify-center gap-2 group overflow-hidden relative"
                    >
                      <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:250%_250%,100%_100%] animate-shimmer" />
                      <Cpu className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      EXECUTE TRADE
                    </motion.button>
                  )}
                </AnimatePresence>

              </motion.div>
            );
          })}
        </div>
      )}

    </div>
  );
}

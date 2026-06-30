import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, TrendingUp, Zap, Target, BarChart2, ShieldAlert, Cpu } from 'lucide-react';

interface ArbitrageOpportunity {
  id: string;
  topic: string;
  niche: string;
  competition: number; // 0-100
  predictedRoas: number;
  momentum: number; // 0-100
  directive: string;
}

const LIVE_OPPORTUNITIES: ArbitrageOpportunity[] = [
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

export function LiveArbitrageFeed({ onDeploy }: { onDeploy: (directive: string) => void }) {
  const [activeIdx, setActiveIdx] = useState(0);

  // Auto-rotate the highlighted opportunity
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % LIVE_OPPORTUNITIES.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-5xl mx-auto p-4 lg:p-8 flex flex-col items-center justify-center min-h-[70vh]">
      
      {/* Header */}
      <div className="text-center mb-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 mb-4"
        >
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] font-tactical text-red-400 tracking-widest">LIVE MARKET DATA</span>
        </motion.div>
        <h1 className="text-4xl lg:text-5xl font-bold font-tactical tracking-wider text-white mb-4">
          CULTURAL <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">ARBITRAGE</span>
        </h1>
        <p className="text-zinc-400 text-sm max-w-xl mx-auto font-mono">
          Our AI Quants are scanning global social networks for mispriced attention. 
          Deploy capital into high-momentum trends before market saturation.
        </p>
      </div>

      {/* Main Radar Display */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
        {/* Background grid effect */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none" />
        
        {LIVE_OPPORTUNITIES.map((opp, idx) => {
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
                  ? 'bg-zinc-900/80 border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.15)] scale-105 z-10' 
                  : 'bg-zinc-950/50 border-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-900/50 scale-100 z-0 opacity-60 hover:opacity-100'
              }`}
            >
              {/* Active Indicator */}
              {isActive && (
                <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-1/3 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
              )}

              <div className="flex justify-between items-start mb-4">
                <div className="flex flex-col">
                  <span className="text-[10px] font-tactical text-indigo-400 mb-1 tracking-widest">OPPORTUNITY</span>
                  <h3 className="text-lg font-bold text-white leading-tight">{opp.topic}</h3>
                </div>
                <div className="p-2 rounded-lg bg-white/5">
                  <TrendingUp className={`w-5 h-5 ${isActive ? 'text-green-400' : 'text-zinc-500'}`} />
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-black/50 rounded-lg p-3 border border-white/5">
                  <div className="flex items-center gap-1.5 mb-1 text-[10px] text-zinc-500 font-mono">
                    <ShieldAlert className="w-3 h-3" /> COMPETITION
                  </div>
                  <div className="text-lg font-tactical text-emerald-400">{opp.competition}%</div>
                </div>
                <div className="bg-black/50 rounded-lg p-3 border border-white/5">
                  <div className="flex items-center gap-1.5 mb-1 text-[10px] text-zinc-500 font-mono">
                    <BarChart2 className="w-3 h-3" /> PRED. ROAS
                  </div>
                  <div className="text-lg font-tactical text-indigo-400">{opp.predictedRoas}x</div>
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
                    className="w-full py-3 rounded-xl bg-indigo-500 text-white font-tactical text-sm tracking-wider hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2 group overflow-hidden relative"
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

    </div>
  );
}

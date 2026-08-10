'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Zap, TrendingUp, Target, Loader2, ArrowRight } from 'lucide-react';

interface AlphaBriefData {
  trend: {
    title: string;
    description: string;
    momentum: string;
  };
  brief: {
    plan?: {
      hook?: string;
      offer?: string;
      cta?: string;
    };
    captions?: string[];
  };
}

const FALLBACK_BRIEF: AlphaBriefData = {
  trend: {
    title: 'AI Micro-Agents',
    description: 'Explosive growth in single-purpose AI agents replacing complex SaaS.',
    momentum: 'peaking',
  },
  brief: {
    plan: {
      hook: '🔥 The era of bloated SaaS is dead. Say hello to Micro-Agents.',
      offer: 'Deploy 5 highly-specialized AI agents for the cost of 1 generic tool.',
      cta: 'Start building your automated army today 🚀',
    },
  },
};

export default function DailyAlphaBrief() {
  const [data, setData] = useState<AlphaBriefData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Fetches today's Redis-cached brief from /api/alpha-brief.
    // Falls back to the local mock if the API is unreachable so the UI never breaks.
    const fetchBrief = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/alpha-brief');
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const brief = await res.json();
        setData(brief);
      } catch (err) {
        console.warn('[DailyAlphaBrief] API unavailable, using local fallback:', err);
        setData(FALLBACK_BRIEF);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBrief();
  }, []);

  if (isDismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-zinc-950/80 backdrop-blur-xl shadow-[0_0_30px_rgba(99,102,241,0.15)] mb-8"
    >
      {/* Animated Background Glow */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/20 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-rose-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="p-6 relative z-10 flex flex-col md:flex-row gap-6 items-start">
        {/* Left Column: Context */}
        <div className="w-full md:w-1/3 space-y-4 border-b md:border-b-0 md:border-r border-zinc-800/50 pb-4 md:pb-0 md:pr-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-tactical tracking-widest text-indigo-400 font-bold uppercase">Daily Alpha Brief</h2>
          </div>
          
          {isLoading ? (
            <div className="flex items-center gap-3 text-zinc-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs font-mono">Decrypting market signals...</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-rose-500/10 text-rose-400 text-[10px] font-mono rounded border border-rose-500/20 uppercase">
                  Anomaly Detected
                </span>
              </div>
              <h3 className="text-xl font-bold text-white leading-tight">{data?.trend.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{data?.trend.description}</p>
            </div>
          )}
        </div>

        {/* Right Column: Execution */}
        <div className="w-full md:w-2/3 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Tactical Playbook</h3>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <div className="h-12 bg-zinc-900/50 rounded-lg animate-pulse" />
              <div className="h-12 bg-zinc-900/50 rounded-lg animate-pulse" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 hover:border-indigo-500/30 transition-colors">
                <p className="text-[10px] text-zinc-500 font-mono uppercase mb-1">Hook</p>
                <p className="text-sm text-zinc-300 font-medium">{data?.brief?.plan?.hook}</p>
              </div>
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 hover:border-indigo-500/30 transition-colors">
                <p className="text-[10px] text-zinc-500 font-mono uppercase mb-1">Offer</p>
                <p className="text-sm text-zinc-300 font-medium">{data?.brief?.plan?.offer}</p>
              </div>
            </div>
          )}

          {/* Action Row */}
          {!isLoading && (
            <div className="pt-4 flex items-center justify-between">
              <button 
                onClick={() => setIsDismissed(true)}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Dismiss
              </button>
              <button 
                onClick={() => {
                  document.getElementById('active-positions-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-[0_0_15px_rgba(99,102,241,0.4)]">
                Deploy to Omni-Deck
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

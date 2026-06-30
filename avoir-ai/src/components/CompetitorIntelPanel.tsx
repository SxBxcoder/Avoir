'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Eye, Flame, AlertTriangle, Target, Activity, Loader2, X } from 'lucide-react';

interface CompetitorAd {
  id: string;
  brand: string;
  hook: string;
  engagement: string;
  runTime: string;
  detectedFormat: string;
}

interface CompetitorIntel {
  industry: string;
  topAds: CompetitorAd[];
  marketGaps: string[];
  lastUpdated: string;
}

interface CompetitorIntelPanelProps {
  industry: string;
  onClose: () => void;
  onInjectGap: (gap: string) => void;
}

export default function CompetitorIntelPanel({ industry, onClose, onInjectGap }: CompetitorIntelPanelProps) {
  const [intel, setIntel] = useState<CompetitorIntel | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchIntel = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/competitors?industry=${encodeURIComponent(industry)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.intel && mounted) {
            setIntel(data.intel);
          }
        }
      } catch (err) {
        console.error('Failed to fetch competitor intel:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    fetchIntel();
    return () => { mounted = false; };
  }, [industry]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-800/50 flex items-center justify-between bg-gradient-to-r from-orange-500/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-xl">
              <Eye className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white font-tactical tracking-wider">COMPETITOR INTEL</h2>
              <p className="text-sm text-zinc-400 flex items-center gap-2">
                <Target className="w-4 h-4 text-orange-500/70" />
                Live Analysis: <span className="text-orange-400 font-mono">{industry.toUpperCase()}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-xl transition-colors">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
              <p className="text-sm text-zinc-500 font-tactical tracking-wider">ANALYZING AD LIBRARIES...</p>
            </div>
          ) : !intel ? (
            <div className="text-center py-20 text-zinc-500">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No competitor data available for this industry.</p>
            </div>
          ) : (
            <>
              {/* Top Ads */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-400" />
                  Top Performing Competitor Ads
                </h3>
                <div className="grid gap-3">
                  {intel.topAds.map((ad) => (
                    <div key={ad.id} className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/30">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-white bg-zinc-800 px-2 py-1 rounded-md">{ad.brand}</span>
                        <div className="flex items-center gap-2 text-[10px] font-mono">
                          <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                            <Activity className="w-3 h-3" /> {ad.engagement} Engagement
                          </span>
                          <span className="text-zinc-500 bg-zinc-800/50 px-2 py-1 rounded">Run Time: {ad.runTime}</span>
                        </div>
                      </div>
                      <p className="text-sm text-zinc-300 italic border-l-2 border-orange-500/30 pl-3 py-1">"{ad.hook}"</p>
                      <div className="mt-3 text-xs text-zinc-500 flex items-center gap-2">
                        Format: <span className="text-zinc-300">{ad.detectedFormat}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Market Gaps */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  Market Gaps (Opportunities)
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {intel.marketGaps.map((gap, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        onInjectGap(`Position the brand against competitors by focusing on this market gap: "${gap}"`);
                        onClose();
                      }}
                      className="w-full text-left p-3 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400 transition-all text-sm text-zinc-300 group flex justify-between items-center"
                    >
                      <span>{gap}</span>
                      <span className="text-[10px] font-mono text-emerald-500/0 group-hover:text-emerald-500/70 transition-all uppercase tracking-wider">
                        Inject into Strategy →
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

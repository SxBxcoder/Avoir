'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Zap, Loader2, ArrowRight, Bot } from 'lucide-react';
import { MOCK_ALPHA_BRIEF } from '@/lib/mockShield';
import type { AlphaBrief } from '@/lib/alphaBrief';
import { clientLog } from '@/lib/logClient';

const FALLBACK_BRIEF: AlphaBrief = MOCK_ALPHA_BRIEF;

export default function DailyAlphaBrief() {
  const [data, setData] = useState<AlphaBrief | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const fetchBrief = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/alpha-brief');
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const brief = await res.json();
        setData(brief);
      } catch (err) {
        clientLog.warn('[DailyAlphaBrief] API unavailable, using local fallback:', err);
        setData(FALLBACK_BRIEF);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBrief();
  }, []);

  if (isDismissed) return null;

  return (
    <div className="w-full border border-terminal-border bg-terminal-surface mb-3">
      <div className="flex flex-col md:flex-row items-stretch">
        {/* Left: Context */}
        <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-terminal-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-neon-amber" />
            <h2 className="text-[10px] font-bold tracking-[0.2em] text-neon-amber">DAILY ALPHA BRIEF</h2>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-zinc-600">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-[10px]">DECRYPTING MARKET SIGNALS...</span>
            </div>
          ) : (
            <div className="space-y-2">
              <span className="inline-block px-1.5 py-0.5 bg-neon-red/15 text-neon-red text-[9px] font-bold tracking-widest border border-neon-red/30">
                ANOMALY DETECTED
              </span>
              <h3 className="text-[13px] font-bold text-foreground leading-tight">{data?.trend.title}</h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{data?.trend.description}</p>
              {data?.generated_by && (
                <div className="flex items-center gap-1.5 pt-1">
                  <Bot className="w-3 h-3 text-zinc-600" />
                  <span className="text-[9px] text-zinc-600 tracking-wide">SOURCE: {data.generated_by.toUpperCase()}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Execution */}
        <div className="w-full md:w-2/3 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-3.5 h-3.5 text-neon-cyan" />
            <h3 className="text-[10px] font-bold text-muted-foreground tracking-[0.15em]">TACTICAL PLAYBOOK</h3>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <div className="h-10 bg-terminal-surface border border-terminal-border animate-pulse" />
              <div className="h-10 bg-terminal-surface border border-terminal-border animate-pulse" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-terminal-border">
              <div className="p-3 border-b md:border-b-0 md:border-r border-terminal-border">
                <p className="text-[9px] text-zinc-600 tracking-widest mb-1">HOOK</p>
                <p className="text-[11px] text-neon-amber font-medium">{data?.brief?.plan?.hook}</p>
              </div>
              <div className="p-3">
                <p className="text-[9px] text-zinc-600 tracking-widest mb-1">OFFER</p>
                <p className="text-[11px] text-neon-amber font-medium">{data?.brief?.plan?.offer}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          {!isLoading && (
            <div className="mt-3 flex items-center justify-between">
              <button
                onClick={() => setIsDismissed(true)}
                className="text-[10px] text-zinc-600 hover:text-muted-foreground tracking-widest"
              >
                DISMISS
              </button>
              <button
                onClick={() => {
                  document.getElementById('active-positions-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="terminal-btn flex items-center gap-2"
              >
                DEPLOY TO OMNI-DECK
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

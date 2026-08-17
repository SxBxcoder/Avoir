'use client';

import { useState, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Server } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { RequireAuth } from '@/components/auth/guards';
import InteractivePlasmaCanvas from '@/components/InteractivePlasmaCanvas';
import TickerTape from '@/components/TickerTape';
import OrderBook from '@/components/OrderBook';
import ExecutionLog from '@/components/ExecutionLog';
import TerminalCLI from '@/components/TerminalCLI';
import TerminalChart from '@/components/TerminalChart';
import { CapitalDeploymentSimulator } from '@/components/CapitalDeploymentSimulator';

export default function OmniDeckPage() {
  const router = useRouter();
  const [selectedCampaignForSim, setSelectedCampaignForSim] = useState<any | null>(null);

  const [activePositions, setActivePositions] = useState([
    { id: 'pos-1', asset: 'Corporate Villain Era Hook', platform: 'TikTok', roas: 4.2, spend: 1250, momentum: '+15', status: 'SCALING', isDecaying: false },
    { id: 'pos-2', asset: 'Anti-Hustle Culture Ad', platform: 'Instagram', roas: 3.8, spend: 850, momentum: '+8', status: 'OPTIMIZING', isDecaying: false },
    { id: 'pos-3', asset: 'Lo-Fi Skincare Demo', platform: 'YouTube Shorts', roas: 1.2, spend: 400, momentum: '-5', status: 'LIQUIDATING', isDecaying: false },
  ]);

  const totalAum = activePositions.reduce((sum, p) => sum + p.spend, 0);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const eventSource = new EventSource(`${apiUrl}/api/engagement/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.id && data.momentum !== undefined) {
          setActivePositions(prev => prev.map(pos => {
            if (pos.id === data.id) {
              const newStatus = data.momentum > 10 ? 'SCALING' : data.momentum > 0 ? 'OPTIMIZING' : 'LIQUIDATING';
              return {
                ...pos,
                momentum: data.momentum > 0 ? `+${data.momentum}` : `${data.momentum}`,
                isDecaying: data.is_decay_alert,
                status: data.is_decay_alert ? 'DECAY WARNING' : newStatus
              };
            }
            return pos;
          }));
        }
      } catch (err) {}
    };

    return () => eventSource.close();
  }, []);

  return (
    <RequireAuth>
    <div className="h-screen bg-black text-white font-mono overflow-hidden selection:bg-neon-amber/30 terminal-scrollbar flex flex-col crt-scanline noise-overlay vignette">

      {/* Background Grid */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <InteractivePlasmaCanvas />
      </div>

      {/* ── HEADER ── */}
      <header className="relative z-10 border-b border-terminal-border bg-black flex-shrink-0">
        <div className="h-9 flex items-center justify-between px-3">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => router.push('/')} className="text-zinc-600 hover:text-neon-amber transition-colors text-[9px] flex-shrink-0">
              [ESC]
            </button>
            <div className="h-3 w-px bg-terminal-border flex-shrink-0" />
            <Server className="w-3 h-3 text-neon-cyan flex-shrink-0" />
            <span className="text-[9px] font-bold tracking-[0.2em] text-neon-cyan truncate">OMNI-DECK</span>
            <span className="text-[8px] text-zinc-700 hidden sm:inline">// PORTFOLIO MANAGER</span>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-neon-green" />
              <span className="text-[8px] text-neon-green tracking-widest hidden sm:inline">NOMINAL</span>
            </div>
            <span className="text-[8px] text-zinc-700 hidden md:inline">v2.4.1</span>
          </div>
        </div>
      </header>

      {/* ── TICKER TAPE ── */}
      <TickerTape positions={activePositions} totalAum={totalAum} />

      {/* ── MAIN GRID ── */}
      <div className="relative z-10 flex-1 flex overflow-hidden">

        {/* Left: Order Book */}
        <div className="w-full lg:w-[420px] flex-shrink-0 border-r border-terminal-border overflow-y-auto terminal-scrollbar">
          <OrderBook positions={activePositions} onSelect={setSelectedCampaignForSim} />
        </div>

        {/* Right: Charts + Log */}
        <div className="hidden lg:flex flex-1 flex-col min-w-0">

          {/* Charts Grid */}
          <div className="grid grid-cols-2 xl:grid-cols-4 border-b border-terminal-border">
            <TerminalChart title="ROAS INDEX" color="amber" min={0} max={8} dataPoints={40} speed={800} />
            <TerminalChart title="MOMENTUM" color="cyan" min={-20} max={30} dataPoints={40} speed={1200} />
            <TerminalChart title="REACH" color="green" min={0} max={50000} dataPoints={40} speed={1500} />
            <TerminalChart title="DECAY RISK" color="red" min={0} max={100} dataPoints={40} speed={1000} />
          </div>

          {/* Execution Log */}
          <div className="flex-1 min-h-0">
            <ExecutionLog />
          </div>
        </div>
      </div>

      {/* ── CLI ── */}
      <TerminalCLI />

      {/* ── SIMULATOR MODAL ── */}
      <AnimatePresence>
        {selectedCampaignForSim && (
          <CapitalDeploymentSimulator
            onClose={() => setSelectedCampaignForSim(null)}
            campaignPlan={selectedCampaignForSim}
          />
        )}
      </AnimatePresence>
    </div>
    </RequireAuth>
  );
}

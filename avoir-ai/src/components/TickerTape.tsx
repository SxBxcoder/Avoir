'use client';

import { useEffect, useRef, useState } from 'react';

interface TickerItem {
  label: string;
  value: string;
  color: 'amber' | 'cyan' | 'green' | 'red';
  alert?: boolean;
}

interface TickerTapeProps {
  positions: {
    asset: string;
    roas: number;
    momentum: string;
    spend: number;
    status: string;
  }[];
  totalAum: number;
}

const COLOR_MAP = {
  amber: 'text-neon-amber',
  cyan: 'text-neon-cyan',
  green: 'text-neon-green',
  red: 'text-neon-red',
};

const GLOW_MAP = {
  amber: '',
  cyan: '',
  green: '',
  red: 'text-glow-red',
};

export default function TickerTape({ positions, totalAum }: TickerTapeProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [paused, setPaused] = useState(false);
  const [tick, setTick] = useState(0);

  const items: TickerItem[] = [
    { label: 'AUM', value: `$${totalAum.toLocaleString()}`, color: 'amber' },
    ...positions.map(p => ({
      label: p.asset.split(' ').slice(0, 3).join(' ').toUpperCase(),
      value: `${p.roas}x ROAS ${p.momentum.startsWith('+') ? '▲' : '▼'}${p.momentum}%`,
      color: p.status === 'SCALING' ? 'green' as const : p.status === 'LIQUIDATING' ? 'red' as const : 'cyan' as const,
    })),
    { label: 'VIX', value: 'ELEVATED', color: 'red', alert: true },
    { label: 'SIGNAL', value: 'TIKTOK ALGO SHIFT', color: 'cyan' },
    { label: 'EXEC', value: `${positions.length} POSITIONS ACTIVE`, color: 'amber' },
    { label: 'LATENCY', value: '8ms AVG', color: 'green' },
    { label: 'FEED', value: 'ALL EXCHANGES CONNECTED', color: 'green' },
  ];

  // Tick counter for time display
  useEffect(() => {
    const t = setInterval(() => setTick(prev => prev + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      setOffset(prev => {
        if (!scrollRef.current) return prev;
        const maxScroll = scrollRef.current.scrollWidth / 2;
        const next = prev + 1;
        return next >= maxScroll ? 0 : next;
      });
    }, 30);
    return () => clearInterval(interval);
  }, [paused]);

  const duplicated = [...items, ...items];

  const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });

  return (
    <div
      className="relative z-10 border-b border-terminal-border bg-black overflow-hidden group"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-center h-7">
        {/* Static label with blinking dot */}
        <div className="flex-shrink-0 px-3 h-full flex items-center gap-2 bg-terminal-surface border-r border-terminal-border">
          <div className="w-1.5 h-1.5 bg-neon-green animate-pulse" />
          <span className="text-[8px] font-bold text-zinc-600 tracking-[0.2em]">FEED</span>
        </div>

        {/* Scrolling content */}
        <div className="flex-1 overflow-hidden relative">
          {/* Left edge fade */}
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
          {/* Right edge fade */}
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />

          <div
            ref={scrollRef}
            className="flex items-center gap-4 whitespace-nowrap"
            style={{ transform: `translateX(-${offset}px)` }}
          >
            {duplicated.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[8px] text-zinc-700 tracking-widest">{item.label}</span>
                <span className={`text-[9px] font-bold ${COLOR_MAP[item.color]} ${item.alert ? GLOW_MAP[item.color] : ''}`}>
                  {item.value}
                </span>
                <span className="text-zinc-800 text-[8px]">◆</span>
              </div>
            ))}
          </div>
        </div>

        {/* Timestamp */}
        <div className="flex-shrink-0 px-3 h-full flex items-center bg-terminal-surface border-l border-terminal-border">
          <span className="text-[8px] text-zinc-700 font-mono">{timeStr}</span>
        </div>
      </div>

      {/* Pause indicator */}
      {paused && (
        <div className="absolute top-0 right-12 h-7 flex items-center">
          <span className="text-[8px] text-neon-amber font-bold tracking-widest">PAUSED</span>
        </div>
      )}
    </div>
  );
}

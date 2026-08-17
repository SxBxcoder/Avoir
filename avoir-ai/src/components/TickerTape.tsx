'use client';

import { useEffect, useRef, useState } from 'react';

interface TickerItem {
  label: string;
  value: string;
  color: 'amber' | 'cyan' | 'green' | 'red';
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

export default function TickerTape({ positions, totalAum }: TickerTapeProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  const items: TickerItem[] = [
    { label: 'TOTAL AUM', value: `$${totalAum.toLocaleString()}`, color: 'amber' },
    ...positions.map(p => ({
      label: p.asset.split(' ').slice(0, 3).join(' ').toUpperCase(),
      value: `${p.roas}x ROAS ${p.momentum.startsWith('+') ? '▲' : '▼'}${p.momentum}%`,
      color: p.status === 'SCALING' ? 'green' as const : p.status === 'LIQUIDATING' ? 'red' as const : 'cyan' as const,
    })),
    { label: 'ALERT', value: 'MARKET VOLATILITY INDEX: ELEVATED', color: 'red' },
    { label: 'SIGNAL', value: 'TIKTOK ALGO SHIFT DETECTED', color: 'cyan' },
    { label: 'EXEC', value: '3 POSITIONS ACTIVE // 1 DECAYING', color: 'amber' },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setOffset(prev => {
        if (!scrollRef.current) return prev;
        const maxScroll = scrollRef.current.scrollWidth / 2;
        const next = prev + 1;
        return next >= maxScroll ? 0 : next;
      });
    }, 30);
    return () => clearInterval(interval);
  }, []);

  const duplicated = [...items, ...items];

  return (
    <div className="relative z-10 border-b border-terminal-border bg-black overflow-hidden">
      <div className="flex items-center h-7">
        {/* Static label */}
        <div className="flex-shrink-0 px-3 h-full flex items-center bg-terminal-surface border-r border-terminal-border">
          <span className="text-[8px] font-bold text-zinc-600 tracking-[0.2em]">FEED</span>
        </div>

        {/* Scrolling content */}
        <div className="flex-1 overflow-hidden">
          <div
            ref={scrollRef}
            className="flex items-center gap-6 whitespace-nowrap"
            style={{ transform: `translateX(-${offset}px)` }}
          >
            {duplicated.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[8px] text-zinc-600 tracking-widest">{item.label}</span>
                <span className={`text-[9px] font-bold ${COLOR_MAP[item.color]}`}>{item.value}</span>
                <span className="text-zinc-800">|</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

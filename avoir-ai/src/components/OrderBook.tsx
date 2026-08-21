'use client';

import { useEffect, useRef, useState } from 'react';

interface Position {
  id: string;
  asset: string;
  platform: string;
  roas: number;
  spend: number;
  momentum: string;
  status: string;
  isDecaying: boolean;
}

interface OrderBookProps {
  positions: Position[];
  onSelect: (pos: Position) => void;
}

type SortKey = 'asset' | 'spend' | 'roas' | 'momentum' | 'status';

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = 56 * dpr;
    canvas.height = 24 * dpr;
    ctx.scale(dpr, dpr);

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    ctx.clearRect(0, 0, 56, 24);

    ctx.beginPath();
    ctx.moveTo(0, 24);
    data.forEach((val, i) => {
      const x = (i / (data.length - 1)) * 56;
      const y = 24 - ((val - min) / range) * 20;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(56, 24);
    ctx.closePath();
    ctx.fillStyle = color.replace(')', ', 0.15)').replace('rgb', 'rgba');
    ctx.fill();

    ctx.beginPath();
    data.forEach((val, i) => {
      const x = (i / (data.length - 1)) * 56;
      const y = 24 - ((val - min) / range) * 20;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [data, color]);

  return <canvas ref={canvasRef} className="w-[56px] h-[24px] flex-shrink-0" />;
}

const SPARKLINE_COLORS: Record<string, string> = {
  SCALING: 'rgb(74, 222, 128)',
  OPTIMIZING: 'rgb(34, 211, 238)',
  LIQUIDATING: 'rgb(248, 113, 113)',
  'DECAY WARNING': 'rgb(248, 113, 113)',
};

export default function OrderBook({ positions, onSelect }: OrderBookProps) {
  const [sortKey, setSortKey] = useState<SortKey>('spend');
  const [sortAsc, setSortAsc] = useState(false);
  const [flashMap, setFlashMap] = useState<Record<string, 'green' | 'red'>>({});
  const prevMomentum = useRef<Record<string, string>>({});
  const [sparkData, setSparkData] = useState<Record<string, number[]>>({});

  useEffect(() => {
    positions.forEach(pos => {
      const prev = prevMomentum.current[pos.id];
      if (prev !== undefined && prev !== pos.momentum) {
        const isPositive = String(pos.momentum).startsWith('+');
        setFlashMap(f => ({ ...f, [pos.id]: isPositive ? 'green' : 'red' }));
        setTimeout(() => setFlashMap(f => {
          const n = { ...f };
          delete n[pos.id];
          return n;
        }), 600);
      }
      prevMomentum.current[pos.momentum] = pos.momentum;

      setSparkData(sd => {
        const existing = sd[pos.id] || [];
        const next = [...existing, pos.roas].slice(-20);
        return { ...sd, [pos.id]: next };
      });
    });
  }, [positions]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sorted = [...positions].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'asset') cmp = a.asset.localeCompare(b.asset);
    else if (sortKey === 'spend') cmp = a.spend - b.spend;
    else if (sortKey === 'roas') cmp = a.roas - b.roas;
    else if (sortKey === 'momentum') cmp = parseInt(a.momentum) - parseInt(b.momentum);
    else if (sortKey === 'status') cmp = a.status.localeCompare(b.status);
    return sortAsc ? cmp : -cmp;
  });

  const totalAum = positions.reduce((sum, p) => sum + p.spend, 0);
  const avgRoas = positions.reduce((sum, p) => sum + p.roas, 0) / positions.length;
  const activeCount = positions.filter(p => !p.isDecaying).length;
  const decayCount = positions.filter(p => p.isDecaying).length;

  const SortIndicator = ({ field }: { field: SortKey }) => (
    <span className={`ml-1 ${sortKey === field ? 'text-neon-amber' : 'text-zinc-600'}`}>
      {sortKey === field ? (sortAsc ? '▲' : '▼') : '○'}
    </span>
  );

  return (
    <div className="border-r border-terminal-border h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-terminal-border bg-terminal-surface flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-neon-amber" />
          <span className="text-[11px] font-bold text-muted-foreground tracking-[0.2em]">ORDER BOOK</span>
        </div>
        <span className="text-[11px] text-neon-amber font-bold">AUM ${totalAum.toLocaleString()}</span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[28px_1fr_72px_60px_68px_64px_80px] border-b border-terminal-border bg-terminal-surface/50 flex-shrink-0">
        <span className="px-1.5 py-1.5 text-[9px] text-muted-foreground tracking-widest">#</span>
        <button onClick={() => handleSort('asset')} className="px-2 py-1.5 text-[9px] text-muted-foreground tracking-widest text-left hover:text-foreground">
          ASSET<SortIndicator field="asset" />
        </button>
        <button onClick={() => handleSort('spend')} className="px-1.5 py-1.5 text-[9px] text-muted-foreground tracking-widest text-right hover:text-foreground">
          ALLOC<SortIndicator field="spend" />
        </button>
        <button onClick={() => handleSort('roas')} className="px-1.5 py-1.5 text-[9px] text-muted-foreground tracking-widest text-right hover:text-foreground">
          ROAS<SortIndicator field="roas" />
        </button>
        <button onClick={() => handleSort('momentum')} className="px-1.5 py-1.5 text-[9px] text-muted-foreground tracking-widest text-right hover:text-foreground">
          MOM<SortIndicator field="momentum" />
        </button>
        <span className="px-1.5 py-1.5 text-[9px] text-muted-foreground tracking-widest text-center">CHART</span>
        <button onClick={() => handleSort('status')} className="px-1.5 py-1.5 text-[9px] text-muted-foreground tracking-widest text-right hover:text-foreground">
          STATUS<SortIndicator field="status" />
        </button>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto terminal-scrollbar">
        {sorted.map((pos) => (
          <button
            key={pos.id}
            onClick={() => onSelect(pos)}
            className={`w-full grid grid-cols-[28px_1fr_72px_60px_68px_64px_80px] border-b border-terminal-border text-left transition-all duration-300 ${
              flashMap[pos.id] === 'green'
                ? 'bg-neon-green/10'
                : flashMap[pos.id] === 'red'
                  ? 'bg-neon-red/10'
                  : pos.isDecaying
                    ? 'bg-neon-red/5'
                    : 'hover:bg-terminal-surface'
            }`}
          >
            <span className="px-1.5 py-2 text-[10px] text-muted-foreground font-mono">{pos.id.replace('pos-', '')}</span>
            <span className="px-2 py-2 text-[12px] text-foreground font-medium truncate pr-1">{pos.asset}</span>
            <span className="px-1.5 py-2 text-[12px] text-neon-amber font-bold text-right font-mono">${pos.spend}</span>
            <span className="px-1.5 py-2 text-[12px] text-neon-cyan font-bold text-right font-mono">{pos.roas}x</span>
            <span className={`px-1.5 py-2 text-[12px] font-bold text-right font-mono ${
              String(pos.momentum).startsWith('+') ? 'text-neon-green' : 'text-neon-red'
            }`}>
              {pos.momentum}%
            </span>
            <span className="px-1.5 py-2 flex items-center justify-center">
              {sparkData[pos.id] && (
                <Sparkline data={sparkData[pos.id]} color={SPARKLINE_COLORS[pos.status] || 'rgb(150,150,150)'} />
              )}
            </span>
            <span className="px-1.5 py-2 text-right flex items-center justify-end gap-1.5">
              {pos.isDecaying && <div className="w-1.5 h-1.5 bg-neon-red animate-pulse" />}
              <span className={`text-[10px] font-bold tracking-widest ${
                pos.isDecaying
                  ? 'text-neon-red'
                  : pos.status === 'SCALING'
                    ? 'text-neon-green'
                    : pos.status === 'OPTIMIZING'
                      ? 'text-neon-cyan'
                      : 'text-neon-red'
              }`}>
                {pos.status}
              </span>
            </span>
          </button>
        ))}
      </div>

      {/* Summary bar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-terminal-border bg-terminal-surface flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-muted-foreground">
            <span className="text-neon-green font-bold">{activeCount}</span> ACTIVE
          </span>
          {decayCount > 0 && (
            <span className="text-[10px] text-muted-foreground">
              <span className="text-neon-red font-bold">{decayCount}</span> DECAY
            </span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground">
          AVG ROAS <span className="text-neon-cyan font-bold">{avgRoas.toFixed(1)}x</span>
        </span>
      </div>
    </div>
  );
}

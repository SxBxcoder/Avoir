'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

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
    canvas.width = 40 * dpr;
    canvas.height = 16 * dpr;
    ctx.scale(dpr, dpr);

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    ctx.clearRect(0, 0, 40, 16);

    // Fill
    ctx.beginPath();
    ctx.moveTo(0, 16);
    data.forEach((val, i) => {
      const x = (i / (data.length - 1)) * 40;
      const y = 16 - ((val - min) / range) * 14;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(40, 16);
    ctx.closePath();
    ctx.fillStyle = color.replace(')', ', 0.15)').replace('rgb', 'rgba');
    ctx.fill();

    // Line
    ctx.beginPath();
    data.forEach((val, i) => {
      const x = (i / (data.length - 1)) * 40;
      const y = 16 - ((val - min) / range) * 14;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [data, color]);

  return <canvas ref={canvasRef} className="w-[40px] h-[16px] flex-shrink-0" />;
}

const SPARKLINE_COLORS: Record<string, string> = {
  SCALING: 'rgb(34, 197, 94)',
  OPTIMIZING: 'rgb(6, 182, 212)',
  LIQUIDATING: 'rgb(239, 68, 68)',
  'DECAY WARNING': 'rgb(239, 68, 68)',
};

export default function OrderBook({ positions, onSelect }: OrderBookProps) {
  const [sortKey, setSortKey] = useState<SortKey>('spend');
  const [sortAsc, setSortAsc] = useState(false);
  const [flashMap, setFlashMap] = useState<Record<string, 'green' | 'red'>>({});
  const prevMomentum = useRef<Record<string, string>>({});
  const [sparkData, setSparkData] = useState<Record<string, number[]>>({});

  // Track momentum changes for flash + sparkline
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
    <span className={`ml-1 ${sortKey === field ? 'text-neon-amber' : 'text-zinc-800'}`}>
      {sortKey === field ? (sortAsc ? '▲' : '▼') : '○'}
    </span>
  );

  return (
    <div className="border border-terminal-border h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-terminal-border bg-terminal-surface flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-neon-amber" />
          <span className="text-[9px] font-bold text-zinc-500 tracking-[0.2em]">ORDER BOOK</span>
        </div>
        <span className="text-[9px] text-neon-amber font-bold">AUM ${totalAum.toLocaleString()}</span>
      </div>

      {/* Column headers — sortable */}
      <div className="grid grid-cols-[24px_1fr_60px_50px_60px_55px_70px] border-b border-terminal-border bg-terminal-surface/50 flex-shrink-0">
        <span className="px-1 py-1 text-[7px] text-zinc-700 tracking-widest">#</span>
        <button onClick={() => handleSort('asset')} className="px-2 py-1 text-[7px] text-zinc-600 tracking-widest text-left hover:text-zinc-400">
          ASSET<SortIndicator field="asset" />
        </button>
        <button onClick={() => handleSort('spend')} className="px-1 py-1 text-[7px] text-zinc-600 tracking-widest text-right hover:text-zinc-400">
          ALLOC<SortIndicator field="spend" />
        </button>
        <button onClick={() => handleSort('roas')} className="px-1 py-1 text-[7px] text-zinc-600 tracking-widest text-right hover:text-zinc-400">
          ROAS<SortIndicator field="roas" />
        </button>
        <button onClick={() => handleSort('momentum')} className="px-1 py-1 text-[7px] text-zinc-600 tracking-widest text-right hover:text-zinc-400">
          MOM<SortIndicator field="momentum" />
        </button>
        <span className="px-1 py-1 text-[7px] text-zinc-600 tracking-widest text-center">CHART</span>
        <button onClick={() => handleSort('status')} className="px-1 py-1 text-[7px] text-zinc-600 tracking-widest text-right hover:text-zinc-400">
          STATUS<SortIndicator field="status" />
        </button>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto terminal-scrollbar">
        {sorted.map((pos) => (
          <button
            key={pos.id}
            onClick={() => onSelect(pos)}
            className={`w-full grid grid-cols-[24px_1fr_60px_50px_60px_55px_70px] border-b border-terminal-border text-left transition-all duration-300 ${
              flashMap[pos.id] === 'green'
                ? 'bg-neon-green/15'
                : flashMap[pos.id] === 'red'
                  ? 'bg-neon-red/15'
                  : pos.isDecaying
                    ? 'bg-neon-red/10'
                    : 'hover:bg-terminal-surface'
            }`}
          >
            <span className="px-1 py-1.5 text-[8px] text-zinc-700 font-mono">{pos.id.replace('pos-', '')}</span>
            <span className="px-2 py-1.5 text-[10px] text-white font-medium truncate">{pos.asset}</span>
            <span className="px-1 py-1.5 text-[10px] text-neon-amber font-bold text-right font-mono">${pos.spend}</span>
            <span className="px-1 py-1.5 text-[10px] text-neon-cyan font-bold text-right font-mono">{pos.roas}x</span>
            <span className={`px-1 py-1.5 text-[10px] font-bold text-right font-mono ${
              String(pos.momentum).startsWith('+') ? 'text-neon-green' : 'text-neon-red'
            }`}>
              {pos.momentum}%
            </span>
            <span className="px-1 py-1.5 flex items-center justify-center">
              {sparkData[pos.id] && (
                <Sparkline data={sparkData[pos.id]} color={SPARKLINE_COLORS[pos.status] || 'rgb(100,100,100)'} />
              )}
            </span>
            <span className="px-1 py-1.5 text-right flex items-center justify-end gap-1">
              {pos.isDecaying && <div className="w-1 h-1 bg-neon-red animate-pulse" />}
              <span className={`text-[8px] font-bold tracking-widest ${
                pos.isDecaying
                  ? 'text-neon-red'
                  : pos.status === 'SCALING'
                    ? 'text-neon-green'
                    : pos.status === 'OPTIMIZING'
                      ? 'text-neon-cyan'
                      : 'text-neon-red'
              }`}>
                {pos.status.slice(0, 4)}
              </span>
            </span>
          </button>
        ))}
      </div>

      {/* Summary bar */}
      <div className="flex items-center justify-between px-3 py-1 border-t border-terminal-border bg-terminal-surface flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[8px] text-zinc-600">
            <span className="text-neon-green font-bold">{activeCount}</span> ACTIVE
          </span>
          {decayCount > 0 && (
            <span className="text-[8px] text-zinc-600">
              <span className="text-neon-red font-bold">{decayCount}</span> DECAY
            </span>
          )}
        </div>
        <span className="text-[8px] text-zinc-600">
          AVG ROAS <span className="text-neon-cyan font-bold">{avgRoas.toFixed(1)}x</span>
        </span>
      </div>
    </div>
  );
}

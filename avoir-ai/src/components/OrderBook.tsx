'use client';

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

export default function OrderBook({ positions, onSelect }: OrderBookProps) {
  const totalAum = positions.reduce((sum, p) => sum + p.spend, 0);

  return (
    <div className="border border-terminal-border">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-terminal-border bg-terminal-surface">
        <span className="text-[9px] font-bold text-zinc-500 tracking-[0.2em]">ORDER BOOK</span>
        <span className="text-[9px] text-neon-amber font-bold">AUM ${totalAum.toLocaleString()}</span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_70px_60px_70px_80px_90px] border-b border-terminal-border bg-terminal-surface/50">
        <span className="px-3 py-1 text-[8px] text-zinc-600 tracking-widest">ASSET</span>
        <span className="px-2 py-1 text-[8px] text-zinc-600 tracking-widest text-right">ALLOC</span>
        <span className="px-2 py-1 text-[8px] text-zinc-600 tracking-widest text-right">ROAS</span>
        <span className="px-2 py-1 text-[8px] text-zinc-600 tracking-widest text-right">MOM</span>
        <span className="px-2 py-1 text-[8px] text-zinc-600 tracking-widest text-center">TYPE</span>
        <span className="px-2 py-1 text-[8px] text-zinc-600 tracking-widest text-right">STATUS</span>
      </div>

      {/* Rows */}
      {positions.map((pos) => (
        <button
          key={pos.id}
          onClick={() => onSelect(pos)}
          className={`w-full grid grid-cols-[1fr_70px_60px_70px_80px_90px] border-b border-terminal-border text-left transition-colors ${
            pos.isDecaying ? 'bg-neon-red/10 animate-pulse' : 'hover:bg-terminal-surface'
          }`}
        >
          <span className="px-3 py-1.5 text-[10px] text-white font-medium truncate">{pos.asset}</span>
          <span className="px-2 py-1.5 text-[10px] text-neon-amber font-bold text-right">${pos.spend}</span>
          <span className="px-2 py-1.5 text-[10px] text-neon-cyan font-bold text-right">{pos.roas}x</span>
          <span className={`px-2 py-1.5 text-[10px] font-bold text-right ${
            String(pos.momentum).startsWith('+') ? 'text-neon-green' : 'text-neon-red'
          }`}>
            {pos.momentum}%
          </span>
          <span className="px-2 py-1.5 text-[9px] text-zinc-500 text-center">{pos.platform}</span>
          <span className="px-2 py-1.5 text-right">
            <span className={`inline-block px-1.5 py-0.5 text-[8px] font-bold tracking-widest ${
              pos.isDecaying
                ? 'bg-neon-red text-black'
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
  );
}

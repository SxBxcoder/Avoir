'use client';

import { useEffect, useRef, useState, useMemo, forwardRef, useImperativeHandle } from 'react';

export interface ExternalLogEntry {
  timestamp: string;
  level: 'INFO' | 'EXEC' | 'WARN' | 'SIGNAL' | 'ALGO';
  message: string;
}

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'EXEC' | 'WARN' | 'SIGNAL' | 'ALGO';
  message: string;
  id: number;
  isExternal?: boolean;
}

interface ExecutionLogProps {
  streamUrl?: string;
  externalEntries?: ExternalLogEntry[];
  clearLogs?: boolean;
}

export type ExecutionLogHandle = {
  addEntry: (level: LogEntry['level'], message: string) => void;
};

type FilterLevel = 'ALL' | 'INFO' | 'EXEC' | 'WARN' | 'SIGNAL' | 'ALGO';

const LEVEL_COLORS: Record<string, string> = {
  INFO: 'text-zinc-400',
  EXEC: 'text-neon-amber',
  WARN: 'text-neon-red',
  SIGNAL: 'text-neon-cyan',
  ALGO: 'text-neon-green',
};

const LEVEL_BORDER_COLORS: Record<string, string> = {
  INFO: 'border-l-zinc-600',
  EXEC: 'border-l-neon-amber',
  WARN: 'border-l-neon-red',
  SIGNAL: 'border-l-neon-cyan',
  ALGO: 'border-l-neon-green',
};

const MOCK_MESSAGES: { level: LogEntry['level']; msg: string }[] = [
  { level: 'ALGO', msg: 'Scanning TikTok creative API for emerging audio patterns...' },
  { level: 'SIGNAL', msg: 'Anomaly detected: "corporate villain" audio spike +340% in 2h window' },
  { level: 'EXEC', msg: 'Reallocating $200 from pos-3 (decay) → pos-1 (momentum surge)' },
  { level: 'INFO', msg: 'Synthetic focus group: 4/5 personas approved hook variant B' },
  { level: 'ALGO', msg: 'Running Monte Carlo simulation on bid adjustments (1000 iterations)...' },
  { level: 'EXEC', msg: 'pos-2 CTR decay detected. Initiating creative refresh pipeline.' },
  { level: 'WARN', msg: 'Instagram API rate limit approaching (87% consumed). Throttling requests.' },
  { level: 'SIGNAL', msg: 'Cross-platform sentiment shift: anti-hustle content trending +180% on LinkedIn' },
  { level: 'ALGO', msg: 'Backtest complete: pos-1 projected ROAS 4.8x within 6h window' },
  { level: 'EXEC', msg: 'Deploying variant C creative to YouTube Shorts test slot' },
  { level: 'ALGO', msg: 'Neural network recalibration complete. Confidence interval: 92.4%' },
  { level: 'SIGNAL', msg: 'Competitor detected scaling same hook archetype. Counter-strategy initiated.' },
  { level: 'WARN', msg: 'pos-3 ROAS dropped below 1.0x threshold. Auto-liquidation armed.' },
  { level: 'EXEC', msg: 'Creative variant D deployed to TikTok. A/B split: 50/50.' },
  { level: 'INFO', msg: 'Portfolio Sharpe ratio: 2.14 (above benchmark of 1.5)' },
  { level: 'ALGO', msg: 'Correlation matrix updated. pos-1 and pos-2 divergence: 0.23' },
  { level: 'SIGNAL', msg: 'YouTube Shorts algorithm update detected. Adjusting posting cadence model.' },
  { level: 'EXEC', msg: 'Auto-scaling bid ceiling for pos-1: $12 → $18 based on ROAS trajectory' },
  { level: 'ALGO', msg: 'Running competitor spend analysis across 3 rival campaigns...' },
  { level: 'WARN', msg: 'pos-3 momentum below threshold. Decay alert escalated to PRIORITY.' },
  { level: 'EXEC', msg: 'Creative A/B swap triggered for pos-2: variant B outperforming by 23%' },
  { level: 'INFO', msg: 'Latency check: all exchange connections nominal (<12ms)' },
  { level: 'ALGO', msg: 'Portfolio rebalance recommendation: shift 15% from LIQUIDATING → SCALING' },
  { level: 'SIGNAL', msg: 'New engagement spike detected on pos-1 (TikTok +47 interactions/min)' },
  { level: 'EXEC', msg: 'Budget reallocation confirmed: $50 moved from pos-3 reserve to pos-1 scaling pool' },
  { level: 'INFO', msg: 'Daily alpha brief regenerated. Anomaly confidence: 91.2%' },
  { level: 'ALGO', msg: 'Entropy analysis on creative variants: 3 high-novelty candidates identified' },
  { level: 'WARN', msg: 'LinkedIn API response time elevated (340ms). Monitoring degradation.' },
  { level: 'SIGNAL', msg: 'Instagram Reels engagement rate spike +28% in last 15 minutes' },
  { level: 'EXEC', msg: 'Position hedging activated: $100 counter-allocation on pos-3 decay hedge' },
];

export default forwardRef<ExecutionLogHandle, ExecutionLogProps>(function ExecutionLog({ externalEntries, clearLogs }, ref) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<FilterLevel>('ALL');
  const [newIds, setNewIds] = useState<Set<number>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const idCounter = useRef(0);

  useImperativeHandle(ref, () => ({
    addEntry(level: LogEntry['level'], message: string) {
      const newId = idCounter.current++;
      const entry: LogEntry = {
        level,
        message,
        timestamp: makeTs(),
        id: newId,
        isExternal: true,
      };
      setLogs(prev => [...prev.slice(-200), entry]);
      setNewIds(prev => { const n = new Set(Array.from(prev)); n.add(newId); return n; });
      setTimeout(() => setNewIds(prev => { const n = new Set(Array.from(prev)); n.delete(newId); return n; }), 800);
    },
  }));

  useEffect(() => {
    const initial = MOCK_MESSAGES.slice(0, 8).map(m => ({
      level: m.level,
      message: m.msg,
      timestamp: makeTs(),
      id: idCounter.current++,
    }));
    setLogs(initial);
  }, []);

  useEffect(() => {
    if (externalEntries && externalEntries.length > 0) {
      setLogs(prev => {
        const existing = new Set(prev.map(l => `${l.timestamp}-${l.message}`));
        const newEntries = externalEntries
          .filter(e => !existing.has(`${e.timestamp}-${e.message}`))
          .map(e => ({
            ...e,
            id: idCounter.current++,
            isExternal: true,
          }));
        return newEntries.length > 0 ? [...prev.slice(-200), ...newEntries] : prev;
      });
    }
  }, [externalEntries]);

  useEffect(() => {
    if (clearLogs) {
      setLogs([]);
    }
  }, [clearLogs]);

  useEffect(() => {
    const interval = setInterval(() => {
      const pick = MOCK_MESSAGES[Math.floor(Math.random() * MOCK_MESSAGES.length)];
      const newId = idCounter.current++;
      const entry: LogEntry = {
        level: pick.level,
        message: pick.msg,
        timestamp: makeTs(),
        id: newId,
      };

      setLogs(prev => [...prev.slice(-200), entry]);
      setNewIds(prev => { const n = new Set(Array.from(prev)); n.add(newId); return n; });
      setTimeout(() => setNewIds(prev => { const n = new Set(Array.from(prev)); n.delete(newId); return n; }), 800);
    }, 1500 + Math.random() * 2500);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const filtered = useMemo(() =>
    filter === 'ALL' ? logs : logs.filter(l => l.level === filter),
    [logs, filter]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: logs.length, INFO: 0, EXEC: 0, WARN: 0, SIGNAL: 0, ALGO: 0 };
    logs.forEach(l => c[l.level]++);
    return c;
  }, [logs]);

  const filters: FilterLevel[] = ['ALL', 'ALGO', 'EXEC', 'SIGNAL', 'WARN', 'INFO'];

  return (
    <div className="border border-terminal-border flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-terminal-border bg-terminal-surface flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-neon-green animate-pulse" />
          <span className="text-[11px] font-bold text-zinc-300 tracking-[0.2em]">EXECUTION LOG</span>
        </div>
        <span className="text-[10px] text-zinc-400">{logs.length} ENTRIES</span>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-terminal-border bg-terminal-surface/30 flex-shrink-0 overflow-x-auto">
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2 py-0.5 text-[10px] font-bold tracking-widest transition-colors ${
              filter === f
                ? 'bg-neon-amber/20 text-neon-amber border border-neon-amber/30'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
            }`}
          >
            {f} <span className="text-zinc-600">{counts[f]}</span>
          </button>
        ))}
      </div>

      {/* Log feed */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto terminal-scrollbar bg-black p-2 space-y-px"
      >
        {filtered.map((log, idx) => (
          <div
            key={log.id}
            className={`flex items-start gap-0 font-mono leading-tight border-l-2 ${LEVEL_BORDER_COLORS[log.level]} pl-2 transition-colors duration-500 ${
              newIds.has(log.id) ? 'bg-neon-amber/5' : ''
            }`}
          >
            <span className="text-[9px] text-zinc-600 flex-shrink-0 w-[32px] text-right pr-2 pt-[2px]">
              {String(idx + 1).padStart(3, '0')}
            </span>
            <span className="text-[9px] text-zinc-500 flex-shrink-0 w-[88px] pt-[2px]">{log.timestamp}</span>
            <span className={`text-[10px] font-bold flex-shrink-0 w-[48px] pt-[1px] ${LEVEL_COLORS[log.level]}`}>
              {log.level}
            </span>
            <span className="text-[11px] text-zinc-300 min-w-0">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

function makeTs(): string {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;
}

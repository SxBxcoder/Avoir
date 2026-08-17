'use client';

import { useEffect, useRef, useState } from 'react';

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'EXEC' | 'WARN' | 'SIGNAL' | 'ALGO';
  message: string;
}

interface ExecutionLogProps {
  streamUrl?: string;
}

const MOCK_LOGS: LogEntry[] = [
  { timestamp: '14:32:01.004', level: 'ALGO', message: 'Scanning TikTok creative API for emerging audio patterns...' },
  { timestamp: '14:32:01.892', level: 'SIGNAL', message: 'Anomaly detected: "corporate villain" audio spike +340% in 2h window' },
  { timestamp: '14:32:02.101', level: 'EXEC', message: 'Reallocating $200 from pos-3 (decay) → pos-1 (momentum surge)' },
  { timestamp: '14:32:03.445', level: 'INFO', message: 'Synthetic focus group: 4/5 personas approved hook variant B' },
  { timestamp: '14:32:04.200', level: 'ALGO', message: 'Running Monte Carlo simulation on bid adjustments (1000 iterations)...' },
  { timestamp: '14:32:05.001', level: 'EXEC', message: 'pos-2 CTR decay detected. Initiating creative refresh pipeline.' },
  { timestamp: '14:32:06.330', level: 'WARN', message: 'Instagram API rate limit approaching (87% consumed). Throttling requests.' },
  { timestamp: '14:32:07.100', level: 'SIGNAL', message: 'Cross-platform sentiment shift: anti-hustle content trending +180% on LinkedIn' },
  { timestamp: '14:32:08.550', level: 'ALGO', message: 'Backtest complete: pos-1 projected ROAS 4.8x within 6h window' },
  { timestamp: '14:32:09.001', level: 'EXEC', message: 'Deploying variant C creative to YouTube Shorts test slot' },
];

const LEVEL_COLORS: Record<string, string> = {
  INFO: 'text-zinc-500',
  EXEC: 'text-neon-amber',
  WARN: 'text-neon-red',
  SIGNAL: 'text-neon-cyan',
  ALGO: 'text-neon-green',
};

export default function ExecutionLog({ streamUrl }: ExecutionLogProps) {
  const [logs, setLogs] = useState<LogEntry[]>(MOCK_LOGS);
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Simulate live log entries
  useEffect(() => {
    const messages = [
      { level: 'ALGO' as const, msg: 'Recalculating momentum vectors for all active positions...' },
      { level: 'SIGNAL' as const, msg: 'New engagement spike detected on pos-1 (TikTok +47 interactions/min)' },
      { level: 'EXEC' as const, msg: 'Auto-scaling bid ceiling for pos-1: $12 → $18 based on ROAS trajectory' },
      { level: 'INFO' as const, msg: 'Latency check: all exchange connections nominal (<12ms)' },
      { level: 'ALGO' as const, msg: 'Running competitor spend analysis across 3 rival campaigns...' },
      { level: 'WARN' as const, msg: 'pos-3 momentum below threshold. Decay alert escalated to PRIORITY.' },
      { level: 'EXEC' as const, msg: 'Creative A/B swap triggered for pos-2: variant B outperforming by 23%' },
      { level: 'SIGNAL' as const, msg: 'TikTok algorithm update detected. Adjusting posting cadence model.' },
      { level: 'ALGO' as const, msg: 'Portfolio rebalance recommendation: shift 15% from LIQUIDATING → SCALING' },
      { level: 'INFO' as const, msg: 'Daily alpha brief regenerated. Anomaly confidence: 91.2%' },
    ];

    const interval = setInterval(() => {
      const now = new Date();
      const ts = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
      const pick = messages[Math.floor(Math.random() * messages.length)];

      setLogs(prev => [...prev.slice(-100), { timestamp: ts, level: pick.level, message: pick.msg }]);
    }, 2000 + Math.random() * 3000);

    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="border border-terminal-border flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-terminal-border bg-terminal-surface flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold text-zinc-500 tracking-[0.2em]">EXECUTION LOG</span>
          <div className="w-1.5 h-1.5 bg-neon-green animate-pulse" />
        </div>
        <span className="text-[8px] text-zinc-600">{logs.length} ENTRIES</span>
      </div>

      {/* Log feed */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto terminal-scrollbar bg-black p-2 space-y-0.5"
      >
        {logs.map((log, idx) => (
          <div key={idx} className="flex items-start gap-2 font-mono leading-tight">
            <span className="text-[8px] text-zinc-700 flex-shrink-0 w-[85px]">{log.timestamp}</span>
            <span className={`text-[8px] font-bold flex-shrink-0 w-[36px] ${LEVEL_COLORS[log.level]}`}>
              [{log.level}]
            </span>
            <span className="text-[9px] text-zinc-400">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

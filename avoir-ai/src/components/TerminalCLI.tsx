'use client';

import { useState, useRef, useEffect } from 'react';

interface CLIEntry {
  input: string;
  output: string;
  timestamp: string;
  type: 'command' | 'response' | 'error';
}

interface TerminalCLIProps {
  onCommand?: (cmd: string) => void;
}

const COMMANDS: Record<string, (args: string) => string> = {
  help: () => `AVAILABLE COMMANDS:
  /help              Show this help
  /status            System status overview
  /positions         List all active positions
  /allocate $<amt> <pos-id>   Reallocate capital
  /liquidate <pos-id>         Liquidate position
  /scan              Run market scan
  /brief             Regenerate alpha brief
  /alert <msg>       Set custom alert
  /history           Command history
  /clear             Clear terminal`,

  status: () => `SYSTEM STATUS:
  Engine:       ONLINE
  Connections:  4/4 EXCHANGES CONNECTED
  Latency:      8ms avg
  Uptime:       99.97%
  Active Pos:   3
  Total AUM:    $2,500`,

  positions: () => `ACTIVE POSITIONS:
  pos-1  Corporate Villain Era Hook    TikTok      $1,250   4.2x ROAS   +15%   SCALING
  pos-2  Anti-Hustle Culture Ad        Instagram   $850     3.8x ROAS   +8%    OPTIMIZING
  pos-3  Lo-Fi Skincare Demo           YT Shorts   $400     1.2x ROAS   -5%    LIQUIDATING`,

  scan: () => `SCANNING MARKET SIGNALS...
  TikTok:    3 trending audio anomalies detected
  Instagram: engagement rate shifting +12% in niche
  LinkedIn:  anti-corporate content surging
  YouTube:   short-form algorithm favoring UGC-style
  RESULT: pos-1 momentum confirmed. pos-3 decay accelerating.`,

  brief: () => `REGENERATING ALPHA BRIEF...
  Fetching market data... DONE
  Running trend analysis... DONE
  Generating playbook... DONE
  Alpha brief updated. Anomaly confidence: 91.2%`,

  clear: () => '__CLEAR__',
};

export default function TerminalCLI({ onCommand }: TerminalCLIProps) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<CLIEntry[]>([
    { input: '', output: 'AVOIR TERMINAL v2.4.1 — Type /help for commands', timestamp: '00:00:00.000', type: 'response' },
  ]);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const now = () => {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;
  };

  const execute = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    const ts = now();
    const cmd = trimmed.startsWith('/') ? trimmed.slice(1).split(' ')[0].toLowerCase() : trimmed.toLowerCase();
    const args = trimmed.slice(cmd.length + 1).trim();

    let output = '';
    let isError = false;

    if (cmd === 'clear') {
      setHistory([]);
      setInput('');
      return;
    }

    if (COMMANDS[cmd]) {
      output = COMMANDS[cmd](args);
    } else if (trimmed.startsWith('/liquidate')) {
      const posId = args || 'pos-3';
      output = `LIQUIDATING ${posId.toUpperCase()}...
  Selling all allocated capital at market price...
  Execution complete. Funds returned to pool.
  Position ${posId} marked as CLOSED.`;
    } else if (trimmed.startsWith('/allocate')) {
      const match = args.match(/\$(\d+)\s+(\S+)/);
      if (match) {
        output = `ALLOCATING $${match[1]} → ${match[2].toUpperCase()}...
  Bid placed. Waiting for fill...
  FILLED at $${match[1]}. Position ${match[2]} updated.
  New AUM allocation confirmed.`;
      } else {
        output = 'USAGE: /allocate $<amount> <pos-id>';
        isError = true;
      }
    } else if (trimmed.startsWith('/alert')) {
      output = `ALERT SET: "${args || 'No message'}"
  Notification will trigger when conditions are met.`;
    } else {
      output = `UNKNOWN COMMAND: "${trimmed}" — Type /help for available commands`;
      isError = true;
    }

    setHistory(prev => [
      ...prev,
      { input: trimmed, output: '', timestamp: ts, type: 'command' },
      { input: '', output, timestamp: ts, type: isError ? 'error' : 'response' },
    ]);
    setCmdHistory(prev => [trimmed, ...prev].slice(0, 50));
    setHistIdx(-1);
    setInput('');
    onCommand?.(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      execute(input);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistory.length > 0) {
        const next = Math.min(histIdx + 1, cmdHistory.length - 1);
        setHistIdx(next);
        setInput(cmdHistory[next]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx > 0) {
        const next = histIdx - 1;
        setHistIdx(next);
        setInput(cmdHistory[next]);
      } else {
        setHistIdx(-1);
        setInput('');
      }
    }
  };

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-terminal-border bg-black">
      {/* Output history */}
      <div
        ref={scrollRef}
        className="max-h-[120px] overflow-y-auto terminal-scrollbar px-3 py-1.5 space-y-0.5"
      >
        {history.map((entry, idx) => (
          <div key={idx}>
            {entry.type === 'command' && (
              <div className="flex items-center gap-2">
                <span className="text-[8px] text-zinc-700">{entry.timestamp}</span>
                <span className="text-[9px] text-neon-amber font-bold">$</span>
                <span className="text-[9px] text-white">{entry.input}</span>
              </div>
            )}
            {entry.type === 'response' && (
              <pre className="text-[9px] text-zinc-400 whitespace-pre-wrap pl-[100px]">{entry.output}</pre>
            )}
            {entry.type === 'error' && (
              <pre className="text-[9px] text-neon-red whitespace-pre-wrap pl-[100px]">{entry.output}</pre>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-center px-3 py-1.5 border-t border-terminal-border bg-terminal-surface">
        <span className="text-[9px] text-neon-amber font-bold mr-2">$</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type /help for commands..."
          className="flex-1 bg-transparent text-[10px] text-white font-mono outline-none placeholder:text-zinc-700"
          autoFocus
        />
        <span className="text-[8px] text-zinc-700 ml-2 hidden sm:block">ENTER ↵</span>
      </div>
    </div>
  );
}

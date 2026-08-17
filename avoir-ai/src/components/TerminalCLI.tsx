'use client';

import { useState, useRef, useEffect, useMemo } from 'react';

interface CLIEntry {
  input: string;
  output: string;
  timestamp: string;
  type: 'command' | 'response' | 'error' | 'system';
}

interface TerminalCLIProps {
  onCommand?: (cmd: string) => void;
}

const COMMAND_LIST = [
  '/help', '/status', '/positions', '/portfolio', '/risk',
  '/allocate', '/liquidate', '/scan', '/brief', '/alert',
  '/history', '/export', '/theme', '/clear',
];

const COMMANDS: Record<string, (args: string) => string> = {
  help: () => `AVAILABLE COMMANDS:
  ├── /help                  Show this help
  ├── /status                System status overview
  ├── /positions             List all active positions
  ├── /portfolio             Portfolio summary with risk metrics
  ├── /risk                  Risk analysis breakdown
  ├── /allocate $<amt> <id>  Reallocate capital to position
  ├── /liquidate <id>        Liquidate a position
  ├── /scan                  Run market signal scan
  ├── /brief                 Regenerate alpha brief
  ├── /alert <msg>           Set custom alert condition
  ├── /history               Show command history
  ├── /export                Export data to clipboard
  └── /clear                 Clear terminal`,

  status: () => `SYSTEM STATUS:
  ├── Engine:       ● ONLINE
  ├── Connections:  4/4 EXCHANGES CONNECTED
  ├── Latency:      8ms avg (12ms p99)
  ├── Uptime:       99.97% (14d 7h 23m)
  ├── Active Pos:   3
  ├── Total AUM:    $2,500
  └── Last Scan:    ${new Date().toLocaleTimeString('en-US', { hour12: false })}`,

  positions: () => `ACTIVE POSITIONS:
  ├── pos-1  Corporate Villain Era Hook   TikTok      $1,250   4.2x   +15%   SCALING
  ├── pos-2  Anti-Hustle Culture Ad       Instagram   $850     3.8x   +8%    OPTIMIZING
  └── pos-3  Lo-Fi Skincare Demo          YT Shorts   $400     1.2x   -5%    LIQUIDATING`,

  portfolio: () => `PORTFOLIO SUMMARY:
  ├── Total AUM:          $2,500
  ├── Weighted ROAS:      3.7x
  ├── Daily P&L:          +$142.50 (+5.7%)
  ├── Win Rate:           2/3 (66.7%)
  ├── Avg Hold Time:      4.2 days
  └── Sharpe Ratio:       2.14`,

  risk: () => `RISK ANALYSIS:
  ├── Portfolio Beta:     0.82
  ├── Max Drawdown:       -8.3%
  ├── VaR (95%):          -$87.50
  ├── Concentration Risk: MODERATE (pos-1 = 50% of AUM)
  ├── Decay Exposure:     1 position (pos-3)
  └── Recommendation:    Reduce pos-3 exposure or hedge`,

  scan: () => `SCANNING MARKET SIGNALS...
  ├── TikTok:      3 trending audio anomalies detected
  ├── Instagram:   Engagement rate shifting +12% in niche
  ├── LinkedIn:    Anti-corporate content surging
  ├── YouTube:     Short-form algorithm favoring UGC-style
  └── RESULT:      pos-1 momentum confirmed. pos-3 decay accelerating.`,

  brief: () => `REGENERATING ALPHA BRIEF...
  ├── Fetching market data.......... DONE
  ├── Running trend analysis........ DONE
  ├── Generating playbook........... DONE
  └── Alpha brief updated. Anomaly confidence: 91.2%`,

  history: () => `RECENT COMMANDS:
  ├── /status
  ├── /positions
  ├── /scan
  └── /brief`,

  export: () => `EXPORTING PORTFOLIO DATA...
  ├── Format: JSON
  ├── Positions: 3
  ├── Timestamp: ${new Date().toISOString()}
  └── ✓ Copied to clipboard`,

  theme: () => `AVAILABLE THEMES:
  ├── matrix    (green on black)
  ├── amber     (amber on black) [CURRENT]
  ├── cyan      (cyan on black)
  └── red       (red on black)
  Usage: /theme <name>`,

  clear: () => '__CLEAR__',
};

const STARTUP_SEQUENCE = [
  { type: 'system' as const, msg: 'AVOIR TERMINAL v2.4.1' },
  { type: 'system' as const, msg: 'Initializing portfolio engine...' },
  { type: 'system' as const, msg: 'Connecting to exchange APIs... OK' },
  { type: 'system' as const, msg: 'Type /help for available commands' },
  { type: 'system' as const, msg: '─'.repeat(48) },
];

export default function TerminalCLI({ onCommand }: TerminalCLIProps) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<CLIEntry[]>([]);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIdx, setSuggestionIdx] = useState(0);
  const [booted, setBooted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Boot sequence
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < STARTUP_SEQUENCE.length) {
        setHistory(prev => [...prev, { input: '', output: STARTUP_SEQUENCE[i].msg, timestamp: now(), type: STARTUP_SEQUENCE[i].type }]);
        i++;
      } else {
        setBooted(true);
        clearInterval(interval);
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const suggestions = useMemo(() => {
    if (!input.startsWith('/') || input.length < 1) return [];
    return COMMAND_LIST.filter(c => c.startsWith(input.toLowerCase()));
  }, [input]);

  const now = () => {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;
  };

  const execute = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    const ts = now();
    const cmd = trimmed.startsWith('/') ? trimmed.slice(1).split(' ')[0].toLowerCase() : trimmed.toLowerCase();
    const args = trimmed.slice(cmd.length + (trimmed.startsWith('/') ? 1 : 0) + cmd.length).trim();
    const fullArgs = trimmed.slice(cmd.length + 1).trim();

    let output = '';
    let isError = false;

    if (cmd === 'clear') {
      setHistory([]);
      setInput('');
      return;
    }

    if (COMMANDS[cmd]) {
      output = COMMANDS[cmd](fullArgs);
    } else if (trimmed.startsWith('/liquidate')) {
      const posId = fullArgs || 'pos-3';
      output = `LIQUIDATING ${posId.toUpperCase()}...
  ├── Selling all allocated capital at market price...
  ├── Execution complete. Funds returned to pool.
  └── Position ${posId} marked as CLOSED.`;
    } else if (trimmed.startsWith('/allocate')) {
      const match = fullArgs.match(/\$(\d+)\s+(\S+)/);
      if (match) {
        output = `ALLOCATING $${match[1]} → ${match[2].toUpperCase()}...
  ├── Bid placed. Waiting for fill...
  ├── FILLED at $${match[1]}
  └── Position ${match[2]} updated. New AUM confirmed.`;
      } else {
        output = 'USAGE: /allocate $<amount> <pos-id>';
        isError = true;
      }
    } else if (trimmed.startsWith('/alert')) {
      output = `ALERT SET: "${fullArgs || 'No message'}"
  └── Notification will trigger when conditions are met.`;
    } else {
      output = `UNKNOWN COMMAND: "${trimmed}"
  └── Type /help for available commands`;
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
    setShowSuggestions(false);
    onCommand?.(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (showSuggestions && suggestions.length > 0) {
        setInput(suggestions[suggestionIdx]);
        setShowSuggestions(false);
      } else {
        execute(input);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (suggestions.length > 0) {
        const next = (suggestionIdx + 1) % suggestions.length;
        setSuggestionIdx(next);
        setInput(suggestions[next]);
      }
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
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  // Show suggestions on input change
  useEffect(() => {
    if (input.startsWith('/') && input.length >= 1 && suggestions.length > 0) {
      setShowSuggestions(true);
      setSuggestionIdx(0);
    } else {
      setShowSuggestions(false);
    }
  }, [input, suggestions.length]);

  const renderOutput = (text: string, isError: boolean) => {
    if (!text) return null;
    return (
      <pre className={`text-[9px] whitespace-pre-wrap pl-[90px] ${isError ? 'text-neon-red' : 'text-zinc-400'}`}>
        {text}
      </pre>
    );
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-terminal-border bg-black">
      {/* Output history */}
      <div
        ref={scrollRef}
        className="max-h-[140px] overflow-y-auto terminal-scrollbar px-3 py-1.5 space-y-0.5"
      >
        {history.map((entry, idx) => (
          <div key={idx}>
            {entry.type === 'command' && (
              <div className="flex items-center gap-2">
                <span className="text-[8px] text-zinc-700 w-[70px] flex-shrink-0">{entry.timestamp}</span>
                <span className="text-[9px] text-neon-amber font-bold">$</span>
                <span className="text-[9px] text-white">{entry.input}</span>
              </div>
            )}
            {entry.type === 'response' && renderOutput(entry.output, false)}
            {entry.type === 'error' && renderOutput(entry.output, true)}
            {entry.type === 'system' && (
              <div className="text-[9px] text-neon-cyan/60">{entry.output}</div>
            )}
          </div>
        ))}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="mx-3 mb-1 border border-terminal-border bg-terminal-surface">
          {suggestions.map((s, i) => (
            <div
              key={s}
              className={`px-3 py-1 text-[9px] font-mono cursor-pointer ${
                i === suggestionIdx ? 'bg-neon-amber/10 text-neon-amber' : 'text-zinc-500'
              }`}
              onClick={() => { setInput(s); setShowSuggestions(false); inputRef.current?.focus(); }}
            >
              {s}
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex items-center px-3 py-2 border-t border-terminal-border bg-terminal-surface">
        <span className="text-[10px] text-neon-amber font-bold mr-2">$</span>
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={booted ? 'Type /help for commands...' : ''}
            className="w-full bg-transparent text-[10px] text-white font-mono outline-none placeholder:text-zinc-700 caret-transparent"
            autoFocus
            disabled={!booted}
          />
          {/* Blinking block cursor overlay */}
          <span className="absolute top-1/2 -translate-y-1/2 pointer-events-none text-[10px] text-neon-amber font-mono" style={{ left: `${input.length * 6.5 + 2}px` }}>
            <span className="animate-pulse">█</span>
          </span>
        </div>
        <span className="text-[8px] text-zinc-700 ml-2 hidden sm:block">TAB ↹ autocomplete</span>
      </div>
    </div>
  );
}

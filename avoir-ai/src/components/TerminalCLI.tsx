'use client';

import { useState, useRef, useEffect, useMemo } from 'react';

interface CLIEntry {
  input: string;
  output: string;
  timestamp: string;
  type: 'command' | 'response' | 'error' | 'system';
}

interface TerminalCLIProps {
  onCommand?: (cmd: string, emitOutput: (output: string) => void) => void;
}

const COMMAND_LIST = [
  '/help', '/status', '/positions', '/portfolio', '/risk',
  '/allocate', '/liquidate', '/scan', '/brief', '/alert',
  '/history', '/export', '/theme', '/clear', '/alpha', '/agency',
];

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
        const entry = STARTUP_SEQUENCE[i];
        setHistory(prev => [...prev, { input: '', output: entry.msg, timestamp: now(), type: entry.type }]);
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

    const emitOutput = (output: string, isError = false) => {
      setHistory(prev => [
        ...prev,
        { input: trimmed, output: '', timestamp: ts, type: 'command' },
        { input: '', output, timestamp: ts, type: isError ? 'error' : 'response' },
      ]);
    };

    if (cmd === 'clear') {
      setHistory([]);
      setInput('');
      onCommand?.(trimmed, emitOutput);
      return;
    }

    onCommand?.(trimmed, emitOutput);

    setCmdHistory(prev => [trimmed, ...prev].slice(0, 50));
    setHistIdx(-1);
    setInput('');
    setShowSuggestions(false);
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

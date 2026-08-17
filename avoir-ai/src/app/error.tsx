'use client';

import { useEffect } from 'react';
import { Terminal, AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Global Crash Detected:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-zinc-950 border border-red-500/30 rounded-lg p-6 shadow-[0_0_50px_rgba(255,0,0,0.1)] font-mono">
        <div className="flex items-center gap-3 mb-6 border-b border-red-500/20 pb-4">
          <div className="p-2 bg-red-500/10 rounded-md">
            <AlertTriangle className="w-6 h-6 text-red-500 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-widest uppercase">System Failure</h1>
            <p className="text-sm text-zinc-500">Avoir Terminal Error Boundary</p>
          </div>
        </div>

        <div className="bg-black border border-zinc-800 rounded p-4 mb-6 overflow-x-auto terminal-scrollbar">
          <div className="flex items-center gap-2 mb-2">
            <Terminal className="w-4 h-4 text-zinc-500" />
            <span className="text-xs text-zinc-500 uppercase">Stack Trace</span>
          </div>
          <pre className="text-sm text-red-400 whitespace-pre-wrap font-mono">
            {error.message || 'Unknown critical error encountered in UI thread.'}
          </pre>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500 hidden sm:block">Run diagnostics and reset terminal state.</span>
          <button
            onClick={() => reset()}
            className="flex items-center gap-2 px-6 py-2 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-white transition-all rounded font-bold uppercase tracking-wider text-sm w-full sm:w-auto justify-center"
          >
            <RefreshCw className="w-4 h-4" />
            Re-Initialize
          </button>
        </div>
      </div>
    </div>
  );
}

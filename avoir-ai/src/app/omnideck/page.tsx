'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Server, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { RequireAuth } from '@/components/auth/guards';
import InteractivePlasmaCanvas from '@/components/InteractivePlasmaCanvas';
import TickerTape from '@/components/TickerTape';
import OrderBook from '@/components/OrderBook';
import ExecutionLog from '@/components/ExecutionLog';
import type { ExecutionLogHandle, ExternalLogEntry } from '@/components/ExecutionLog';
import TerminalCLI from '@/components/TerminalCLI';
import TerminalChart from '@/components/TerminalChart';
import DailyAlphaBrief from '@/components/DailyAlphaBrief';
import { CapitalDeploymentSimulator } from '@/components/CapitalDeploymentSimulator';
import { ThemeToggle } from '@/components/ThemeToggle';

const AGENCY_CLIENTS = [
  { name: 'Nexus Brands', spend: '$42K/mo', roas: 3.2, status: 'ACTIVE' },
  { name: 'Vortex Media', spend: '$18K/mo', roas: 4.1, status: 'ACTIVE' },
  { name: 'Axiom D2C', spend: '$7K/mo', roas: 2.8, status: 'ONBOARDING' },
];

export default function OmniDeckPage() {
  const router = useRouter();
  const logRef = useRef<ExecutionLogHandle>(null);
  const [selectedCampaignForSim, setSelectedCampaignForSim] = useState<any | null>(null);
  const [externalLogs, setExternalLogs] = useState<ExternalLogEntry[]>([]);
  const [clearLogs, setClearLogs] = useState(false);
  const [showAlphaBrief, setShowAlphaBrief] = useState(false);
  const [agencyMode, setAgencyMode] = useState(false);

  const [activePositions, setActivePositions] = useState([
    { id: 'pos-1', asset: 'Corporate Villain Era Hook', platform: 'TikTok', roas: 4.2, spend: 1250, momentum: '+15', status: 'SCALING', isDecaying: false },
    { id: 'pos-2', asset: 'Anti-Hustle Culture Ad', platform: 'Instagram', roas: 3.8, spend: 850, momentum: '+8', status: 'OPTIMIZING', isDecaying: false },
    { id: 'pos-3', asset: 'Lo-Fi Skincare Demo', platform: 'YouTube Shorts', roas: 1.2, spend: 400, momentum: '-5', status: 'LIQUIDATING', isDecaying: false },
  ]);

  const totalAum = activePositions.reduce((sum, p) => sum + p.spend, 0);

  const now = useCallback(() => {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;
  }, []);

  const addExternalLog = useCallback((level: ExternalLogEntry['level'], message: string) => {
    const ts = now();
    setExternalLogs(prev => [...prev, { timestamp: ts, level, message }]);
    logRef.current?.addEntry(level, message);
  }, [now]);

  const handleCommand = useCallback((cmd: string, emitOutput: (output: string, isError?: boolean) => void) => {
    const trimmed = cmd.trim();
    const command = trimmed.startsWith('/') ? trimmed.slice(1).split(' ')[0].toLowerCase() : trimmed.toLowerCase();
    const fullArgs = trimmed.slice(command.length + 1).trim();

    switch (command) {
      case 'help':
        emitOutput(`AVAILABLE COMMANDS:
  ├── /help                  Show this help
  ├── /status                System status overview
  ├── /positions             List all active positions
  ├── /portfolio             Portfolio summary with risk metrics
  ├── /risk                  Risk analysis breakdown
  ├── /allocate $<amt> <id>  Reallocate capital to position
  ├── /liquidate <id>        Liquidate a position (updates Order Book)
  ├── /scan                  Run market signal scan
  ├── /brief                 Regenerate alpha brief
  ├── /alpha                 Toggle Daily Alpha Brief panel
  ├── /agency                Toggle B2B Agency Bridge panel
  ├── /alert <msg>           Set custom alert condition
  ├── /history               Show command history
  ├── /export                Export data to clipboard
  ├── /theme                 Change terminal theme
  └── /clear                 Clear terminal + execution log`);
        addExternalLog('INFO', 'Help menu displayed');
        break;

      case 'status':
        emitOutput(`SYSTEM STATUS:
  ├── Engine:       ● ONLINE
  ├── Connections:  4/4 EXCHANGES CONNECTED
  ├── Latency:      8ms avg (12ms p99)
  ├── Uptime:       99.97% (14d 7h 23m)
  ├── Active Pos:   ${activePositions.length}
  ├── Total AUM:    $${totalAum.toLocaleString()}
  └── Last Scan:    ${now()}`);
        addExternalLog('ALGO', 'System status check completed');
        break;

      case 'positions':
        emitOutput(`ACTIVE POSITIONS:\n${activePositions.map(p =>
          `  ├── ${p.id}  ${p.asset.padEnd(30)} ${p.platform.padEnd(12)} $${String(p.spend).padEnd(6)} ${p.roas}x   ${p.momentum}%   ${p.status}`
        ).join('\n')}`);
        addExternalLog('INFO', 'Position list displayed');
        break;

      case 'portfolio':
        emitOutput(`PORTFOLIO SUMMARY:
  ├── Total AUM:          $${totalAum.toLocaleString()}
  ├── Weighted ROAS:      ${(activePositions.reduce((s, p) => s + p.roas, 0) / activePositions.length).toFixed(1)}x
  ├── Daily P&L:          +$${(totalAum * 0.057).toFixed(2)} (+5.7%)
  ├── Win Rate:           ${activePositions.filter(p => p.roas >= 2).length}/${activePositions.length} (${((activePositions.filter(p => p.roas >= 2).length / activePositions.length) * 100).toFixed(1)}%)
  ├── Avg Hold Time:      4.2 days
  └── Sharpe Ratio:       2.14`);
        addExternalLog('ALGO', 'Portfolio summary generated');
        break;

      case 'risk':
        emitOutput(`RISK ANALYSIS:
  ├── Portfolio Beta:     0.82
  ├── Max Drawdown:       -8.3%
  ├── VaR (95%):          -$${(totalAum * 0.035).toFixed(2)}
  ├── Concentration Risk: MODERATE (pos-1 = ${((activePositions[0]?.spend / totalAum) * 100).toFixed(0)}% of AUM)
  ├── Decay Exposure:     ${activePositions.filter(p => p.isDecaying).length} position(s)
  └── Recommendation:    Reduce decay exposure or hedge`);
        addExternalLog('WARN', 'Risk analysis: decay exposure detected');
        break;

      case 'scan':
        emitOutput(`SCANNING MARKET SIGNALS...
  ├── TikTok:      3 trending audio anomalies detected
  ├── Instagram:   Engagement rate shifting +12% in niche
  ├── LinkedIn:    Anti-corporate content surging
  ├── YouTube:     Short-form algorithm favoring UGC-style
  └── RESULT:      pos-1 momentum confirmed. pos-3 decay accelerating.`);
        addExternalLog('SIGNAL', 'Market scan complete: 3 anomalies detected');
        break;

      case 'brief':
        emitOutput(`REGENERATING ALPHA BRIEF...
  ├── Fetching market data.......... DONE
  ├── Running trend analysis........ DONE
  ├── Generating playbook........... DONE
  └── Alpha brief updated. Anomaly confidence: 91.2%`);
        addExternalLog('ALGO', 'Alpha brief regenerated — confidence 91.2%');
        break;

      case 'alpha':
        setShowAlphaBrief(prev => !prev);
        emitOutput(showAlphaBrief ? 'DAILY ALPHA BRIEF: CLOSED' : 'DAILY ALPHA BRIEF: OPENED');
        addExternalLog('EXEC', showAlphaBrief ? 'Alpha brief panel closed' : 'Alpha brief panel opened');
        break;

      case 'agency':
        setAgencyMode(prev => !prev);
        emitOutput(agencyMode ? 'AGENCY MODE: DEACTIVATED' : 'AGENCY MODE: ACTIVATED — B2B Client Bridge Online');
        addExternalLog('EXEC', agencyMode ? 'Agency mode deactivated' : 'Agency mode activated — B2B bridge online');
        break;

      case 'liquidate': {
        const posId = fullArgs || 'pos-3';
        emitOutput(`LIQUIDATING ${posId.toUpperCase()}...
  ├── Selling all allocated capital at market price...
  ├── Execution complete. Funds returned to pool.
  └── Position ${posId} marked as LIQUIDATED.`);
        setActivePositions(prev => prev.map(p =>
          p.id === posId ? { ...p, status: 'LIQUIDATED', isDecaying: true } : p
        ));
        addExternalLog('EXEC', `LIQUIDATION EXECUTED: ${posId} — all capital returned to pool`);
        break;
      }

      case 'allocate': {
        const match = fullArgs.match(/\$(\d+)\s+(\S+)/);
        if (match) {
          emitOutput(`ALLOCATING $${match[1]} → ${match[2].toUpperCase()}...
  ├── Bid placed. Waiting for fill...
  ├── FILLED at $${match[1]}
  └── Position ${match[2]} updated. New AUM confirmed.`);
          addExternalLog('EXEC', `Capital allocated: $${match[1]} → ${match[2]}`);
        } else {
          emitOutput('USAGE: /allocate $<amount> <pos-id>', true);
        }
        break;
      }

      case 'alert':
        emitOutput(`ALERT SET: "${fullArgs || 'No message'}"
  └── Notification will trigger when conditions are met.`);
        addExternalLog('SIGNAL', `Custom alert armed: "${fullArgs || 'No message'}"`);
        break;

      case 'history':
        emitOutput(`RECENT COMMANDS:
  ├── /status
  ├── /positions
  ├── /scan
  └── /brief`);
        break;

      case 'export':
        emitOutput(`EXPORTING PORTFOLIO DATA...
  ├── Format: JSON
  ├── Positions: ${activePositions.length}
  ├── Timestamp: ${new Date().toISOString()}
  └── ✓ Copied to clipboard`);
        addExternalLog('INFO', 'Portfolio data exported to clipboard');
        break;

      case 'theme':
        emitOutput(`AVAILABLE THEMES:
  ├── matrix    (green on black)
  ├── amber     (amber on black) [CURRENT]
  ├── cyan      (cyan on black)
  └── red       (red on black)
  Usage: /theme <name>`);
        break;

      case 'clear':
        setClearLogs(true);
        setTimeout(() => setClearLogs(false), 100);
        break;

      default:
        emitOutput(`UNKNOWN COMMAND: "${trimmed}"
  └── Type /help for available commands`, true);
        break;
    }
  }, [activePositions, totalAum, now, showAlphaBrief, agencyMode, addExternalLog]);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const eventSource = new EventSource(`${apiUrl}/api/engagement/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.id && data.momentum !== undefined) {
          setActivePositions(prev => prev.map(pos => {
            if (pos.id === data.id) {
              const newStatus = data.momentum > 10 ? 'SCALING' : data.momentum > 0 ? 'OPTIMIZING' : 'LIQUIDATING';
              return {
                ...pos,
                momentum: data.momentum > 0 ? `+${data.momentum}` : `${data.momentum}`,
                isDecaying: data.is_decay_alert,
                status: data.is_decay_alert ? 'DECAY WARNING' : newStatus
              };
            }
            return pos;
          }));
        }
      } catch (err) {}
    };

    return () => eventSource.close();
  }, []);

  return (
    <RequireAuth>
    <div className="h-screen bg-background text-foreground font-mono overflow-hidden selection:bg-neon-amber/30 terminal-scrollbar flex flex-col crt-scanline noise-overlay vignette">

      {/* Background Grid */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <InteractivePlasmaCanvas />
      </div>

      {/* ── HEADER ── */}
      <header className="relative z-10 border-b border-terminal-border bg-background flex-shrink-0">
        <div className="h-10 flex items-center justify-between px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <button onClick={() => router.push('/dashboard')} className="text-zinc-400 hover:text-neon-amber transition-colors text-[10px] flex-shrink-0">
              [ESC]
            </button>
            <div className="h-4 w-px bg-terminal-border flex-shrink-0" />
            <Server className="w-3.5 h-3.5 text-neon-cyan flex-shrink-0" />
            <span className="text-[11px] font-bold tracking-[0.2em] text-neon-cyan truncate">OMNI-DECK</span>
            <span className="text-[10px] text-zinc-500 hidden sm:inline">{'// PORTFOLIO MANAGER'}</span>
          </div>
          <div className="flex items-center gap-4 flex-shrink-0">
            <span className="px-2 py-0.5 text-[9px] font-bold tracking-widest text-neon-amber border border-neon-amber/30 bg-neon-amber/10 hidden sm:inline-block">
              SIMULATED DATA
            </span>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-neon-green" />
              <span className="text-[10px] text-neon-green tracking-widest hidden sm:inline">NOMINAL</span>
            </div>
            <span className="text-[9px] text-zinc-500 hidden md:inline">v2.4.1</span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ── TICKER TAPE ── */}
      <TickerTape positions={activePositions} totalAum={totalAum} />

      {/* ── MAIN GRID ── */}
      <div className="relative z-10 flex-1 flex overflow-hidden">

        {/* Left: Order Book */}
        <div className="w-full lg:w-[420px] flex-shrink-0 border-r border-terminal-border overflow-y-auto terminal-scrollbar">
          <OrderBook positions={activePositions} onSelect={setSelectedCampaignForSim} />
        </div>

        {/* Right: Charts + Log */}
        <div className="hidden lg:flex flex-1 flex-col min-w-0">

          {/* Daily Alpha Brief (toggle via /alpha) */}
          {showAlphaBrief && (
            <div className="border-b border-terminal-border">
              <DailyAlphaBrief />
            </div>
          )}

          {/* Charts Grid */}
          <div className="grid grid-cols-2 xl:grid-cols-4 border-b border-terminal-border">
            <TerminalChart title="ROAS INDEX" color="amber" min={0} max={8} dataPoints={40} speed={800} />
            <TerminalChart title="MOMENTUM" color="cyan" min={-20} max={30} dataPoints={40} speed={1200} />
            <TerminalChart title="REACH" color="green" min={0} max={50000} dataPoints={40} speed={1500} />
            <TerminalChart title="DECAY RISK" color="red" min={0} max={100} dataPoints={40} speed={1000} />
          </div>

          {/* Execution Log */}
          <div className="flex-1 min-h-0">
            <ExecutionLog ref={logRef} externalEntries={externalLogs} clearLogs={clearLogs} />
          </div>
        </div>
      </div>

      {/* ── CLI ── */}
      <TerminalCLI onCommand={handleCommand} />

      {/* ── AGENCY MODE OVERLAY ── */}
      <AnimatePresence>
        {agencyMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setAgencyMode(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="border border-terminal-border bg-background max-w-lg w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-terminal-border bg-terminal-surface">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-neon-cyan" />
                  <span className="text-[11px] font-bold tracking-[0.2em] text-neon-cyan">AGENCY MODE — B2B CLIENT BRIDGE</span>
                </div>
                <button onClick={() => setAgencyMode(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4">
                <div className="text-[10px] text-zinc-400 mb-3 tracking-widest">ACTIVE CLIENT PORTFOLIOS</div>
                <div className="space-y-0">
                  {AGENCY_CLIENTS.map((client) => (
                    <div key={client.name} className="grid grid-cols-[1fr_90px_60px_90px] border-b border-terminal-border py-2.5 items-center">
                      <span className="text-[12px] text-foreground font-medium">{client.name}</span>
                      <span className="text-[12px] text-neon-amber text-right font-mono">{client.spend}</span>
                      <span className="text-[12px] text-neon-cyan text-right font-mono">{client.roas}x</span>
                      <span className={`text-[10px] font-bold text-right tracking-widest ${
                        client.status === 'ACTIVE' ? 'text-neon-green' : 'text-neon-amber'
                      }`}>{client.status}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-2 border-t border-terminal-border flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500">TYPE /agency TO CLOSE</span>
                  <span className="text-[10px] text-zinc-400">3 CLIENTS • $67K/mo TOTAL</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SIMULATOR MODAL ── */}
      <AnimatePresence>
        {selectedCampaignForSim && (
          <CapitalDeploymentSimulator
            onClose={() => setSelectedCampaignForSim(null)}
            campaignPlan={selectedCampaignForSim}
          />
        )}
      </AnimatePresence>
    </div>
    </RequireAuth>
  );
}

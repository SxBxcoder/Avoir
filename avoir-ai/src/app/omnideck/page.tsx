'use client';

import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, Briefcase, BarChart2, ChevronRight, Server, Share2, CheckCircle2, Zap, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { RequireAuth } from '@/components/auth/guards';
import InteractivePlasmaCanvas from '@/components/InteractivePlasmaCanvas';
import DailyAlphaBrief from '@/components/DailyAlphaBrief';
import { CapitalDeploymentSimulator } from '@/components/CapitalDeploymentSimulator';

const fadeTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15 },
};

export default function OmniDeckPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'positions' | 'intelligence' | 'b2b'>('positions');
  const activeTabRef = useRef(activeTab);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);
  const [engagements, setEngagements] = useState<any[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedCampaignForSim, setSelectedCampaignForSim] = useState<any | null>(null);

  const [activePositions, setActivePositions] = useState([
    { id: 'pos-1', asset: 'Corporate Villain Era Hook', platform: 'TikTok', roas: 4.2, spend: 1250, momentum: '+15', status: 'SCALING', isDecaying: false },
    { id: 'pos-2', asset: 'Anti-Hustle Culture Ad', platform: 'Instagram', roas: 3.8, spend: 850, momentum: '+8', status: 'OPTIMIZING', isDecaying: false },
    { id: 'pos-3', asset: 'Lo-Fi Skincare Demo', platform: 'YouTube Shorts', roas: 1.2, spend: 400, momentum: '-5', status: 'LIQUIDATING', isDecaying: false },
  ]);

  const clients = [
    { id: 'c-1', name: 'Stark Industries', aum: '$50,000/mo', performance: '+24%' },
    { id: 'c-2', name: 'Wayne Enterprises', aum: '$120,000/mo', performance: '+18%' },
  ];

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
        } else if (data.action) {
          if (activeTabRef.current === 'intelligence') {
            setEngagements(prev => [data, ...prev].slice(0, 15));
          }
        }
      } catch (err) {}
    };

    return () => eventSource.close();
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <RequireAuth>
    <div className="min-h-screen bg-black text-white font-mono overflow-x-hidden selection:bg-neon-amber/30 terminal-scrollbar">
      {/* Background Grid */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <InteractivePlasmaCanvas />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-terminal-border bg-black">
        <div className="max-w-[1600px] mx-auto px-4 h-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/')} className="text-zinc-600 hover:text-neon-amber transition-colors text-xs">
              [BACK]
            </button>
            <div className="h-3 w-px bg-terminal-border" />
            <div className="flex items-center gap-2">
              <Server className="w-3.5 h-3.5 text-neon-cyan" />
              <span className="text-[10px] font-bold tracking-[0.2em] text-neon-cyan">OMNI-DECK // PORTFOLIO MANAGER</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-neon-green" />
              <span className="text-[9px] text-neon-green tracking-widest">SYSTEM NOMINAL</span>
            </div>
            <span className="text-[9px] text-zinc-600">v2.4.1</span>
          </div>
        </div>
      </header>

      {/* Alpha Brief */}
      <div className="relative z-10 max-w-[1600px] mx-auto px-4 pt-3">
        <DailyAlphaBrief />
      </div>

      {/* Main Content */}
      <main className="relative z-10 max-w-[1600px] mx-auto px-4 py-3 flex gap-0">

        {/* Sidebar Nav */}
        <aside className="w-52 flex-shrink-0 border-r border-terminal-border">
          <NavButton
            active={activeTab === 'positions'}
            onClick={() => setActiveTab('positions')}
            icon={<BarChart2 className="w-3.5 h-3.5" />}
            label="ACTIVE POSITIONS"
          />
          <NavButton
            active={activeTab === 'intelligence'}
            onClick={() => setActiveTab('intelligence')}
            icon={<Activity className="w-3.5 h-3.5" />}
            label="INTELLIGENCE"
          />
          <NavButton
            active={activeTab === 'b2b'}
            onClick={() => setActiveTab('b2b')}
            icon={<Briefcase className="w-3.5 h-3.5" />}
            label="B2B CLIENTS"
          />
        </aside>

        {/* Tab Content */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">

            {/* POSITIONS TAB */}
            {activeTab === 'positions' && (
              <motion.div
                key="positions"
                id="active-positions-table"
                {...fadeTransition}
                className="px-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold tracking-[0.15em] text-white">CAPITAL DEPLOYMENT STATUS</h2>
                  <div className="text-right">
                    <p className="text-[9px] text-zinc-600 tracking-widest">TOTAL AUM</p>
                    <p className="text-base font-bold text-neon-amber text-glow-amber">$2,500.00</p>
                  </div>
                </div>

                {/* Table */}
                <div className="border border-terminal-border overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-terminal-border bg-terminal-surface">
                        <th className="px-3 py-2 text-[9px] font-bold text-zinc-500 tracking-widest">ASSET (CAMPAIGN)</th>
                        <th className="px-3 py-2 text-[9px] font-bold text-zinc-500 tracking-widest">EXCHANGE</th>
                        <th className="px-3 py-2 text-[9px] font-bold text-zinc-500 tracking-widest">CAPITAL</th>
                        <th className="px-3 py-2 text-[9px] font-bold text-zinc-500 tracking-widest">ROAS</th>
                        <th className="px-3 py-2 text-[9px] font-bold text-zinc-500 tracking-widest">MOMENTUM</th>
                        <th className="px-3 py-2 text-[9px] font-bold text-zinc-500 tracking-widest text-right">STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activePositions.map((pos, idx) => (
                        <tr
                          key={pos.id}
                          onClick={() => setSelectedCampaignForSim(pos)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedCampaignForSim(pos);
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          className={`border-b border-terminal-border cursor-pointer transition-colors ${
                            pos.isDecaying
                              ? 'bg-neon-red/10 animate-pulse'
                              : idx % 2 === 0
                                ? 'bg-black hover:bg-terminal-surface'
                                : 'bg-terminal-surface/50 hover:bg-terminal-surface'
                          }`}
                        >
                          <td className="px-3 py-2 text-[12px] text-white font-medium">{pos.asset}</td>
                          <td className="px-3 py-2 text-[12px] text-zinc-500">{pos.platform}</td>
                          <td className="px-3 py-2 text-[12px] text-neon-amber font-bold">${pos.spend}</td>
                          <td className="px-3 py-2 text-[12px] text-neon-cyan font-bold">{pos.roas}x</td>
                          <td className={`px-3 py-2 text-[12px] font-bold ${
                            String(pos.momentum).startsWith('+') ? 'text-neon-green text-glow-green' : 'text-neon-red text-glow-red'
                          }`}>
                            {pos.momentum}%
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className={`inline-block px-2 py-0.5 text-[9px] font-bold tracking-widest ${
                              pos.isDecaying
                                ? 'bg-neon-red text-black'
                                : pos.status === 'SCALING'
                                  ? 'bg-neon-green/15 text-neon-green border border-neon-green/30'
                                  : pos.status === 'OPTIMIZING'
                                    ? 'bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/30'
                                    : 'bg-neon-red/15 text-neon-red border border-neon-red/30'
                            }`}>
                              {pos.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* INTELLIGENCE TAB */}
            {activeTab === 'intelligence' && (
              <motion.div
                key="intelligence"
                {...fadeTransition}
                className="px-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold tracking-[0.15em] text-white">LIVE MARKET INTELLIGENCE</h2>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-neon-green animate-pulse" />
                    <span className="text-[9px] text-neon-green tracking-widest">RECEIVING TELEMETRY</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-terminal-border">
                  {engagements.length === 0 ? (
                    <div className="col-span-2 py-10 text-center text-zinc-600 text-[11px] tracking-widest border-b border-terminal-border">
                      AWAITING MARKET SIGNALS...
                    </div>
                  ) : (
                    engagements.map((eng, idx) => (
                      <div
                        key={idx}
                        className="px-3 py-2.5 border-b border-terminal-border flex items-start gap-3 hover:bg-terminal-surface transition-colors"
                      >
                        <div className={`w-5 h-5 flex items-center justify-center flex-shrink-0 ${
                          eng.type === 'comment' ? 'text-neon-cyan' :
                          eng.type === 'share' ? 'text-neon-green' :
                          'text-neon-red'
                        }`}>
                          <Zap className="w-3 h-3" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] text-white"><span className="font-bold">{eng.user}</span> <span className="text-zinc-500">{eng.action}</span></p>
                          <p className="text-[9px] text-zinc-600 mt-0.5">{eng.platform} &middot; {eng.sentiment}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {/* B2B BRIDGE TAB */}
            {activeTab === 'b2b' && (
              <motion.div
                key="b2b"
                {...fadeTransition}
                className="px-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold tracking-[0.15em] text-white">INSTITUTIONAL CLIENT PORTAL</h2>
                  <span className="text-[9px] text-zinc-600 border border-terminal-border px-2 py-0.5 tracking-widest">AGENCY MODE</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 border border-terminal-border">
                  {/* Clients List */}
                  <div className="lg:col-span-1 border-r border-terminal-border">
                    {clients.map(client => (
                      <div
                        key={client.id}
                        className="px-3 py-3 border-b border-terminal-border hover:bg-terminal-surface cursor-pointer transition-colors"
                      >
                        <h3 className="text-[11px] font-bold text-white mb-1">{client.name}</h3>
                        <div className="flex items-center justify-between text-[10px] text-zinc-600">
                          <span>AUM: {client.aum}</span>
                          <span className="text-neon-green font-bold">{client.performance}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Client Report Generator */}
                  <div className="lg:col-span-2 flex flex-col items-center justify-center text-center py-12 px-8">
                    <Shield className="w-8 h-8 text-zinc-700 mb-3" />
                    <h3 className="text-[11px] font-bold tracking-[0.15em] text-zinc-400 mb-2">WHITE-LABEL REPORT GENERATOR</h3>
                    <p className="text-[10px] text-zinc-600 max-w-sm mb-5 leading-relaxed">
                      Generate cryptographic share links for clients to view real-time portfolio performance.
                    </p>
                    <button
                      onClick={() => copyToClipboard('https://avoir.ai/client/rep_8x92nd81')}
                      className="terminal-btn flex items-center gap-2"
                    >
                      {copiedLink ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                      {copiedLink ? 'LINK COPIED' : 'GENERATE CLIENT REPORT LINK'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>

      {/* Simulator Modal */}
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

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors border-b border-terminal-border ${
        active
          ? 'bg-terminal-surface border-l-2 border-l-neon-amber text-neon-amber'
          : 'bg-transparent border-l-2 border-l-transparent text-zinc-600 hover:text-zinc-400 hover:bg-terminal-surface/50'
      }`}
    >
      <div className="flex items-center gap-2.5">
        {icon}
        <span className="text-[10px] font-bold tracking-widest">{label}</span>
      </div>
      {active && <ChevronRight className="w-3 h-3" />}
    </button>
  );
}

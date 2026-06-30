'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Activity, TrendingUp, DollarSign, Users, Briefcase, Zap, Shield, ArrowRight, Server, ChevronRight, Share2, Copy, BarChart2, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import InteractivePlasmaCanvas from '@/components/InteractivePlasmaCanvas';

// Spring physics
const springConfig = { type: 'spring' as const, stiffness: 300, damping: 30 };
const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: springConfig },
};

export default function OmniDeckPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'positions' | 'intelligence' | 'b2b'>('positions');
  const [engagements, setEngagements] = useState<any[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);

  // Mock Active Positions (Live Campaigns)
  const activePositions = [
    { id: 'pos-1', asset: 'Corporate Villain Era Hook', platform: 'TikTok', roas: 4.2, spend: 1250, momentum: '+15%', status: 'SCALING' },
    { id: 'pos-2', asset: 'Anti-Hustle Culture Ad', platform: 'Instagram', roas: 3.8, spend: 850, momentum: '+8%', status: 'OPTIMIZING' },
    { id: 'pos-3', asset: 'Lo-Fi Skincare Demo', platform: 'YouTube Shorts', roas: 1.2, spend: 400, momentum: '-5%', status: 'LIQUIDATING' },
  ];

  // Mock B2B Clients
  const clients = [
    { id: 'c-1', name: 'Stark Industries', aum: '$50,000/mo', performance: '+24%' },
    { id: 'c-2', name: 'Wayne Enterprises', aum: '$120,000/mo', performance: '+18%' },
  ];

  useEffect(() => {
    if (activeTab === 'intelligence') {
      const eventSource = new EventSource('/api/engagement/stream');
      eventSource.onmessage = (event) => {
        try {
          const newEngagement = JSON.parse(event.data);
          setEngagements(prev => [newEngagement, ...prev].slice(0, 15));
        } catch (err) {}
      };
      return () => eventSource.close();
    }
  }, [activeTab]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-x-hidden selection:bg-indigo-500/30">
      {/* Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <InteractivePlasmaCanvas />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
        <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-indigo-900/20 to-transparent blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/10 bg-black/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="text-zinc-400 hover:text-white transition-colors">
              <ArrowRight className="w-5 h-5 rotate-180" />
            </button>
            <div className="h-4 w-px bg-white/20" />
            <div className="flex items-center gap-2 text-indigo-400">
              <Server className="w-5 h-5" />
              <span className="font-tactical font-bold tracking-widest">OMNI-DECK // PORTFOLIO MANAGER</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-tactical text-emerald-400">SYSTEM NOMINAL</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8 flex gap-8">
        
        {/* Sidebar Nav */}
        <aside className="w-64 flex-shrink-0 space-y-2">
          <NavButton 
            active={activeTab === 'positions'} 
            onClick={() => setActiveTab('positions')} 
            icon={<BarChart2 className="w-4 h-4" />} 
            label="ACTIVE POSITIONS" 
          />
          <NavButton 
            active={activeTab === 'intelligence'} 
            onClick={() => setActiveTab('intelligence')} 
            icon={<Activity className="w-4 h-4" />} 
            label="MARKET INTELLIGENCE" 
          />
          <NavButton 
            active={activeTab === 'b2b'} 
            onClick={() => setActiveTab('b2b')} 
            icon={<Briefcase className="w-4 h-4" />} 
            label="B2B BRIDGE (CLIENTS)" 
          />
        </aside>

        {/* Tab Content */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            
            {/* POSITIONS TAB */}
            {activeTab === 'positions' && (
              <motion.div
                key="positions"
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-tactical tracking-wider">CAPITAL DEPLOYMENT STATUS</h2>
                  <div className="text-right">
                    <p className="text-[10px] font-tactical text-zinc-500">TOTAL AUM (AD SPEND)</p>
                    <p className="text-xl font-mono text-white">$2,500.00</p>
                  </div>
                </div>

                <div className="bg-zinc-900/50 border border-white/10 rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5 text-[10px] font-tactical text-zinc-400 tracking-wider">
                        <th className="p-4 font-normal">ASSET (CAMPAIGN)</th>
                        <th className="p-4 font-normal">EXCHANGE (PLATFORM)</th>
                        <th className="p-4 font-normal">CAPITAL ALLOCATED</th>
                        <th className="p-4 font-normal">CURRENT ROAS</th>
                        <th className="p-4 font-normal">MOMENTUM</th>
                        <th className="p-4 font-normal text-right">STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activePositions.map((pos, idx) => (
                        <motion.tr 
                          key={pos.id}
                          variants={staggerItem}
                          className="border-b border-white/5 hover:bg-white/5 transition-colors"
                        >
                          <td className="p-4 text-sm font-medium text-white">{pos.asset}</td>
                          <td className="p-4 text-sm text-zinc-400">{pos.platform}</td>
                          <td className="p-4 text-sm font-mono text-zinc-300">${pos.spend}</td>
                          <td className="p-4 text-sm font-mono text-indigo-400">{pos.roas}x</td>
                          <td className={`p-4 text-sm font-mono ${pos.momentum.startsWith('+') ? 'text-emerald-400' : 'text-red-400'}`}>
                            {pos.momentum}
                          </td>
                          <td className="p-4 text-right">
                            <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-tactical tracking-widest ${
                              pos.status === 'SCALING' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                              pos.status === 'OPTIMIZING' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                              'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                              {pos.status}
                            </span>
                          </td>
                        </motion.tr>
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
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-tactical tracking-wider">LIVE MARKET INTELLIGENCE</h2>
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Activity className="w-4 h-4 animate-pulse" />
                    <span className="text-xs font-tactical">RECEIVING TELEMETRY</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {engagements.length === 0 ? (
                    <div className="col-span-2 py-12 text-center text-zinc-500 font-mono text-sm border border-white/5 border-dashed rounded-xl">
                      Awaiting market signals...
                    </div>
                  ) : (
                    engagements.map((eng, idx) => (
                      <motion.div 
                        key={idx}
                        variants={staggerItem}
                        className="p-4 rounded-xl bg-zinc-900/50 border border-white/10 flex items-start gap-4"
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          eng.type === 'comment' ? 'bg-blue-500/20 text-blue-400' :
                          eng.type === 'share' ? 'bg-emerald-500/20 text-emerald-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          <Zap className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm text-white mb-1"><span className="font-bold">{eng.user}</span> {eng.action}</p>
                          <p className="text-xs text-zinc-500 font-mono">Platform: {eng.platform} • Sentiment: {eng.sentiment}</p>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {/* B2B BRIDGE TAB */}
            {activeTab === 'b2b' && (
              <motion.div
                key="b2b"
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-tactical tracking-wider">INSTITUTIONAL CLIENT PORTAL</h2>
                  <span className="text-[10px] font-tactical text-zinc-500 border border-white/10 px-2 py-1 rounded">AGENCY MODE ACTIVE</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Clients List */}
                  <div className="lg:col-span-1 space-y-3">
                    {clients.map(client => (
                      <motion.div 
                        key={client.id}
                        variants={staggerItem}
                        className="p-4 rounded-xl bg-zinc-900/50 border border-white/10 hover:border-indigo-500/50 cursor-pointer transition-colors group"
                      >
                        <h3 className="text-sm font-bold text-white mb-1 group-hover:text-indigo-400 transition-colors">{client.name}</h3>
                        <div className="flex items-center justify-between text-xs font-mono text-zinc-500">
                          <span>AUM: {client.aum}</span>
                          <span className="text-emerald-400">{client.performance}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Client Report Preview */}
                  <motion.div variants={staggerItem} className="lg:col-span-2 bg-zinc-900/30 border border-white/5 rounded-2xl p-8 flex flex-col items-center justify-center text-center min-h-[300px]">
                    <Shield className="w-12 h-12 text-indigo-500/50 mb-4" />
                    <h3 className="text-lg font-tactical text-white mb-2">WHITE-LABEL REPORT GENERATOR</h3>
                    <p className="text-sm text-zinc-400 max-w-md mx-auto mb-6">
                      Generate cryptographic share links for clients to view real-time portfolio performance without accessing the main command center.
                    </p>
                    <button 
                      onClick={() => copyToClipboard('https://avoir.ai/client/rep_8x92nd81')}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-tactical tracking-widest transition-colors"
                    >
                      {copiedLink ? <CheckCircle2 className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                      {copiedLink ? 'LINK COPIED' : 'GENERATE CLIENT REPORT LINK'}
                    </button>
                  </motion.div>
                </div>

              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
        active 
          ? 'bg-indigo-500/10 border border-indigo-500/30 text-indigo-400' 
          : 'bg-transparent border border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
      }`}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-[11px] font-tactical tracking-widest">{label}</span>
      </div>
      {active && <ChevronRight className="w-4 h-4" />}
    </button>
  );
}

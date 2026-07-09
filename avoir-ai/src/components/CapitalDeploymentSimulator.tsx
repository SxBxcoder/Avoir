'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Cpu, CheckCircle2, Globe, Server, Activity, ArrowRight, DollarSign } from 'lucide-react';

interface CapitalDeploymentSimulatorProps {
  onClose: () => void;
  campaignPlan: any;
}

export function CapitalDeploymentSimulator({ onClose, campaignPlan }: CapitalDeploymentSimulatorProps) {
  const [stage, setStage] = useState(0);
  const [budget, setBudget] = useState(5000);
  const [targetRoas, setTargetRoas] = useState(3.5);
  
  const stages = [
    { id: 'setup', title: 'CONFIGURING TRADE PARAMETERS' },
    { id: 'connecting', title: 'CONNECTING TO EXCHANGES' },
    { id: 'bidding', title: 'OPTIMIZING BID ALGORITHMS' },
    { id: 'deploying', title: 'DEPLOYING CAPITAL' },
    { id: 'live', title: 'TRADE EXECUTED' },
  ];

  const [simulationResult, setSimulationResult] = useState<any>(null);
  const mounted = useRef(true);

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  const handleExecute = async () => {
    setStage(1);
    
    // Start backend simulation simultaneously
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const simPromise = fetch(`${apiUrl}/api/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ budget, target_roas: targetRoas })
    }).then(res => res.json()).catch(() => null);

    await new Promise(r => setTimeout(r, 1200));
    if (!mounted.current) return;
    setStage(2);
    
    const result = await simPromise;
    if (!mounted.current) return;
    if (result) setSimulationResult(result);

    await new Promise(r => setTimeout(r, 1500));
    if (!mounted.current) return;
    setStage(3);
    await new Promise(r => setTimeout(r, 1000));
    if (!mounted.current) return;
    setStage(4);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" style={{ perspective: 1000 }}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20, rotateX: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20, rotateX: -10 }}
        whileHover={{ scale: 1.01, rotateX: 2, rotateY: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-2xl bg-zinc-950 border border-indigo-500/30 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(99,102,241,0.15)] relative"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-indigo-500/5">
          <div className="flex items-center gap-3">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-tactical font-bold text-white tracking-widest">CAPITAL DEPLOYMENT TERMINAL</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          
          <AnimatePresence mode="wait">
            {stage === 0 ? (
              <motion.div 
                key="setup"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <h3 className="text-[10px] font-tactical text-zinc-500 mb-2">TARGET ASSET</h3>
                  <p className="text-sm text-indigo-300 font-medium leading-relaxed">"{campaignPlan?.asset || campaignPlan?.hook || 'Campaign'}"</p>
                  <p className="text-xs text-zinc-500 mt-1 font-mono">{campaignPlan?.platform} &middot; Current ROAS: {campaignPlan?.roas}x &middot; Spend: ${campaignPlan?.spend}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-tactical text-zinc-500 mb-2 block">INITIAL CAPITAL ALLOCATION ($)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input 
                        type="number" 
                        value={budget}
                        onChange={(e) => setBudget(Number(e.target.value))}
                        className="w-full bg-black/50 border border-white/10 rounded-lg py-3 pl-9 pr-4 text-white font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-tactical text-zinc-500 mb-2 block">TARGET ROAS MULTIPLIER (x)</label>
                    <div className="relative">
                      <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input 
                        type="number" 
                        step="0.1"
                        value={targetRoas}
                        onChange={(e) => setTargetRoas(Number(e.target.value))}
                        className="w-full bg-black/50 border border-white/10 rounded-lg py-3 pl-9 pr-4 text-white font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleExecute}
                  className="w-full py-4 mt-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-tactical tracking-widest flex items-center justify-center gap-2 group"
                >
                  <Cpu className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  INITIATE TRADE SEQUENCE
                </button>
              </motion.div>
            ) : (
              <motion.div 
                key="executing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-8 py-6"
              >
                {stages.slice(1).map((s, idx) => {
                  const stepIndex = idx + 1;
                  const isActive = stage === stepIndex;
                  const isDone = stage > stepIndex;

                  return (
                    <div key={s.id} className={`flex items-center gap-4 transition-all duration-500 ${isActive || isDone ? 'opacity-100' : 'opacity-30'}`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                        isDone ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 
                        isActive ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400 animate-pulse' : 
                        'bg-zinc-900 border-zinc-800 text-zinc-600'
                      }`}>
                        {isDone ? <CheckCircle2 className="w-5 h-5" /> : 
                         isActive ? <Activity className="w-5 h-5 animate-spin-slow" /> : 
                         <Server className="w-5 h-5" />}
                      </div>
                      <div>
                        <h4 className={`text-sm font-tactical tracking-widest ${isActive ? 'text-cyan-400' : isDone ? 'text-indigo-400' : 'text-zinc-500'}`}>
                          {s.title}
                        </h4>
                        {isActive && (
                          <div className="w-48 h-1 bg-zinc-900 rounded-full mt-2 overflow-hidden">
                            <motion.div 
                              className="h-full bg-cyan-500"
                              initial={{ width: "0%" }}
                              animate={{ width: "100%" }}
                              transition={{ duration: 1.5, ease: "linear" }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {stage === 4 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="mt-8 pt-8 border-t border-white/10"
                  >
                    <div className="flex items-center justify-center gap-2 mb-6">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs font-bold font-mono text-emerald-400">CAPITAL DEPLOYED & SIMULATION COMPLETE</span>
                    </div>

                    {simulationResult && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-zinc-500 font-mono mb-1">PROJECTED REACH</p>
                          <p className="text-lg font-bold text-white">{simulationResult.projected_reach.toLocaleString()}</p>
                        </div>
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-zinc-500 font-mono mb-1">EXPECTED CTR</p>
                          <p className="text-lg font-bold text-indigo-400">{simulationResult.expected_ctr.toFixed(2)}%</p>
                        </div>
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-zinc-500 font-mono mb-1">ESTIMATED CPC</p>
                          <p className="text-lg font-bold text-emerald-400">${simulationResult.estimated_cpc.toFixed(2)}</p>
                        </div>
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-zinc-500 font-mono mb-1">CONFIDENCE</p>
                          <p className="text-lg font-bold text-cyan-400">{simulationResult.confidence.toFixed(1)}%</p>
                        </div>
                      </div>
                    )}

                    <button 
                      onClick={onClose}
                      className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-tactical transition-colors"
                    >
                      RETURN TO COMMAND CENTER
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </motion.div>
    </div>
  );
}

function Target(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  )
}

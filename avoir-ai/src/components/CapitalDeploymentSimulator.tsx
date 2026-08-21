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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 p-2 sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.1 }}
        className="w-full max-w-2xl border border-terminal-border bg-background max-h-[90vh] overflow-y-auto terminal-scrollbar"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-terminal-border bg-terminal-surface">
          <div className="flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-neon-cyan" />
            <h2 className="text-[10px] font-bold text-neon-cyan tracking-[0.2em]">CAPITAL DEPLOYMENT TERMINAL</h2>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-neon-red transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-5">
          <AnimatePresence mode="wait">
            {stage === 0 ? (
              <motion.div
                key="setup"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
                className="space-y-4"
              >
                {/* Target Asset */}
                <div className="border border-terminal-border bg-terminal-surface p-3">
                  <h3 className="text-[9px] text-zinc-600 tracking-widest mb-1">TARGET ASSET</h3>
                  <p className="text-[12px] text-neon-amber font-medium">&quot;{campaignPlan?.asset || campaignPlan?.hook || 'Campaign'}&quot;</p>
                  <p className="text-[10px] text-zinc-600 mt-1">{campaignPlan?.platform} &middot; ROAS: {campaignPlan?.roas}x &middot; Spend: ${campaignPlan?.spend}</p>
                </div>

                {/* Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 border border-terminal-border">
                  <div className="p-3 border-b sm:border-b-0 sm:border-r border-terminal-border">
                    <label className="text-[9px] text-zinc-600 tracking-widest mb-1.5 block">INITIAL CAPITAL ($)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600" />
                      <input
                        type="number"
                        value={budget}
                        onChange={(e) => setBudget(Number(e.target.value))}
                        className="terminal-input w-full pl-7"
                      />
                    </div>
                  </div>
                  <div className="p-3">
                    <label className="text-[9px] text-zinc-600 tracking-widest mb-1.5 block">TARGET ROAS (x)</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600">x</span>
                      <input
                        type="number"
                        step="0.1"
                        value={targetRoas}
                        onChange={(e) => setTargetRoas(Number(e.target.value))}
                        className="terminal-input w-full pl-7"
                      />
                    </div>
                  </div>
                </div>

                {/* Execute */}
                <button
                  onClick={handleExecute}
                  className="terminal-btn w-full py-3 flex items-center justify-center gap-2"
                >
                  <Cpu className="w-4 h-4" />
                  INITIATE TRADE SEQUENCE
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="executing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-5 py-4"
              >
                {stages.slice(1).map((s, idx) => {
                  const stepIndex = idx + 1;
                  const isActive = stage === stepIndex;
                  const isDone = stage > stepIndex;

                  return (
                    <div key={s.id} className={`flex items-center gap-3 transition-opacity duration-300 ${isActive || isDone ? 'opacity-100' : 'opacity-20'}`}>
                      <div className={`w-7 h-7 flex items-center justify-center border ${
                        isDone ? 'border-neon-green bg-neon-green/10 text-neon-green' :
                        isActive ? 'border-neon-cyan bg-neon-cyan/10 text-neon-cyan' :
                        'border-terminal-border bg-terminal-surface text-zinc-700'
                      }`}>
                        {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                         isActive ? <Activity className="w-3.5 h-3.5 animate-pulse" /> :
                         <Server className="w-3.5 h-3.5" />}
                      </div>
                      <div className="flex-1">
                        <h4 className={`text-[10px] font-bold tracking-[0.15em] ${isActive ? 'text-neon-cyan' : isDone ? 'text-neon-green' : 'text-zinc-700'}`}>
                          {s.title}
                        </h4>
                        {isActive && (
                          <div className="mt-1.5 h-1 bg-terminal-border w-full overflow-hidden">
                            <motion.div
                              className="h-full bg-neon-cyan"
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
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mt-6 pt-4 border-t border-terminal-border"
                  >
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <div className="w-1.5 h-1.5 bg-neon-green" />
                      <span className="text-[10px] font-bold text-neon-green tracking-widest">CAPITAL DEPLOYED &amp; SIMULATION COMPLETE</span>
                    </div>

                    {simulationResult && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border border-terminal-border mb-4">
                        <div className="p-3 border-b sm:border-b-0 sm:border-r border-terminal-border text-center">
                          <p className="text-[8px] sm:text-[9px] text-zinc-600 tracking-widest mb-1">PROJECTED REACH</p>
                          <p className="text-[12px] sm:text-[14px] font-bold text-foreground">{simulationResult.projected_reach.toLocaleString()}</p>
                        </div>
                        <div className="p-3 border-b sm:border-b-0 sm:border-r border-terminal-border text-center">
                          <p className="text-[8px] sm:text-[9px] text-zinc-600 tracking-widest mb-1">EXPECTED CTR</p>
                          <p className="text-[12px] sm:text-[14px] font-bold text-neon-cyan">{simulationResult.expected_ctr.toFixed(2)}%</p>
                        </div>
                        <div className="p-3 border-b sm:border-b-0 sm:border-r border-terminal-border text-center">
                          <p className="text-[8px] sm:text-[9px] text-zinc-600 tracking-widest mb-1">ESTIMATED CPC</p>
                          <p className="text-[12px] sm:text-[14px] font-bold text-neon-green">${simulationResult.estimated_cpc.toFixed(2)}</p>
                        </div>
                        <div className="p-3 text-center">
                          <p className="text-[8px] sm:text-[9px] text-zinc-600 tracking-widest mb-1">CONFIDENCE</p>
                          <p className="text-[12px] sm:text-[14px] font-bold text-neon-amber">{simulationResult.confidence.toFixed(1)}%</p>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={onClose}
                      className="terminal-btn-outline w-full py-2.5"
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

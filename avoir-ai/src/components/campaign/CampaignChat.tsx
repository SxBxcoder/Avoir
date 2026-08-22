'use client';

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity } from 'lucide-react';
import { type Message, type CampaignData, type GenomeVariant } from './types';
import { CookingStatus } from './CookingStatus';
import { WelcomeScreen } from './WelcomeScreen';
import { LiveArbitrageFeed } from '../LiveArbitrageFeed';
import { springConfig } from './configs';

interface CampaignChatProps {
  messages: Message[];
  isGenerating: boolean;
  cookingMessages: string[];
  currentCampaign: CampaignData | null;
  genomeVariants: GenomeVariant[] | null;
  simulationPhase: 'idle' | 'running' | 'complete';
  simulationData: {
    simulation: Array<{ name: string; role: string; critique: string; approved: boolean }>;
    predicted_score: number;
  } | null;
  onQuickAction: (prompt: string) => void;
  /** Industry used for the live arbitrage feed shown on the empty state. */
  industry?: string;
  children?: React.ReactNode;
}

export function CampaignChat({
  messages,
  isGenerating,
  cookingMessages,
  simulationPhase,
  simulationData,
  onQuickAction,
  industry = 'general',
  children,
}: CampaignChatProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, cookingMessages]);

  const isEmpty = messages.length === 0 && cookingMessages.length === 0;

  return (
    <div className="flex-1 overflow-y-auto relative flex flex-col">
      {isEmpty ? (
        <WelcomeScreen onQuickAction={onQuickAction}>
          <LiveArbitrageFeed onDeploy={onQuickAction} industry={industry} />
        </WelcomeScreen>
      ) : (
        <div className="p-4 lg:p-8 space-y-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={springConfig}
            className="flex items-center space-x-2 text-cyan mb-6"
          >
            <Activity className="w-5 h-5" />
            <span className="text-sm tracking-widest font-bold font-tactical">ACTIVE INTELLIGENCE FEED</span>
          </motion.div>

          <AnimatePresence mode="popLayout">
            {messages.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 15, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ ...springConfig, delay: idx * 0.03 }}
                layout
                className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
              >
                <div
                  className={`max-w-[90%] sm:max-w-[85%] lg:max-w-[70%] rounded-2xl p-3 sm:p-4 ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white ml-auto shadow-lg shadow-indigo-500/10'
                      : 'glass-card text-zinc-100'
                  }`}
                >
                  <p className="text-sm leading-relaxed">
                    {msg.displayContent || msg.content}
                  </p>
                </div>
              </motion.div>
            ))}

            {isGenerating && (
              <CookingStatus key="cooking-status" messages={cookingMessages.length > 0 ? cookingMessages : ['\uD83D\uDD25 Initializing Diamond Cascade Engine...']} />
            )}

            {simulationPhase !== 'idle' && (
              <motion.div
                key="simulation-ui"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full mt-4 bg-background/40 backdrop-blur-md rounded-2xl border border-info overflow-hidden relative"
              >
                <div className="bg-info/40 border-b border-info px-4 sm:px-6 py-3 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <Activity className={`w-4 h-4 ${simulationPhase === 'running' ? 'text-info animate-pulse' : 'text-success'}`} />
                    <span className="text-xs font-tactical tracking-widest text-info">
                      {simulationPhase === 'running' ? 'SYNTHETIC BACKTESTING ACTIVE...' : 'VALIDATION COMPLETE'}
                    </span>
                  </div>
                  {simulationPhase === 'complete' && simulationData && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Predicted Success</span>
                      <span className={`text-sm font-black font-tactical px-2 py-0.5 rounded ${
                        simulationData.predicted_score >= 90 ? 'bg-success/20 text-success' :
                        simulationData.predicted_score >= 75 ? 'bg-warning/20 text-warning' :
                        'bg-danger/20 text-danger'
                      }`}>
                        {simulationData.predicted_score}%
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-4 sm:p-6">
                  {simulationPhase === 'running' ? (
                    <div className="flex flex-col items-center justify-center py-8 space-y-6">
                      <div className="relative">
                        <div className="absolute inset-0 border border-info rounded-full animate-ping opacity-20"></div>
                        <div className="w-16 h-16 rounded-full border-2 border-t-indigo-500 border-r-indigo-500/30 border-b-indigo-500/10 border-l-indigo-500/30 animate-spin"></div>
                      </div>
                      <div className="text-center">
                        <h4 className="text-sm font-bold text-info mb-1">Spawning AI Personas</h4>
                        <p className="text-xs text-info/60 font-mono">Running generated campaign against 3 distinct psychological profiles...</p>
                      </div>
                    </div>
                  ) : simulationData ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                      {simulationData.simulation.map((persona, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.15 }}
                          className={`rounded-xl p-4 border ${
                            persona.approved ? 'bg-success/10 border-success' : 'bg-danger/10 border-danger'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h5 className={`text-xs font-bold font-tactical tracking-wider ${persona.approved ? 'text-success' : 'text-danger'}`}>
                                {persona.name}
                              </h5>
                              <p className="text-[10px] text-muted-foreground uppercase">{persona.role}</p>
                            </div>
                            {persona.approved ? (
                              <svg className="w-4 h-4 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
                            ) : (
                              <svg className="w-4 h-4 text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground italic leading-relaxed">&quot;{persona.critique}&quot;</p>
                        </motion.div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={chatEndRef} />

          {children}
        </div>
      )}
    </div>
  );
}

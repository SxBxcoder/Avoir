'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy, Check, Sparkles, ChevronRight, Cpu, Eye, MessageSquare, Video,
} from 'lucide-react';
import { type CampaignData, type CampaignReasoning } from './types';
import { springConfig, staggerContainer, staggerItem } from './configs';

interface CampaignCanvasProps {
  currentCampaign: CampaignData;
  reasoningExpanded: Record<string, boolean>;
  onToggleReasoning: (key: string) => void;
}

export function CampaignCanvas({
  currentCampaign,
  reasoningExpanded,
  onToggleReasoning,
}: CampaignCanvasProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-6 pt-8 border-t border-border/50 mt-8"
    >
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={springConfig}
        className="flex items-center justify-between mb-6"
      >
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-info" />
          <h3 className="text-xs font-tactical text-info uppercase tracking-wider">TRADE EXECUTION TICKET</h3>
        </div>
      </motion.div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4"
      >
        {(['hook', 'offer', 'cta'] as const).map((key) => {
          const colors: Record<string, { label: string; textColor: string }> = {
            hook: { label: 'THE HOOK', textColor: 'text-info' },
            offer: { label: 'THE OFFER', textColor: 'text-primary' },
            cta: { label: 'ACTION', textColor: 'text-pink-400' },
          };
          const c = colors[key];
          return (
            <motion.div
              key={key}
              variants={staggerItem}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="group relative glass-card scan-line glow-border rounded-2xl p-6 cursor-default"
            >
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-tactical ${c.textColor} uppercase tracking-wider`}>{c.label}</span>
                  <button
                    onClick={() => copyToClipboard(currentCampaign.plan[key], key)}
                    className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                  >
                    {copied === key ? (
                      <Check className="w-4 h-4 text-success" />
                    ) : (
                      <Copy className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
                <p className="text-lg font-bold text-foreground leading-tight">{currentCampaign.plan[key]}</p>
                {currentCampaign.plan.reasoning && (
                  <>
                    <button
                      onClick={() => onToggleReasoning(key)}
                      className="flex items-center gap-1.5 mt-3 text-[11px] text-warning/80 hover:text-warning transition-colors font-medium"
                    >
                      <Sparkles className="w-3 h-3" />
                      Why this works
                      <ChevronRight className={`w-3 h-3 transition-transform ${reasoningExpanded[key] ? 'rotate-90' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {reasoningExpanded[key] && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <p className="text-xs text-muted-foreground italic mt-2 leading-relaxed border-t border-border/50 pt-2">
                            {currentCampaign.plan.reasoning[`${key}_rationale` as keyof CampaignReasoning] as string}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {currentCampaign.plan.funnel && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, ...springConfig }}
          className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4"
        >
          <div className="glass-card rounded-2xl p-5 border border-cyan bg-cyan/5 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-cyan/50" />
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-cyan" />
                <span className="text-xs font-tactical text-cyan uppercase tracking-widest">TOP OF FUNNEL (VIDEO)</span>
              </div>
              <button
                onClick={() => copyToClipboard(currentCampaign.plan.funnel!.top, 'funnel-top')}
                className="p-1.5 hover:bg-muted rounded-lg transition-colors"
              >
                {copied === 'funnel-top' ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
              </button>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed font-mono whitespace-pre-wrap">{currentCampaign.plan.funnel.top}</p>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-danger bg-danger/5 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-danger/50" />
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-danger" />
                <span className="text-xs font-tactical text-danger uppercase tracking-widest">BOTTOM OF FUNNEL (RETARGET)</span>
              </div>
              <button
                onClick={() => copyToClipboard(currentCampaign.plan.funnel!.bottom, 'funnel-bottom')}
                className="p-1.5 hover:bg-muted rounded-lg transition-colors"
              >
                {copied === 'funnel-bottom' ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
              </button>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed font-mono whitespace-pre-wrap">{currentCampaign.plan.funnel.bottom}</p>
          </div>
        </motion.div>
      )}

      {currentCampaign.plan.reasoning && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, ...springConfig }}
          className="glass-card rounded-2xl p-5 border border-info bg-info/5"
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 p-2 bg-info/10 rounded-xl">
              <Eye className="w-4 h-4 text-info" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-tactical text-info uppercase tracking-widest">AUDIENCE INSIGHT</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  currentCampaign.plan.reasoning.confidence_score >= 80
                    ? 'bg-success/20 text-success border border-success'
                    : currentCampaign.plan.reasoning.confidence_score >= 60
                    ? 'bg-warning/20 text-warning border border-warning'
                    : 'bg-danger/20 text-danger border border-danger'
                }`}>
                  {currentCampaign.plan.reasoning.confidence_score}% CONFIDENCE
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {currentCampaign.plan.reasoning.audience_insight}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {currentCampaign.captions && currentCampaign.captions.length > 0 && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4"
        >
          {currentCampaign.captions.map((caption, idx) => (
            <motion.div
              key={idx}
              variants={staggerItem}
              whileHover={{ y: -4, scale: 1.02, transition: { duration: 0.2 } }}
              className="group relative glass-card scan-line glow-border rounded-2xl p-6 cursor-default"
            >
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-tactical text-cyan uppercase tracking-wider">CAPTION {idx + 1}</span>
                  <button
                    onClick={() => copyToClipboard(caption, `caption-${idx}`)}
                    className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                  >
                    {copied === `caption-${idx}` ? (
                      <Check className="w-4 h-4 text-success" />
                    ) : (
                      <Copy className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{caption}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

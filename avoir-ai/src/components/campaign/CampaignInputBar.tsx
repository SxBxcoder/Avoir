'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Send, Sparkles } from 'lucide-react';
import { MagneticButton } from './MagneticButton';

interface CampaignInputBarProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  genomeMode: boolean;
  onToggleGenomeMode: () => void;
}

export function CampaignInputBar({
  inputValue,
  onInputChange,
  onGenerate,
  isGenerating,
  genomeMode,
  onToggleGenomeMode,
}: CampaignInputBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div id="tour-input-bar" className="flex-shrink-0 border-t border-border/50 bg-card/60 backdrop-blur-2xl p-3 sm:p-4 relative z-20">
      <div className="max-w-4xl mx-auto">
        <div className="flex gap-3 items-center">
          <div className="flex-1 relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-info font-mono text-sm font-bold">
              <span>{'>_'}</span>
            </div>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && onGenerate()}
              placeholder="Enter your campaign directive..."
              disabled={isGenerating}
              className="w-full bg-card/50 border border-info rounded-xl px-4 py-4 pl-12 text-sm text-info placeholder-indigo-500/40 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-info disabled:opacity-50 transition-all font-mono shadow-inner"
            />
            <div className="absolute inset-0 rounded-xl border border-info group-focus-within:border-info group-focus-within:shadow-[0_0_15px_rgba(99,102,241,0.15)] pointer-events-none transition-all" />
          </div>
          <MagneticButton
            onClick={onGenerate}
            disabled={isGenerating || !inputValue.trim()}
            className="!px-6 !py-4 !rounded-xl bg-info hover:bg-info text-white font-tactical tracking-wider"
          >
            {isGenerating ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-5 h-5 border-2 border-border border-t-white rounded-full" />
            ) : (
              <span className="flex items-center gap-2">EXECUTE <Send className="w-4 h-4" /></span>
            )}
          </MagneticButton>
        </div>
        <div className="flex items-center justify-between mt-2 px-1">
          <div className="flex items-center gap-4">
            <p className="text-[10px] text-zinc-600 font-tactical">POWERED BY DIAMOND CASCADE ENGINE</p>
            <button
              id="tour-genome-toggle"
              onClick={onToggleGenomeMode}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold tracking-wider transition-colors border ${
                genomeMode
                  ? 'bg-primary/20 text-primary border-primary'
                  : 'bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              GENOME MODE
              <span className="text-[9px] opacity-70 ml-1">(2 CREDITS)</span>
            </button>
          </div>
          <p className="text-[10px] text-zinc-600">Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-muted-foreground font-mono text-[9px]">Enter</kbd> to send</p>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, MessageSquare, Briefcase, ChevronRight, X, ArrowRight, Zap } from 'lucide-react';

interface StrategicInterrogationPanelProps {
  baseDirective: string;
  onComplete: (enrichedDirective: string) => void;
  onCancel: () => void;
}

export default function StrategicInterrogationPanel({ baseDirective, onComplete, onCancel }: StrategicInterrogationPanelProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({
    audience: '',
    offer: '',
    angle: ''
  });

  const questions = [
    {
      key: 'audience',
      title: "Who exactly is this for?",
      subtitle: "The more specific, the better the hook.",
      placeholder: "e.g., Startup founders struggling with churn",
      icon: Target
    },
    {
      key: 'offer',
      title: "What's the core offer or message?",
      subtitle: "What do they get out of this?",
      placeholder: "e.g., A free 5-day email course on retention",
      icon: Briefcase
    },
    {
      key: 'angle',
      title: "What's your unique angle/hook?",
      subtitle: "Why should they care right now?",
      placeholder: "e.g., Traditional onboarding is dead. Use shadow-flows.",
      icon: Zap
    }
  ];

  const handleNext = () => {
    const currentKey = questions[step].key as keyof typeof answers;
    if (!answers[currentKey].trim()) return;

    if (step < questions.length - 1) {
      setStep(prev => prev + 1);
    } else {
      // Build enriched directive
      const enriched = `${baseDirective}\n\nStrategic Context:\n- Target Audience: ${answers.audience}\n- Core Offer: ${answers.offer}\n- Unique Angle: ${answers.angle}`;
      onComplete(enriched);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleNext();
  };

  const currentQ = questions[step];
  const Icon = currentQ.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute bottom-full left-0 right-0 mb-4 z-50 p-6 rounded-2xl bg-zinc-950/95 border border-amber-500/30 shadow-[0_0_50px_rgba(245,158,11,0.15)] backdrop-blur-xl mx-4"
    >
      <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-900 rounded-t-2xl overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
          initial={{ width: 0 }}
          animate={{ width: `${((step) / questions.length) * 100}%` }}
        />
      </div>

      <div className="flex justify-between items-start mb-6 mt-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-xl">
            <MessageSquare className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold font-tactical tracking-wider text-amber-400">STRATEGIC INTERROGATION MODE</h3>
            <p className="text-xs text-zinc-400">Your prompt was too vague. Let's sharpen the blade.</p>
          </div>
        </div>
        <button onClick={onCancel} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
          <X className="w-5 h-5 text-zinc-500" />
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-3">
            <Icon className="w-5 h-5 text-zinc-400" />
            <div>
              <h4 className="text-lg font-bold text-white">{currentQ.title}</h4>
              <p className="text-sm text-zinc-500">{currentQ.subtitle}</p>
            </div>
          </div>

          <div className="relative group">
            <input
              autoFocus
              type="text"
              value={answers[currentQ.key as keyof typeof answers]}
              onChange={e => setAnswers({ ...answers, [currentQ.key]: e.target.value })}
              onKeyDown={handleKeyDown}
              placeholder={currentQ.placeholder}
              className="w-full bg-black border border-zinc-800 focus:border-amber-500/50 rounded-xl px-4 py-3 text-white placeholder-zinc-600 outline-none transition-all focus:ring-1 focus:ring-amber-500/50"
            />
            <button
              onClick={handleNext}
              disabled={!answers[currentQ.key as keyof typeof answers].trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-amber-500 text-black disabled:opacity-30 disabled:bg-zinc-800 disabled:text-zinc-500 hover:bg-amber-400 transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, MessageSquare, Briefcase, Zap, Shield, Link as LinkIcon, ArrowRight, Loader2, Check } from 'lucide-react';
import { getCurrentUser } from 'aws-amplify/auth';

const QUESTIONS = [
  { id: 'brandName', title: "What's the name of your brand?", icon: Zap, placeholder: "e.g., Nexus Athletics" },
  { id: 'industry', title: "What industry are you in?", icon: Briefcase, placeholder: "e.g., Direct-to-Consumer Fitness Apparel" },
  { id: 'targetAudience', title: "Who is your exact target audience?", icon: Target, placeholder: "e.g., Gen-Z athletes aged 18-25 who care about sustainable materials" },
  { id: 'toneOfVoice', title: "How should your brand sound? (Tone of Voice)", icon: MessageSquare, placeholder: "e.g., Bold, provocative, and highly energetic" },
  { id: 'coreValues', title: "What are your 3 core brand values?", icon: Shield, placeholder: "e.g., Relentless ambition, Eco-conscious, Community first" },
  { id: 'uniqueSellingProposition', title: "What's your Unique Selling Proposition (USP)?", icon: Zap, placeholder: "e.g., We use 100% recycled ocean plastic for high-performance gear" },
  { id: 'referenceUrl', title: "Any reference website or Instagram handle? (Optional)", icon: LinkIcon, placeholder: "e.g., instagram.com/nexusathletics", optional: true },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function checkAuth() {
      try {
        const user = await getCurrentUser();
        setUserEmail(user.signInDetails?.loginId || user.username);
      } catch (err) {
        // Not logged in? Either redirect to login or check if there's a bypass
        const isDemo = new URLSearchParams(window.location.search).get('demo');
        if (isDemo) {
          setUserEmail('demo@avoir.ai');
        } else {
          router.push('/login');
        }
      }
    }
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentStep]);

  const handleNext = async () => {
    const currentQ = QUESTIONS[currentStep];
    if (!inputValue.trim() && !currentQ.optional) return;

    const newAnswers = { ...answers, [currentQ.id]: inputValue };
    setAnswers(newAnswers);
    setInputValue('');

    if (currentStep < QUESTIONS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      await submitBrandDNA(newAnswers);
    }
  };

  const submitBrandDNA = async (finalAnswers: Record<string, string>) => {
    setIsSubmitting(true);
    try {
      const payload = {
        userId: userEmail,
        ...finalAnswers
      };

      const res = await fetch('/api/brand-dna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save DNA');
      
      // Redirect to dashboard
      const isDemo = new URLSearchParams(window.location.search).get('demo');
      router.push(isDemo ? '/?demo=true' : '/');
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  if (!userEmail) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  const CurrentIcon = QUESTIONS[currentStep].icon;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-indigo-500/30 overflow-hidden relative">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-black to-black" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
      
      {/* Header */}
      <div className="p-6 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
            Avoir
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-2xl">
          {/* Progress Bar */}
          <div className="mb-12 flex gap-2">
            {QUESTIONS.map((_, idx) => (
              <div 
                key={idx} 
                className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                  idx < currentStep ? 'bg-indigo-500' : idx === currentStep ? 'bg-indigo-500/50' : 'bg-zinc-800'
                }`} 
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              {/* Question Context */}
              <div className="flex items-center gap-4 text-indigo-400">
                <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
                  <CurrentIcon className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest font-tactical">Step {currentStep + 1} of {QUESTIONS.length}</span>
              </div>

              {/* Question Title */}
              <h1 className="text-3xl md:text-4xl font-bold leading-tight">
                {QUESTIONS[currentStep].title}
              </h1>

              {/* Input Area */}
              <div className="relative group">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                  placeholder={QUESTIONS[currentStep].placeholder}
                  disabled={isSubmitting}
                  className="w-full bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-2xl px-6 py-5 text-lg text-white placeholder-zinc-500 transition-all outline-none"
                />
                
                <button
                  onClick={handleNext}
                  disabled={isSubmitting || (!inputValue.trim() && !QUESTIONS[currentStep].optional)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-xl bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-600 transition-all"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                </button>
              </div>

              {QUESTIONS[currentStep].optional && (
                <p className="text-xs text-zinc-500">Press Enter to skip</p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

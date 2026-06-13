'use client';

import { Suspense, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Sparkles, ArrowRight, Zap } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

const springSmooth = { type: 'spring' as const, stiffness: 100, damping: 30 };
const springBouncy = { type: 'spring' as const, stiffness: 400, damping: 25 };

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <SuccessContent />
    </Suspense>
  );
}

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [countdown, setCountdown] = useState(8);

  useEffect(() => {
    if (countdown <= 0) {
      router.push('/');
      return;
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, router]);

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative flex items-center justify-center" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Background effects */}
      <motion.div
        animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/3 left-1/3 w-[400px] h-[400px] rounded-full bg-green-600/10 blur-[120px] pointer-events-none"
      />
      <motion.div
        animate={{ x: [0, -20, 0], y: [0, 30, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-1/3 right-1/3 w-[300px] h-[300px] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none"
      />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      {/* Confetti-like particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              backgroundColor: ['#6366f1', '#a855f7', '#22c55e', '#06b6d4', '#ec4899'][i % 5],
            }}
            animate={{
              y: [0, -40, 0],
              opacity: [0, 0.6, 0],
              scale: [0.5, 1.5, 0.5],
            }}
            transition={{
              duration: 3 + Math.random() * 3,
              repeat: Infinity,
              delay: Math.random() * 3,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-lg mx-auto px-6 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={springSmooth}>
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springSmooth, delay: 0.1 }}
            className="mb-10"
          >
            <Image src="/logo.png" alt="Prachar.ai" width={48} height={48} className="mx-auto rounded-xl shadow-lg shadow-indigo-500/20" />
          </motion.div>

          {/* Success icon with ring animation */}
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ ...springBouncy, delay: 0.2 }}
            className="mx-auto mb-8"
          >
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-2 border-green-500/40 flex items-center justify-center mx-auto shadow-2xl shadow-green-500/20">
                <CheckCircle className="w-12 h-12 text-green-400" />
              </div>
              {/* Pulse rings */}
              <motion.div
                animate={{ scale: [1, 1.5], opacity: [0.3, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 rounded-full border-2 border-green-500/20"
              />
              <motion.div
                animate={{ scale: [1, 1.8], opacity: [0.2, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                className="absolute inset-0 rounded-full border-2 border-green-500/10"
              />
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springSmooth, delay: 0.3 }}
            className="text-4xl font-bold tracking-tight mb-3"
          >
            Welcome to{' '}
            <span className="fluid-text-hero">Pro</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springSmooth, delay: 0.4 }}
            className="text-zinc-400 text-lg mb-8"
          >
            Your subscription is active. The full Diamond Cascade AI is now at your command.
          </motion.p>

          {/* Feature highlights */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springSmooth, delay: 0.5 }}
            className="glass-card rounded-2xl p-6 mb-8 text-left"
          >
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-medium text-indigo-400 uppercase tracking-wider">Unlocked</span>
            </div>
            <ul className="space-y-3">
              {[
                'Unlimited AI campaign generations',
                '6-Tier Diamond Cascade AI models',
                'Priority support channel',
                'Custom brand guidelines',
              ].map((feature, i) => (
                <motion.li
                  key={feature}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...springSmooth, delay: 0.6 + i * 0.1 }}
                  className="flex items-center gap-3 text-sm text-zinc-300"
                >
                  <div className="p-0.5 rounded-full bg-green-500/20 text-green-400 flex-shrink-0">
                    <CheckCircle className="w-3.5 h-3.5" />
                  </div>
                  {feature}
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* CTA */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/"
                className="inline-flex items-center gap-2 bg-white text-black font-bold px-8 py-4 rounded-full transition-all shadow-xl shadow-white/10 hover:shadow-white/20 group"
              >
                <Sparkles className="w-5 h-5" />
                Launch the War Room
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
            <p className="text-xs text-zinc-600 mt-4">
              Auto-redirecting in {countdown}s...
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

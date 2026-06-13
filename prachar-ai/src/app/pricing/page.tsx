'use client';

import { Suspense, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Zap, Star, Shield, ArrowLeft, Sparkles, Crown, Users, ArrowRight, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getStripe, PLANS, type PlanTier } from '@/lib/stripe';
import { isAuthenticated, getUser } from '@/lib/authHelpers';
import Link from 'next/link';
import Image from 'next/image';

const springSmooth = { type: 'spring' as const, stiffness: 100, damping: 30 };
const springBouncy = { type: 'spring' as const, stiffness: 400, damping: 25 };

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: springSmooth },
};

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <PricingContent />
    </Suspense>
  );
}

function PricingContent() {
  const [loading, setLoading] = useState<string | null>(null);
  const [isAnnual, setIsAnnual] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const canceled = searchParams.get('canceled');

  const tiers: { tier: PlanTier; icon: React.ReactNode; gradient: string; bgGradient: string; monthlyPrice: string; annualPrice: string; annualSavings: string; popular?: boolean }[] = [
    {
      tier: 'free',
      icon: <Sparkles className="w-6 h-6" />,
      gradient: 'from-zinc-400 to-zinc-500',
      bgGradient: 'from-zinc-500/5 to-zinc-600/5',
      monthlyPrice: '$0',
      annualPrice: '$0',
      annualSavings: '',
    },
    {
      tier: 'pro',
      icon: <Zap className="w-6 h-6" />,
      gradient: 'from-indigo-500 to-purple-600',
      bgGradient: 'from-indigo-500/10 to-purple-500/10',
      monthlyPrice: '$9.99',
      annualPrice: '$7.99',
      annualSavings: 'Save 20%',
      popular: true,
    },
    {
      tier: 'enterprise',
      icon: <Shield className="w-6 h-6" />,
      gradient: 'from-amber-500 to-orange-600',
      bgGradient: 'from-amber-500/10 to-orange-500/10',
      monthlyPrice: '$49.99',
      annualPrice: '$39.99',
      annualSavings: 'Save 20%',
    },
  ];

  const handleSubscribe = async (planTier: PlanTier) => {
    const plan = PLANS[planTier];
    const priceId = isAnnual ? plan.annualPriceId : plan.monthlyPriceId;
    if (!priceId) return;

    setLoading(priceId);
    try {
      const isAuth = await isAuthenticated();
      if (!isAuth) {
        router.push('/login');
        return;
      }

      const user = await getUser();
      const userEmail = user?.signInDetails?.loginId || '';
      const userId = user?.userId || '';

      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, email: userEmail, userId }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to create checkout session');
      }

      const { sessionId } = await response.json();
      const stripe = await getStripe();

      if (stripe) {
        const { error } = await (stripe as any).redirectToCheckout({ sessionId });
        if (error) throw error;
      }
    } catch (error: any) {
      console.error('Subscription error:', error);
      alert(error.message || 'Subscription failed. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <motion.div
          animate={{ x: [0, 50, 0], y: [0, -30, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/4 left-1/3 w-[500px] h-[500px] rounded-full bg-indigo-600/8 blur-[120px]"
        />
        <motion.div
          animate={{ x: [0, -40, 0], y: [0, 40, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-purple-600/8 blur-[120px]"
        />
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-2xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <motion.div whileHover={{ rotate: 12, scale: 1.1 }} transition={springBouncy}>
              <Image src="/logo.png" alt="Prachar.ai" width={32} height={32} className="rounded-lg" />
            </motion.div>
            <span className="text-base font-bold tracking-tight">
              Prachar<span className="text-indigo-400">.ai</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-zinc-400 hover:text-white transition-colors px-4 py-2">Sign In</Link>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link href="/register" className="text-sm font-semibold bg-white text-black px-5 py-2.5 rounded-full hover:bg-zinc-200 transition-colors">
                Get Started Free
              </Link>
            </motion.div>
          </div>
        </div>
      </nav>

      <div className="relative z-10 pt-28 pb-20">
        <div className="max-w-7xl mx-auto px-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springSmooth}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-6">
              <Crown className="w-3 h-3 text-indigo-400" />
              <span className="text-xs font-medium text-indigo-300">Simple, transparent pricing</span>
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-[-0.04em] mb-6 leading-[0.95]">
              Power that scales with{' '}
              <span className="fluid-text-hero">your ambition</span>
            </h1>
            <p className="text-lg text-zinc-400 max-w-xl mx-auto">
              Start free. Upgrade when your campaigns demand the full force of the Diamond Cascade AI.
            </p>
          </motion.div>

          {/* Canceled banner */}
          <AnimatePresence>
            {canceled && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                className="max-w-xl mx-auto mb-8"
              >
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center text-sm text-amber-300">
                  Checkout was canceled. No worries — you can try again whenever you're ready.
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Billing Toggle */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-4 mb-16"
          >
            <span className={`text-sm font-medium transition-colors ${!isAnnual ? 'text-white' : 'text-zinc-500'}`}>Monthly</span>
            <motion.button
              onClick={() => setIsAnnual(!isAnnual)}
              className={`relative w-14 h-7 rounded-full transition-colors ${isAnnual ? 'bg-indigo-600' : 'bg-zinc-700'}`}
              whileTap={{ scale: 0.95 }}
            >
              <motion.div
                animate={{ x: isAnnual ? 28 : 2 }}
                transition={springBouncy}
                className="absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-lg"
              />
            </motion.button>
            <span className={`text-sm font-medium transition-colors flex items-center gap-2 ${isAnnual ? 'text-white' : 'text-zinc-500'}`}>
              Annual
              {isAnnual && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-xs text-green-400 font-bold bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20"
                >
                  SAVE 20%
                </motion.span>
              )}
            </span>
          </motion.div>

          {/* Pricing Cards */}
          <motion.div
            initial="hidden"
            animate="show"
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto"
          >
            {tiers.map((item) => {
              const plan = PLANS[item.tier];
              const isPro = item.tier === 'pro';
              const isEnterprise = item.tier === 'enterprise';
              const isFree = item.tier === 'free';
              const priceId = isAnnual ? plan.annualPriceId : plan.monthlyPriceId;
              const displayPrice = isAnnual ? item.annualPrice : item.monthlyPrice;

              return (
                <motion.div
                  key={item.tier}
                  variants={staggerItem}
                  whileHover={{ y: -8, transition: { duration: 0.3 } }}
                  className={`group relative rounded-2xl p-8 flex flex-col transition-all duration-300 ${
                    isPro
                      ? 'glass-card glow-border-active border-indigo-500/30 shadow-xl shadow-indigo-500/10'
                      : 'glass-card glow-border'
                  }`}
                >
                  {/* Popular badge */}
                  {isPro && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={springBouncy}
                      className="absolute -top-3 left-1/2 -translate-x-1/2"
                    >
                      <span className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg shadow-indigo-500/30">
                        <Star className="w-3 h-3 fill-current" /> MOST POPULAR
                      </span>
                    </motion.div>
                  )}

                  {/* Icon + Name */}
                  <div className="mb-6">
                    <motion.div
                      whileHover={{ rotate: 10, scale: 1.1 }}
                      transition={springBouncy}
                      className={`w-14 h-14 rounded-xl bg-gradient-to-br ${item.gradient} p-3 flex items-center justify-center text-white mb-4 shadow-lg`}
                    >
                      {item.icon}
                    </motion.div>
                    <h3 className="text-2xl font-bold">{plan.name}</h3>
                  </div>

                  {/* Price */}
                  <div className="mb-8">
                    <div className="flex items-baseline gap-1">
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={displayPrice}
                          initial={{ opacity: 0, y: -20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 20 }}
                          transition={springBouncy}
                          className="text-5xl font-extrabold tracking-tight"
                        >
                          {displayPrice}
                        </motion.span>
                      </AnimatePresence>
                      {!isFree && <span className="text-zinc-400 text-base">/ month</span>}
                    </div>
                    {isAnnual && item.annualSavings && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="inline-block mt-2 text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full font-medium border border-green-500/20"
                      >
                        {item.annualSavings}
                      </motion.span>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="mb-8 space-y-3 flex-1">
                    {plan.features.map((feature, idx) => (
                      <motion.li
                        key={feature}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + idx * 0.05 }}
                        className="flex items-start gap-3"
                      >
                        <div className={`mt-0.5 p-0.5 rounded-full flex-shrink-0 ${
                          isPro ? 'bg-indigo-500/20 text-indigo-400' :
                          isEnterprise ? 'bg-amber-500/20 text-amber-400' :
                          'bg-zinc-700 text-zinc-400'
                        }`}>
                          <Check className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-sm text-zinc-300 leading-relaxed">{feature}</span>
                      </motion.li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <motion.button
                    onClick={() => isFree ? router.push('/register') : handleSubscribe(item.tier)}
                    disabled={loading === priceId}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm ${
                      isPro
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/20'
                        : isEnterprise
                        ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-500/20'
                        : 'bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10 hover:border-white/20'
                    }`}
                  >
                    {loading === priceId ? (
                      <div className="flex items-center gap-2">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                        />
                        Processing...
                      </div>
                    ) : (
                      <>
                        {isPro && <Zap className="w-4 h-4" />}
                        {isEnterprise && <Shield className="w-4 h-4" />}
                        {isFree ? 'Get Started Free' : `Upgrade to ${plan.name}`}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </motion.button>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Trust Section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-20 text-center"
          >
            <div className="flex items-center justify-center gap-8 flex-wrap text-zinc-500 text-sm">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span>256-bit SSL</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>1,000+ Creators</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Prachar.ai" width={24} height={24} className="rounded-md" />
            <span className="text-xs text-zinc-500">© 2026 Prachar.ai</span>
          </div>
          <Link href="/" className="text-xs text-zinc-500 hover:text-white transition-colors">Back to Home</Link>
        </div>
      </footer>
    </div>
  );
}

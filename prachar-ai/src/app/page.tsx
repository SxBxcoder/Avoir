'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, useSpring, useInView, AnimatePresence } from 'framer-motion';
import { Sparkles, Layers, Zap, ArrowRight, Play, ChevronDown, Globe, BarChart3, Palette, MessageSquare, Shield, Star, Users, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { configureAuth } from '@/lib/auth';
import { isAuthenticated, getUser, logout, getAccessToken } from '@/lib/authHelpers';
import Link from 'next/link';
import Image from 'next/image';
import CampaignDashboard from '@/components/CampaignDashboard';

// ============================================================================
// SPRING CONFIGS
// ============================================================================
const springSmooth = { type: 'spring' as const, stiffness: 100, damping: 30 };
const springBouncy = { type: 'spring' as const, stiffness: 400, damping: 25 };
const springGentle = { type: 'spring' as const, stiffness: 80, damping: 20 };

// Stagger container
const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: springSmooth },
};

// ============================================================================
// ANIMATED COUNTER
// ============================================================================
function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const spring = useSpring(0, { stiffness: 50, damping: 20 });
  const display = useTransform(spring, (v) => `${Math.round(v)}${suffix}`);

  useEffect(() => {
    if (isInView) spring.set(target);
  }, [isInView, spring, target]);

  return <motion.span ref={ref}>{display}</motion.span>;
}

// ============================================================================
// FLOATING PARTICLES
// ============================================================================
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-indigo-500/20"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.2, 0.6, 0.2],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: 3 + Math.random() * 4,
            repeat: Infinity,
            delay: Math.random() * 2,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// NAVBAR
// ============================================================================
function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={springSmooth}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-black/60 backdrop-blur-2xl border-b border-white/5 shadow-2xl shadow-black/50'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <motion.div whileHover={{ rotate: 12, scale: 1.1 }} transition={springBouncy}>
            <Image src="/logo.png" alt="Prachar.ai" width={36} height={36} className="rounded-lg" />
          </motion.div>
          <span className="text-lg font-bold tracking-tight">
            Prachar<span className="text-indigo-400">.ai</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <Link href="#features" className="text-sm text-zinc-400 hover:text-white transition-colors">Features</Link>
          <Link href="#how-it-works" className="text-sm text-zinc-400 hover:text-white transition-colors">How It Works</Link>
          <Link href="/pricing" className="text-sm text-zinc-400 hover:text-white transition-colors">Pricing</Link>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-zinc-400 hover:text-white transition-colors px-4 py-2">
            Sign In
          </Link>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              href="/register"
              className="text-sm font-semibold bg-white text-black px-5 py-2.5 rounded-full hover:bg-zinc-200 transition-colors"
            >
              Get Started Free
            </Link>
          </motion.div>
        </div>
      </div>
    </motion.nav>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function Home() {
  const router = useRouter();

  // Auth States
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Scroll-based parallax (global scroll, no ref — avoids hydration errors with conditional rendering)
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, 200]);
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);
  const heroScale = useTransform(scrollY, [0, 400], [1, 0.95]);

  useEffect(() => {
    configureAuth();
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const authenticated = await isAuthenticated();
    setIsLoggedIn(authenticated);
    if (authenticated) {
      const user = await getUser();
      setUserEmail(user?.signInDetails?.loginId || '');
      const token = await getAccessToken();
      setAccessToken(token || '');
    }
    setCheckingAuth(false);
  };

  const handleLogout = async () => {
    await logout();
    setIsLoggedIn(false);
    setUserEmail('');
    setAccessToken('');
    router.refresh();
  };

  // Loading screen
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full"
        />
      </div>
    );
  }

  // Authenticated: Show Dashboard
  if (isLoggedIn) {
    return <CampaignDashboard accessToken={accessToken} userEmail={userEmail} onLogout={handleLogout} />;
  }

  // ========================================================================
  // LANDING PAGE — CUTTING-EDGE SAAS
  // ========================================================================

  const features = [
    {
      icon: <Sparkles className="w-6 h-6" />,
      title: 'AI-Powered Copy',
      description: 'Generate viral Hinglish captions that connect with Indian youth. No more staring at blank screens.',
      gradient: 'from-indigo-500/20 to-purple-500/20',
      iconColor: 'text-indigo-400',
      borderColor: 'border-indigo-500/20',
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'Diamond Cascade Engine',
      description: 'Our proprietary 6-tier AI system orchestrates multiple models for campaign strategies no single AI can match.',
      gradient: 'from-purple-500/20 to-pink-500/20',
      iconColor: 'text-purple-400',
      borderColor: 'border-purple-500/20',
    },
    {
      icon: <Layers className="w-6 h-6" />,
      title: 'Complete Campaigns',
      description: 'Get hook → offer → CTA strategy, platform-ready captions, and AI-generated visuals — all in one click.',
      gradient: 'from-pink-500/20 to-rose-500/20',
      iconColor: 'text-pink-400',
      borderColor: 'border-pink-500/20',
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: 'Aukaat Engine',
      description: 'Real-time competitive intelligence. Know exactly where you stand against competitors in your niche.',
      gradient: 'from-cyan-500/20 to-blue-500/20',
      iconColor: 'text-cyan-400',
      borderColor: 'border-cyan-500/20',
    },
    {
      icon: <Globe className="w-6 h-6" />,
      title: 'Trend Sniper',
      description: 'Auto-detect viral trends across Instagram, YouTube, and Twitter. Get campaign suggestions in real-time.',
      gradient: 'from-green-500/20 to-emerald-500/20',
      iconColor: 'text-green-400',
      borderColor: 'border-green-500/20',
    },
    {
      icon: <Palette className="w-6 h-6" />,
      title: 'Brand Memory',
      description: 'Your AI learns your brand voice. Every campaign gets more personalized and on-brand over time.',
      gradient: 'from-amber-500/20 to-orange-500/20',
      iconColor: 'text-amber-400',
      borderColor: 'border-amber-500/20',
    },
  ];

  const steps = [
    { number: '01', title: 'Describe Your Goal', description: 'Tell the AI what you want to promote — a product launch, event, brand awareness, or viral content.' },
    { number: '02', title: 'AI Orchestrates', description: 'The Diamond Cascade fires 6 specialized AI models in sequence — each refining and enhancing the output.' },
    { number: '03', title: 'Deploy & Dominate', description: 'Get platform-ready captions, visual assets, and a strategic playbook. Copy, paste, post, and go viral.' },
  ];

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Navbar />
      <FloatingParticles />

      {/* ================================================================
          HERO SECTION — Full viewport with parallax
          ================================================================ */}
      <section className="relative min-h-[100vh] flex items-center justify-center overflow-hidden">
        {/* Animated gradient orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <motion.div
            animate={{ x: [0, 50, 0], y: [0, -30, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-indigo-600/10 blur-[120px]"
          />
          <motion.div
            animate={{ x: [0, -40, 0], y: [0, 40, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-purple-600/10 blur-[120px]"
          />
          <motion.div
            animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-cyan-600/5 blur-[100px]"
          />
        </div>

        {/* Subtle grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black to-transparent" />

        <motion.div
          style={{ y: heroY, opacity: heroOpacity, scale: heroScale }}
          className="relative z-10 max-w-5xl mx-auto px-6 text-center"
        >
          {/* Status badge */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...springSmooth, delay: 0.2 }}
            className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl mb-8"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-xs font-medium text-zinc-400">Now in Public Beta — 1,000+ creators onboard</span>
          </motion.div>

          {/* Logo + Brand */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ ...springBouncy, delay: 0.3 }}
            className="flex items-center justify-center mb-8"
          >
            <Image src="/logo.png" alt="Prachar.ai" width={72} height={72} className="rounded-2xl shadow-2xl shadow-indigo-500/20" />
          </motion.div>

          {/* Hero headline with fluid animation */}
          <motion.h1
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springGentle, delay: 0.4 }}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-[-0.04em] leading-[0.9] mb-6"
          >
            <span className="block">Your AI</span>
            <span className="block mt-2 fluid-text-hero">Creative Director</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springSmooth, delay: 0.6 }}
            className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Generate viral Hinglish campaigns, structured marketing strategies, and authentic local copy in seconds.
            <span className="text-zinc-300 font-medium"> Built for Indian creators.</span>
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springSmooth, delay: 0.8 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/register"
                className="group relative inline-flex items-center gap-2 bg-white text-black font-semibold px-8 py-4 rounded-full text-base overflow-hidden shadow-xl shadow-white/10 hover:shadow-white/20 transition-shadow"
              >
                <Sparkles className="w-5 h-5" />
                Start Creating — Free
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-xl border border-white/10 text-white font-medium px-8 py-4 rounded-full text-base hover:bg-white/10 hover:border-white/20 transition-all"
              >
                View Pricing
              </Link>
            </motion.div>
          </motion.div>

          {/* Social proof */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="mt-16 flex items-center justify-center gap-8 flex-wrap"
          >
            <div className="flex -space-x-3">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-full border-2 border-black bg-gradient-to-br from-indigo-400 to-purple-500"
                  style={{ zIndex: 5 - i }}
                />
              ))}
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">Loved by 1,000+ Indian creators</p>
            </div>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity }}>
            <ChevronDown className="w-5 h-5 text-zinc-600" />
          </motion.div>
        </motion.div>
      </section>

      {/* ================================================================
          STATS BAR
          ================================================================ */}
      <section className="relative py-16 border-y border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
            className="grid grid-cols-2 md:grid-cols-4 gap-8"
          >
            {[
              { value: 1000, suffix: '+', label: 'Active Creators' },
              { value: 50000, suffix: '+', label: 'Campaigns Generated' },
              { value: 6, suffix: '', label: 'AI Tiers in Cascade' },
              { value: 98, suffix: '%', label: 'Satisfaction Rate' },
            ].map((stat) => (
              <motion.div key={stat.label} variants={staggerItem} className="text-center">
                <div className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                </div>
                <p className="text-sm text-zinc-500 mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ================================================================
          FEATURES GRID
          ================================================================ */}
      <section id="features" className="relative py-32 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-indigo-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={springSmooth}
            className="text-center mb-20"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-6">
              <Zap className="w-3 h-3 text-indigo-400" />
              <span className="text-xs font-medium text-indigo-300">Features</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Everything you need to{' '}
              <span className="fluid-text-hero">go viral</span>
            </h2>
            <p className="text-lg text-zinc-400 max-w-xl mx-auto">
              From strategy to execution — Prachar.ai handles the entire creative pipeline.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-50px' }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((feature) => (
              <motion.div
                key={feature.title}
                variants={staggerItem}
                whileHover={{ y: -8, transition: { duration: 0.3 } }}
                className={`group relative glass-card glow-border rounded-2xl p-8 cursor-default`}
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-5 border ${feature.borderColor} ${feature.iconColor}`}>
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ================================================================
          HOW IT WORKS
          ================================================================ */}
      <section id="how-it-works" className="relative py-32">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={springSmooth}
            className="text-center mb-20"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 mb-6">
              <Play className="w-3 h-3 text-purple-400" />
              <span className="text-xs font-medium text-purple-300">How It Works</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Three steps to{' '}
              <span className="fluid-text-hero">domination</span>
            </h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger}
            className="space-y-8"
          >
            {steps.map((step, idx) => (
              <motion.div
                key={step.number}
                variants={staggerItem}
                whileHover={{ x: 8 }}
                className="relative flex items-start gap-8 group"
              >
                <div className="flex-shrink-0 relative">
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={springBouncy}
                    className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 flex items-center justify-center"
                  >
                    <span className="text-xl font-bold text-indigo-400 font-tactical">{step.number}</span>
                  </motion.div>
                  {idx < steps.length - 1 && (
                    <div className="absolute top-16 left-1/2 -translate-x-1/2 w-px h-8 bg-gradient-to-b from-indigo-500/20 to-transparent" />
                  )}
                </div>
                <div className="pt-3">
                  <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-zinc-400 leading-relaxed max-w-lg">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ================================================================
          CTA SECTION
          ================================================================ */}
      <section className="relative py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-500/5 to-transparent" />
        
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={springSmooth}
          >
            <Image src="/logo.png" alt="Prachar.ai" width={56} height={56} className="mx-auto mb-8 rounded-xl shadow-lg shadow-indigo-500/20" />
            
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Ready to stop guessing and{' '}
              <span className="fluid-text-hero">start dominating?</span>
            </h2>
            <p className="text-lg text-zinc-400 max-w-xl mx-auto mb-10">
              Join 1,000+ Indian creators who are already using AI to generate campaigns that actually convert.
            </p>

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/register"
                className="group inline-flex items-center gap-2 bg-white text-black font-semibold px-10 py-5 rounded-full text-lg shadow-xl shadow-white/10 hover:shadow-white/20 transition-shadow"
              >
                <Sparkles className="w-5 h-5" />
                Get Started — It's Free
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ================================================================
          FOOTER
          ================================================================ */}
      <footer className="border-t border-white/5 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Image src="/logo.png" alt="Prachar.ai" width={28} height={28} className="rounded-lg" />
              <span className="text-sm font-semibold">
                Prachar<span className="text-indigo-400">.ai</span>
              </span>
            </div>
            
            <div className="flex items-center gap-6 text-sm text-zinc-500">
              <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
              <Link href="/login" className="hover:text-white transition-colors">Sign In</Link>
              <Link href="/register" className="hover:text-white transition-colors">Get Started</Link>
            </div>

            <div className="flex items-center gap-2 text-xs text-zinc-600">
              <span>© 2026 Prachar.ai</span>
              <span>·</span>
              <span>Built with ❤️ for India</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
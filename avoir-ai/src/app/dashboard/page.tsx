'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Megaphone,
  Server,
  CreditCard,
  Settings,
  Zap,
  TrendingUp,
  Sparkles,
  ArrowRight,
  BarChart3,
  Shield,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/provider';

const springSmooth = { type: 'spring' as const, stiffness: 100, damping: 30 };
const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: springSmooth },
};

export default function DashboardPage() {
  const router = useRouter();
  const { email } = useAuth();
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      );
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, []);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const userName = email ? email.split('@')[0] : 'Operator';
  const initials = email ? email.split('@')[0].slice(0, 2).toUpperCase() : '??';

  const quickActions = [
    {
      title: 'Generate Campaign',
      description: 'Create AI-powered marketing campaigns with Diamond Cascade Engine',
      icon: Megaphone,
      href: '/dashboard/campaigns',
      gradient: 'from-indigo-500 to-purple-600',
      borderColor: 'border-indigo-500/20 hover:border-indigo-500/40',
    },
    {
      title: 'OmniDeck',
      description: 'Portfolio management dashboard with real-time analytics',
      icon: Server,
      href: '/omnideck',
      gradient: 'from-cyan-500 to-blue-600',
      borderColor: 'border-cyan-500/20 hover:border-cyan-500/40',
    },
    {
      title: 'Upgrade Plan',
      description: 'Unlock unlimited campaigns and premium AI tiers',
      icon: CreditCard,
      href: '/pricing',
      gradient: 'from-amber-500 to-orange-600',
      borderColor: 'border-amber-500/20 hover:border-amber-500/40',
    },
    {
      title: 'Account Settings',
      description: 'Manage profile, security, and verification',
      icon: Settings,
      href: '/dashboard/settings',
      gradient: 'from-zinc-400 to-zinc-600',
      borderColor: 'border-zinc-500/20 hover:border-zinc-500/40',
    },
  ];

  const features = [
    {
      icon: Sparkles,
      title: 'Diamond Cascade Engine',
      description: '6-tier AI orchestration for high-converting campaigns',
      color: 'text-indigo-400',
    },
    {
      icon: TrendingUp,
      title: 'Trend Radar',
      description: 'Real-time cultural trend detection and injection',
      color: 'text-cyan-400',
    },
    {
      icon: BarChart3,
      title: 'Performance Analytics',
      description: 'Track campaign ROI and engagement metrics',
      color: 'text-purple-400',
    },
    {
      icon: Shield,
      title: 'Brand DNA',
      description: 'Your unique brand fingerprint guides every generation',
      color: 'text-amber-400',
    },
  ];

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {/* Welcome Header */}
        <motion.div variants={staggerItem} className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-indigo-500/20">
              {initials}
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white">
                {greeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">{userName}</span>
              </h1>
              <p className="text-sm text-zinc-500 mt-0.5 font-tactical">
                {currentTime}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Quick Actions Grid */}
        <motion.div variants={staggerItem} className="mb-10">
          <h2 className="text-xs font-tactical font-bold text-zinc-500 tracking-widest mb-4">QUICK ACTIONS</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action) => (
              <button
                key={action.title}
                onClick={() => router.push(action.href)}
                className={`glass-card rounded-2xl p-5 text-left group transition-all ${action.borderColor}`}
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <action.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">{action.title}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed mb-3">{action.description}</p>
                <div className="flex items-center gap-1 text-xs text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Open</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Features Overview */}
        <motion.div variants={staggerItem} className="mb-10">
          <h2 className="text-xs font-tactical font-bold text-zinc-500 tracking-widest mb-4">PLATFORM CAPABILITIES</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="flex items-start gap-3 p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/50"
              >
                <feature.icon className={`w-5 h-5 ${feature.color} flex-shrink-0 mt-0.5`} />
                <div>
                  <h3 className="text-sm font-medium text-zinc-200">{feature.title}</h3>
                  <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Getting Started */}
        <motion.div variants={staggerItem}>
          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-xs font-tactical font-bold text-zinc-500 tracking-widest mb-4">GETTING STARTED</h2>
            <div className="space-y-3">
              {[
                { step: 1, text: 'Set up your Brand DNA in Settings for personalized generation', done: false },
                { step: 2, text: 'Generate your first campaign with the Diamond Cascade Engine', done: false },
                { step: 3, text: 'Explore OmniDeck for real-time portfolio analytics', done: false },
                { step: 4, text: 'Verify your email and phone for full account security', done: false },
              ].map((item) => (
                <div key={item.step} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/30 border border-zinc-800/30">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-tactical font-bold text-indigo-400">{item.step}</span>
                  </div>
                  <p className="text-sm text-zinc-400">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

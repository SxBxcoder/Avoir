'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Megaphone,
  Server,
  CreditCard,
  Settings,
  TrendingUp,
  Sparkles,
  ArrowRight,
  BarChart3,
  Shield,
  Zap,
  Activity,
  ChevronRight,
  Rocket,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/provider';

/* ── Animation Configs ─────────────────────────────────────────────────────── */
const springSmooth = { type: 'spring' as const, stiffness: 120, damping: 28 };
const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 24, filter: 'blur(6px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: springSmooth },
};

/* ── Animated Particle Grid (background only) ──────────────────────────────── */
function ParticleGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame: number;
    const dpr = window.devicePixelRatio || 1;
    const particles: { x: number; y: number; vx: number; vy: number; size: number; alpha: number }[] = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);
    };

    const init = () => {
      resize();
      particles.length = 0;
      const count = Math.min(60, Math.floor((canvas.offsetWidth * canvas.offsetHeight) / 18000));
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.offsetWidth,
          y: Math.random() * canvas.offsetHeight,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          size: Math.random() * 1.5 + 0.5,
          alpha: Math.random() * 0.4 + 0.1,
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.offsetWidth) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.offsetHeight) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(99, 102, 241, ${p.alpha})`;
        ctx.fill();
      });

      // Draw faint connection lines between close particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(99, 102, 241, ${0.06 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      animFrame = requestAnimationFrame(draw);
    };

    init();
    draw();
    window.addEventListener('resize', init);
    return () => {
      window.removeEventListener('resize', init);
      cancelAnimationFrame(animFrame);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none opacity-60"
      style={{ zIndex: 0 }}
    />
  );
}

/* ── Hover Glow Card ───────────────────────────────────────────────────────── */
function GlowCard({
  children,
  className = '',
  glowColor = 'rgba(99, 102, 241, 0.15)',
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
  onClick?: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 300, damping: 30 });
  const springY = useSpring(mouseY, { stiffness: 300, damping: 30 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouse = (e: React.MouseEvent) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouse}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      className={`relative overflow-hidden ${className}`}
      style={{ cursor: onClick ? 'pointer' : undefined }}
    >
      {/* Radial glow following the mouse */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 pointer-events-none z-0"
            style={{
              background: `radial-gradient(400px circle at ${springX.get()}px ${springY.get()}px, ${glowColor}, transparent 70%)`,
            }}
          />
        )}
      </AnimatePresence>
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

/* ── Main Dashboard ────────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const router = useRouter();
  const { email } = useAuth();
  const [currentTime, setCurrentTime] = useState('');
  const [mounted, setMounted] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('avoir_display_name');
    if (stored) {
      setUserName(stored);
    } else if (email) {
      setUserName(email.split('@')[0]);
    } else {
      setUserName('Operator');
    }

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

  const initials = userName ? userName.slice(0, 2).toUpperCase() : '??';

  const quickActions = [
    {
      title: 'Generate Campaign',
      description: 'Unleash the Diamond Cascade Engine to create AI-powered, high-converting campaigns.',
      icon: Megaphone,
      href: '/dashboard/campaigns',
      gradient: 'from-indigo-500 via-purple-500 to-pink-500',
      glow: 'rgba(99, 102, 241, 0.2)',
      iconBg: 'bg-gradient-to-br from-indigo-500 to-purple-600',
      tag: 'CORE',
    },
    {
      title: 'OmniDeck',
      description: 'Real-time portfolio analytics, live positions, and campaign P&L in a single command center.',
      icon: Server,
      href: '/omnideck',
      gradient: 'from-cyan-400 via-blue-500 to-indigo-500',
      glow: 'rgba(6, 182, 212, 0.2)',
      iconBg: 'bg-gradient-to-br from-cyan-500 to-blue-600',
      tag: 'ANALYTICS',
    },
    {
      title: 'Upgrade Plan',
      description: 'Unlock unlimited campaigns, premium AI tiers, and priority Cascade execution.',
      icon: CreditCard,
      href: '/pricing',
      gradient: 'from-amber-400 via-orange-500 to-red-500',
      glow: 'rgba(245, 158, 11, 0.2)',
      iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600',
      tag: 'PREMIUM',
    },
    {
      title: 'Account Settings',
      description: 'Manage your profile, Brand DNA, security, and system preferences.',
      icon: Settings,
      href: '/dashboard/settings',
      gradient: 'from-zinc-400 via-zinc-500 to-zinc-600',
      glow: 'rgba(161, 161, 170, 0.15)',
      iconBg: 'bg-gradient-to-br from-zinc-500 to-zinc-700',
      tag: 'CONFIG',
    },
  ];

  const capabilities = [
    {
      icon: Sparkles,
      title: 'Diamond Cascade Engine',
      description: '6-tier AI orchestration. Every campaign passes through Strategist → Writer → Visual → Validator → Optimizer → Deployer.',
      color: 'text-indigo-400',
      borderColor: 'border-indigo-500/20',
      bgAccent: 'bg-indigo-500/5',
      metric: '6',
      metricLabel: 'AI TIERS',
    },
    {
      icon: TrendingUp,
      title: 'Cultural Arbitrage',
      description: 'Real-time trend detection across TikTok, X, Instagram, and Reddit. Deploy capital before saturation.',
      color: 'text-cyan-400',
      borderColor: 'border-cyan-500/20',
      bgAccent: 'bg-cyan-500/5',
      metric: '24/7',
      metricLabel: 'SCANNING',
    },
    {
      icon: BarChart3,
      title: 'Predictive Analytics',
      description: 'AI backtesting with synthetic personas. Know your campaign score before you spend a single dollar.',
      color: 'text-purple-400',
      borderColor: 'border-purple-500/20',
      bgAccent: 'bg-purple-500/5',
      metric: '94%',
      metricLabel: 'ACCURACY',
    },
    {
      icon: Shield,
      title: 'Brand DNA',
      description: 'Your unique brand fingerprint — tone, values, audience segments — guides every single generation.',
      color: 'text-amber-400',
      borderColor: 'border-amber-500/20',
      bgAccent: 'bg-amber-500/5',
      metric: '∞',
      metricLabel: 'ADAPTIVE',
    },
  ];


  if (!mounted) return null;

  return (
    <div className="relative min-h-full">
      {/* Background Particle Grid */}
      <ParticleGrid />

      {/* Ambient gradient blob */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-indigo-500/8 via-purple-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-cyan-500/6 via-blue-500/3 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 p-4 lg:p-8 max-w-7xl mx-auto">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          {/* ── Welcome Header ────────────────────────────────────────────── */}
          <motion.div variants={staggerItem} className="mb-8">
            <div className="flex items-center gap-5 mb-1">
              {/* Avatar with animated ring */}
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl opacity-60 blur-sm animate-pulse" />
                <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold shadow-2xl shadow-indigo-500/30 border border-indigo-500/20">
                  {initials}
                </div>
              </div>
              <div>
                <h1 className="text-2xl lg:text-4xl font-bold text-foreground tracking-tight">
                  {greeting()},{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 animate-gradient-x">
                    {userName}
                  </span>
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-sm text-muted-foreground font-mono">
                    {currentTime}
                  </p>
                  <span className="w-1 h-1 rounded-full bg-indigo-500" />
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] text-emerald-400 font-tactical tracking-widest">ALL SYSTEMS NOMINAL</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>


          {/* ── Quick Actions ──────────────────────────────────────────────── */}
          <motion.div variants={staggerItem} className="mb-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xs font-tactical font-bold text-muted-foreground tracking-[0.2em]">QUICK ACTIONS</h2>
              <div className="h-[1px] flex-1 mx-4 bg-gradient-to-r from-border/50 to-transparent" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {quickActions.map((action, idx) => (
                <GlowCard
                  key={action.title}
                  onClick={() => router.push(action.href)}
                  glowColor={action.glow}
                  className="rounded-2xl border border-indigo-500/10 bg-card/50 backdrop-blur-md p-5 group hover:border-indigo-500/40 hover:shadow-[0_8px_30px_rgba(99,102,241,0.15)] transition-all duration-500"
                >
                  {/* Top accent line */}
                  <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${action.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-t-2xl`} />

                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-11 h-11 rounded-xl ${action.iconBg} flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300`}>
                      <action.icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-[8px] font-tactical tracking-[0.25em] text-muted-foreground/60 bg-muted/30 px-2 py-0.5 rounded-full border border-border/30">
                      {action.tag}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-foreground mb-1.5 group-hover:text-white transition-colors">
                    {action.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-4 line-clamp-2">
                    {action.description}
                  </p>

                  {/* Hover-reveal CTA */}
                  <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-400 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-300">
                    <span>Launch</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </GlowCard>
              ))}
            </div>
          </motion.div>

          {/* ── Platform Capabilities ──────────────────────────────────────── */}
          <motion.div variants={staggerItem} className="mb-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xs font-tactical font-bold text-muted-foreground tracking-[0.2em]">PLATFORM CAPABILITIES</h2>
              <div className="h-[1px] flex-1 mx-4 bg-gradient-to-r from-border/50 to-transparent" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {capabilities.map((cap) => (
                <GlowCard
                  key={cap.title}
                  glowColor={cap.glow || 'rgba(99, 102, 241, 0.1)'}
                  className={`rounded-xl border ${cap.borderColor} ${cap.bgAccent} backdrop-blur-sm p-5 group`}
                >
                  <div className="flex items-start gap-4">
                    {/* Metric badge */}
                    <div className="flex-shrink-0 flex flex-col items-center">
                      <div className={`w-12 h-12 rounded-xl border ${cap.borderColor} flex items-center justify-center ${cap.bgAccent}`}>
                        <span className={`text-lg font-black font-tactical ${cap.color}`}>{cap.metric}</span>
                      </div>
                      <span className={`text-[7px] font-tactical tracking-widest mt-1.5 ${cap.color} opacity-60`}>{cap.metricLabel}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <cap.icon className={`w-4 h-4 ${cap.color} flex-shrink-0`} />
                        <h3 className="text-sm font-semibold text-foreground">{cap.title}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{cap.description}</p>
                    </div>
                  </div>
                </GlowCard>
              ))}
            </div>
          </motion.div>

          {/* ── Getting Started Roadmap ────────────────────────────────────── */}
          <motion.div variants={staggerItem}>
            <GlowCard className="rounded-2xl border border-indigo-500/10 bg-card/40 backdrop-blur-md p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xs font-tactical font-bold text-muted-foreground tracking-[0.2em]">MISSION BRIEFING</h2>
                <div className="text-[9px] font-tactical tracking-widest text-indigo-400/60 bg-indigo-500/5 px-2.5 py-1 rounded-full border border-indigo-500/10">
                  4 OBJECTIVES
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { step: 1, text: 'Configure your Brand DNA in Settings for hyper-personalized generation', icon: Shield, color: 'text-amber-400', borderColor: 'border-amber-500/20', bgColor: 'bg-amber-500/10' },
                  { step: 2, text: 'Generate your first campaign with the Diamond Cascade Engine', icon: Sparkles, color: 'text-indigo-400', borderColor: 'border-indigo-500/20', bgColor: 'bg-indigo-500/10' },
                  { step: 3, text: 'Explore OmniDeck for live portfolio analytics and position management', icon: Activity, color: 'text-cyan-400', borderColor: 'border-cyan-500/20', bgColor: 'bg-cyan-500/10' },
                  { step: 4, text: 'Verify email and phone to unlock full account security', icon: Shield, color: 'text-emerald-400', borderColor: 'border-emerald-500/20', bgColor: 'bg-emerald-500/10' },
                ].map((item) => (
                  <motion.div
                    key={item.step}
                    whileHover={{ x: 4 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className={`flex items-center gap-4 p-3.5 rounded-xl border ${item.borderColor} bg-background/30 hover:bg-background/50 transition-colors group cursor-default`}
                  >
                    <div className={`w-8 h-8 rounded-lg ${item.bgColor} border ${item.borderColor} flex items-center justify-center flex-shrink-0`}>
                      <item.icon className={`w-4 h-4 ${item.color}`} />
                    </div>
                    <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors flex-1">{item.text}</p>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                  </motion.div>
                ))}
              </div>
            </GlowCard>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

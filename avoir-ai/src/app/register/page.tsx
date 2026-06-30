'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signUp, confirmSignUp, signIn, signInWithRedirect } from 'aws-amplify/auth';
import { configureAuth } from '@/lib/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Mail, Lock, Building2, Shield, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

const springSmooth = { type: 'spring' as const, stiffness: 100, damping: 30 };
const springBouncy = { type: 'spring' as const, stiffness: 400, damping: 25 };

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<'signup' | 'verify'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [brandName, setBrandName] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { configureAuth(); }, []);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const signUpOptions: any = {
        username: email,
        password,
        options: {
          userAttributes: { email },
          autoSignIn: true,
        },
      };

      if (brandName) {
        signUpOptions.options.userAttributes['custom:brand_name'] = brandName;
      }

      await signUp(signUpOptions);
      setStep('verify');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await confirmSignUp({ username: email, confirmationCode: verificationCode });
      await signIn({ username: email, password });
      window.location.href = '/onboarding';
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const passwordRequirements = [
    { label: '8+ characters', met: password.length >= 8 },
    { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Number', met: /[0-9]/.test(password) },
    { label: 'Special character', met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
  ];

  return (
    <div className="min-h-screen bg-black text-white flex" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 via-indigo-600/10 to-black" />
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/3 left-1/4 w-[400px] h-[400px] rounded-full bg-purple-600/15 blur-[120px]"
        />
        <motion.div
          animate={{ x: [0, -20, 0], y: [0, 30, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-1/4 right-1/3 w-[300px] h-[300px] rounded-full bg-indigo-600/15 blur-[100px]"
        />
        
        <div className="relative z-10 flex flex-col justify-center px-16">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={springSmooth}>
            <Image src="/logo.png" alt="Avoir" width={64} height={64} className="rounded-xl shadow-2xl shadow-purple-500/20 mb-8" />
            
            <h1 className="text-5xl font-bold tracking-tight mb-4 leading-tight">
              Join the<br />
              <span className="fluid-text-hero">Revolution.</span>
            </h1>
            <p className="text-lg text-zinc-400 max-w-md leading-relaxed">
              Avoir builds high-converting campaigns and deploys them across platforms, all on complete autopilot.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-3 mt-12">
              {['AI-Powered Copy', 'Global Campaigns', 'Visual Assets', 'Free to Start'].map((feat) => (
                <span key={feat} className="text-xs text-zinc-400 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                  {feat}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right Panel — Register Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 relative">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]" />
        
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={springSmooth}
          className="w-full max-w-md relative z-10"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <Image src="/logo.png" alt="Avoir" width={40} height={40} className="rounded-lg" />
            <span className="text-lg font-bold">Avoir<span className="text-indigo-400">.ai</span></span>
          </div>

          <Link href="/" className="inline-flex items-center gap-2 text-zinc-500 hover:text-white mb-8 transition-colors group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm">Back to Home</span>
          </Link>

          <AnimatePresence mode="wait">
            {step === 'signup' ? (
              <motion.div key="signup" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={springSmooth}>
                <div className="mb-8">
                  <h2 className="text-3xl font-bold tracking-tight mb-2">Create Account</h2>
                  <p className="text-zinc-500">Start generating viral campaigns for free</p>
                </div>

          {/* Google SSO Button */}
          <motion.button
            type="button"
            onClick={() => signInWithRedirect({ provider: 'Google' })}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-white/5 border border-white/10 text-white font-medium py-3.5 rounded-xl transition-all flex items-center justify-center gap-3 hover:bg-white/10 hover:border-white/20 shadow-lg shadow-black/20 mb-6"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </motion.button>

          <div className="flex items-center gap-4 mb-6">
            <div className="h-px bg-white/10 flex-1"></div>
            <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">or sign up with email</span>
            <div className="h-px bg-white/10 flex-1"></div>
          </div>

                {error && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                  </motion.div>
                )}

                <form onSubmit={handleSignUp} className="space-y-5">
                  <div>
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider block mb-2">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 pl-11 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/30 transition-all" />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider block mb-2">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a strong password" required
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 pl-11 pr-11 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/30 transition-all" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {/* Password strength indicators */}
                    {password.length > 0 && (
                      <div className="flex gap-2 mt-3 flex-wrap">
                        {passwordRequirements.map((req) => (
                          <span key={req.label} className={`text-[10px] px-2 py-0.5 rounded-full border ${req.met ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>
                            {req.met ? '✓' : '○'} {req.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider block mb-2">Brand Name <span className="text-zinc-600">(Optional)</span></label>
                    <div className="relative">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input type="text" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Your brand or organization"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 pl-11 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/30 transition-all" />
                    </div>
                  </div>

                  <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="w-full bg-white text-black font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-white/5">
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full" />
                        Creating Account...
                      </div>
                    ) : (
                      <>Create Account<ArrowRight className="w-4 h-4" /></>
                    )}
                  </motion.button>
                </form>
              </motion.div>
            ) : (
              <motion.div key="verify" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={springSmooth}>
                <div className="mb-8">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={springBouncy}
                    className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-6">
                    <Shield className="w-8 h-8 text-indigo-400" />
                  </motion.div>
                  <h2 className="text-3xl font-bold tracking-tight mb-2">Verify Email</h2>
                  <p className="text-zinc-500">We sent a 6-digit code to <span className="text-white font-medium">{email}</span></p>
                </div>

                {error && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                  </motion.div>
                )}

                <form onSubmit={handleVerify} className="space-y-5">
                  <div>
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider block mb-2">Verification Code</label>
                    <input type="text" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} placeholder="Enter 6-digit code" required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white text-center text-2xl font-bold tracking-[0.3em] placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/30 transition-all" />
                  </div>

                  <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="w-full bg-white text-black font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-white/5">
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full" />
                        Verifying...
                      </div>
                    ) : (
                      <>Verify & Launch<ArrowRight className="w-4 h-4" /></>
                    )}
                  </motion.button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-8 text-center text-sm text-zinc-500">
            Already have an account?{' '}
            <Link href="/login" className="text-white font-medium hover:text-indigo-400 transition-colors">Sign In</Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

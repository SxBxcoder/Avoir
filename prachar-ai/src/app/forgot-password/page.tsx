'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { resetPassword, confirmResetPassword } from 'aws-amplify/auth';
import { configureAuth } from '@/lib/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Mail, Lock, ShieldCheck, KeyRound, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

const springSmooth = { type: 'spring' as const, stiffness: 100, damping: 30 };

type Step = 'email' | 'code' | 'success';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { configureAuth(); }, []);

  // Step 1: Send verification code
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (!process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID) {
        throw new Error('Deployment Error: Cognito User Pool ID is missing.');
      }

      await resetPassword({ username: email });
      setSuccess('Verification code sent! Check your email inbox (and spam folder).');
      setStep('code');
    } catch (err: any) {
      if (err.name === 'UserNotFoundException') {
        setError('No account found with this email address.');
      } else if (err.name === 'LimitExceededException') {
        setError('Too many attempts. Please wait a few minutes and try again.');
      } else {
        setError(err.message || 'Failed to send verification code.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Confirm new password with code
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      setLoading(false);
      return;
    }

    try {
      await confirmResetPassword({
        username: email,
        confirmationCode: code,
        newPassword: newPassword,
      });
      setStep('success');
    } catch (err: any) {
      if (err.name === 'CodeMismatchException') {
        setError('Invalid verification code. Please check and try again.');
      } else if (err.name === 'ExpiredCodeException') {
        setError('Verification code has expired. Please request a new one.');
      } else if (err.name === 'InvalidPasswordException') {
        setError('Password must include uppercase, lowercase, numbers, and special characters.');
      } else {
        setError(err.message || 'Failed to reset password.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Password strength indicator
  const getPasswordStrength = (pw: string) => {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[a-z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  };

  const strength = getPasswordStrength(newPassword);
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
  const strengthColors = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4'];

  return (
    <div className="min-h-screen bg-black text-white flex" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 via-purple-600/10 to-black" />
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/3 left-1/4 w-[400px] h-[400px] rounded-full bg-indigo-600/15 blur-[120px]"
        />
        <motion.div
          animate={{ x: [0, -20, 0], y: [0, 30, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-1/4 right-1/3 w-[300px] h-[300px] rounded-full bg-purple-600/15 blur-[100px]"
        />
        
        <div className="relative z-10 flex flex-col justify-center px-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springSmooth}
          >
            <Image src="/logo.png" alt="Prachar.ai" width={64} height={64} className="rounded-xl shadow-2xl shadow-indigo-500/20 mb-8" />
            
            <h1 className="text-5xl font-bold tracking-tight mb-4 leading-tight">
              Forgot your<br />
              <span className="fluid-text-hero">password?</span>
            </h1>
            <p className="text-lg text-zinc-400 max-w-md leading-relaxed">
              No worries. We'll send you a verification code to your email and you'll be back in action in seconds.
            </p>

            {/* Security badge */}
            <div className="flex items-center gap-4 mt-12 p-4 rounded-xl bg-white/5 border border-white/10 max-w-sm">
              <ShieldCheck className="w-8 h-8 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">End-to-end encrypted</p>
                <p className="text-xs text-zinc-500">Your password reset is secured by AWS Cognito</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right Panel — Forms */}
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
            <Image src="/logo.png" alt="Prachar.ai" width={40} height={40} className="rounded-lg" />
            <span className="text-lg font-bold">Prachar<span className="text-indigo-400">.ai</span></span>
          </div>

          <Link href="/login" className="inline-flex items-center gap-2 text-zinc-500 hover:text-white mb-8 transition-colors group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm">Back to Login</span>
          </Link>

          {/* Step indicators */}
          <div className="flex items-center gap-3 mb-8">
            {(['email', 'code', 'success'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  step === s ? 'bg-white text-black scale-110' : 
                  (['email', 'code', 'success'].indexOf(step) > i) ? 'bg-indigo-500 text-white' : 
                  'bg-white/10 text-zinc-500'
                }`}>
                  {(['email', 'code', 'success'].indexOf(step) > i) ? '✓' : i + 1}
                </div>
                {i < 2 && <div className={`w-8 h-px transition-colors duration-300 ${
                  (['email', 'code', 'success'].indexOf(step) > i) ? 'bg-indigo-500' : 'bg-white/10'
                }`} />}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* STEP 1: Enter Email */}
            {step === 'email' && (
              <motion.div
                key="email"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="mb-8">
                  <h2 className="text-3xl font-bold tracking-tight mb-2">Reset Password</h2>
                  <p className="text-zinc-500">Enter your email and we'll send you a verification code</p>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                  >
                    {error}
                  </motion.div>
                )}

                <form onSubmit={handleSendCode} className="space-y-5">
                  <div>
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider block mb-2">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 pl-11 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/30 transition-all"
                      />
                    </div>
                  </div>

                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-white text-black font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-white/5"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full" />
                        Sending Code...
                      </div>
                    ) : (
                      <>
                        Send Verification Code
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </motion.button>
                </form>
              </motion.div>
            )}

            {/* STEP 2: Enter Code & New Password */}
            {step === 'code' && (
              <motion.div
                key="code"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="mb-8">
                  <h2 className="text-3xl font-bold tracking-tight mb-2">Enter Code</h2>
                  <p className="text-zinc-500">
                    We sent a code to <span className="text-white font-medium">{email}</span>
                  </p>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                  >
                    {error}
                  </motion.div>
                )}

                {success && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm"
                  >
                    {success}
                  </motion.div>
                )}

                <form onSubmit={handleResetPassword} className="space-y-5">
                  <div>
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider block mb-2">Verification Code</label>
                    <div className="relative">
                      <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        required
                        maxLength={6}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 pl-11 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/30 transition-all tracking-[0.3em] text-center text-lg font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider block mb-2">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        required
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 pl-11 pr-11 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/30 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {/* Password strength bar */}
                    {newPassword && (
                      <div className="mt-2">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((level) => (
                            <div
                              key={level}
                              className="h-1 flex-1 rounded-full transition-all duration-300"
                              style={{
                                backgroundColor: strength >= level ? strengthColors[strength] : 'rgba(255,255,255,0.1)',
                              }}
                            />
                          ))}
                        </div>
                        <p className="text-xs mt-1" style={{ color: strengthColors[strength] }}>
                          {strengthLabels[strength]}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider block mb-2">Confirm Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        required
                        className={`w-full bg-white/5 border rounded-xl px-4 py-3.5 pl-11 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all ${
                          confirmPassword && confirmPassword !== newPassword
                            ? 'border-red-500/50'
                            : confirmPassword && confirmPassword === newPassword
                            ? 'border-emerald-500/50'
                            : 'border-white/10'
                        }`}
                      />
                      {confirmPassword && confirmPassword === newPassword && (
                        <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                      )}
                    </div>
                  </div>

                  <motion.button
                    type="submit"
                    disabled={loading || !code || !newPassword || !confirmPassword}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-white text-black font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-white/5"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full" />
                        Resetting Password...
                      </div>
                    ) : (
                      <>
                        Reset Password
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </motion.button>

                  <button
                    type="button"
                    onClick={() => { setStep('email'); setError(''); setSuccess(''); setCode(''); }}
                    className="w-full text-center text-sm text-zinc-500 hover:text-white transition-colors mt-2"
                  >
                    Didn't receive the code? Go back and try again
                  </button>
                </form>
              </motion.div>
            )}

            {/* STEP 3: Success */}
            {step === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={springSmooth}
                className="text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                  className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6"
                >
                  <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                </motion.div>

                <h2 className="text-3xl font-bold tracking-tight mb-3">Password Reset!</h2>
                <p className="text-zinc-400 mb-8 max-w-sm mx-auto">
                  Your password has been successfully reset. You can now sign in with your new password.
                </p>

                <motion.button
                  onClick={() => router.push('/login')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-white text-black font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 hover:bg-zinc-200 shadow-lg shadow-white/5"
                >
                  Go to Login
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-8 text-center text-sm text-zinc-500">
            Remember your password?{' '}
            <Link href="/login" className="text-white font-medium hover:text-indigo-400 transition-colors">
              Sign In
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Zap, X, Check, Crown, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getRemainingCampaigns, type UserSubscription, PLANS } from '@/lib/stripe';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscription?: UserSubscription | null;
}

export default function UpgradeModal({ isOpen, onClose, subscription }: UpgradeModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const remaining = subscription ? getRemainingCampaigns(subscription) : 0;
  const limit = subscription ? PLANS[subscription.tier].campaignsPerMonth : 3;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="relative bg-zinc-900 border border-zinc-700/50 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl shadow-indigo-500/10"
          >
            {/* Gradient top bar */}
            <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

            <div className="p-8 text-center">
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.1 }}
              >
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-indigo-500/30 shadow-lg shadow-indigo-500/10">
                  <Crown className="w-10 h-10 text-indigo-400" />
                </div>
              </motion.div>

              {/* Content */}
              <h2 className="text-2xl font-extrabold text-white mb-2">
                You've used all {limit} free campaigns
              </h2>
              <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
                Upgrade to <span className="text-indigo-400 font-semibold">Pro</span> for unlimited AI campaigns, the full 6-Tier Diamond Cascade, and priority support.
              </p>

              {/* Feature list */}
              <div className="bg-zinc-800/50 rounded-xl p-5 mb-8 text-left border border-zinc-700/50">
                <div className="text-xs font-mono text-indigo-400 uppercase tracking-wider mb-3">Pro includes</div>
                <ul className="space-y-2.5">
                  {['Unlimited AI campaign generations', '6-Tier Diamond Cascade AI', 'Custom brand guidelines', 'Priority support'].map((feature) => (
                    <li key={feature} className="flex items-center gap-2.5 text-sm text-zinc-300">
                      <div className="p-0.5 rounded-full bg-indigo-500/20 flex-shrink-0">
                        <Check className="w-3 h-3 text-indigo-400" />
                      </div>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Buttons */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => { onClose(); router.push('/pricing'); }}
                  className="w-full py-4 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 group"
                >
                  <Zap className="w-5 h-5" />
                  Upgrade to Pro — $9.99/mo
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-3 rounded-xl font-medium text-zinc-500 hover:text-zinc-300 transition-colors text-sm"
                >
                  Maybe later
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

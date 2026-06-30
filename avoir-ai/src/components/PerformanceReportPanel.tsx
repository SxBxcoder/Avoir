'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, TrendingUp, X, ArrowRight, Check, Loader2, Activity, Target, Globe } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

type Platform = 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'google_ads' | 'email';

interface PerformanceReportPanelProps {
  campaignId: string;
  campaignSnapshot: { hook: string; offer: string; cta: string };
  userId: string;
  onClose: () => void;
  onReported: () => void;
}

const PLATFORMS: { id: Platform; label: string; icon: string; color: string }[] = [
  { id: 'instagram', label: 'Instagram', icon: '📸', color: 'from-pink-500 to-purple-600' },
  { id: 'facebook', label: 'Facebook', icon: '📘', color: 'from-blue-500 to-blue-700' },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼', color: 'from-sky-500 to-blue-600' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵', color: 'from-purple-500 to-pink-500' },
  { id: 'google_ads', label: 'Google Ads', icon: '🔍', color: 'from-green-500 to-emerald-600' },
  { id: 'email', label: 'Email', icon: '📧', color: 'from-amber-500 to-orange-600' },
];

const METRIC_FIELDS = [
  { key: 'impressions', label: 'Impressions', placeholder: 'e.g., 12500', type: 'number' },
  { key: 'clicks', label: 'Clicks', placeholder: 'e.g., 340', type: 'number' },
  { key: 'conversions', label: 'Conversions', placeholder: 'e.g., 12', type: 'number' },
  { key: 'engagementRate', label: 'Engagement Rate %', placeholder: 'e.g., 4.2', type: 'number' },
  { key: 'costPerClick', label: 'Cost Per Click ($)', placeholder: 'e.g., 0.45', type: 'number' },
  { key: 'roas', label: 'ROAS', placeholder: 'e.g., 3.2', type: 'number' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function PerformanceReportPanel({
  campaignId,
  campaignSnapshot,
  userId,
  onClose,
  onReported,
}: PerformanceReportPanelProps) {
  const [step, setStep] = useState<'platform' | 'metrics' | 'success'>('platform');
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [metrics, setMetrics] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleMetricChange = (key: string, value: string) => {
    setMetrics(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!selectedPlatform) return;
    setIsSubmitting(true);

    try {
      const numericMetrics = {
        impressions: parseInt(metrics.impressions || '0'),
        clicks: parseInt(metrics.clicks || '0'),
        ctr: 0,
        engagementRate: parseFloat(metrics.engagementRate || '0'),
        conversions: parseInt(metrics.conversions || '0'),
        costPerClick: parseFloat(metrics.costPerClick || '0'),
        roas: parseFloat(metrics.roas || '0'),
      };

      // Auto-calculate CTR
      if (numericMetrics.impressions > 0) {
        numericMetrics.ctr = parseFloat(((numericMetrics.clicks / numericMetrics.impressions) * 100).toFixed(2));
      }

      await fetch('/api/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          campaignId,
          platform: selectedPlatform,
          metrics: numericMetrics,
          campaignSnapshot,
          tags: [],
        }),
      });

      setStep('success');
      setTimeout(() => {
        onReported();
      }, 2000);
    } catch (err) {
      console.error('Performance report error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.9, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 30 }}
        className="w-full max-w-lg mx-4 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl shadow-indigo-500/10 overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold font-tactical tracking-wider text-emerald-400">PERFORMANCE INTELLIGENCE</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Report metrics → Your AI gets smarter</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
              <X className="w-5 h-5 text-zinc-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            {step === 'platform' && (
              <motion.div key="platform" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <p className="text-sm text-zinc-400 mb-4">Where did you deploy this campaign?</p>
                <div className="grid grid-cols-2 gap-3">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedPlatform(p.id); setStep('metrics'); }}
                      className={`group p-4 rounded-xl border transition-all text-left hover:scale-[1.02] ${
                        selectedPlatform === p.id
                          ? 'border-emerald-500/50 bg-emerald-500/5'
                          : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50'
                      }`}
                    >
                      <span className="text-2xl">{p.icon}</span>
                      <p className="text-sm font-medium text-white mt-2">{p.label}</p>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 'metrics' && (
              <motion.div key="metrics" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">{PLATFORMS.find(p => p.id === selectedPlatform)?.icon}</span>
                  <p className="text-sm text-zinc-400">
                    Enter your <span className="text-white font-medium">{PLATFORMS.find(p => p.id === selectedPlatform)?.label}</span> metrics
                  </p>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {METRIC_FIELDS.map((field) => (
                    <div key={field.key}>
                      <label className="text-xs text-zinc-500 font-medium mb-1 block">{field.label}</label>
                      <input
                        type="number"
                        step="any"
                        value={metrics[field.key] || ''}
                        onChange={(e) => handleMetricChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full bg-black border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:ring-1 focus:ring-emerald-500/30"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setStep('platform')}
                    className="flex-1 py-3 rounded-xl border border-zinc-800 text-sm text-zinc-400 hover:text-white hover:border-zinc-700 transition-all"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white text-sm font-bold hover:from-emerald-500 hover:to-green-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                    {isSubmitting ? 'Recording...' : 'Record Intelligence'}
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
                  className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center"
                >
                  <Check className="w-8 h-8 text-emerald-400" />
                </motion.div>
                <h4 className="text-lg font-bold text-white mb-2">Intelligence Recorded</h4>
                <p className="text-sm text-zinc-400">Your AI will use this data to generate better campaigns.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

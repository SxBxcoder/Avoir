'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Target, Shield, Check, Copy, ChevronRight, Sparkles, Eye, Merge, X } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface CampaignReasoning {
  hook_rationale: string;
  offer_rationale: string;
  cta_rationale: string;
  confidence_score: number;
  audience_insight: string;
}

interface CampaignAsset {
  hook: string;
  offer: string;
  cta: string;
  reasoning?: CampaignReasoning;
  funnel?: {
    top: string;
    bottom: string;
  };
}

interface GenomePredictedScores {
  virality: number;
  conversion: number;
  retention: number;
  brand_trust: number;
  shareability: number;
}

interface GenomeVariant {
  genome_type: 'virality' | 'conversion' | 'authority';
  plan: CampaignAsset;
  captions: string[];
  predicted_scores: GenomePredictedScores;
}

interface CampaignGenomeProps {
  variants: GenomeVariant[];
  onSelectVariant: (variant: GenomeVariant) => void;
  onMergeVariants: (merged: CampaignAsset, captions: string[]) => void;
}

// ============================================================================
// GENOME CONFIG — visual identity for each variant type
// ============================================================================

const GENOME_CONFIG = {
  virality: {
    label: 'α VIRALITY',
    subtitle: 'Maximum reach, shares, saves',
    icon: Flame,
    gradient: 'from-red-500/20 to-orange-500/20',
    border: 'border-red-500/30 hover:border-red-500/50',
    glow: 'shadow-[0_0_30px_rgba(239,68,68,0.15)]',
    iconColor: 'text-red-400',
    labelColor: 'text-red-400',
    fillColor: 'rgba(239, 68, 68, 0.2)',
    strokeColor: 'rgba(239, 68, 68, 0.8)',
  },
  conversion: {
    label: 'β CONVERSION',
    subtitle: 'Maximum clicks, sign-ups, purchases',
    icon: Target,
    gradient: 'from-emerald-500/20 to-green-500/20',
    border: 'border-emerald-500/30 hover:border-emerald-500/50',
    glow: 'shadow-[0_0_30px_rgba(16,185,129,0.15)]',
    iconColor: 'text-emerald-400',
    labelColor: 'text-emerald-400',
    fillColor: 'rgba(16, 185, 129, 0.2)',
    strokeColor: 'rgba(16, 185, 129, 0.8)',
  },
  authority: {
    label: 'γ AUTHORITY',
    subtitle: 'Maximum brand trust & community',
    icon: Shield,
    gradient: 'from-indigo-500/20 to-blue-500/20',
    border: 'border-indigo-500/30 hover:border-indigo-500/50',
    glow: 'shadow-[0_0_30px_rgba(99,102,241,0.15)]',
    iconColor: 'text-indigo-400',
    labelColor: 'text-indigo-400',
    fillColor: 'rgba(99, 102, 241, 0.2)',
    strokeColor: 'rgba(99, 102, 241, 0.8)',
  },
};

// ============================================================================
// RADAR CHART (Pure SVG — no library)
// ============================================================================

const RADAR_AXES = ['virality', 'conversion', 'retention', 'brand_trust', 'shareability'] as const;
const RADAR_LABELS = ['Virality', 'Conversion', 'Retention', 'Trust', 'Share'];

function RadarChart({ scores, fillColor, strokeColor }: {
  scores: GenomePredictedScores;
  fillColor: string;
  strokeColor: string;
}) {
  const cx = 100, cy = 100, maxR = 80;
  const angleStep = (2 * Math.PI) / 5;
  const offset = -Math.PI / 2; // Start from top

  // Convert scores to polygon points
  const points = RADAR_AXES.map((axis, i) => {
    const val = (scores[axis] || 0) / 100;
    const angle = offset + i * angleStep;
    return {
      x: cx + maxR * val * Math.cos(angle),
      y: cy + maxR * val * Math.sin(angle),
    };
  });

  const polygonPoints = points.map(p => `${p.x},${p.y}`).join(' ');

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1.0];

  return (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {/* Grid rings */}
      {rings.map(r => {
        const ringPoints = RADAR_AXES.map((_, i) => {
          const angle = offset + i * angleStep;
          return `${cx + maxR * r * Math.cos(angle)},${cy + maxR * r * Math.sin(angle)}`;
        }).join(' ');
        return <polygon key={r} points={ringPoints} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />;
      })}

      {/* Axis lines */}
      {RADAR_AXES.map((_, i) => {
        const angle = offset + i * angleStep;
        return (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={cx + maxR * Math.cos(angle)}
            y2={cy + maxR * Math.sin(angle)}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
        );
      })}

      {/* Data polygon */}
      <motion.polygon
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        points={polygonPoints}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth="2"
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />

      {/* Data dots */}
      {points.map((p, i) => (
        <motion.circle
          key={i}
          initial={{ opacity: 0, r: 0 }}
          animate={{ opacity: 1, r: 3 }}
          transition={{ delay: 0.5 + i * 0.1 }}
          cx={p.x} cy={p.y}
          fill={strokeColor}
        />
      ))}

      {/* Labels */}
      {RADAR_AXES.map((axis, i) => {
        const angle = offset + i * angleStep;
        const lx = cx + (maxR + 18) * Math.cos(angle);
        const ly = cy + (maxR + 18) * Math.sin(angle);
        return (
          <text
            key={axis}
            x={lx} y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(255,255,255,0.5)"
            fontSize="8"
            fontFamily="monospace"
          >
            {RADAR_LABELS[i]}
          </text>
        );
      })}

      {/* Score labels on each point */}
      {RADAR_AXES.map((axis, i) => {
        const val = scores[axis] || 0;
        const angle = offset + i * angleStep;
        const r = (maxR * val) / 100;
        const lx = cx + (r + 12) * Math.cos(angle);
        const ly = cy + (r + 12) * Math.sin(angle);
        return (
          <text
            key={`score-${axis}`}
            x={lx} y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={strokeColor}
            fontSize="9"
            fontWeight="bold"
          >
            {val}
          </text>
        );
      })}
    </svg>
  );
}

// ============================================================================
// MERGE MODAL
// ============================================================================

function MergeModal({ variants, onMerge, onClose }: {
  variants: GenomeVariant[];
  onMerge: (merged: CampaignAsset, captions: string[]) => void;
  onClose: () => void;
}) {
  const [hookFrom, setHookFrom] = useState<'virality' | 'conversion' | 'authority'>('virality');
  const [offerFrom, setOfferFrom] = useState<'virality' | 'conversion' | 'authority'>('conversion');
  const [ctaFrom, setCtaFrom] = useState<'virality' | 'conversion' | 'authority'>('authority');

  const getVariant = (type: string) => variants.find(v => v.genome_type === type)!;

  const handleMerge = () => {
    const hookVariant = getVariant(hookFrom);
    const offerVariant = getVariant(offerFrom);
    const ctaVariant = getVariant(ctaFrom);
    onMerge(
      {
        hook: hookVariant.plan.hook,
        offer: offerVariant.plan.offer,
        cta: ctaVariant.plan.cta,
        reasoning: hookVariant.plan.reasoning,
      },
      hookVariant.captions
    );
  };

  const PickerRow = ({ label, value, onChange }: {
    label: string;
    value: string;
    onChange: (v: 'virality' | 'conversion' | 'authority') => void;
  }) => (
    <div className="flex items-center justify-between py-3 border-b border-zinc-800/50">
      <span className="text-sm font-bold text-zinc-300">{label}</span>
      <div className="flex gap-2">
        {(['virality', 'conversion', 'authority'] as const).map(type => {
          const config = GENOME_CONFIG[type];
          return (
            <button
              key={type}
              onClick={() => onChange(type)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                value === type
                  ? `bg-gradient-to-r ${config.gradient} ${config.labelColor} border ${config.border}`
                  : 'bg-zinc-800/50 text-zinc-500 border border-zinc-700/50 hover:bg-zinc-700/50'
              }`}
            >
              {config.label.split(' ')[0]}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl p-8 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-xl">
              <Merge className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Merge Genomes</h3>
              <p className="text-xs text-zinc-500">Pick the best element from each variant</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        <div className="space-y-1">
          <PickerRow label="Hook from" value={hookFrom} onChange={setHookFrom} />
          <PickerRow label="Offer from" value={offerFrom} onChange={setOfferFrom} />
          <PickerRow label="CTA from" value={ctaFrom} onChange={setCtaFrom} />
        </div>

        {/* Preview */}
        <div className="mt-6 p-4 rounded-xl bg-zinc-900/80 border border-zinc-800/50 space-y-2">
          <span className="text-[10px] font-tactical text-purple-400 uppercase tracking-widest">MERGED PREVIEW</span>
          <p className="text-sm font-bold text-white">{getVariant(hookFrom).plan.hook}</p>
          <p className="text-xs text-zinc-400">{getVariant(offerFrom).plan.offer}</p>
          <p className="text-xs text-zinc-300 font-medium">{getVariant(ctaFrom).plan.cta}</p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleMerge}
          className="w-full mt-6 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-sm shadow-[0_0_25px_rgba(168,85,247,0.3)] hover:shadow-[0_0_35px_rgba(168,85,247,0.5)] transition-all flex items-center justify-center gap-2"
        >
          <Merge className="w-4 h-4" /> Deploy Merged Campaign
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const springConfig = { type: 'spring' as const, stiffness: 300, damping: 30 };
const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.15 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: springConfig },
};

export default function CampaignGenome({ variants, onSelectVariant, onMergeVariants }: CampaignGenomeProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [showMerge, setShowMerge] = useState(false);
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-6 pt-8 border-t border-zinc-800/50 mt-8"
    >
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={springConfig}
          className="flex items-center gap-2"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/30 via-emerald-500/30 to-indigo-500/30 rounded-lg blur-lg" />
            <div className="relative p-1.5 bg-zinc-900 rounded-lg border border-zinc-700/50">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
          </div>
          <h3 className="text-xs font-tactical text-white uppercase tracking-wider">Campaign Genome™</h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/20 font-bold">3 VARIANTS</span>
        </motion.div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowMerge(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold hover:bg-purple-500/20 transition-all"
        >
          <Merge className="w-3.5 h-3.5" /> Merge Custom
        </motion.button>
      </div>

      {/* Variant Cards Grid */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        {variants.map((variant) => {
          const config = GENOME_CONFIG[variant.genome_type];
          const Icon = config.icon;
          const key = variant.genome_type;

          return (
            <motion.div
              key={key}
              variants={staggerItem}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
              className={`relative rounded-2xl bg-gradient-to-br ${config.gradient} border ${config.border} ${config.glow} overflow-hidden transition-all`}
            >
              {/* Card content */}
              <div className="p-6 space-y-5">
                {/* Genome Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl bg-black/30`}>
                      <Icon className={`w-5 h-5 ${config.iconColor}`} />
                    </div>
                    <div>
                      <h4 className={`text-sm font-bold font-tactical tracking-wider ${config.labelColor}`}>
                        {config.label}
                      </h4>
                      <p className="text-[10px] text-zinc-500">{config.subtitle}</p>
                    </div>
                  </div>
                </div>

                {/* Radar Chart */}
                <div className="w-full aspect-square max-w-[180px] mx-auto">
                  <RadarChart
                    scores={variant.predicted_scores}
                    fillColor={config.fillColor}
                    strokeColor={config.strokeColor}
                  />
                </div>

                {/* Copy Section */}
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-tactical text-zinc-500">HOOK</span>
                      <button onClick={() => copyToClipboard(variant.plan.hook, `${key}-hook`)} className="p-1 hover:bg-zinc-800 rounded transition-colors">
                        {copied === `${key}-hook` ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-zinc-600" />}
                      </button>
                    </div>
                    <p className="text-sm font-bold text-white leading-snug">{variant.plan.hook}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                    <span className="text-[10px] font-tactical text-zinc-500">OFFER</span>
                    <p className="text-xs text-zinc-300 mt-1">{variant.plan.offer}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                    <span className="text-[10px] font-tactical text-zinc-500">CTA</span>
                    <p className="text-xs text-zinc-300 font-bold mt-1">{variant.plan.cta}</p>
                  </div>

                  {/* Funnel Matrix (P3) */}
                  {variant.plan.funnel && (
                    <>
                      <div className="p-3 rounded-xl bg-cyan-900/10 border border-cyan-500/10 mt-2">
                        <span className="text-[10px] font-tactical text-cyan-400">TOP OF FUNNEL (VIDEO)</span>
                        <p className="text-[11px] font-mono text-zinc-400 mt-1 line-clamp-3">{variant.plan.funnel.top}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-rose-900/10 border border-rose-500/10">
                        <span className="text-[10px] font-tactical text-rose-400">BOTTOM OF FUNNEL</span>
                        <p className="text-[11px] font-mono text-zinc-400 mt-1 line-clamp-2">{variant.plan.funnel.bottom}</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Reasoning Expand */}
                {variant.plan.reasoning && (
                  <>
                    <button
                      onClick={() => setExpandedReasoning(prev => ({ ...prev, [key]: !prev[key] }))}
                      className="flex items-center gap-1.5 text-[11px] text-amber-400/80 hover:text-amber-300 transition-colors font-medium"
                    >
                      <Sparkles className="w-3 h-3" />
                      Strategy Rationale
                      <ChevronRight className={`w-3 h-3 transition-transform ${expandedReasoning[key] ? 'rotate-90' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {expandedReasoning[key] && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-3 rounded-xl bg-black/20 border border-amber-500/10 space-y-2">
                            <p className="text-[11px] text-zinc-400 italic">{variant.plan.reasoning.hook_rationale}</p>
                            <div className="flex items-center gap-2">
                              <Eye className="w-3 h-3 text-indigo-400" />
                              <p className="text-[11px] text-indigo-300">{variant.plan.reasoning.audience_insight}</p>
                            </div>
                            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              variant.plan.reasoning.confidence_score >= 80
                                ? 'bg-green-500/20 text-green-400'
                                : variant.plan.reasoning.confidence_score >= 60
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {variant.plan.reasoning.confidence_score}% confidence
                            </span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}

                {/* Select Button */}
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onSelectVariant(variant)}
                  className={`w-full py-3 rounded-xl bg-gradient-to-r ${config.gradient} border ${config.border} text-white font-bold text-sm flex items-center justify-center gap-2 transition-all ${config.glow.replace('0.15', '0.3')}`}
                >
                  Select This Variant <ChevronRight className="w-4 h-4" />
                </motion.button>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Merge Modal */}
      <AnimatePresence>
        {showMerge && (
          <MergeModal
            variants={variants}
            onMerge={(merged, captions) => {
              onMergeVariants(merged, captions);
              setShowMerge(false);
            }}
            onClose={() => setShowMerge(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

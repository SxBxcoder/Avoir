'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Shield, Eye, Flame, AlertTriangle, Target, Activity, Loader2, X, Globe, RefreshCw } from 'lucide-react';
import { clientLog } from '@/lib/logClient';
import type { CompetitorAd, CompetitorIntel } from '@/lib/db/competitors';

interface CompetitorIntelPanelProps {
  industry: string;
  onClose: () => void;
  onInjectGap: (gap: string) => void;
}

const COUNTRIES = [
  { code: 'ALL', label: 'Global' },
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'IN', label: 'India' },
  { code: 'BR', label: 'Brazil' },
  { code: 'AU', label: 'Australia' },
  { code: 'CA', label: 'Canada' },
];

const PLATFORM_ICONS: Record<string, string> = {
  FACEBOOK: '📘',
  INSTAGRAM: '📸',
  AUDIENCE_NETWORK: '📺',
  MESSENGER: '💬',
  WHATSAPP: '📱',
  THREADS: '🧵',
};

export default function CompetitorIntelPanel({ industry, onClose, onInjectGap }: CompetitorIntelPanelProps) {
  const [intel, setIntel] = useState<CompetitorIntel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [country, setCountry] = useState('ALL');
  const [source, setSource] = useState<string>('mock');

  const getAccessToken = useCallback((): string | null => {
    try {
      const raw = localStorage.getItem('avoir_auth');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.accessToken ?? parsed?.token ?? null;
    } catch {
      return null;
    }
  }, []);

  const fetchIntel = useCallback(async (fresh = false) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ industry, country });
      if (fresh) params.set('fresh', 'true');

      const token = getAccessToken();
      const res = await fetch(`/api/competitors?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.intel) {
          setIntel(data.intel);
          setSource(data.source || 'mock');
        }
      }
    } catch (err) {
      clientLog.error('Failed to fetch competitor intel:', err);
    } finally {
      setIsLoading(false);
    }
  }, [industry, country, getAccessToken]);

  useEffect(() => {
    fetchIntel();
  }, [fetchIntel]);

  const handleRefresh = () => fetchIntel(true);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-border/50 flex items-center justify-between bg-gradient-to-r from-orange-500/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-xl">
              <Eye className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-foreground font-tactical tracking-wider">COMPETITOR INTEL</h2>
                <SourceBadge source={source} cachedUntil={intel?.cachedUntil} />
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Target className="w-4 h-4 text-orange-500/70" />
                Analysis: <span className="text-orange-400 font-mono">{industry.toUpperCase()}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2 hover:bg-muted rounded-xl transition-colors"
              title="Force refresh from Facebook Ad Library"
            >
              <RefreshCw className={`w-4 h-4 text-muted-foreground ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition-colors">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Country Filter */}
        <div className="px-6 py-3 border-b border-border/50 flex items-center gap-2">
          <Globe className="w-4 h-4 text-muted-foreground" />
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="bg-muted/50 border border-border/50 rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
              <p className="text-sm text-muted-foreground font-tactical tracking-wider">
                {source === 'facebook' ? 'QUERYING AD LIBRARY...' : 'ANALYZING AD LIBRARIES...'}
              </p>
            </div>
          ) : !intel ? (
            <div className="text-center py-20 text-muted-foreground">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No competitor data available for this industry.</p>
            </div>
          ) : (
            <>
              {/* Top Ads */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-400" />
                  Top Performing Competitor Ads
                </h3>
                <div className="grid gap-3">
                  {intel.topAds.map((ad) => (
                    <div key={ad.id} className="p-4 rounded-xl border border-border/80 bg-card/30">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {ad.brandLogo ? (
                            <img src={ad.brandLogo} alt={ad.brand} className="w-6 h-6 rounded-full object-cover" />
                          ) : null}
                          <span className="text-sm font-bold text-foreground bg-muted px-2 py-1 rounded-md">{ad.brand}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-mono">
                          {ad.engagementScore != null && (
                            <span className="flex items-center gap-1 bg-orange-500/10 text-orange-400 px-2 py-1 rounded">
                              Score {ad.engagementScore}/100
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-success bg-success/10 px-2 py-1 rounded">
                            <Activity className="w-3 h-3" /> {ad.engagement}
                          </span>
                          <span className="text-muted-foreground bg-muted/50 px-2 py-1 rounded">Run Time: {ad.runTime}</span>
                        </div>
                      </div>
                      {ad.title && <p className="text-xs font-semibold text-foreground mb-1">{ad.title}</p>}
                      <p className="text-sm text-muted-foreground italic border-l-2 border-orange-500/30 pl-3 py-1">&ldquo;{ad.hook}&rdquo;</p>
                      <div className="mt-3 text-xs text-muted-foreground flex items-center gap-3">
                        <span>Format: {ad.detectedFormat}</span>
                        {ad.cta && <span className="text-orange-400 font-mono">CTA: {ad.cta}</span>}
                        {ad.platforms && ad.platforms.length > 0 && (
                          <span className="flex items-center gap-1">
                            {ad.platforms.map((p) => (
                              <span key={p} title={p} className="text-sm">{PLATFORM_ICONS[p] || '📢'}</span>
                            ))}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Market Gaps */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Shield className="w-4 h-4 text-success" />
                  Market Gaps (Opportunities)
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {intel.marketGaps.map((gap, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        onInjectGap(`Position the brand against competitors by focusing on this market gap: "${gap}"`);
                        onClose();
                      }}
                      className="w-full text-left p-3 rounded-xl border border-border bg-card/50 hover:bg-success/10 hover:border-success hover:text-success transition-all text-sm text-muted-foreground group flex justify-between items-center"
                    >
                      <span>{gap}</span>
                      <span className="text-[10px] font-mono text-success/0 group-hover:text-success/70 transition-all uppercase tracking-wider">
                        Inject into Strategy →
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// SOURCE BADGE
// ============================================================================

function SourceBadge({ source, cachedUntil }: { source: string; cachedUntil?: string }) {
  if (source === 'facebook') {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono tracking-widest border border-emerald-500/30">
        LIVE · Facebook Ad Library
      </span>
    );
  }
  if (source === 'cache') {
    const timeLeft = cachedUntil
      ? `${Math.max(0, Math.round((new Date(cachedUntil).getTime() - Date.now()) / (1000 * 60 * 60)))}h left`
      : '';
    return (
      <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono tracking-widest border border-blue-500/30">
        CACHED {timeLeft && `· ${timeLeft}`}
      </span>
    );
  }
  return (
    <span className="text-[10px] px-2 py-0.5 rounded bg-muted/80 text-muted-foreground font-mono tracking-widest border border-border">
      DEMO DATA
    </span>
  );
}

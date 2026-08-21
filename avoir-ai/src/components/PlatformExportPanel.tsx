import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Copy, Check, Facebook, Mail } from 'lucide-react';
interface ExportCampaignProp {
  hook: string;
  offer: string;
  cta: string;
  captions?: string[];
}

interface PlatformExportPanelProps {
  campaign: ExportCampaignProp;
  onClose: () => void;
}

export function PlatformExportPanel({ campaign, onClose }: PlatformExportPanelProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'meta' | 'google'>('meta');

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // --- META ADS LOGIC ---
  // Primary Text: 125 chars recommended, max 255 before truncation. We'll put Hook + Rationale here if it fits.
  // Headline: 27 chars recommended. We'll use a shortened offer.
  // Description: 27 chars recommended. We'll use the CTA.
  
  const metaPrimary = campaign.hook.length > 255 
    ? campaign.hook.substring(0, 252) + '...' 
    : campaign.hook;
  
  const metaHeadline = campaign.offer.length > 40
    ? campaign.offer.substring(0, 37) + '...'
    : campaign.offer;
    
  const metaDescription = campaign.cta.length > 30
    ? campaign.cta.substring(0, 27) + '...'
    : campaign.cta;

  // --- GOOGLE ADS LOGIC ---
  // Headlines: Max 30 chars each.
  // Descriptions: Max 90 chars each.
  const googleHeadline1 = campaign.hook.length > 30
    ? campaign.hook.substring(0, 27) + '...'
    : campaign.hook;
    
  const googleHeadline2 = campaign.offer.length > 30
    ? campaign.offer.substring(0, 27) + '...'
    : campaign.offer;
    
  const googleDescription1 = campaign.hook.length > 90
    ? campaign.hook.substring(0, 87) + '...'
    : campaign.hook;
    
  const googleDescription2 = campaign.offer.length > 90
    ? campaign.offer.substring(0, 87) + '...'
    : campaign.offer;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl bg-card border border-border rounded-2xl overflow-hidden shadow-2xl"
      >
        <div className="p-4 border-b border-border flex items-center justify-between bg-card/50">
          <h2 className="text-lg font-tactical font-bold text-foreground tracking-wide">PLATFORM NATIVE EXPORT</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-border">
          <button 
            onClick={() => setActiveTab('meta')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${activeTab === 'meta' ? 'bg-info/10 text-info border-b-2 border-info' : 'text-muted-foreground hover:text-foreground hover:bg-card'}`}
          >
            <Facebook className="w-4 h-4" /> Meta Ads
          </button>
          <button 
            onClick={() => setActiveTab('google')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${activeTab === 'google' ? 'bg-success/10 text-success border-b-2 border-success' : 'text-muted-foreground hover:text-foreground hover:bg-card'}`}
          >
            <Mail className="w-4 h-4" /> Google Ads
          </button>
        </div>

        <div className="p-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {activeTab === 'meta' && (
            <div className="space-y-5">
              <div className="p-3 bg-info/10 border border-info rounded-lg mb-4">
                <p className="text-xs text-info">Outputs are strictly truncated to Meta's recommended character limits to prevent clipping on mobile feeds.</p>
              </div>
              
              <ExportField 
                label="Primary Text" 
                value={metaPrimary} 
                limit={125} 
                onCopy={() => handleCopy(metaPrimary, 'meta-primary')} 
                isCopied={copiedField === 'meta-primary'} 
              />
              <ExportField 
                label="Headline" 
                value={metaHeadline} 
                limit={27} 
                onCopy={() => handleCopy(metaHeadline, 'meta-headline')} 
                isCopied={copiedField === 'meta-headline'} 
              />
              <ExportField 
                label="Description" 
                value={metaDescription} 
                limit={27} 
                onCopy={() => handleCopy(metaDescription, 'meta-desc')} 
                isCopied={copiedField === 'meta-desc'} 
              />
            </div>
          )}

          {activeTab === 'google' && (
            <div className="space-y-5">
              <div className="p-3 bg-success/10 border border-success rounded-lg mb-4">
                <p className="text-xs text-success">Outputs are strictly truncated to Google's hard character limits (30 for Headlines, 90 for Descriptions).</p>
              </div>

              <ExportField 
                label="Headline 1" 
                value={googleHeadline1} 
                limit={30} 
                onCopy={() => handleCopy(googleHeadline1, 'g-h1')} 
                isCopied={copiedField === 'g-h1'} 
              />
              <ExportField 
                label="Headline 2" 
                value={googleHeadline2} 
                limit={30} 
                onCopy={() => handleCopy(googleHeadline2, 'g-h2')} 
                isCopied={copiedField === 'g-h2'} 
              />
              <ExportField 
                label="Description 1" 
                value={googleDescription1} 
                limit={90} 
                onCopy={() => handleCopy(googleDescription1, 'g-d1')} 
                isCopied={copiedField === 'g-d1'} 
              />
              <ExportField 
                label="Description 2" 
                value={googleDescription2} 
                limit={90} 
                onCopy={() => handleCopy(googleDescription2, 'g-d2')} 
                isCopied={copiedField === 'g-d2'} 
              />
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function ExportField({ label, value, limit, onCopy, isCopied }: { label: string, value: string, limit: number, onCopy: () => void, isCopied: boolean }) {
  const chars = value.length;
  const isOverLimit = chars > limit;
  
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        <span className={`text-[10px] font-mono ${isOverLimit ? 'text-danger' : 'text-muted-foreground'}`}>
          {chars}/{limit}
        </span>
      </div>
      <div className="relative group">
        <div className="w-full bg-card border border-border rounded-lg p-3 text-sm text-foreground pr-12 min-h-[44px]">
          {value}
        </div>
        <button
          onClick={onCopy}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md bg-muted text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
          title="Copy"
        >
          {isCopied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

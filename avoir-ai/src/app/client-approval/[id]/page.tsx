'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';

export default function ClientApprovalPage() {
  const params = useParams();
  const id = params.id as string;
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');

  useEffect(() => {
    fetch(`http://localhost:8000/api/public/campaign/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.campaign) {
          setCampaign(data.campaign);
        } else {
          setError('Campaign not found or expired.');
        }
      })
      .catch(() => setError('Error loading campaign.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
        <p className="text-gray-400">Loading Campaign Proposal...</p>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white selection:bg-indigo-500/30 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* White-label Header (No Avoir branding) */}
        <header className="flex items-center justify-between mb-12 border-b border-white/10 pb-6">
          <h1 className="text-2xl font-light tracking-wide text-gray-200">
            Campaign Proposal <span className="font-bold text-white">Review</span>
          </h1>
          <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-gray-400">
            ID: {id}
          </div>
        </header>

        <main className="space-y-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 rounded-2xl bg-white/5 border border-white/10"
          >
            <h2 className="text-xs font-bold text-indigo-400 tracking-widest mb-2 uppercase">Core Hook</h2>
            <p className="text-2xl md:text-3xl font-medium leading-relaxed mb-8">
              "{campaign.hook}"
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xs font-bold text-gray-500 tracking-widest mb-3 uppercase">Primary Offer</h3>
                <div className="p-4 bg-black/30 rounded-xl border border-white/5 text-gray-300">
                  {campaign.offer}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-bold text-gray-500 tracking-widest mb-3 uppercase">Call to Action</h3>
                <div className="p-4 bg-black/30 rounded-xl border border-white/5 text-gray-300">
                  {campaign.cta}
                </div>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-4"
            >
              <h3 className="text-sm font-bold text-gray-400 tracking-wider">GENERATED CAPTIONS</h3>
              {campaign.captions?.map((caption: string, idx: number) => (
                <div key={idx} className="p-5 rounded-xl bg-white/5 border border-white/10 text-gray-300 leading-relaxed text-sm">
                  {caption}
                </div>
              ))}
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-4"
            >
              <h3 className="text-sm font-bold text-gray-400 tracking-wider">VISUAL ASSET</h3>
              {campaign.image_url ? (
                <div className="rounded-xl overflow-hidden border border-white/10 aspect-square relative">
                  <img src={campaign.image_url} alt="Campaign Asset" className="object-cover w-full h-full" />
                </div>
              ) : (
                <div className="aspect-square rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 text-sm">
                  No image asset provided.
                </div>
              )}
            </motion.div>
          </div>
        </main>

        {/* Approval Actions */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-12 p-6 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col sm:flex-row items-center justify-between gap-6"
        >
          <div>
            <h3 className="font-bold text-white mb-1">Approval Required</h3>
            <p className="text-sm text-gray-400">Please review the assets above and provide your decision.</p>
          </div>
          
          <div className="flex w-full sm:w-auto gap-4">
            {status === 'PENDING' ? (
              <>
                <button 
                  onClick={() => setStatus('REJECTED')}
                  className="flex-1 sm:flex-none px-6 py-3 rounded-xl border border-red-500/30 text-red-400 font-medium hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2"
                >
                  <XCircle className="w-5 h-5" /> Request Changes
                </button>
                <button 
                  onClick={() => setStatus('APPROVED')}
                  className="flex-1 sm:flex-none px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" /> Approve Campaign
                </button>
              </>
            ) : status === 'APPROVED' ? (
              <div className="px-6 py-3 rounded-xl bg-green-500/20 text-green-400 font-bold flex items-center gap-2 border border-green-500/30">
                <CheckCircle2 className="w-5 h-5" /> Approved
              </div>
            ) : (
              <div className="px-6 py-3 rounded-xl bg-red-500/20 text-red-400 font-bold flex items-center gap-2 border border-red-500/30">
                <XCircle className="w-5 h-5" /> Changes Requested
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, Send, Bot, User } from 'lucide-react';
import { useParams } from 'next/navigation';
import { clientLog } from '@/lib/logClient';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function ClientApprovalPage() {
  const params = useParams();
  const id = params.id as string;
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'PENDING' | 'APPROVED' | 'REVISING'>('PENDING');
  
  const [comment, setComment] = useState('');
  const [thread, setThread] = useState<any[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    fetch(`${apiUrl}/api/public/campaign/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.campaign) {
          setCampaign(data.campaign);
          if (data.campaign.thread) {
            setThread(data.campaign.thread);
          }
        } else {
          setError('Campaign not found or expired.');
        }
      })
      .catch(() => setError('Error loading campaign.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    // Scroll to bottom of chat when thread updates
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread]);

  const handleApprove = () => {
    setStatus('APPROVED');
    // We could hit an endpoint here to mark as approved in the DB
  };

  const handleRevise = async () => {
    if (!comment.trim()) return;
    
    const userMessage = comment;
    setComment('');
    
    // Optimistically update thread
    setThread(prev => [...prev, { sender: 'client', text: userMessage, timestamp: Date.now() }]);
    setStatus('REVISING');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/campaigns/revise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          link_id: id,
          client_comment: userMessage
        })
      });
      const data = await res.json();
      if (data.campaign) {
        setCampaign(data.campaign);
        if (data.campaign.thread) {
          setThread(data.campaign.thread);
        }
      }
    } catch (err) {
      clientLog.error('Failed to revise', err);
    } finally {
      setStatus('PENDING');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
        <p className="text-muted-foreground">Loading Campaign Proposal...</p>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-indigo-500/30 flex flex-col lg:flex-row">
      
      {/* Left Panel: The Campaign */}
      <div className="flex-1 p-6 md:p-12 overflow-y-auto">
        <header className="flex items-center justify-between mb-8 border-b border-border pb-6">
          <h1 className="text-2xl font-light tracking-wide text-muted-foreground">
            Campaign Proposal <span className="font-bold text-foreground">Review</span>
          </h1>
          <div className="flex items-center gap-4">
            <div className="px-4 py-1.5 rounded-full bg-white/5 border border-border text-sm text-zinc-500 dark:text-muted-foreground">
              ID: {id}
            </div>
            <ThemeToggle />
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div 
            key={campaign.hook} // Animate on change
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            <div className="p-8 rounded-2xl bg-muted/30 border border-border relative overflow-hidden">
              {status === 'REVISING' && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
                  <Loader2 className="w-10 h-10 animate-spin text-indigo-400 mb-4" />
                  <p className="text-lg font-medium text-indigo-200">Avoir AI is rewriting the campaign...</p>
                </div>
              )}
              
              <h2 className="text-xs font-bold text-indigo-400 tracking-widest mb-2 uppercase">Core Hook</h2>
              <p className="text-2xl md:text-3xl font-medium leading-relaxed mb-8">
                "{campaign.hook}"
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xs font-bold text-muted-foreground tracking-widest mb-3 uppercase">Primary Offer</h3>
                  <div className="p-4 bg-muted/50 rounded-xl border border-border text-foreground/80">
                    {campaign.offer}
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-muted-foreground tracking-widest mb-3 uppercase">Call to Action</h3>
                  <div className="p-4 bg-muted/50 rounded-xl border border-border text-foreground/80">
                    {campaign.cta}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-muted-foreground tracking-wider">GENERATED CAPTIONS</h3>
                {campaign.captions?.map((cap: string, idx: number) => (
                  <div key={idx} className="p-5 rounded-xl bg-muted/30 border border-border text-foreground/80 leading-relaxed text-sm">
                    {cap}
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-muted-foreground tracking-wider">VISUAL ASSET</h3>
                {campaign.image_url ? (
                  <div className="rounded-xl overflow-hidden border border-border aspect-square relative">
                    <img src={campaign.image_url} alt="Campaign Asset" className="object-cover w-full h-full" />
                  </div>
                ) : (
                  <div className="aspect-square rounded-xl bg-muted/30 border border-border flex items-center justify-center text-muted-foreground text-sm">
                    No image asset provided.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {status === 'APPROVED' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-12 p-8 rounded-2xl bg-green-500/10 border border-green-500/30 text-center"
          >
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-foreground mb-2">Campaign Approved!</h3>
            <p className="text-green-600 dark:text-green-300/80">The agency has been notified and the campaign is ready to deploy.</p>
          </motion.div>
        )}
      </div>

      {/* Right Panel: Collaboration & Chat */}
      <div className="w-full lg:w-[400px] border-l border-white/10 bg-black/50 flex flex-col h-screen">
        <div className="p-6 border-b border-white/10 bg-white/5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-400" /> Autonomous Agent
          </h2>
          <p className="text-xs text-gray-400 mt-1">Leave feedback, and I will rewrite the campaign instantly.</p>
        </div>
        
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {thread.length === 0 ? (
            <div className="text-center text-gray-500 text-sm mt-10">
              No feedback yet. What do you think of this proposal?
            </div>
          ) : (
            thread.map((msg, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.sender === 'client' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.sender === 'client' ? 'bg-indigo-600' : 'bg-zinc-800 border border-zinc-700'}`}>
                  {msg.sender === 'client' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-indigo-400" />}
                </div>
                <div className={`p-4 rounded-2xl max-w-[85%] text-sm leading-relaxed ${msg.sender === 'client' ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-100 rounded-tr-none' : 'bg-zinc-900 border border-zinc-800 text-gray-300 rounded-tl-none'}`}>
                  {msg.text}
                </div>
              </motion.div>
            ))
          )}
          {status === 'REVISING' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3"
            >
               <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-indigo-400" />
               </div>
               <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-gray-400 rounded-tl-none flex items-center gap-2">
                 <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> Working on revisions...
               </div>
            </motion.div>
          )}
          <div ref={chatEndRef} />
        </div>

        {status !== 'APPROVED' && (
          <div className="p-6 border-t border-white/10 bg-zinc-950 space-y-4">
            <div className="relative">
              <textarea 
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleRevise();
                  }
                }}
                placeholder="Request changes (e.g. 'Make it more Gen-Z')..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 pr-12 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none h-[100px]"
                disabled={status === 'REVISING'}
              />
              <button 
                onClick={handleRevise}
                disabled={status === 'REVISING' || !comment.trim()}
                className="absolute bottom-4 right-4 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-lg text-white transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <button 
              onClick={handleApprove}
              disabled={status === 'REVISING'}
              className="w-full py-4 rounded-xl bg-white text-black font-bold hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" /> Approve Campaign
            </button>
          </div>
        )}
      </div>

    </div>
  );
}

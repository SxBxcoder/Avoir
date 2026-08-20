'use client';

import { motion } from 'framer-motion';
import { Rocket, TrendingUp, Target, Flame, Sparkles } from 'lucide-react';
import NeuralNetworkCanvas from '../NeuralNetworkCanvas';
import { bouncySpring, smoothSpring, staggerContainer, staggerItem } from './configs';

const quickActions = [
  { icon: <Rocket className="w-4 h-4" />, label: 'Product Launch', prompt: 'Create a viral campaign for my new product launch targeting global Gen-Z', color: 'from-indigo-500/20 to-purple-500/20', border: 'border-info', iconColor: 'text-info' },
  { icon: <TrendingUp className="w-4 h-4" />, label: 'Brand Awareness', prompt: 'Generate a high-converting brand awareness campaign for Instagram and YouTube', color: 'from-purple-500/20 to-pink-500/20', border: 'border-primary', iconColor: 'text-primary' },
  { icon: <Target className="w-4 h-4" />, label: 'Event Promotion', prompt: 'Create a social media campaign to promote my upcoming event in New York', color: 'from-cyan-500/20 to-blue-500/20', border: 'border-cyan', iconColor: 'text-cyan' },
  { icon: <Flame className="w-4 h-4" />, label: 'Viral Content', prompt: 'Generate viral meme-worthy captions for my streetwear brand', color: 'from-orange-500/20 to-red-500/20', border: 'border-orange-500/20', iconColor: 'text-orange-400' },
];

export function WelcomeScreen({ onQuickAction }: { onQuickAction: (text: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="absolute inset-0 flex flex-col items-center justify-center px-4 sm:px-6 overflow-auto"
    >
      <NeuralNetworkCanvas />

      <div className="relative z-10 flex flex-col items-center w-full max-w-4xl">
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={bouncySpring}
          className="mb-8"
        >
          <motion.div
            animate={{
              boxShadow: [
                '0 0 20px rgba(99,102,241,0.1)',
                '0 0 40px rgba(99,102,241,0.2)',
                '0 0 20px rgba(99,102,241,0.1)',
              ]
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-info flex items-center justify-center"
          >
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Sparkles className="w-10 h-10 text-info" />
            </motion.div>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...smoothSpring, delay: 0.2 }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-3">
            What would you like to{' '}
            <span className="fluid-text-hero">create?</span>
          </h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Enter your campaign goal below or pick a quick action to get started
          </p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg"
        >
          {quickActions.map((action) => (
            <motion.button
              key={action.label}
              variants={staggerItem}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onQuickAction(action.prompt)}
              className={`group glass-card glow-border rounded-xl p-4 text-left cursor-pointer transition-all hover:border-border`}
            >
              <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${action.color} flex items-center justify-center mb-3 border ${action.border} ${action.iconColor}`}>
                {action.icon}
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">{action.label}</p>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{action.prompt}</p>
            </motion.button>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}

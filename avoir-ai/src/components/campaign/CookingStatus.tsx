'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { bouncySpring, gentleSpring } from './configs';

export function CookingStatus({ messages }: { messages: string[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={bouncySpring}
      className="flex justify-start"
    >
      <div className="max-w-[90%] sm:max-w-[85%] lg:max-w-[70%] rounded-2xl p-4 sm:p-5 glass-card glow-border-active overflow-hidden">
        <div className="flex items-center gap-3 mb-4">
          <div className="pulse-ring relative w-3 h-3 rounded-full bg-info flex-shrink-0" />
          <span className="text-sm font-tactical tracking-widest text-info font-bold">
            DIAMOND CASCADE ACTIVE
          </span>
        </div>

        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {messages.map((msg, idx) => (
              <motion.div
                key={`${idx}-${msg}`}
                initial={{ opacity: 0, x: -20, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                transition={{ ...gentleSpring, delay: idx * 0.05 }}
                className="flex items-center gap-2"
              >
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={bouncySpring}
                  className={`text-xs ${idx === messages.length - 1 ? 'text-info' : 'text-zinc-600'}`}
                >
                  {msg}
                </motion.span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="cooking-loader mt-4">
          <div className="cooking-dots">
            <span /><span /><span />
          </div>
          <span className="text-xs font-tactical text-muted-foreground">Processing...</span>
        </div>
      </div>
    </motion.div>
  );
}

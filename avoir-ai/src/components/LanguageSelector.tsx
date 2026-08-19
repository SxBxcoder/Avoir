'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, ChevronDown } from 'lucide-react';

interface Language {
  code: string;
  name: string;
  native_name: string;
  flag: string;
}

interface LanguageSelectorProps {
  value: string;
  onChange: (code: string) => void;
}

export default function LanguageSelector({ value, onChange }: LanguageSelectorProps) {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('avoir_language');
    if (stored && !value) {
      onChange(stored);
    }

    fetch('/api/languages')
      .then(r => r.json())
      .then(data => setLanguages(data.languages || []))
      .catch(() => {
        setLanguages([
          { code: 'en', name: 'English', native_name: 'English', flag: '🇺🇸' },
          { code: 'hi', name: 'Hindi', native_name: 'हिन्दी', flag: '🇮🇳' },
          { code: 'hi-en', name: 'Hinglish', native_name: 'Hinglish', flag: '🇮🇳' },
          { code: 'es', name: 'Spanish', native_name: 'Español', flag: '🇪🇸' },
          { code: 'pt', name: 'Portuguese', native_name: 'Português', flag: '🇧🇷' },
          { code: 'fr', name: 'French', native_name: 'Français', flag: '🇫🇷' },
          { code: 'ta', name: 'Tamil', native_name: 'தமிழ்', flag: '🇮🇳' },
          { code: 'bn', name: 'Bengali', native_name: 'বাংলা', flag: '🇧🇩' },
        ]);
      });
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selected = languages.find(l => l.code === value) || languages[0];

  const handleSelect = (code: string) => {
    onChange(code);
    localStorage.setItem('avoir_language', code);
    setIsOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card/50 hover:border-danger transition-colors text-sm"
      >
        <Globe className="w-4 h-4 text-muted-foreground" />
        <span className="text-muted-foreground">
          {selected?.flag} {selected?.native_name || 'English'}
        </span>
        <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full mt-1 left-0 z-50 w-52 bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
          >
            {languages.map(lang => (
              <button
                key={lang.code}
                onClick={() => handleSelect(lang.code)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted transition-colors ${
                  lang.code === value ? 'bg-danger/10 text-danger' : 'text-muted-foreground'
                }`}
              >
                <span className="text-base">{lang.flag}</span>
                <div>
                  <div className="text-sm font-medium">{lang.native_name}</div>
                  <div className="text-[10px] text-muted-foreground">{lang.name}</div>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

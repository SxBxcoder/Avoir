'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Menu,
  User,
  Settings,
  LogOut,
  ChevronDown,
  CreditCard,
  Shield,
} from 'lucide-react';

interface DashboardTopbarProps {
  userEmail: string;
  onLogout: () => void;
  onToggleMobileSidebar: () => void;
}

export default function DashboardTopbar({
  userEmail,
  onLogout,
  onToggleMobileSidebar,
}: DashboardTopbarProps) {
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const initials = userEmail
    ? userEmail.split('@')[0].slice(0, 2).toUpperCase()
    : '??';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const menuItems = [
    { label: 'Profile', icon: User, href: '/dashboard/settings?tab=profile' },
    { label: 'Account & Security', icon: Shield, href: '/dashboard/settings?tab=security' },
    { label: 'Billing', icon: CreditCard, href: '/pricing' },
    { label: 'Settings', icon: Settings, href: '/dashboard/settings' },
  ];

  return (
    <header className="h-14 flex items-center justify-between px-4 lg:px-6 border-b border-zinc-800/50 bg-zinc-950/60 backdrop-blur-xl flex-shrink-0">
      {/* Left: Mobile menu + breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileSidebar}
          className="lg:hidden p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden sm:flex items-center gap-2 text-sm">
          <span className="text-zinc-500 font-tactical text-xs tracking-wider">AVOIR</span>
          <span className="text-zinc-700">/</span>
          <span className="text-zinc-300 font-medium">Dashboard</span>
        </div>
      </div>

      {/* Right: Profile dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-zinc-800/50 transition-all group"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
            {initials}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-medium text-zinc-200 leading-tight truncate max-w-[140px]">
              {userEmail.split('@')[0]}
            </p>
            <p className="text-[10px] text-zinc-500 leading-tight">
              @{userEmail.split('@')[1]}
            </p>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {dropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl shadow-black/50 overflow-hidden z-50"
            >
              {/* User info header */}
              <div className="px-4 py-3 border-b border-zinc-800/50">
                <p className="text-sm font-medium text-white truncate">{userEmail}</p>
                <p className="text-xs text-zinc-500 mt-0.5">Manage your account</p>
              </div>

              {/* Menu items */}
              <div className="p-1.5">
                {menuItems.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      router.push(item.href);
                      setDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                  >
                    <item.icon className="w-4 h-4 text-zinc-500" />
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Logout */}
              <div className="p-1.5 border-t border-zinc-800/50">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    onLogout();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-red-400 hover:bg-red-500/5 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}

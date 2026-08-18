'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Megaphone,
  Server,
  CreditCard,
  Settings,
  LogOut,
  ChevronLeft,
  Flame,
  Zap,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Overview', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Campaigns', icon: Megaphone, href: '/dashboard/campaigns' },
  { label: 'OmniDeck', icon: Server, href: '/omnideck' },
  { label: 'Pricing', icon: CreditCard, href: '/pricing' },
  { label: 'Settings', icon: Settings, href: '/dashboard/settings' },
];

interface DashboardSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onLogout: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function DashboardSidebar({
  collapsed,
  onToggle,
  onLogout,
  mobileOpen,
  onMobileClose,
}: DashboardSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleNavigate = (href: string) => {
    router.push(href);
    onMobileClose();
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 flex items-center justify-between border-b border-zinc-800/50">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex items-center gap-2.5"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Flame className="w-4 h-4 text-indigo-400" />
              </div>
              <span className="text-sm font-tactical font-bold text-white tracking-wider">
                AVOIR
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={onToggle}
          className="hidden lg:flex p-1.5 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
        >
          <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
            <ChevronLeft className="w-4 h-4" />
          </motion.div>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <button
              key={item.href}
              onClick={() => handleNavigate(item.href)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative ${
                active
                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50 border border-transparent'
              }`}
              title={collapsed ? item.label : undefined}
            >
              {active && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-indigo-500 rounded-r-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <item.icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-indigo-400' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
              {!collapsed && (
                <span className="whitespace-nowrap">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-zinc-800/50">
        {!collapsed && (
          <div className="px-3 py-2 mb-2 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
            <div className="flex items-center gap-2">
              <Zap className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] font-tactical text-zinc-500 tracking-widest">AVOIR AI</span>
            </div>
            <p className="text-[10px] text-zinc-600 mt-1">Quantitative Marketing Engine</p>
          </div>
        )}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-red-400 hover:bg-red-500/5 transition-all border border-transparent hover:border-red-500/20"
          title={collapsed ? 'Sign Out' : undefined}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 240 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="hidden lg:flex flex-col fixed inset-y-0 left-0 z-40 bg-zinc-950/80 backdrop-blur-2xl border-r border-zinc-800/50 overflow-hidden"
      >
        {sidebarContent}
      </motion.aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 z-40 lg:hidden"
              onClick={onMobileClose}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 z-50 w-[260px] bg-zinc-950 border-r border-zinc-800/50 lg:hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

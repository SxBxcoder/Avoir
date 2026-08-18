'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { RequireAuth } from '@/components/auth/guards';
import { useAuth } from '@/lib/auth/provider';
import DashboardSidebar from '@/components/dashboard/Sidebar';
import DashboardTopbar from '@/components/dashboard/Topbar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { email, logout } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <RequireAuth>
      <div className="min-h-screen bg-black flex">
        {/* Sidebar */}
        <DashboardSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          onLogout={handleLogout}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />

        {/* Main content area */}
        <motion.div
          animate={{ marginLeft: sidebarCollapsed ? 72 : 240 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="flex-1 flex flex-col min-h-screen overflow-hidden max-lg:!ml-0"
        >
          <DashboardTopbar
            userEmail={email || ''}
            onLogout={handleLogout}
            onToggleMobileSidebar={() => setMobileOpen(!mobileOpen)}
          />

          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </motion.div>
      </div>
    </RequireAuth>
  );
}

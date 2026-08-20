'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  User,
  Mail,
  Phone,
  Shield,
  Bell,
  BellOff,
  Check,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Palette,
  Globe,
  Save,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/provider';
import type { AuthUser } from '@/lib/auth/types';

const springSmooth = { type: 'spring' as const, stiffness: 100, damping: 30 };
const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: springSmooth },
};

type Tab = 'profile' | 'security' | 'notifications' | 'preferences';
const VALID_TABS: Tab[] = ['profile', 'security', 'notifications', 'preferences'];

const TABS: { id: Tab; label: string; icon: typeof User }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security & Verification', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'preferences', label: 'Preferences', icon: Palette },
];

function readTabParam(raw: string | null): Tab {
  if (raw && VALID_TABS.includes(raw as Tab)) return raw as Tab;
  return 'profile';
}

export default function SettingsPage() {
  const { email, user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>(() => readTabParam(searchParams.get('tab')));
  const [saved, setSaved] = useState(false);

  const initials = email ? email.split('@')[0].slice(0, 2).toUpperCase() : '??';

  const switchTab = useCallback(
    (tab: Tab) => {
      setActiveTab(tab);
      const params = new URLSearchParams(window.location.search);
      params.set('tab', tab);
      router.replace(`/dashboard/settings?${params.toString()}`, { scroll: false });
    },
    [router],
  );

  useEffect(() => {
    if (saved) {
      const t = setTimeout(() => setSaved(false), 2000);
      return () => clearTimeout(t);
    }
  }, [saved]);

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <motion.div variants={stagger} initial="hidden" animate="show">
        {/* Header */}
        <motion.div variants={staggerItem} className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your account, security, and preferences</p>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Tab Navigation */}
          <motion.div variants={staggerItem} className="lg:w-56 flex-shrink-0">
            <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => switchTab(tab.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? 'bg-info/10 text-info border border-info/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </motion.div>

          {/* Content */}
          <motion.div variants={staggerItem} className="flex-1 min-w-0">
            {activeTab === 'profile' && (
              <ProfileTab email={email} user={user} initials={initials} onSave={() => setSaved(true)} saved={saved} />
            )}
            {activeTab === 'security' && (
              <SecurityTab email={email} />
            )}
            {activeTab === 'notifications' && (
              <NotificationsTab />
            )}
            {activeTab === 'preferences' && (
              <PreferencesTab />
            )}
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================================
// PROFILE TAB
// ============================================================================
function ProfileTab({ email, user, initials, onSave, saved }: {
  email: string | null;
  user: AuthUser | null;
  initials: string;
  onSave: () => void;
  saved: boolean;
}) {
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [memberSince, setMemberSince] = useState<string>('');

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('avoir_display_name') : null;
    setDisplayName(stored || user?.username || email?.split('@')[0] || '');
  }, [user, email]);

  useEffect(() => {
    async function fetchMemberSince() {
      try {
        const res = await fetch('/api/user/profile');
        if (res.ok) {
          const data = await res.json();
          if (data.createdAt) {
            setMemberSince(new Date(data.createdAt).getFullYear().toString());
            return;
          }
        }
      } catch {
        // fall through
      }
      // Fallback: show current year
      setMemberSince(new Date().getFullYear().toString());
    }
    fetchMemberSince();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    localStorage.setItem('avoir_display_name', displayName);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    onSave();
  };

  return (
    <div className="space-y-6">
      {/* Avatar + Name */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-sm font-tactical font-bold text-muted-foreground tracking-widest mb-4">PROFILE</h3>
        <div className="flex items-center gap-5 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-foreground text-xl font-bold shadow-lg shadow-indigo-500/20">
            {initials}
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">{displayName}</p>
            <p className="text-sm text-muted-foreground">{email || 'No email'}</p>
            <p className="text-xs text-muted-foreground font-tactical mt-1">ID: {user?.userId?.slice(0, 16) || 'N/A'}...</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
              placeholder="Your display name"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email Address</label>
            <input
              type="email"
              value={email || ''}
              disabled
              className="w-full px-4 py-2.5 rounded-xl bg-card/50 border border-border/50 text-sm text-muted-foreground cursor-not-allowed"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Email is managed through your authentication provider</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl btn-primary text-sm font-medium disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <Check className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save Changes'}
        </button>
      </div>

      {/* Subscription Info */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-sm font-tactical font-bold text-muted-foreground tracking-widest mb-4">SUBSCRIPTION</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-card/50 border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">Plan</p>
            <p className="text-lg font-bold text-foreground">Free Tier</p>
            <p className="text-[10px] text-muted-foreground mt-1">10 trial credits included</p>
          </div>
          <div className="p-4 rounded-xl bg-card/50 border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">Status</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <p className="text-lg font-bold text-foreground">Active</p>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-card/50 border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">Member Since</p>
            <p className="text-lg font-bold text-foreground">{memberSince || '—'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SECURITY TAB
// ============================================================================
function SecurityTab({ email }: { email: string | null }) {
  const [phone, setPhone] = useState('');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  return (
    <div className="space-y-6">
      {/* Email Verification */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-sm font-tactical font-bold text-muted-foreground tracking-widest mb-4">EMAIL VERIFICATION</h3>
        <div className="flex items-center justify-between p-4 rounded-xl bg-card/50 border border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <Mail className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{email || 'No email'}</p>
              <p className="text-xs text-muted-foreground">Primary email address</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
            <Check className="w-3.5 h-3.5 text-green-400" />
            <span className="text-xs font-medium text-green-400">Verified</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">Email verification is handled through your authentication provider (AWS Cognito).</p>
      </div>

      {/* Phone Verification */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-sm font-tactical font-bold text-muted-foreground tracking-widest mb-4">PHONE VERIFICATION</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-card/50 border border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Phone className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{phone || 'No phone number added'}</p>
                <p className="text-xs text-muted-foreground">Used for two-factor authentication</p>
              </div>
            </div>
            {phone ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
                <Check className="w-3.5 h-3.5 text-green-400" />
                <span className="text-xs font-medium text-green-400">Verified</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted border border-border">
                <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Not Set</span>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="flex-1 px-4 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
            />
            <button className="px-5 py-2.5 rounded-xl btn-primary text-sm font-medium">
              Verify Phone
            </button>
          </div>
        </div>
      </div>

      {/* Password */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-sm font-tactical font-bold text-muted-foreground tracking-widest mb-4">PASSWORD</h3>
        {!showChangePassword ? (
          <button
            onClick={() => setShowChangePassword(true)}
            className="px-5 py-2.5 rounded-xl btn-ghost text-sm font-medium"
          >
            Change Password
          </button>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPw ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2.5 pr-10 rounded-xl bg-card border border-border text-sm text-foreground placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">New Password</label>
              <div className="relative">
                <input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 pr-10 rounded-xl bg-card border border-border text-sm text-foreground placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Min 8 chars, uppercase, lowercase, number, and special character</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowChangePassword(false);
                  setCurrentPassword('');
                  setNewPassword('');
                }}
                className="px-4 py-2 rounded-xl btn-ghost text-sm font-medium"
              >
                Cancel
              </button>
              <button className="px-5 py-2 rounded-xl btn-primary text-sm font-medium">
                Update Password
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// NOTIFICATIONS TAB
// ============================================================================
function NotificationsTab() {
  const [prefs, setPrefs] = useState(() => {
    if (typeof window === 'undefined') {
      return { emailNotifs: true, campaignUpdates: true, weeklyDigest: false, marketing: false };
    }
    try {
      const stored = localStorage.getItem('avoir_notifications');
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return { emailNotifs: true, campaignUpdates: true, weeklyDigest: false, marketing: false };
  });

  const update = (key: keyof typeof prefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    localStorage.setItem('avoir_notifications', JSON.stringify(next));
  };

  return (
    <div className="space-y-6">
      <PushNotificationsSection />

      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-sm font-tactical font-bold text-muted-foreground tracking-widest mb-4">NOTIFICATION PREFERENCES</h3>
        <div className="space-y-4">
          {[
            { label: 'Email Notifications', description: 'Receive updates about your account via email', key: 'emailNotifs' as const },
            { label: 'Campaign Updates', description: 'Get notified when campaigns complete or fail', key: 'campaignUpdates' as const },
            { label: 'Weekly Digest', description: 'Summary of your campaign performance each week', key: 'weeklyDigest' as const },
            { label: 'Marketing Emails', description: 'Product updates, tips, and promotional content', key: 'marketing' as const },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between p-4 rounded-xl bg-card/50 border border-border/50">
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
              </div>
              <Toggle enabled={prefs[item.key]} onToggle={() => update(item.key)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PUSH NOTIFICATIONS SECTION
// ============================================================================
function PushNotificationsSection() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setIsLoading(false);
      return;
    }
    setSupported(true);
    setPermission(Notification.permission);

    // Check server-side subscription status
    fetch('/api/push/status')
      .then((r) => r.json())
      .then((data) => {
        setIsSubscribed(data.subscribed || false);
      })
      .catch(() => { /* ignore */ })
      .finally(() => setIsLoading(false));
  }, []);

  const handleToggle = async () => {
    if (isToggling) return;
    setIsToggling(true);

    try {
      if (isSubscribed) {
        // Unsubscribe
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ all: true }),
        });
        setIsSubscribed(false);
      } else {
        // Request permission then subscribe
        const result = await Notification.requestPermission();
        setPermission(result);

        if (result === 'granted') {
          // Register SW and subscribe
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(
              process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
            ),
          });

          await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.toJSON().keys?.p256dh || '',
                auth: sub.toJSON().keys?.auth || '',
              },
            }),
          });

          setIsSubscribed(true);
        }
      }
    } catch {
      // Push toggle failed — user will see the toggle remain in its previous state
    } finally {
      setIsToggling(false);
    }
  };

  if (!supported) return null;

  const isGranted = permission === 'granted';
  const isBlocked = permission === 'denied';

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-xl ${isSubscribed ? 'bg-emerald-500/10' : 'bg-zinc-500/10'}`}>
          {isSubscribed ? <Bell className="w-5 h-5 text-emerald-400" /> : <BellOff className="w-5 h-5 text-zinc-400" />}
        </div>
        <div>
          <h3 className="text-sm font-tactical font-bold text-muted-foreground tracking-widest">PUSH NOTIFICATIONS</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Real-time alerts for campaigns, team updates, and more</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading notification status...
        </div>
      ) : isBlocked ? (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-400">Notifications blocked</p>
            <p className="text-xs text-red-400/70 mt-0.5">
              Enable notifications in your browser settings to receive push alerts.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between p-4 rounded-xl bg-card/50 border border-border/50">
          <div>
            <p className="text-sm font-medium text-foreground">
              {isSubscribed ? 'Push notifications enabled' : 'Push notifications disabled'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isSubscribed
                ? 'You will receive push alerts for campaign updates and team activity'
                : 'Turn on to get real-time push alerts'}
            </p>
          </div>
          <button
            onClick={handleToggle}
            disabled={isToggling}
            className={`relative w-10 rounded-full transition-colors ${isSubscribed ? 'bg-indigo-500' : 'bg-zinc-700'}`}
            style={{ height: 22 }}
          >
            {isToggling ? (
              <Loader2 className="w-4 h-4 animate-spin text-white absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
            ) : (
              <motion.div
                animate={{ x: isSubscribed ? 20 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-sm"
              />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-10 rounded-full transition-colors ${enabled ? 'bg-indigo-500' : 'bg-zinc-700'}`}
      style={{ height: 22 }}
    >
      <motion.div
        animate={{ x: enabled ? 20 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-sm"
      />
    </button>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ============================================================================
// PREFERENCES TAB
// ============================================================================
function PreferencesTab() {
  const [language, setLanguage] = useState('en');
  const [theme, setTheme] = useState('dark');
  const [languages, setLanguages] = useState([
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'Hindi' },
    { code: 'hi-en', label: 'Hinglish' },
    { code: 'es', label: 'Spanish' },
  ]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('avoir_preferences');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.language) setLanguage(parsed.language);
        if (parsed.theme) setTheme(parsed.theme);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetch('/api/languages')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setLanguages(data);
        }
      })
      .catch(() => {
        // Keep the hardcoded fallback list
      });
  }, []);

  const setLang = (code: string) => {
    setLanguage(code);
    const stored = (() => { try { return JSON.parse(localStorage.getItem('avoir_preferences') || '{}'); } catch { return {}; } })();
    localStorage.setItem('avoir_preferences', JSON.stringify({ ...stored, language: code }));
  };

  const setThemeVal = (id: string) => {
    setTheme(id);
    const stored = (() => { try { return JSON.parse(localStorage.getItem('avoir_preferences') || '{}'); } catch { return {}; } })();
    localStorage.setItem('avoir_preferences', JSON.stringify({ ...stored, theme: id }));
  };

  const themes = [
    { id: 'dark', label: 'Dark', color: 'bg-card' },
    { id: 'midnight', label: 'Midnight', color: 'bg-black' },
  ];

  return (
    <div className="space-y-6">
      {/* Language */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-sm font-tactical font-bold text-muted-foreground tracking-widest mb-4">LANGUAGE</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setLang(lang.code)}
              className={`p-3 rounded-xl text-sm font-medium transition-all border ${
                language === lang.code
                  ? 'bg-info/10 text-info border-indigo-500/30'
                  : 'bg-card/50 text-muted-foreground border-border/50 hover:border-border'
              }`}
            >
              <div className="flex items-center gap-2">
                {language === lang.code && <Check className="w-3.5 h-3.5" />}
                {lang.label}
              </div>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">This controls the language of AI-generated campaigns</p>
      </div>

      {/* Theme */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-sm font-tactical font-bold text-muted-foreground tracking-widest mb-4">THEME</h3>
        <div className="flex gap-3">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => setThemeVal(t.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                theme === t.id
                  ? 'bg-info/10 text-info border-indigo-500/30'
                  : 'bg-card/50 text-muted-foreground border-border/50 hover:border-border'
              }`}
            >
              <div className={`w-5 h-5 rounded-md ${t.color} border border-border`} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timezone */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-sm font-tactical font-bold text-muted-foreground tracking-widest mb-4">TIMEZONE</h3>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-card/50 border border-border/50">
          <Globe className="w-5 h-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">UTC (Coordinated Universal Time)</p>
            <p className="text-xs text-muted-foreground">Used for scheduling and analytics timestamps</p>
          </div>
        </div>
      </div>
    </div>
  );
}

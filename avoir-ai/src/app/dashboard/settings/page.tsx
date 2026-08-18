'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Mail,
  Phone,
  Shield,
  Bell,
  CreditCard,
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

const TABS: { id: Tab; label: string; icon: typeof User }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security & Verification', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'preferences', label: 'Preferences', icon: Palette },
];

export default function SettingsPage() {
  const { email, user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [saved, setSaved] = useState(false);

  const initials = email ? email.split('@')[0].slice(0, 2).toUpperCase() : '??';

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
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage your account, security, and preferences</p>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Tab Navigation */}
          <motion.div variants={staggerItem} className="lg:w-56 flex-shrink-0">
            <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50 border border-transparent'
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
  user: any;
  initials: string;
  onSave: () => void;
  saved: boolean;
}) {
  const [displayName, setDisplayName] = useState(user?.username || email?.split('@')[0] || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    onSave();
  };

  return (
    <div className="space-y-6">
      {/* Avatar + Name */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-sm font-tactical font-bold text-zinc-500 tracking-widest mb-4">PROFILE</h3>
        <div className="flex items-center gap-5 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-indigo-500/20">
            {initials}
          </div>
          <div>
            <p className="text-lg font-semibold text-white">{displayName}</p>
            <p className="text-sm text-zinc-500">{email || 'No email'}</p>
            <p className="text-xs text-zinc-600 font-tactical mt-1">ID: {user?.userId?.slice(0, 16) || 'N/A'}...</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
              placeholder="Your display name"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email Address</label>
            <input
              type="email"
              value={email || ''}
              disabled
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800/50 text-sm text-zinc-500 cursor-not-allowed"
            />
            <p className="text-[10px] text-zinc-600 mt-1">Email is managed through your authentication provider</p>
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
        <h3 className="text-sm font-tactical font-bold text-zinc-500 tracking-widest mb-4">SUBSCRIPTION</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
            <p className="text-xs text-zinc-500 mb-1">Plan</p>
            <p className="text-lg font-bold text-white">Free Tier</p>
            <p className="text-[10px] text-zinc-600 mt-1">10 trial credits included</p>
          </div>
          <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
            <p className="text-xs text-zinc-500 mb-1">Status</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <p className="text-lg font-bold text-white">Active</p>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
            <p className="text-xs text-zinc-500 mb-1">Member Since</p>
            <p className="text-lg font-bold text-white">2024</p>
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
        <h3 className="text-sm font-tactical font-bold text-zinc-500 tracking-widest mb-4">EMAIL VERIFICATION</h3>
        <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <Mail className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">{email || 'No email'}</p>
              <p className="text-xs text-zinc-500">Primary email address</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
            <Check className="w-3.5 h-3.5 text-green-400" />
            <span className="text-xs font-medium text-green-400">Verified</span>
          </div>
        </div>
        <p className="text-xs text-zinc-600 mt-3">Email verification is handled through your authentication provider (AWS Cognito).</p>
      </div>

      {/* Phone Verification */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-sm font-tactical font-bold text-zinc-500 tracking-widest mb-4">PHONE VERIFICATION</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Phone className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{phone || 'No phone number added'}</p>
                <p className="text-xs text-zinc-500">Used for two-factor authentication</p>
              </div>
            </div>
            {phone ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
                <Check className="w-3.5 h-3.5 text-green-400" />
                <span className="text-xs font-medium text-green-400">Verified</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700">
                <AlertCircle className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-xs font-medium text-zinc-500">Not Set</span>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
            />
            <button className="px-5 py-2.5 rounded-xl btn-primary text-sm font-medium">
              Verify Phone
            </button>
          </div>
        </div>
      </div>

      {/* Password */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-sm font-tactical font-bold text-zinc-500 tracking-widest mb-4">PASSWORD</h3>
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
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPw ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2.5 pr-10 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">New Password</label>
              <div className="relative">
                <input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 pr-10 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-zinc-600 mt-1">Min 8 chars, uppercase, lowercase, number, and special character</p>
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
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [campaignUpdates, setCampaignUpdates] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [marketing, setMarketing] = useState(false);

  const Toggle = ({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) => (
    <button
      onClick={onToggle}
      className={`relative w-10 h-5.5 rounded-full transition-colors ${enabled ? 'bg-indigo-500' : 'bg-zinc-700'}`}
      style={{ height: 22 }}
    >
      <motion.div
        animate={{ x: enabled ? 20 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-sm"
      />
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-sm font-tactical font-bold text-zinc-500 tracking-widest mb-4">NOTIFICATION PREFERENCES</h3>
        <div className="space-y-4">
          {[
            { label: 'Email Notifications', description: 'Receive updates about your account via email', enabled: emailNotifs, onToggle: () => setEmailNotifs(!emailNotifs) },
            { label: 'Campaign Updates', description: 'Get notified when campaigns complete or fail', enabled: campaignUpdates, onToggle: () => setCampaignUpdates(!campaignUpdates) },
            { label: 'Weekly Digest', description: 'Summary of your campaign performance each week', enabled: weeklyDigest, onToggle: () => setWeeklyDigest(!weeklyDigest) },
            { label: 'Marketing Emails', description: 'Product updates, tips, and promotional content', enabled: marketing, onToggle: () => setMarketing(!marketing) },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
              <div>
                <p className="text-sm font-medium text-white">{item.label}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{item.description}</p>
              </div>
              <Toggle enabled={item.enabled} onToggle={item.onToggle} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PREFERENCES TAB
// ============================================================================
function PreferencesTab() {
  const [language, setLanguage] = useState('en');
  const [theme, setTheme] = useState('dark');

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'Hindi' },
    { code: 'hi-en', label: 'Hinglish' },
    { code: 'es', label: 'Spanish' },
  ];

  const themes = [
    { id: 'dark', label: 'Dark', color: 'bg-zinc-900' },
    { id: 'midnight', label: 'Midnight', color: 'bg-black' },
  ];

  return (
    <div className="space-y-6">
      {/* Language */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-sm font-tactical font-bold text-zinc-500 tracking-widest mb-4">LANGUAGE</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={`p-3 rounded-xl text-sm font-medium transition-all border ${
                language === lang.code
                  ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                  : 'bg-zinc-900/50 text-zinc-400 border-zinc-800/50 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-2">
                {language === lang.code && <Check className="w-3.5 h-3.5" />}
                {lang.label}
              </div>
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-600 mt-3">This controls the language of AI-generated campaigns</p>
      </div>

      {/* Theme */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-sm font-tactical font-bold text-zinc-500 tracking-widest mb-4">THEME</h3>
        <div className="flex gap-3">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                theme === t.id
                  ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                  : 'bg-zinc-900/50 text-zinc-400 border-zinc-800/50 hover:border-zinc-700'
              }`}
            >
              <div className={`w-5 h-5 rounded-md ${t.color} border border-zinc-700`} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timezone */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-sm font-tactical font-bold text-zinc-500 tracking-widest mb-4">TIMEZONE</h3>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
          <Globe className="w-5 h-5 text-zinc-500" />
          <div>
            <p className="text-sm font-medium text-white">UTC (Coordinated Universal Time)</p>
            <p className="text-xs text-zinc-500">Used for scheduling and analytics timestamps</p>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useAuth } from '@/lib/auth/provider';
import CampaignDashboard from '@/components/CampaignDashboard';

export default function CampaignsPage() {
  const { email, accessToken, logout } = useAuth();

  return (
    <CampaignDashboard
      accessToken={accessToken || ''}
      userEmail={email || ''}
      onLogout={async () => { await logout(); }}
    />
  );
}

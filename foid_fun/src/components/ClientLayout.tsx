'use client';

import { useEffect } from 'react';
import FairyDustCursor from '@/components/FairyDustCursor';
import { MobileNav } from '@/components/MobileNav';
import CompactMusicPlayer from '@/components/CompactMusicPlayer';
import FoidWalletOnboarding from '@/components/FoidWalletOnboarding';
import FoidOnboardingTour from '@/components/FoidOnboardingTour';
import { useMobile } from '@/hooks/useMobile';
import { clearSession } from '@/lib/embeddedWallet';

export function ClientLayout() {
  const { isMobile } = useMobile();

  // Clear embedded wallet session on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      clearSession();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return (
    <>
      {!isMobile && <FairyDustCursor />}
      <MobileNav />
      <FoidWalletOnboarding />
      <FoidOnboardingTour />
      {!isMobile && <CompactMusicPlayer mountLogic={true} />}
    </>
  );
}

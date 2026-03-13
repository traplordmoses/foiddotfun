'use client';

import FairyDustCursor from '@/components/FairyDustCursor';
import { MobileNav } from '@/components/MobileNav';
import CompactMusicPlayer from '@/components/CompactMusicPlayer';
import FoidWalletOnboarding from '@/components/FoidWalletOnboarding';
import FoidOnboardingTour from '@/components/FoidOnboardingTour';
import { useMobile } from '@/hooks/useMobile';

export function ClientLayout() {
  const { isMobile } = useMobile();

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

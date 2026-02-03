'use client';

import FairyDustCursor from '@/components/FairyDustCursor';
import { MobileNav } from '@/components/MobileNav';
import { useMobile } from '@/hooks/useMobile';

export function ClientLayout() {
  const { isMobile } = useMobile();

  return (
    <>
      {!isMobile && <FairyDustCursor />}
      <MobileNav />
    </>
  );
}

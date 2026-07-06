'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Dock } from '@/components/Dock';
import CompactMusicPlayer from '@/components/CompactMusicPlayer';
import { useMobile } from '@/hooks/useMobile';
// Import clearSession from the session module directly — the '@/lib/wallet'
// barrel drags the full wallet stack (bip39 wordlist, bip32, passkey,
// crypto) into the every-route layout bundle just for this one call.
import { clearSession } from '@/lib/wallet/session';

// These overlays all render null until a user/cookie condition flips
// (wallet modal opened, first-visit tour, post-connect welcome), and the
// cursor effect is imperative-only. Loading them as separate lazy chunks
// keeps their code — including the wallet lib behind FoidWalletOnboarding —
// out of the critical path of every route. ssr:false is a no-op change:
// each one returns null during SSR anyway.
const FairyDustCursor = dynamic(() => import('@/components/FairyDustCursor'), { ssr: false });
const FoidWalletOnboarding = dynamic(() => import('@/components/FoidWalletOnboarding'), { ssr: false });
const FoidOnboardingTour = dynamic(() => import('@/components/FoidOnboardingTour'), { ssr: false });
const PostWalletWelcome = dynamic(() => import('@/components/PostWalletWelcome'), { ssr: false });
// CHAT.EXE — floating chat window opened from the dock's Chat tile.
// Desktop-only chrome; the Supabase socket only connects on first open.
const ChatApp = dynamic(() => import('@/components/ChatApp'), { ssr: false });

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
      <Dock />
      <FoidWalletOnboarding />
      <FoidOnboardingTour />
      <PostWalletWelcome />
      <CompactMusicPlayer mountLogic={true} />
      <ChatApp />
    </>
  );
}

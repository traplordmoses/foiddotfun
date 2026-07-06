'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { Dock } from '@/components/Dock';
import CompactMusicPlayer from '@/components/CompactMusicPlayer';
import { useMobile } from '@/hooks/useMobile';
// Import clearSession from the session module directly — the '@/lib/wallet'
// barrel drags the full wallet stack (bip39 wordlist, bip32, passkey,
// crypto) into the every-route layout bundle just for this one call.
import { clearSession } from '@/lib/wallet/session';
import { useMainFocusListener } from '@/stores/floatStore';

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
  const pathname = usePathname();

  // ── Boot isolation (FOID OS: /enter is the machine powering on) ────────
  // /enter shares this root layout, so without a gate the dock and the
  // first-run onboarding tour mount *underneath / on top of* the boot
  // sequence — the dock's glass pill shows through the login frame, and
  // FoidOnboardingTour's 800ms timer pops WELCOME.EXE straight over the
  // POST animation. While the boot owns the screen NO desktop chrome
  // exists: the dock, both wallet overlays, the tour, chat, and the deck
  // all arrive with the desktop *after* the enter click, as the payoff.
  // (The tour additionally waits for the desktop to settle — see
  // FoidOnboardingTour.) This only suppresses mounting on /enter; the
  // dock's normal behaviour, auto-hide, and launch feedback are untouched
  // everywhere else.
  const booting = pathname === '/enter';

  // Interim click-to-front layering: a pointerdown on main-window territory
  // (inside .app-viewport, but not on the dock or a floater) drops the
  // floating apps behind the route window. Lives here because this layout
  // owns both floaters. See src/stores/floatStore.ts for the z ladder.
  useMainFocusListener();

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

  // The boot screen stands alone — power on → POST → login → desktop.
  // Nothing but the wallpaper (root layout) sits behind EnterGate.
  if (booting) return null;

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

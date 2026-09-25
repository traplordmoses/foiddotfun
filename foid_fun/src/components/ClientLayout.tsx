'use client';

import { useVisualViewport } from '@/hooks/useVisualViewport';
import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { Dock } from '@/components/Dock';
import { MobileHomeScreen } from '@/components/os/MobileHomeScreen';
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
const PostWalletWelcome = dynamic(() => import('@/components/PostWalletWelcome'), { ssr: false });
// CHAT.EXE — floating chat window opened from the dock's Chat tile.
// Desktop-only chrome; the Supabase socket only connects on first open.
const ChatApp = dynamic(() => import('@/components/ChatApp'), { ssr: false });
const ServiceWorkerRegistrar = dynamic(() => import('@/components/ServiceWorkerRegistrar'), { ssr: false });
const MiniAppReady = dynamic(() => import('@/components/MiniAppReady'), { ssr: false });

export function ClientLayout() {
  useVisualViewport();
  const { isMobile, isDesktop } = useMobile();
  const pathname = usePathname();

  // Entry is isolated by AppRuntime; keep this guard for standalone reuse.
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
  if (booting) return (
    <>
      <ServiceWorkerRegistrar />
      <MiniAppReady />
    </>
  );

  return (
    <>
      <ServiceWorkerRegistrar />
      <MiniAppReady />
      {!isMobile && <FairyDustCursor />}
      {/* Phones and tablets: a closed window leaves the home screen, not an
          empty page. The desktop shell has its own wallpaper and icons. */}
      {!isDesktop && <MobileHomeScreen />}
      <Dock />
      <FoidWalletOnboarding />
      {/* The desktop welcome provides direct actions without a blocking first-run overlay. */}
      <PostWalletWelcome />
      <CompactMusicPlayer mountLogic={true} />
      <ChatApp />
    </>
  );
}

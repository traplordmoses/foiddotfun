// src/lib/foidOsBoot.ts
// The FOID OS boot handshake between /enter and the desktop shell
// (multi-window plan, Stage C + founder decision #4: the desktop boots
// through the /enter animation into the shell).
//
// Tiny on purpose: the home route imports this to decide "have we booted
// this tab session?" without pulling EnterGate's component code into its
// bundle.

/** sessionStorage flag set when a boot lands (EnterGate.finishBoot). The
 *  desktop only redirects through /enter while this is absent, so the OS
 *  boots at most once per tab session. */
export const BOOT_SESSION_KEY = "foid_os_booted";

/** 24h cookie set when the user actually presses enter — the middleware's
 *  server-side gate for `/`, and EnterGate's "returning visitor" signal
 *  (new tab within the window ⇒ fast ~0.9s boot instead of the full one). */
export const ENTERED_COOKIE = "foid_entered";

/** True once the boot theater has played in this tab session. Fails open
 *  (pretends booted) when sessionStorage is unavailable — a private-mode
 *  quirk must never trap the desktop in a redirect loop with /enter. */
export function hasBootedThisSession(): boolean {
  try {
    return window.sessionStorage.getItem(BOOT_SESSION_KEY) === "1";
  } catch {
    return true;
  }
}

/** True while the entered cookie is live (returning visitor). */
export function hasEnteredRecently(): boolean {
  try {
    return document.cookie
      .split(";")
      .some((part) => part.trim().startsWith(`${ENTERED_COOKIE}=`));
  } catch {
    return false;
  }
}

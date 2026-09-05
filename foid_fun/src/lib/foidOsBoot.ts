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

/** localStorage flag: this device has already sat through the boot once.
 *  The desktop only bounces through /enter while BOTH this and the session
 *  flag are absent, so the ceremony plays once per device, not once per
 *  tab (audit P7). /enter itself is always reachable directly. */
export const BOOT_DEVICE_KEY = "foid_os_booted_device";

/** True once the boot theater has played in this tab session OR on this
 *  device. Fails open (pretends booted) when storage is unavailable — a
 *  private-mode quirk must never trap the desktop in a redirect loop
 *  with /enter. */
export function hasBootedThisSession(): boolean {
  try {
    if (window.sessionStorage.getItem(BOOT_SESSION_KEY) === "1") return true;
    return window.localStorage.getItem(BOOT_DEVICE_KEY) === "1";
  } catch {
    return true;
  }
}

/** Remember that this device has booted. Called when a boot lands. */
export function markBootedOnDevice(): void {
  try {
    window.localStorage.setItem(BOOT_DEVICE_KEY, "1");
  } catch {
    /* private mode: the cookie still covers the server-side gate */
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

/** sessionStorage flag: the dock has already played its one-shot arrival
 *  slide-up (the "login → desktop" payoff after the enter click). Set the
 *  first time the dock mounts on the desktop this session so navigating
 *  between routes doesn't replay the entrance. */
export const DOCK_ARRIVED_KEY = "foid_dock_arrived";

/** Claims the dock's arrival animation for this tab session. Returns true
 *  exactly once (the first call) — the dock plays its slide-up then; every
 *  later mount returns false and skips straight to the resting state. Fails
 *  closed (no animation) if sessionStorage is unavailable, so a private-mode
 *  quirk can never wedge the dock mid-entrance. */
export function claimDockArrival(): boolean {
  try {
    if (window.sessionStorage.getItem(DOCK_ARRIVED_KEY) === "1") return false;
    window.sessionStorage.setItem(DOCK_ARRIVED_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

/**
 * Event bridge between the wagmi connector (non-React) and the React
 * onboarding/unlock modal.
 *
 * Two flows:
 *   - CREATE: new wallet — user enters PIN, passkey created, wallet encrypted
 *   - UNLOCK: existing wallet — user enters PIN, passkey authenticates, wallet decrypted
 *
 * Both return { address, privateKey } so the connector can cache the session.
 */

const CREATE_EVENT = "foid-wallet:request-create";
const UNLOCK_EVENT = "foid-wallet:request-unlock";
const WINDOW_KEY = "__foidWalletResolve";

export type WalletResult = { address: string; privateKey: string } | null;
type Resolver = (result: WalletResult) => void;

declare global {
  interface WindowEventMap {
    [CREATE_EVENT]: CustomEvent;
    [UNLOCK_EVENT]: CustomEvent;
  }
  interface Window {
    [WINDOW_KEY]?: Resolver;
  }
}

export function requestWalletCreation(): Promise<WalletResult> {
  return new Promise<WalletResult>((resolve) => {
    window[WINDOW_KEY] = resolve;
    window.dispatchEvent(new CustomEvent(CREATE_EVENT));
  });
}

export function requestWalletUnlock(): Promise<WalletResult> {
  return new Promise<WalletResult>((resolve) => {
    window[WINDOW_KEY] = resolve;
    window.dispatchEvent(new CustomEvent(UNLOCK_EVENT));
  });
}

export function resolveWalletRequest(result: WalletResult): void {
  const resolve = window[WINDOW_KEY];
  if (resolve) {
    delete window[WINDOW_KEY];
    resolve(result);
  }
}

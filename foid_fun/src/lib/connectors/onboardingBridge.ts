/**
 * Event bridge between the wagmi connector (non-React) and the React
 * onboarding modal. The connector calls requestWalletCreation() which
 * dispatches a custom event; the React modal listens, runs the flow,
 * then calls resolveWalletCreation() to fulfill the promise.
 */

const EVENT_NAME = "foid-wallet:request-create";
const WINDOW_KEY = "__foidWalletCreateResolve";

type CreationResult = { address: string } | null;
type Resolver = (result: CreationResult) => void;

declare global {
  interface WindowEventMap {
    [EVENT_NAME]: CustomEvent;
  }
  interface Window {
    [WINDOW_KEY]?: Resolver;
  }
}

/**
 * Called by the wagmi connector. Returns a promise that resolves when
 * the React onboarding modal completes (or null if cancelled).
 */
export function requestWalletCreation(): Promise<CreationResult> {
  return new Promise<CreationResult>((resolve) => {
    window[WINDOW_KEY] = resolve;
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  });
}

/**
 * Called by the React onboarding modal to resolve the pending promise.
 */
export function resolveWalletCreation(result: CreationResult): void {
  const resolve = window[WINDOW_KEY];
  if (resolve) {
    delete window[WINDOW_KEY];
    resolve(result);
  }
}

/**
 * Lazy WalletConnect wallet for RainbowKit (audit P1).
 *
 * wagmi's stock `walletConnect` connector calls `getProvider()` inside
 * `setup()`, and `createConfig` runs `setup()` for every connector at boot.
 * That single call imports @walletconnect/ethereum-provider plus the Reown
 * modal (~250 KB gzipped) on every page for every visitor, wallet or not.
 *
 * This wrapper presents the same connector surface but creates the real
 * connector only when something actually needs it: RainbowKit opening the
 * QR panel (getProvider), a connect/reconnect, or a session event. The
 * config (and its emitter) is passed straight through, so wagmi sees the
 * real connector's events exactly as before.
 */
import type { Wallet, WalletDetailsParams } from "@rainbow-me/rainbowkit";
import { createConnector } from "wagmi";
import { walletConnect } from "wagmi/connectors";

type RealConnector = ReturnType<ReturnType<typeof walletConnect>>;
// createConnector is generic; the delegating object is checked against the
// real connector's types above, so hand it over with the loose signature.
type ConnectorFactory = Parameters<typeof createConnector>[0];

const ICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#3b99fc"/><path d="M14.5 19.6c5.2-5.1 13.8-5.1 19 0l.6.6a.7.7 0 0 1 0 1l-2.2 2.1a.4.4 0 0 1-.5 0l-.9-.9c-3.7-3.6-9.6-3.6-13.3 0l-.9.9a.4.4 0 0 1-.5 0l-2.2-2.1a.7.7 0 0 1 0-1l.9-.6zm23.4 4.3 1.9 1.9a.7.7 0 0 1 0 1l-8.7 8.5a.7.7 0 0 1-1 0l-6.1-6a.2.2 0 0 0-.3 0l-6.1 6a.7.7 0 0 1-1 0l-8.7-8.5a.7.7 0 0 1 0-1l1.9-1.9a.7.7 0 0 1 1 0l6.2 6a.2.2 0 0 0 .3 0l6.1-6a.7.7 0 0 1 1 0l6.2 6a.2.2 0 0 0 .3 0l6.1-6a.7.7 0 0 1 .9 0z" fill="#fff"/></svg>`,
  );

export const lazyWalletConnectWallet = ({ projectId }: { projectId: string }): Wallet => ({
  id: "walletConnect",
  name: "WalletConnect",
  iconUrl: ICON,
  iconBackground: "#3b99fc",
  qrCode: { getUri: (uri: string) => uri },
  createConnector: (walletDetails: WalletDetailsParams) =>
    createConnector(((config: Parameters<ReturnType<typeof walletConnect>>[0]) => {
      let real: RealConnector | null = null;
      let loading: Promise<RealConnector> | null = null;
      const load = (): Promise<RealConnector> => {
        if (real) return Promise.resolve(real);
        if (!loading) {
          loading = (async () => {
            const connector = walletConnect({ projectId, showQrModal: false })(config) as RealConnector;
            await connector.setup?.();
            real = connector;
            return connector;
          })();
        }
        return loading;
      };
      return {
        id: "walletConnect",
        name: "WalletConnect",
        type: "walletConnect" as const,
        // Deliberately empty: no provider import at config time.
        async setup() {},
        connect: (params?: Parameters<RealConnector["connect"]>[0]) =>
          load().then((c) => c.connect(params)),
        disconnect: () => load().then((c) => c.disconnect()),
        getAccounts: () => load().then((c) => c.getAccounts()),
        getChainId: () => load().then((c) => c.getChainId()),
        getProvider: (params?: Parameters<RealConnector["getProvider"]>[0]) =>
          load().then((c) => c.getProvider(params)),
        isAuthorized: () => load().then((c) => c.isAuthorized()),
        switchChain: (params: Parameters<NonNullable<RealConnector["switchChain"]>>[0]) =>
          load().then((c) => {
            if (!c.switchChain) throw new Error("switchChain not supported");
            return c.switchChain(params);
          }),
        onAccountsChanged: (accounts: string[]) => {
          void load().then((c) => c.onAccountsChanged(accounts));
        },
        onChainChanged: (chainId: string) => {
          void load().then((c) => c.onChainChanged(chainId));
        },
        onConnect: (connectInfo: Parameters<NonNullable<RealConnector["onConnect"]>>[0]) => {
          void load().then((c) => c.onConnect?.(connectInfo));
        },
        onDisconnect: (error?: Error) => {
          void load().then((c) => c.onDisconnect(error));
        },
        onMessage: (message: Parameters<NonNullable<RealConnector["onMessage"]>>[0]) => {
          void load().then((c) => c.onMessage?.(message));
        },
        ...walletDetails,
      };
    }) as unknown as ConnectorFactory),
});

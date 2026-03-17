/**
 * Custom wagmi v2 connector for the FOID embedded wallet.
 *
 * - On first connect: triggers create or unlock modal via onboardingBridge
 * - On reconnect (page reload): loads address only, defers unlock to first sign
 * - Signing operations ensure wallet is unlocked (prompts if needed)
 */
import { createConnector } from "@wagmi/core";
import {
  createWalletClient,
  fallback,
  http,
  toHex,
  type EIP1193RequestFn,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { TARGET_CHAIN, TARGET_CHAIN_ID } from "@/lib/chain";

type EIP1193Provider = { request: EIP1193RequestFn };

const ACTIVE_KEY = "foid-embedded-active";

const PRIMARY_RPC =
  process.env.NEXT_PUBLIC_FLUENT_RPC ??
  process.env.NEXT_PUBLIC_RPC ??
  process.env.NEXT_PUBLIC_RPC_URL ??
  TARGET_CHAIN.rpcUrls.default.http[0] ??
  "https://rpc.testnet.fluent.xyz";

const FALLBACK_RPC = "https://rpc.testnet.fluent.xyz";

const RPC_URLS = [PRIMARY_RPC, FALLBACK_RPC];

const resilientTransport = fallback(
  [
    http(PRIMARY_RPC, { retryCount: 3, retryDelay: 500 }),
    http(FALLBACK_RPC, { retryCount: 2, retryDelay: 1000 }),
  ],
  { rank: false },
);

/** Fetch with retry across multiple RPCs */
async function rpcFetch(method: string, params?: unknown[]): Promise<unknown> {
  let lastError: unknown;
  for (const url of RPC_URLS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        });
        const json = await response.json();
        if (json.error) {
          lastError = new Error(json.error.message);
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
            continue;
          }
          break; // try next RPC
        }
        return json.result;
      } catch (err) {
        lastError = err;
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        break; // try next RPC
      }
    }
  }
  throw lastError ?? new Error(`RPC call failed: ${method}`);
}

/**
 * Ensure the wallet is unlocked for signing. If no session exists,
 * triggers the unlock modal and waits for user to enter PIN + biometric.
 */
async function ensureUnlocked(): Promise<{ privateKey: string; address: string }> {
  const { getSession, setSession } = await import("@/lib/embeddedWallet");
  const session = getSession();
  if (session) return session;

  const { requestWalletUnlock } = await import("./onboardingBridge");
  const result = await requestWalletUnlock();
  if (!result) throw new Error("Wallet unlock cancelled");

  setSession(result.privateKey, result.address);
  return result;
}

export function embeddedWalletConnector() {
  let _provider: EIP1193Provider | null = null;
  let _address: Address | null = null;

  return createConnector<EIP1193Provider>((config) => ({
    id: "foid-embedded",
    name: "FOID Wallet",
    type: "foid-embedded",

    async setup() {
      if (
        typeof window !== "undefined" &&
        localStorage.getItem(ACTIVE_KEY) === "true"
      ) {
        const { getStoredAddress } = await import("@/lib/embeddedWallet");
        const addr = getStoredAddress();
        if (addr) _address = addr as Address;
      }
    },

    async connect(parameters?: { chainId?: number; isReconnecting?: boolean }) {
      const { chainId, isReconnecting } = parameters ?? {};
      const { exists, getStoredAddress, setSession } = await import(
        "@/lib/embeddedWallet"
      );

      if (isReconnecting) {
        // Page reload — just load address, defer unlock to first sign
        const addr = getStoredAddress();
        if (addr) {
          _address = addr as Address;
          localStorage.setItem(ACTIVE_KEY, "true");
          const chain =
            config.chains.find((c) => c.id === (chainId ?? TARGET_CHAIN_ID)) ??
            config.chains[0];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return { accounts: [_address], chainId: chain.id } as any;
        }
        // No wallet found — clear stale flag
        localStorage.removeItem(ACTIVE_KEY);
        throw new Error("No embedded wallet found");
      }

      if (!exists()) {
        // New wallet — trigger creation modal
        const { requestWalletCreation } = await import("./onboardingBridge");
        const result = await requestWalletCreation();
        if (!result) throw new Error("Wallet creation cancelled");
        _address = result.address as Address;
        setSession(result.privateKey, result.address);
      } else {
        // Existing wallet — trigger unlock modal
        const { requestWalletUnlock } = await import("./onboardingBridge");
        const result = await requestWalletUnlock();
        if (!result) throw new Error("Wallet unlock cancelled");
        _address = result.address as Address;
        setSession(result.privateKey, result.address);
      }

      if (!_address) throw new Error("Failed to connect embedded wallet");

      localStorage.setItem(ACTIVE_KEY, "true");

      const chain =
        config.chains.find((c) => c.id === (chainId ?? TARGET_CHAIN_ID)) ??
        config.chains[0];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { accounts: [_address], chainId: chain.id } as any;
    },

    async disconnect() {
      _provider = null;
      _address = null;
      localStorage.removeItem(ACTIVE_KEY);
      const { clearSession } = await import("@/lib/embeddedWallet");
      clearSession();
    },

    async getAccounts() {
      if (_address) return [_address];
      const { getStoredAddress } = await import("@/lib/embeddedWallet");
      const addr = getStoredAddress();
      if (addr) {
        _address = addr as Address;
        return [_address];
      }
      return [];
    },

    async getChainId() {
      return TARGET_CHAIN_ID;
    },

    async getProvider() {
      if (_provider) return _provider;

      _provider = {
        request: (async ({
          method,
          params,
        }: {
          method: string;
          params?: unknown[];
        }) => {
          switch (method) {
            case "eth_requestAccounts":
            case "eth_accounts": {
              const accts = await this.getAccounts();
              return accts;
            }

            case "eth_chainId": {
              return toHex(TARGET_CHAIN_ID);
            }

            case "wallet_switchEthereumChain": {
              return null;
            }

            case "personal_sign": {
              const [message, address] = params as [string, string];
              const { privateKey } = await ensureUnlocked();
              const account = privateKeyToAccount(
                privateKey as `0x${string}`,
              );
              if (
                account.address.toLowerCase() !== address.toLowerCase()
              ) {
                throw new Error("Address mismatch");
              }
              return account.signMessage({
                message: { raw: message as `0x${string}` },
              });
            }

            case "eth_signTypedData_v4": {
              const [address, typedDataJson] = params as [string, string];
              const { privateKey } = await ensureUnlocked();
              const account = privateKeyToAccount(
                privateKey as `0x${string}`,
              );
              if (
                account.address.toLowerCase() !== address.toLowerCase()
              ) {
                throw new Error("Address mismatch");
              }
              const typedData = JSON.parse(typedDataJson);
              return account.signTypedData({
                domain: typedData.domain,
                types: typedData.types,
                primaryType: typedData.primaryType,
                message: typedData.message,
              });
            }

            case "eth_sendTransaction": {
              const [tx] = params as [Record<string, string>];
              const { privateKey } = await ensureUnlocked();
              const account = privateKeyToAccount(
                privateKey as `0x${string}`,
              );
              const walletClient = createWalletClient({
                account,
                chain: TARGET_CHAIN,
                transport: resilientTransport,
              });
              return walletClient.sendTransaction({
                to: tx.to as Address,
                value: tx.value ? BigInt(tx.value) : 0n,
                data: (tx.data as `0x${string}`) ?? undefined,
                gas: tx.gas ? BigInt(tx.gas) : undefined,
              });
            }

            case "eth_estimateGas":
            case "eth_call":
            case "eth_getBalance":
            case "eth_getTransactionCount":
            case "eth_blockNumber":
            case "eth_getBlockByNumber":
            case "eth_getTransactionReceipt": {
              return rpcFetch(method, params);
            }

            default: {
              return rpcFetch(method, params);
            }
          }
        }) as EIP1193RequestFn,
      };

      return _provider;
    },

    async isAuthorized() {
      if (typeof window === "undefined") return false;
      return localStorage.getItem(ACTIVE_KEY) === "true";
    },

    onAccountsChanged() {},
    onChainChanged() {},
    onDisconnect() {
      _provider = null;
      _address = null;
      localStorage.removeItem(ACTIVE_KEY);
      import("@/lib/embeddedWallet").then(({ clearSession }) =>
        clearSession(),
      );
    },
  }));
}

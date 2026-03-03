/**
 * Custom wagmi v2 connector for the DIY embedded wallet.
 *
 * Implements an EIP-1193 provider backed by a viem PrivateKeyAccount
 * stored encrypted in IndexedDB.
 */
import { createConnector } from "@wagmi/core";
import {
  createWalletClient,
  http,
  toHex,
  type EIP1193RequestFn,
  type Address,
} from "viem";
import { TARGET_CHAIN, TARGET_CHAIN_ID } from "@/lib/chain";
import {
  hasEmbeddedWallet,
  createEmbeddedWallet,
  getEmbeddedAccount,
  getEmbeddedAddress,
  clearEmbeddedWallet,
} from "@/lib/embeddedWallet";

type EIP1193Provider = { request: EIP1193RequestFn };

const RPC_URL =
  process.env.NEXT_PUBLIC_RPC ??
  process.env.NEXT_PUBLIC_RPC_URL ??
  TARGET_CHAIN.rpcUrls.default.http[0] ??
  "https://rpc.testnet.fluent.xyz";

export function embeddedWalletConnector() {
  let _provider: EIP1193Provider | null = null;
  let _address: Address | null = null;

  return createConnector<EIP1193Provider>((config) => ({
    id: "foid-embedded",
    name: "FOID Wallet",
    type: "foid-embedded",

    async setup() {
      // Check if wallet exists on init
      const addr = await getEmbeddedAddress();
      if (addr) _address = addr as Address;
    },

    async connect(parameters?: { chainId?: number; isReconnecting?: boolean }) {
      const { chainId } = parameters ?? {};
      // Create wallet if it doesn't exist
      if (!(await hasEmbeddedWallet())) {
        const { address } = await createEmbeddedWallet();
        _address = address as Address;
      } else {
        const addr = await getEmbeddedAddress();
        _address = (addr as Address) ?? null;
      }

      if (!_address) throw new Error("Failed to create embedded wallet");

      const chain =
        config.chains.find((c) => c.id === (chainId ?? TARGET_CHAIN_ID)) ??
        config.chains[0];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { accounts: [_address], chainId: chain.id } as any;
    },

    async disconnect() {
      _provider = null;
      // Keep the wallet in IndexedDB — just disconnect the session
    },

    async getAccounts() {
      if (_address) return [_address];
      const addr = await getEmbeddedAddress();
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
        request: (async ({ method, params }: { method: string; params?: unknown[] }) => {
          switch (method) {
            case "eth_requestAccounts":
            case "eth_accounts": {
              const accounts = await this.getAccounts();
              return accounts;
            }

            case "eth_chainId": {
              return toHex(TARGET_CHAIN_ID);
            }

            case "wallet_switchEthereumChain": {
              // Single-chain wallet — no-op
              return null;
            }

            case "personal_sign": {
              const [message, address] = params as [string, string];
              const account = await getEmbeddedAccount();
              if (account.address.toLowerCase() !== address.toLowerCase()) {
                throw new Error("Address mismatch");
              }
              const signature = await account.signMessage({
                message: { raw: message as `0x${string}` },
              });
              return signature;
            }

            case "eth_signTypedData_v4": {
              const [address, typedDataJson] = params as [string, string];
              const account = await getEmbeddedAccount();
              if (account.address.toLowerCase() !== address.toLowerCase()) {
                throw new Error("Address mismatch");
              }
              const typedData = JSON.parse(typedDataJson);
              const signature = await account.signTypedData({
                domain: typedData.domain,
                types: typedData.types,
                primaryType: typedData.primaryType,
                message: typedData.message,
              });
              return signature;
            }

            case "eth_sendTransaction": {
              const [tx] = params as [Record<string, string>];
              const account = await getEmbeddedAccount();
              const walletClient = createWalletClient({
                account,
                chain: TARGET_CHAIN,
                transport: http(RPC_URL),
              });
              const hash = await walletClient.sendTransaction({
                to: tx.to as Address,
                value: tx.value ? BigInt(tx.value) : 0n,
                data: (tx.data as `0x${string}`) ?? undefined,
                gas: tx.gas ? BigInt(tx.gas) : undefined,
              });
              return hash;
            }

            case "eth_estimateGas": {
              // Delegate to RPC
              const response = await fetch(RPC_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  jsonrpc: "2.0",
                  id: 1,
                  method: "eth_estimateGas",
                  params,
                }),
              });
              const json = await response.json();
              return json.result;
            }

            case "eth_call":
            case "eth_getBalance":
            case "eth_getTransactionCount":
            case "eth_blockNumber":
            case "eth_getBlockByNumber":
            case "eth_getTransactionReceipt": {
              // Delegate read calls to RPC
              const response = await fetch(RPC_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  jsonrpc: "2.0",
                  id: 1,
                  method,
                  params,
                }),
              });
              const json = await response.json();
              return json.result;
            }

            default: {
              // Fallback: delegate unknown methods to RPC
              try {
                const response = await fetch(RPC_URL, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 1,
                    method,
                    params,
                  }),
                });
                const json = await response.json();
                if (json.error) throw new Error(json.error.message);
                return json.result;
              } catch {
                throw new Error(`Unsupported method: ${method}`);
              }
            }
          }
        }) as EIP1193RequestFn,
      };

      return _provider;
    },

    async isAuthorized() {
      return hasEmbeddedWallet();
    },

    onAccountsChanged() {},
    onChainChanged() {},
    onDisconnect() {
      _provider = null;
    },
  }));
}

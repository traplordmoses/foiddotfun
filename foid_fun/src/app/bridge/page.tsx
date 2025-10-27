"use client";
import { useMemo, useState } from "react";
import { useAccount, useContractRead } from "wagmi";
import {
  parseUnits,
  keccak256,
  concatHex,
  isHex,
  pad,
  numberToHex,
  stringToHex,
  isAddress,
  type Address,
  type Hex,
} from "viem";
import { BridgeRouter, AttestorRegistry } from "@/lib/contracts";
import { NetworkGate } from "@/components/NetworkGate";
import { AmountInput } from "@/components/AmountInput";
import { TxButton } from "@/components/TxButton";
import { StatCard } from "@/components/StatCard";

const MINT_TYPE =
  "Mint(bytes32 lockId,bytes32 moneroTx,address dest,uint256 amount,uint256 expiry,address router,uint256 chainId)";
const MINT_TYPE_HASH = keccak256(stringToHex(MINT_TYPE));
const ZERO_HEX = "0x" as const;
const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

const toBytes32Hex = (value: string): Hex => {
  const normalized = value ? (value.startsWith("0x") ? value : `0x${value}`) : ZERO_HEX;
  if (!isHex(normalized, { strict: false })) {
    throw new Error("Invalid bytes32 value");
  }
  return pad(normalized as `0x${string}`, { size: 32, dir: "left" });
};

const toHexString = (value: string): `0x${string}` => {
  if (!value) throw new Error("Missing hex value");
  const normalized = value.startsWith("0x") ? value : `0x${value}`;
  if (!isHex(normalized, { strict: false })) {
    throw new Error("Invalid hex string");
  }
  return normalized as `0x${string}`;
};

const toOptionalBigInt = (value: unknown): bigint | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string" && value.trim().length > 0) return BigInt(value);
  return undefined;
};

const formatBigInt = (value: unknown): string => {
  const result = toOptionalBigInt(value);
  return result !== undefined ? result.toString() : "";
};

export default function BridgePage() {
  const { address } = useAccount();

  // For burn for redeem
  const [burnAmount, setBurnAmount] = useState("");
  const [moneroDest, setMoneroDest] = useState(""); // hex payload

  // For mint with attestation
  const [lockId, setLockId] = useState("");
  const [moneroTx, setMoneroTx] = useState("");
  const [dest, setDest] = useState("");
  const [mintAmount, setMintAmount] = useState("");
  const [expiry, setExpiry] = useState("");
  const [signature, setSignature] = useState("");
  const [computedHash, setComputedHash] = useState<Hex | "">("");

  const { data: routerChainIdData } = useContractRead({
    ...BridgeRouter,
    functionName: "chainId",
  });

  const { data: isAttestorData } = useContractRead({
    ...AttestorRegistry,
    functionName: "isAttestor",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address),
      refetchInterval: 4000,
    },
  });

  const routerChainId = toOptionalBigInt(routerChainIdData) ?? 0n;
  const routerChainIdLabel = formatBigInt(routerChainIdData);
  const isAttestor = isAttestorData === true;
  const destinationAddress = dest && isAddress(dest) ? (dest as Address) : undefined;

  const burnInputs = useMemo(() => {
    try {
      if (!burnAmount || !moneroDest) return null;
      return {
        amount: parseUnits(burnAmount, 18),
        moneroDest: toHexString(moneroDest),
      };
    } catch {
      return null;
    }
  }, [burnAmount, moneroDest]);

  const mintInputs = useMemo(() => {
    try {
      if (!destinationAddress) return null;
      if (!mintAmount) return null;
      if (!expiry) return null;
      if (!signature) return null;

      return {
        attestation: {
          lockId: toBytes32Hex(lockId) as Hex,
          moneroTx: toBytes32Hex(moneroTx) as Hex,
          dest: destinationAddress,
          amount: parseUnits(mintAmount, 18),
          expiry: BigInt(expiry),
        },
        signature: toHexString(signature),
      };
    } catch {
      return null;
    }
  }, [destinationAddress, expiry, lockId, mintAmount, moneroTx, signature]);

  const computeHash = () => {
    try {
      const lock = toBytes32Hex(lockId);
      const tx = toBytes32Hex(moneroTx);
      const destField = destinationAddress
        ? pad(destinationAddress, { size: 32, dir: "left" })
        : ZERO_BYTES32;
      const amount = mintAmount ? parseUnits(mintAmount, 18) : 0n;
      const expiryValue = expiry ? BigInt(expiry) : 0n;
      const fields = concatHex([
        MINT_TYPE_HASH,
        lock,
        tx,
        destField,
        pad(numberToHex(amount), { size: 32, dir: "left" }),
        pad(numberToHex(expiryValue), { size: 32, dir: "left" }),
        pad(BridgeRouter.address, { size: 32, dir: "left" }),
        pad(numberToHex(routerChainId), { size: 32, dir: "left" }),
      ]);
      setComputedHash(keccak256(fields));
    } catch (err) {
      console.error(err);
      setComputedHash("");
    }
  };

  const resetMintForm = () => {
    setLockId("");
    setMoneroTx("");
    setDest("");
    setMintAmount("");
    setExpiry("");
    setSignature("");
    setComputedHash("");
  };

  const resetBurnForm = () => {
    setBurnAmount("");
    setMoneroDest("");
  };

  const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "0", 10);

  return (
    <main className="space-y-6">
      <NetworkGate chainId={chainId}>
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="Router Chain ID" value={routerChainIdLabel} />
          <StatCard label="Attestor?" value={isAttestor ? "Yes" : "No"} />
        </div>

        <div className="p-4 space-y-8">
          <section className="card space-y-4">
            <h2 className="font-mono uppercase text-fluent-pink text-sm">Burn for Redeem</h2>
            <AmountInput value={burnAmount} onChange={setBurnAmount} placeholder="Amount" />
            <input
              className="w-full p-2 rounded-lg bg-neutral-800"
              placeholder="Monero destination (hex)"
              value={moneroDest}
              onChange={(event) => setMoneroDest(event.target.value)}
            />
            <TxButton
              contract={BridgeRouter}
              functionName="burnForRedeem"
              args={
                burnInputs
                  ? [burnInputs.amount, burnInputs.moneroDest]
                  : undefined
              }
              enabled={Boolean(burnInputs)}
              onSuccess={resetBurnForm}
            >
              Burn &amp; Redeem
            </TxButton>
          </section>

          <section className="card space-y-4">
            <h2 className="font-mono uppercase text-fluent-pink text-sm">Mint with Attestation</h2>

            <input
              className="w-full p-2 rounded-lg bg-neutral-800"
              placeholder="Lock ID (bytes32)"
              value={lockId}
              onChange={(event) => setLockId(event.target.value)}
            />
            <input
              className="w-full p-2 rounded-lg bg-neutral-800"
              placeholder="Monero Tx (bytes32)"
              value={moneroTx}
              onChange={(event) => setMoneroTx(event.target.value)}
            />
            <input
              className="w-full p-2 rounded-lg bg-neutral-800"
              placeholder="Destination address (0x...)"
              value={dest}
              onChange={(event) => setDest(event.target.value)}
            />
            <AmountInput value={mintAmount} onChange={setMintAmount} placeholder="Amount" />
            <input
              className="w-full p-2 rounded-lg bg-neutral-800"
              placeholder="Expiry (timestamp)"
              value={expiry}
              onChange={(event) => setExpiry(event.target.value)}
            />
            <textarea
              className="w-full p-2 rounded-lg bg-neutral-800"
              placeholder="Signature (0x...)"
              value={signature}
              onChange={(event) => setSignature(event.target.value)}
            />

            <div className="flex items-center gap-2">
              <button
                className="px-4 py-2 rounded-full bg-fluent-purple hover:bg-fluent-pink"
                type="button"
                onClick={computeHash}
              >
                Build Hash
              </button>
              {computedHash && (
                <div className="text-xs break-all text-neutral-400">
                  Hash to sign: <span className="text-fluent-blue">{computedHash}</span>
                </div>
              )}
            </div>

            <TxButton
              contract={BridgeRouter}
              functionName="mintWithAttestation"
              args={
                mintInputs
                  ? [
                      mintInputs.attestation,
                      mintInputs.signature,
                    ]
                  : undefined
              }
              enabled={Boolean(mintInputs)}
              onSuccess={resetMintForm}
            >
              Mint
            </TxButton>
          </section>
        </div>
      </NetworkGate>
    </main>
  );
}

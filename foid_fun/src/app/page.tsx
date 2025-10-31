"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import MoireLayer from "./(components)/MoireLayer";
import { CONTRACT_ADDRESSES, NETWORK_DETAILS } from "./(components)/contracts";

const INTENSITY_STORAGE_KEY = "foidfun.intensity";

const appTiles = [
  {
    href: "/foidfactory",
    title: "foid factory (launchpad)",
    body: "spin up a token + pool in minutes.",
  },
  {
    href: "/foidswap",
    title: "foid swap (amm + router)",
    body: "constant-product pools, 0.3% per hop, auto-routing across multiple pairs.",
  },
  {
    href: "/launchpad",
    title: "foid name service (fns)",
    body: "human-readable .foid names for sending/receiving (teaser/alpha).",
  },
] as const;

const valueProps = [
  {
    title: "blended execution (evm + wasm + svm)",
    body: "fluent lets contracts from different VMs interoperate on one chain, on shared state—no bridges. solidity and rust can call each other inside one app, enabling simpler architectures and new design space.",
  },
  {
    title: "zk-powered l2 security",
    body: "fluent is an ethereum l2 with a zkvm for verifiable execution. you keep ethereum settlement security while proving execution succinctly at high throughput.",
  },
  {
    title: "dev ergonomics, familiar tools",
    body: "ship today with evm compatibility (solidity/vyper), then extend with rust/wasm when you’re ready—the fluentbase sdk bridges types and shared state so both paths feel native. less friction, more composability.",
  },
] as const;

const faqItems = [
  {
    question: "how do i add fluent testnet?",
    answer:
      "network name: fluent testnet · chain id: 20994 · rpc: https://rpc.testnet.fluent.xyz · symbol: ETH · explorer: https://testnet.fluentscan.xyz. add via wallet prompt or manually in metamask → networks. docs.fluent.xyz",
  },
  {
    question: "how do i get test tokens?",
    answer:
      "use the fluent dev portal faucet at https://portal.fluent.xyz, then refresh your wallet balance. docs.fluent.xyz",
  },
  {
    question: "how do i create a token in foidfactory?",
    answer:
      "enter name, symbol, max supply; confirm recipient (defaults to your wallet); sign the tx. the contract mints 100% of supply to the recipient and returns a receipt you can view on the explorer. docs.fluent.xyz",
  },
  {
    question: "how do i add liquidity on foidswap?",
    answer:
      "choose a pair (or create one), deposit both assets in proportion, confirm. you’ll receive lp tokens representing your share; trades auto-route across pairs with a 0.3% fee per hop. docs.fluent.xyz",
  },
] as const;

function clampIntensity(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

export default function FoidLanding() {
  const [intensity, setIntensity] = useState(0.95);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(INTENSITY_STORAGE_KEY);
    if (!stored) return;
    const parsed = Number(stored);
    if (!Number.isNaN(parsed)) {
      setIntensity(clampIntensity(parsed));
    }
  }, []);

  useEffect(() => {
    const clamped = clampIntensity(intensity);
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      const moire = (0.35 + clamped * 2.4).toFixed(2);
      const grain = (0.12 + clamped * 0.85).toFixed(2);
      const vignette = (0.38 + clamped * 1.05).toFixed(2);
      const glow = (0.25 + clamped * 0.6).toFixed(2);

      root.style.setProperty("--moire", moire);
      root.style.setProperty("--grain", grain);
      root.style.setProperty("--vignette", vignette);
      root.style.setProperty("--glow", glow);
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(INTENSITY_STORAGE_KEY, clamped.toFixed(2));
    }

    return () => {
      if (typeof document !== "undefined") {
        const root = document.documentElement;
        root.style.setProperty("--moire", "0.5");
        root.style.setProperty("--grain", "0.06");
        root.style.setProperty("--vignette", "0.62");
        root.style.setProperty("--glow", "0.35");
      }
    };
  }, [intensity]);

  const intensityLabel = useMemo(
    () => (intensity >= 0.95 ? "MAX" : `${Math.round(intensity * 100)}%`),
    [intensity],
  );

  const toggleFaq = (index: number) => {
    setFaqOpen((prev) => (prev === index ? null : index));
  };

  const copyToClipboard = async (value: string, successMessage: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      toast.error("Clipboard unavailable.");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch (error: any) {
      toast.error(error?.message ?? "Copy failed.");
    }
  };

  return (
    <main className="relative isolate pb-24">
      <MoireLayer />
      <div className="pointer-events-none fixed inset-0 z-0 vignette" />

      <div className="relative z-20 flex flex-col gap-12">
        <header className="faxbar w-full bg-black/70 px-3 py-1 text-xs text-neutral-200 shadow-[0_2px_0_#000] backdrop-blur-sm md:text-sm">
          FAX FROM: FOID OPS // DATE // PAGE 001/001
        </header>

        <section className="rounded-3xl border border-neutral-800/60 bg-neutral-950/70 p-8 shadow-card">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="space-y-4">
              <h1 className="text-4xl font-black tracking-tight text-neutral-50 sm:text-5xl">
                foid.fun—make on-chain fun again.
              </h1>
              <p className="max-w-2xl text-lg text-neutral-300 sm:text-xl">
                launch anything, swap everything—on fluent testnet, fast and cheap.
              </p>
            </div>
            <div className="flex flex-col gap-2 text-xs uppercase tracking-[0.35em] text-neutral-400">
              <span>fax log id 20994</span>
              <span>checksum 0xf0id</span>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <label
              htmlFor="intensity"
              className="text-xs font-semibold uppercase tracking-[0.4em] text-neutral-300"
            >
              INTENSITY
            </label>
            <input
              id="intensity"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={intensity}
              onChange={(event) => setIntensity(Number(event.target.value))}
              className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-neutral-800 accent-fluent-pink"
            />
            <span className="font-mono text-sm uppercase tracking-[0.4em] text-neutral-200">
              {intensityLabel}
            </span>
          </div>
        </section>

        <section className="rounded-3xl bg-neutral-950/70 p-8 ring-1 ring-neutral-800/40">
          <div className="mb-6 flex flex-col gap-2">
            <h2 className="text-sm uppercase tracking-[0.45em] text-neutral-400">launch suite</h2>
            <p className="text-2xl font-semibold text-neutral-50">three apps, zero friction.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {appTiles.map((tile) => (
              <Link
                key={tile.title}
                href={tile.href}
                className="group flex h-full flex-col justify-between gap-4 rounded-2xl bg-neutral-950/80 p-6 ring-1 ring-neutral-800/50 transition hover:ring-fluent-pink/60 hover:bg-neutral-950"
              >
                <div className="space-y-3">
                  <div className="flex justify-end text-xs uppercase tracking-[0.4em] text-neutral-400">
                    <span>enter →</span>
                  </div>
                  <h3 className="text-2xl font-bold text-neutral-50">{tile.title}</h3>
                  <p className="text-sm text-neutral-300">{tile.body}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-neutral-950/70 p-8 ring-1 ring-neutral-800/40">
          <div className="mb-6 flex flex-col gap-2">
            <h2 className="text-sm uppercase tracking-[0.45em] text-neutral-400">
              why choose fluent
            </h2>
            <p className="text-2xl font-semibold text-neutral-50">three signals builders care about.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {valueProps.map((prop) => (
              <div
                key={prop.title}
                className="flex h-full flex-col justify-between gap-4 rounded-2xl bg-neutral-950/85 p-6 ring-1 ring-neutral-800/40"
              >
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-neutral-100">{prop.title}</h3>
                  <p className="text-sm text-neutral-300">{prop.body}</p>
                </div>
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-neutral-400">
                  <Link href="https://docs.fluent.xyz" target="_blank" rel="noopener noreferrer">
                    docs.fluent.xyz
                  </Link>
                  <span>+1</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-neutral-950/75 p-8 ring-1 ring-neutral-800/40">
          <div className="mb-6 flex flex-col gap-2">
            <h2 className="text-sm uppercase tracking-[0.45em] text-neutral-400">contracts</h2>
            <p className="text-2xl font-semibold text-neutral-50">copy, paste, ship.</p>
          </div>
          <ul className="space-y-4 font-mono text-xs uppercase tracking-[0.25em] text-neutral-400">
            {CONTRACT_ADDRESSES.map((contract) => (
              <li
                key={contract.label}
                className="flex flex-col gap-3 rounded-2xl bg-neutral-950/80 p-5 ring-1 ring-neutral-800/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm text-neutral-200">{contract.label}</p>
                  <p className="break-all text-[0.7rem] lowercase text-neutral-400/80">
                    {contract.address}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      void copyToClipboard(contract.address, `${contract.label} copied.`)
                    }
                    className="rounded-xl px-4 py-2 text-[0.65rem] text-neutral-200 transition hover:text-white hover:ring-1 hover:ring-fluent-pink/50"
                  >
                    copy
                  </button>
                  <a
                    href={`${NETWORK_DETAILS.explorer}/address/${contract.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl px-4 py-2 text-[0.65rem] text-neutral-200 transition hover:text-white hover:ring-1 hover:ring-fluent-pink/50"
                  >
                    view →
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl bg-neutral-950/70 p-8 ring-1 ring-neutral-800/40">
          <div className="mb-6 flex flex-col gap-2">
            <h2 className="text-sm uppercase tracking-[0.45em] text-neutral-400">faq</h2>
            <p className="text-2xl font-semibold text-neutral-50">builder questions, answered.</p>
          </div>
          <div className="space-y-3">
            {faqItems.map((item, index) => {
              const open = faqOpen === index;
              return (
                <div key={item.question} className="rounded-2xl bg-neutral-950/85 ring-1 ring-neutral-800/40">
                  <button
                    type="button"
                    onClick={() => toggleFaq(index)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm uppercase tracking-[0.35em] text-neutral-200 transition hover:bg-neutral-900/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-fluent-pink/60"
                    aria-expanded={open}
                  >
                    <span>{item.question}</span>
                    <span className="text-lg leading-none">{open ? "—" : "+"}</span>
                  </button>
                  {open && (
                    <div className="px-4 pb-4 text-[0.7rem] uppercase tracking-[0.25em] text-neutral-400">
                      {item.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <footer className="rounded-3xl border border-neutral-800/60 bg-neutral-950/80 px-6 py-8 shadow-card">
          <div className="flex flex-col items-center gap-4 text-xs uppercase tracking-[0.4em] text-neutral-400">
            <span className="text-neutral-500/80">follow the signal.</span>
            <a
              href="https://x.com/foidfun"
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-700/70 bg-black/60 px-4 py-2 text-neutral-200 transition hover:border-fluent-pink/60 hover:text-white"
            >
              X / @foidfun →
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}

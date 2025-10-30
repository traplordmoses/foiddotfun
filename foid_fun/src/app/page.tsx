/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { toast } from "react-hot-toast";
import MoireLayer from "./(components)/MoireLayer";
import { SwapBox } from "./(components)/SwapBox";
import { Stamp } from "./(components)/Stamp";
import { CONTRACT_ADDRESSES, NETWORK_DETAILS } from "./(components)/contracts";

const stackCards = [
  {
    title: "foid factory",
    copy: "3-step: name → mint → launch pool",
    detail:
      "Spin up tokens with prestamped metadata, leak an invite, then flood the pool with obedient liquidity.",
  },
  {
    title: "foidswap",
    copy: "constant-product pools, 0.3%/hop, auto multi-hop routing",
    detail:
      "Router ghosts through any wFOID pair, paying itself in 30 bps crumbs while traders chase the next tick.",
  },
  {
    title: "foid name service (fns)",
    copy: "human .foid names (teaser/alpha)",
    detail:
      "Reserve your alias before the compliance drones catch the scent. Directory not indexed; distribution redacted.",
  },
] as const;

const roadmapItems = [
  { label: "polish swap ui", done: true },
  { label: "launch factory mvp", done: false },
  { label: "fns alpha", done: false },
] as const;

const faqItems = [
  {
    question: "how to add fluent testnet",
    answer:
      "Use the Add Network prompt above or use MetaMask → Add Network → paste RPC https://rpc.testnet.fluent.xyz → Chain ID 20994 → Symbol ETH → Save.",
  },
  {
    question: "how to get test tokens",
    answer:
      "Raid the Fluent faucet in Discord #testnet-faucet. Request wFOID + test ETH, wait for notarized drip, then refresh the swap.",
  },
  {
    question: "is this mainnet?",
    answer:
      "No—this is Fluent Testnet. Mainnet launch TBD once the paperwork dries and the routers survive stress tests.",
  },
] as const;

function Paperclip({ className = "" }: { className?: string }) {
  return (
    <div
      className={`cursor-move select-none text-neutral-200/70 mix-blend-multiply drop-shadow-md ${className}`}
      draggable
    >
      <svg
        className="h-10 w-10"
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M23 20c0-5 5-9 10-9s9 4 9 9v22c0 6-4 11-9 11s-10-5-10-11V24c0-3 2-5 5-5s5 2 5 5v17"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export default function FoidLanding() {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [calmMode, setCalmMode] = useState(false);
  const [moireIntensity, setMoireIntensity] = useState(0.5);
  const [faqOpen, setFaqOpen] = useState<Set<number>>(new Set());

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--moire", (calmMode ? 0 : moireIntensity).toString());
    root.style.setProperty("--grain", calmMode ? "0.02" : "0.06");
    return () => {
      root.style.setProperty("--moire", "0.5");
      root.style.setProperty("--grain", "0.06");
    };
  }, [calmMode, moireIntensity]);

  const heroMotion = useMemo(
    () => ({
      rotate: calmMode ? 0 : [-0.4, 0.3, -0.2, 0.2, 0],
      y: calmMode ? 0 : [-1, 0, 1, 0, -1],
    }),
    [calmMode],
  );

  const handleConnect = () => {
    if (isConnected) {
      toast.success("Wallet already connected.");
      return;
    }
    openConnectModal?.();
  };

  const handleSwapScroll = () => {
    const element = document.getElementById("swap");
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const toggleFaq = (index: number) => {
    setFaqOpen((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const heroHeadlineClass = calmMode ? "" : "cmyk-misregister";

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
      {!calmMode && <MoireLayer />}
      {!calmMode && (
        <div
          className="scanlines pointer-events-none fixed inset-0 z-10"
          style={{ opacity: 0.16 }}
        />
      )}
      <div className="pointer-events-none fixed inset-0 z-0 vignette" />

      <div className="relative z-20 flex flex-col gap-12">
        <header className="faxbar w-full text-xs md:text-sm text-neutral-200 bg-black/60 px-3 py-1 shadow-[0_2px_0_#000] backdrop-blur-sm">
          FAX FROM: FOID OPS // DATE // PAGE 001/001
        </header>

        <section className="relative rounded-3xl border border-neutral-800/70 bg-neutral-950/80 p-6 sm:p-10 shadow-[0_0_120px_rgba(0,0,0,0.45)]">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22240%22 height=%22240%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%223%22/></filter><rect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22 opacity=%220.06%22/></svg>')] opacity-80 mix-blend-multiply" />
          <div className="absolute -top-10 right-4 text-[0.65rem] uppercase tracking-[0.4em] text-neutral-400/80">
            EXIF // foid.fun // fluent leak
          </div>
          <motion.div
            className="relative space-y-6"
            animate={heroMotion}
            transition={{ duration: calmMode ? 12 : 6, repeat: Infinity, repeatType: "mirror" }}
          >
            <div className="relative inline-block">
              <span className="absolute -left-8 -top-8 rotate-[-8deg] bg-yellow-300/80 px-3 py-1 text-[0.6rem] uppercase tracking-[0.4em] text-yellow-900 shadow-sm">
                leaked memo
              </span>
              <h1
                className={`text-4xl md:text-6xl lg:text-7xl font-black text-neutral-50 drop-shadow-lg ${heroHeadlineClass}`}
              >
                <span data-text="foid.fun — make on-chain fun again">
                  foid.fun — make on-chain fun again
                </span>
              </h1>
            </div>

            <p className="max-w-2xl text-lg text-neutral-200/90 [text-shadow:_0_0_12px_rgba(0,0,0,0.6)]">
              launch anything, swap everything — auto-routed on fluent testnet. artifacts, receipts,
              and routing intel straight from the FOID ops desk.
            </p>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <motion.button
                type="button"
                onClick={handleConnect}
                className="group inline-flex items-center justify-center rounded-full border border-red-500/70 bg-red-600/30 px-6 py-3 text-sm uppercase tracking-[0.3em] text-red-100 shadow-[4px_4px_0_rgba(0,0,0,0.55)] transition hover:bg-red-500/50 focus:outline-none focus:ring-2 focus:ring-red-300/70"
                animate={calmMode ? {} : { rotate: [-1.5, 1.5, -0.75, 0] }}
                transition={{ duration: calmMode ? 10 : 6, repeat: Infinity, repeatType: "mirror" }}
              >
                connect wallet
              </motion.button>
              <button
                type="button"
                onClick={handleSwapScroll}
                className="inline-flex items-center justify-center rounded-full border border-emerald-400/70 bg-emerald-500/20 px-6 py-3 text-sm uppercase tracking-[0.3em] text-emerald-100 shadow-[4px_4px_0_rgba(0,0,0,0.55)] transition hover:bg-emerald-400/30 focus:outline-none focus:ring-2 focus:ring-emerald-300/70"
              >
                try the swap
              </button>
              <div className="flex items-center gap-3 rounded-full border border-neutral-700/70 bg-neutral-900/60 px-5 py-3 text-xs uppercase tracking-[0.3em] text-neutral-300">
                <label htmlFor="calm-mode-toggle" className="cursor-pointer">
                  calm mode
                </label>
                <button
                  id="calm-mode-toggle"
                  type="button"
                  onClick={() => setCalmMode((prev) => !prev)}
                  aria-pressed={calmMode}
                  className={`relative h-6 w-10 rounded-full border border-neutral-600 transition ${
                    calmMode ? "bg-emerald-400/40" : "bg-neutral-800"
                  } focus:outline-none focus:ring-2 focus:ring-neutral-200/70`}
                >
                  <span
                    className={`absolute top-[3px] h-4 w-4 rounded-full bg-neutral-200 transition ${
                      calmMode ? "right-[4px]" : "left-[4px]"
                    }`}
                  />
                </button>
              </div>
            </div>

            {!calmMode && (
              <div className="flex items-center gap-3 rounded-lg border border-neutral-700/60 bg-neutral-900/70 px-4 py-3 text-xs uppercase tracking-[0.3em] text-neutral-300">
                <span>moire intensity</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={moireIntensity}
                  onChange={(event) => setMoireIntensity(Number(event.target.value))}
                  className="h-1 flex-1 appearance-none rounded-full bg-neutral-800 accent-emerald-400"
                />
                <span>{moireIntensity.toFixed(2)}</span>
              </div>
            )}
          </motion.div>

          <div className="mt-10 flex flex-wrap items-center gap-4 text-xs uppercase tracking-[0.4em] text-neutral-500">
            <span className="redact px-4 py-1" title="[REDACTED]">
              [redacted]
            </span>
            <span>fax log id 20994</span>
            <span>checksum 0xf0id</span>
          </div>
        </section>

        <section className="relative">
          <div className="absolute -left-6 top-0 rotate-[4deg] text-[0.6rem] uppercase tracking-[0.4em] text-neutral-500">
            route trace
          </div>
          <SwapBox calm={calmMode} />
        </section>

        <section className="relative grid gap-6 lg:grid-cols-3">
          {stackCards.map((card, index) => (
            <motion.article
              key={card.title}
              className={`relative overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-950/90 p-6 paper shadow-[0_20px_60px_rgba(0,0,0,0.45)]`}
              animate={
                calmMode
                  ? {}
                  : {
                      rotate: [-1.5, 0.5, -0.3, 0.7, 0],
                    }
              }
              transition={{
                duration: calmMode ? 14 : 9 + index * 1.2,
                repeat: Infinity,
                repeatType: "mirror",
              }}
            >
              {!calmMode && <Paperclip className="absolute -right-2 top-4" />}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.08),transparent_60%)] opacity-60 mix-blend-multiply" />
              <div className="relative space-y-3">
                <h2 className="text-xl font-black uppercase tracking-[0.3em] text-neutral-100">
                  {card.title}
                </h2>
                <p className="text-neutral-300/90">{card.copy}</p>
                <p className="text-sm text-neutral-400/90">{card.detail}</p>
                {!calmMode && (
                  <Stamp text="APPROVED" className="mt-6 text-xs text-red-500" />
                )}
              </div>
              {!calmMode && index === 1 && (
                <span className="redact absolute bottom-6 right-6 px-4 py-2" title="[REDACTED]">
                  Not for circulation
                </span>
              )}
            </motion.article>
          ))}
        </section>

        <section className="relative rounded-3xl border border-neutral-800 bg-neutral-950/80 p-8 shadow-[0_0_80px_rgba(0,0,0,0.45)]">
          <div className="absolute -top-8 left-6 rotate-[-4deg] bg-blue-400/70 px-3 py-1 text-[0.65rem] uppercase tracking-[0.4em] text-blue-950 shadow-md">
            why fluent
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {["speed", "low fees", "smooth ux"].map((item) => (
              <div
                key={item}
                className="relative flex h-full w-full flex-col justify-between rounded-2xl border border-neutral-700 bg-neutral-900/80 p-6"
              >
                <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.03)_0,rgba(255,255,255,0.03)_1px,transparent_1px,transparent_6px)] opacity-40 mix-blend-soft-light" />
                <div className="relative space-y-2">
                  <h3 className="text-lg font-semibold uppercase tracking-[0.4em] text-neutral-200">
                    {item}
                  </h3>
                  <p className="text-sm text-neutral-400">
                    Fluent routers chew through hops without stalling. Faxed clip notes insist on {item}.
                  </p>
                </div>
                {!calmMode && (
                  <span className="mt-8 self-start bg-yellow-300/80 px-3 py-1 text-[0.6rem] uppercase tracking-[0.4em] text-yellow-900 shadow-sm">
                    field note
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="relative rounded-3xl border border-neutral-800 bg-neutral-950/85 p-8 shadow-[0_0_90px_rgba(0,0,0,0.45)]">
          <div className="absolute -top-7 left-4 rotate-[2deg] bg-sky-400/70 px-3 py-1 text-[0.65rem] uppercase tracking-[0.4em] text-sky-950 shadow-md">
            contracts dossier
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-sky-500/40 bg-neutral-900/70 p-6">
            <div className="absolute inset-0 bg-gradient-to-r from-sky-200/10 via-transparent to-sky-200/10 mix-blend-screen opacity-70" />
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22><rect fill=%22000000%22 width=%22100%25%22 height=%22100%25%22/><path stroke=%22rgba(0,153,255,0.08)%22 stroke-width=%221%22 d=%22M0 0h120v120H0zM0 40h120M0 80h120M40 0v120M80 0v120%22/></svg>')] opacity-50 mix-blend-soft-light" />
            <div className="relative space-y-6 font-mono text-xs uppercase tracking-[0.3em] text-sky-200">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded border border-sky-500/40 bg-sky-500/10 px-3 py-2">
                  network: {NETWORK_DETAILS.chainName}
                </span>
                <button
                  type="button"
                  onClick={() => void copyToClipboard(NETWORK_DETAILS.rpcUrl, "RPC copied to clipboard")}
                  className="rounded border border-sky-400/50 bg-sky-400/10 px-3 py-2 text-[0.65rem] lowercase tracking-[0.2em] hover:bg-sky-400/20 focus:outline-none focus:ring-2 focus:ring-sky-300/70"
                >
                  copy rpc
                </button>
                <button
                  type="button"
                  onClick={() => void copyToClipboard(String(NETWORK_DETAILS.chainId), "Chain ID copied.")}
                  className="rounded border border-sky-400/50 bg-sky-400/10 px-3 py-2 text-[0.65rem] lowercase tracking-[0.2em] hover:bg-sky-400/20 focus:outline-none focus:ring-2 focus:ring-sky-300/70"
                >
                  copy chain id
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {CONTRACT_ADDRESSES.map((contract) => (
                  <div
                    key={contract.label}
                    className="relative flex flex-col gap-3 rounded-xl border border-sky-400/40 bg-black/60 p-4 text-[0.7rem] tracking-[0.25em]"
                  >
                    <div className="absolute inset-0 bg-sky-300/5 mix-blend-lighten" />
                    <div className="relative flex items-center justify-between text-sky-100">
                      <span>{contract.label}</span>
                      <a
                        href={`${NETWORK_DETAILS.explorer}/address/${contract.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline-offset-4 hover:underline"
                      >
                        view →
                      </a>
                    </div>
                    <div className="relative break-all text-[0.65rem] lowercase text-sky-200/80">
                      {contract.address}
                    </div>
                    <button
                      type="button"
                      onClick={() => void copyToClipboard(contract.address, `${contract.label} copied.`)}
                      className="relative self-start rounded border border-sky-400/40 bg-sky-400/10 px-3 py-[6px] text-[0.6rem] uppercase tracking-[0.3em] text-sky-200 hover:bg-sky-400/20 focus:outline-none focus:ring-2 focus:ring-sky-300/70"
                    >
                      copy
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[2fr,3fr]">
          <div className="relative overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-950/85 p-8">
            <div className="absolute -top-8 right-6 rotate-[-6deg] bg-pink-400/80 px-3 py-1 text-[0.65rem] uppercase tracking-[0.4em] text-pink-950 shadow">
              roadmap
            </div>
            <ul className="relative space-y-4 text-sm uppercase tracking-[0.3em] text-neutral-200">
              {roadmapItems.map((item) => (
                <li
                  key={item.label}
                  className={`flex items-center justify-between rounded-xl border border-neutral-700/60 bg-neutral-900/70 px-4 py-3 ${
                    item.done ? "line-through decoration-red-400/80" : ""
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="text-[0.65rem] text-neutral-400">
                    {item.done ? "struck" : "pending"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative rounded-3xl border border-neutral-800 bg-neutral-950/80 p-8">
            <div className="absolute -top-8 left-8 rotate-[4deg] bg-emerald-400/80 px-3 py-1 text-[0.65rem] uppercase tracking-[0.4em] text-emerald-950 shadow">
              faq: folded pamphlet
            </div>
            <div className="relative space-y-4">
              {faqItems.map((item, index) => {
                const open = faqOpen.has(index);
                return (
                  <div key={item.question} className="overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-900/70">
                    <button
                      type="button"
                      onClick={() => toggleFaq(index)}
                      className="flex w-full items-center justify-between px-4 py-3 text-sm uppercase tracking-[0.3em] text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-200/70"
                    >
                      <span>{item.question}</span>
                      <span className="text-xs">{open ? "—" : "+"}</span>
                    </button>
                    {open && (
                      <div className="px-4 pb-4 text-xs uppercase tracking-[0.2em] text-neutral-300">
                        {item.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <footer className="relative overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-950/90 px-6 py-10">
          <div className="absolute inset-0 opacity-30 mix-blend-multiply">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.04)_0,rgba(255,255,255,0.04)_2px,transparent_2px,transparent_4px)]" />
          </div>
          <div className="relative flex flex-col gap-4 text-xs uppercase tracking-[0.4em] text-neutral-400">
            <span className="self-center text-sm text-neutral-500/80">“illicit scan” watermark</span>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="https://github.com/foidfun"
                className="inline-flex items-center gap-2 rounded border border-neutral-600/70 bg-neutral-900/60 px-4 py-2 hover:bg-neutral-800/80"
              >
                <Stamp text="github" className="text-[0.6rem]" />
              </a>
              <a
                href="https://x.com/foidfun"
                className="inline-flex items-center gap-2 rounded border border-neutral-600/70 bg-neutral-900/60 px-4 py-2 hover:bg-neutral-800/80"
              >
                <Stamp text="x" className="text-[0.6rem]" />
              </a>
              <a
                href="https://discord.gg/fluentxyz"
                className="inline-flex items-center gap-2 rounded border border-neutral-600/70 bg-neutral-900/60 px-4 py-2 hover:bg-neutral-800/80"
              >
                <Stamp text="discord" className="text-[0.6rem]" />
              </a>
            </div>
            <p className="text-center text-[0.6rem] uppercase tracking-[0.5em] text-neutral-600">
              assembled by foid ops — copy leaks responsibly.
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}

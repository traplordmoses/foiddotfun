"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { toast } from "react-hot-toast";
import { CONTRACT_ADDRESSES, NETWORK_DETAILS } from "../(components)/contracts";

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
    body: "fluent lets contracts from different VMs interoperate on one chain, on shared state--no bridges. solidity and rust can call each other inside one app, enabling simpler architectures and new design space.",
  },
  {
    title: "zk-powered l2 security",
    body: "fluent is an ethereum l2 with a zkvm for verifiable execution. you keep ethereum settlement security while proving execution succinctly at high throughput.",
  },
  {
    title: "dev ergonomics, familiar tools",
    body: "ship today with evm compatibility (solidity/vyper), then extend with rust/wasm when you're ready--the fluentbase sdk bridges types and shared state so both paths feel native. less friction, more composability.",
  },
] as const;

const faqItems = [
  {
    question: "what is foid.fun?",
    answer:
      "a ritual-driven on-chain game. you check in daily (“pray with foid mommy”), mint foid20 tokens, swap them, and eventually mint a mifoid whose traits are shaped by how you showed up.",
  },
  {
    question: "how do i start?",
    answer:
      "connect an evm wallet, hit pray with mommy, and your encrypted check-in records streak + mood. then mint a foid20 in the factory and trade it instantly on foid swap.",
  },
  {
    question: "which wallets work?",
    answer: "most evm wallets (we test with metamask and rabby). make sure you’re on fluent testnet.",
  },
  {
    question: "is this mainnet?",
    answer:
      "no—this is an alpha on fluent testnet. tokens here have no financial value. it’s a live prototype of the game loop.",
  },
  {
    question: "what is a mifoid?",
    answer:
      "your on-chain avatar. its traits are influenced by your streak, mood tags, and in-app actions like minting or swapping.",
  },
  {
    question: "how do traits get decided?",
    answer:
      "inputs include consecutive days checked-in, variability of moods, and activity across the factory/swap. the exact trait mapping will be published at mint time so it stays fair and auditable.",
  },
  {
    question: "what happens if i miss a day?",
    answer:
      "your streak resets, but your lifetime score stays. show up again to rebuild momentum.",
  },
  {
    question: "when can i mint my mifoid?",
    answer:
      "season 1 is coming soon—current check-ins already count. the dashboard will surface countdown + eligibility.",
  },
  {
    question: "can i game it by spamming wallets?",
    answer:
      "one streak per address. anti-abuse checks run at mint time; consistent participation beats churn.",
  },
  {
    question: "is my prayer private?",
    answer:
      "yes. prayers are encrypted client-side before sending; the chain stores ciphertext/hashed data only. explorers show encoded bytes, not plain text.",
  },
  {
    question: "can i edit or delete a prayer?",
    answer:
      "no. on-chain records are immutable. if you make a mistake, submit a new check-in the next day.",
  },
  {
    question: "do you ask for unlimited approvals?",
    answer:
      "we request the minimum allowances needed for minting or swapping. always read prompts before you sign.",
  },
  {
    question: "are the contracts open + verifiable?",
    answer: "yes. check the contracts section on this page for addresses and explorer links.",
  },
  {
    question: "what is wfoid?",
    answer:
      "the site’s native helper token—a dev tool with a clean UI so you can inspect balances, allowances, and contract flows. it’s for demos and testing.",
  },
  {
    question: "what is weth here?",
    answer:
      "wrap or unwrap eth ↔ weth directly on the page so you can trade on foid swap and provide liquidity.",
  },
  {
    question: "what is foid swap?",
    answer:
      "a uniswap v2-style router on fluent. pick tokens, set slippage, swap. it shows route, minimum received, and fees in real time.",
  },
  {
    question: "what is foidfactory?",
    answer:
      "a one-click foid20 token minter. every token deployed via the site ends with f01d / F01d thanks to deterministic deployment.",
  },
  {
    question: "why fluent?",
    answer:
      "speed, low fees, and dev-friendly UX—ideal for daily rituals with verifiable on-chain state.",
  },
  {
    question: "how do i add fluent testnet?",
    answer:
      "click “add network” when prompted or manually add: rpc https://rpc.testnet.fluent.xyz, chain id 20994, symbol ETH, explorer https://testnet.fluentscan.xyz.",
  },
  {
    question: "gas fees?",
    answer:
      "testnet gas is minimal. use the fluent faucet to fund your wallet. swaps, mints, and prayers are designed to stay lightweight.",
  },
  {
    question: "my wallet won’t connect.",
    answer:
      "refresh the page, switch networks, or re-enable the site in your wallet. if that fails, clear cache and reconnect.",
  },
  {
    question: "tx failed / stuck pending.",
    answer:
      "confirm you’re on fluent testnet, have testnet gas, and slippage isn’t too tight. retry with a fresh nonce if your wallet supports it.",
  },
  {
    question: "my streak didn’t update.",
    answer:
      "streaks roll over at 00:00 utc. if you checked in near reset, it may apply to the next day. the dashboard shows the latest recorded day.",
  },
  {
    question: "i minted a foid20—now what?",
    answer:
      "view it on the explorer, then create a pool or trade it on foid swap. share the vanity address (ending in f01d / F01d) so others can find it.",
  },
  {
    question: "safety & disclaimers?",
    answer:
      "alpha software on testnet—tokens have no financial value. always verify contract addresses and never sign transactions you don’t understand.",
  },
] as const;

export default function AboutPage() {
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  const toggleFaq = useCallback((index: number) => {
    setFaqOpen((prev) => (prev === index ? null : index));
  }, []);

  const copyToClipboard = useCallback(async (value: string, label: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      toast.error("Clipboard unavailable.");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success(label);
    } catch (error: any) {
      toast.error(error?.message ?? "Copy failed.");
    }
  }, []);

  return (
    <main className="relative isolate min-h-screen pb-24 text-white/90">
      <div className="pointer-events-none fixed inset-0 z-0 vignette" />

      <div className="relative z-10 space-y-16 px-6 pt-24">
        <section className="mx-auto max-w-5xl">
          <div className="foid-glass rounded-3xl px-8 py-10 text-center shadow-[0_24px_80px_rgba(11,46,78,0.45)]">
            <h1 className="text-4xl font-semibold tracking-[0.35em] text-white drop-shadow-[0_12px_30px_rgba(0,208,255,0.25)] sm:text-5xl">
              what is foid.fun
            </h1>
            <p className="mx-auto mt-4 max-w-3xl text-base text-white/75 sm:text-lg">
              foid.fun is a ritual-driven on-chain game. each day, you pray with foid mommy—a quick, private on-chain
              check-in that tracks your streak and mood. then you can mint a foid20 in the factory and trade instantly on
              foid swap. your consistency and choices shape the type of mifoid you’ll mint, so showing up actually changes
              outcomes. simple loop: show up → mint → swap → evolve. fast, playful, and fully on-chain.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl">
          <div className="foid-glass rounded-3xl p-8 text-white/90">
            <div className="mb-6 flex flex-col gap-2">
              <h2 className="text-sm uppercase tracking-[0.45em] text-foid-mint/75">launch suite</h2>
              <p className="text-2xl font-semibold text-white">three apps, zero friction.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {appTiles.map((tile) => (
                <Link
                  key={tile.title}
                  href={tile.href}
                  className="group foid-glass flex h-full flex-col justify-between gap-4 rounded-2xl p-6 transition hover:shadow-[0_0_35px_rgba(114,225,255,0.25)]"
                >
                  <div className="space-y-3">
                    <div className="flex justify-end text-xs uppercase tracking-[0.4em] text-white/55 transition group-hover:text-white/80">
                      <span>enter -&gt;</span>
                    </div>
                    <h3 className="text-2xl font-bold text-white drop-shadow-[0_2px_12px_rgba(0,208,255,0.18)]">
                      {tile.title}
                    </h3>
                    <p className="text-sm text-white/75">{tile.body}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl">
          <div className="foid-glass rounded-3xl p-8 text-white/90">
            <div className="mb-6 flex flex-col gap-2">
              <h2 className="text-sm uppercase tracking-[0.45em] text-foid-mint/75">why choose fluent</h2>
              <p className="text-2xl font-semibold text-white">three signals builders care about.</p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {valueProps.map((prop) => (
                <div
                  key={prop.title}
                  className="foid-glass flex h-full flex-col justify-between gap-4 rounded-2xl p-6 shadow-[0_0_32px_rgba(143,170,242,0.22)]"
                >
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-white drop-shadow-[0_2px_12px_rgba(0,208,255,0.18)]">
                      {prop.title}
                    </h3>
                    <p className="text-sm text-white/75">{prop.body}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-white/60">
                    <Link
                      href="https://docs.fluent.xyz"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition hover:text-white/85"
                    >
                      docs.fluent.xyz
                    </Link>
                    <span>+1</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl">
          <div className="foid-glass rounded-3xl p-8 text-white/90">
            <div className="mb-6 flex flex-col gap-2">
              <h2 className="text-sm uppercase tracking-[0.45em] text-foid-mint/75">contracts</h2>
              <p className="text-2xl font-semibold text-white">copy, paste, ship.</p>
            </div>
            <ul className="space-y-4 text-white/85">
              {CONTRACT_ADDRESSES.map((contract) => (
                <li
                  key={contract.label}
                  className="foid-glass flex flex-col gap-3 rounded-2xl p-5 shadow-[0_0_30px_rgba(0,208,255,0.16)] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold uppercase tracking-[0.35em] text-foid-mint/80">
                      {contract.label}
                    </p>
                    <p className="font-mono text-xs uppercase tracking-[0.25em] text-white/60">
                      {contract.address}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs uppercase tracking-[0.35em] text-white/60">
                    <button
                      type="button"
                      onClick={() => void copyToClipboard(contract.address, `${contract.label} copied.`)}
                      className="transition hover:text-white"
                    >
                      copy
                    </button>
                    <span className="hidden h-3 w-px bg-white/25 sm:block" />
                    <a
                      href={`${NETWORK_DETAILS.explorer}/address/${contract.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition hover:text-white"
                    >
                      view -&gt;
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl">
          <div className="foid-glass rounded-3xl p-8 text-white/90">
            <div className="mb-6 flex flex-col gap-2">
              <h2 className="text-sm uppercase tracking-[0.45em] text-foid-mint/75">faq</h2>
              <p className="text-2xl font-semibold text-white">questions, answered.</p>
            </div>
            <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-2">
              {faqItems.map((item, index) => {
                const open = faqOpen === index;
                return (
                  <div key={item.question} className="foid-glass rounded-2xl">
                    <button
                      type="button"
                      onClick={() => toggleFaq(index)}
                      className="flex w-full items-center justify-between px-5 py-3 text-left text-xs uppercase tracking-[0.45em] text-white/75 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-foid-cyan/60"
                      aria-expanded={open}
                    >
                      <span>{item.question}</span>
                      <span className="text-lg leading-none text-foid-mint/80">{open ? "--" : "+"}</span>
                    </button>
                    {open && (
                      <div className="px-5 pb-4 text-[0.7rem] uppercase tracking-[0.25em] text-white/60">
                        {item.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

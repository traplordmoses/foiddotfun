"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// PostWalletWelcome — celebration + guided first steps after wallet creation
// ---------------------------------------------------------------------------

const COOKIE_KEY = "foid_welcomed";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

function setCookie() {
  document.cookie = `${COOKIE_KEY}=1; max-age=${COOKIE_MAX_AGE}; path=/; samesite=lax`;
}

function hasCookie(): boolean {
  return document.cookie.split(";").some((c) => c.trim().startsWith(`${COOKIE_KEY}=`));
}

type Feature = {
  emoji: string;
  title: string;
  description: string;
  href: string;
  accent: string;
};

const FEATURES: Feature[] = [
  {
    emoji: "\uD83D\uDE4F",
    title: "PRAY",
    description: "Start your first daily prayer ritual with Foid Mommy.",
    href: "/pray",
    accent: "#00ffff",
  },
  {
    emoji: "\u2694\uFE0F",
    title: "VOTE",
    description: "Swipe to approve or reject proposals on the loreboard.",
    href: "/vote",
    accent: "#a855f7",
  },
  {
    emoji: "\uD83C\uDFA8",
    title: "LOREBOARD",
    description: "Explore the community canvas and propose your own images.",
    href: "/board",
    accent: "#ff6bd5",
  },
];

export default function PostWalletWelcome() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [phase, setPhase] = useState<"celebrate" | "guide">("celebrate");

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (hasCookie()) return; // Already welcomed
      setAddress(detail?.address ?? null);
      setShow(true);
      setPhase("celebrate");
      // Transition to guide phase after celebration
      const timer = setTimeout(() => setPhase("guide"), 2800);
      return () => clearTimeout(timer);
    };

    window.addEventListener("foid-wallet:created", handler);
    return () => window.removeEventListener("foid-wallet:created", handler);
  }, []);

  const dismiss = useCallback(() => {
    setCookie();
    setShow(false);
  }, []);

  const goTo = useCallback(
    (href: string) => {
      setCookie();
      setShow(false);
      router.push(href);
    },
    [router],
  );

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(12px)",
        zIndex: 100001,
      }}
    >
      {/* Celebration phase */}
      {phase === "celebrate" && (
        <div className="flex flex-col items-center gap-5 animate-welcome-in">
          {/* Particle ring */}
          <div className="relative w-24 h-24">
            <div
              className="absolute inset-0 rounded-full animate-welcome-ring"
              style={{
                border: "2px solid rgba(168,130,255,0.5)",
                boxShadow: "0 0 30px rgba(168,130,255,0.3), inset 0 0 20px rgba(168,130,255,0.1)",
              }}
            />
            <div
              className="absolute inset-2 rounded-full animate-welcome-ring-inner"
              style={{
                border: "1px solid rgba(245,160,192,0.4)",
                boxShadow: "0 0 20px rgba(245,160,192,0.2)",
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center text-4xl">
              {"\u2728"}
            </div>
          </div>

          <h1
            className="text-2xl font-bold tracking-[0.2em] uppercase"
            style={{
              background: "linear-gradient(135deg, #f5a0c0, #a882ff, #f5a0c0)",
              backgroundSize: "200% 100%",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation: "welcome-gradient 3s ease infinite",
              textShadow: "0 0 40px rgba(168,130,255,0.4)",
            }}
          >
            Welcome to FOID
          </h1>

          {address && (
            <div
              className="px-4 py-1.5 rounded-full text-xs font-mono tracking-wider"
              style={{
                background: "rgba(168,130,255,0.12)",
                border: "1px solid rgba(168,130,255,0.25)",
                color: "rgba(200,180,255,0.8)",
              }}
            >
              {address.slice(0, 6)}...{address.slice(-4)}
            </div>
          )}
        </div>
      )}

      {/* Guide phase */}
      {phase === "guide" && (
        <div className="w-[90vw] max-w-md animate-welcome-in">
          <div className="text-center mb-5">
            <h2
              className="text-lg font-bold tracking-[0.15em] uppercase"
              style={{
                background: "linear-gradient(135deg, #f5a0c0, #ffcce0)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Your journey begins
            </h2>
            <p className="text-xs text-white/40 mt-1 tracking-wider">
              Choose where to start
            </p>
          </div>

          <div className="space-y-3">
            {FEATURES.map((feature) => (
              <button
                key={feature.href}
                onClick={() => goTo(feature.href)}
                className="w-full text-left rounded-xl border border-white/10 p-4 transition-all duration-200 hover:border-white/25 hover:bg-white/5 group"
                style={{ background: "rgba(20,20,30,0.8)" }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{feature.emoji}</span>
                  <div>
                    <div
                      className="text-sm font-bold tracking-[0.12em] uppercase transition-all group-hover:drop-shadow-[0_0_8px_var(--accent)]"
                      style={{ color: feature.accent, "--accent": feature.accent } as React.CSSProperties}
                    >
                      {feature.title}
                    </div>
                    <div className="text-xs text-white/50 mt-0.5 leading-relaxed">
                      {feature.description}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={dismiss}
            className="w-full mt-4 text-center text-xs text-white/30 hover:text-white/50 transition-colors tracking-wider uppercase py-2"
          >
            Skip &mdash; explore on my own
          </button>
        </div>
      )}

      <style jsx global>{`
        @keyframes welcome-in {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-welcome-in {
          animation: welcome-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        @keyframes welcome-ring {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.15); opacity: 0; }
        }
        .animate-welcome-ring {
          animation: welcome-ring 2s ease-in-out infinite;
        }

        @keyframes welcome-ring-inner {
          0% { transform: scale(1.1); opacity: 0; }
          50% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.85); opacity: 0; }
        }
        .animate-welcome-ring-inner {
          animation: welcome-ring-inner 2s ease-in-out infinite 0.5s;
        }

        @keyframes welcome-gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </div>
  );
}

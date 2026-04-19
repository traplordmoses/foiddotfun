// /src/app/api/og/placement/[id]/route.tsx
// Open-Graph share card for a single Loreboard proposal. When someone posts
// foid.fun/board/proposal/123 to X, Farcaster, iMessage — this 1200×630
// PNG is what renders in the preview.
//
// Reads proposal data directly from the Loreboard contract via viem (no
// extra HTTP round-trip to our own /api/swipe/proposals), fetches the
// placement image from IPFS with a 1-hour revalidate, and composes a
// palette-gradient card using Satori via next/og.
//
// Satori quirk: every <div> must have an explicit display (it only
// supports flex / block / none / -webkit-box). We flatten the layout to
// keep that invariant obvious.

import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import { createPublicClient, http } from "viem";
import { LOREBOARD_ABI } from "@/lib/contracts/abis/loreboard";
import { CONTRACTS, RPC_URL, CHAIN_CONFIG } from "@/lib/contracts/addresses";
import { cidToHttpUrl } from "@/lib/ipfsUrl";
import { loadOgFonts } from "@/lib/ogFont";

export const runtime = "nodejs";
export const revalidate = 300;

type ProposalTuple = [
  bigint, string, string, bigint, bigint, boolean, boolean, bigint, number, number, number, number
];

type ProposalInfo = {
  id: number;
  proposer: string;
  ipfsCid: string;
  finalized: boolean;
  approved: boolean;
};

async function readProposal(id: number): Promise<ProposalInfo | null> {
  const address = CONTRACTS.SWIPE as `0x${string}`;
  if (!address) return null;
  const client = createPublicClient({
    chain: {
      id: CHAIN_CONFIG.id,
      name: CHAIN_CONFIG.name,
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [RPC_URL] } },
    },
    transport: http(RPC_URL),
  });
  try {
    const raw = (await client.readContract({
      address,
      abi: LOREBOARD_ABI,
      functionName: "getProposal",
      args: [BigInt(id)],
    })) as unknown;
    const t = raw as ProposalTuple;
    return {
      id,
      proposer: t[1] as string,
      ipfsCid: t[2] as string,
      finalized: t[5] as boolean,
      approved: t[6] as boolean,
    };
  } catch {
    return null;
  }
}

function shortAddress(addr: string): string {
  if (!addr || addr.length < 8) return addr || "0x????";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const CARD_W = 1200;
const CARD_H = 630;

// Palette — mirrors tokens.css so the card reads as "FOID" at a glance.
const C = {
  bg: "linear-gradient(135deg, #0e0f2b 0%, #180a38 100%)",
  cyan: "#74ffeb",
  purple: "#a78bfa",
  pink: "#f472b6",
  gold: "#fbbf24",
  white: "#ffffff",
};

function FallbackCard({ message }: { message: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: CARD_W,
        height: CARD_H,
        alignItems: "center",
        justifyContent: "center",
        background: C.bg,
        color: C.white,
        fontFamily: "Inter",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 22,
          letterSpacing: 8,
          color: C.cyan,
          fontWeight: 700,
          marginBottom: 16,
        }}
      >
        FOID FOUNDATION
      </div>
      <div style={{ display: "flex", fontSize: 44, fontWeight: 700 }}>{message}</div>
    </div>
  );
}

function PlacementCard({
  p,
  imageUrl,
}: {
  p: ProposalInfo;
  imageUrl: string | null;
}) {
  const engraved = p.finalized && p.approved;
  const badgeColor = engraved ? C.gold : C.purple;
  const badgeLabel = engraved ? "ENGRAVED ✦" : "IN VOTING";
  return (
    <div
      style={{
        display: "flex",
        width: CARD_W,
        height: CARD_H,
        background: C.bg,
        color: C.white,
        fontFamily: "Inter",
      }}
    >
      {/* Left — image panel */}
      <div
        style={{
          display: "flex",
          width: CARD_W * 0.55,
          height: "100%",
          padding: 48,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            borderRadius: 24,
            border: `2px solid ${C.cyan}55`,
            boxShadow: `0 0 60px ${C.purple}33, 0 20px 80px #00000080`,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
            background: "#00000066",
          }}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
            <img
              src={imageUrl}
              width={560}
              height={510}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div style={{ display: "flex", fontSize: 32, color: "#ffffff66" }}>
              no preview
            </div>
          )}
        </div>
      </div>

      {/* Right — stacked meta + wordmark */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: CARD_W * 0.45,
          padding: 48,
          paddingLeft: 0,
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 16,
              letterSpacing: 8,
              color: C.cyan,
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            FOID · LOREBOARD
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 84,
              fontWeight: 700,
              lineHeight: 1,
              background: `linear-gradient(135deg, ${C.cyan} 0%, ${C.purple} 50%, ${C.pink} 100%)`,
              backgroundClip: "text",
              color: "transparent",
              marginBottom: 14,
            }}
          >
            #{p.id}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 13,
              letterSpacing: 4,
              color: "#ffffff66",
              marginBottom: 4,
            }}
          >
            PROPOSED BY
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 28,
              fontWeight: 700,
              color: C.white,
              marginBottom: 14,
            }}
          >
            {shortAddress(p.proposer)}
          </div>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              padding: "10px 18px",
              background: `${badgeColor}22`,
              border: `2px solid ${badgeColor}`,
              borderRadius: 999,
              color: badgeColor,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: 6,
            }}
          >
            {badgeLabel}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 18,
            color: "#ffffff66",
            letterSpacing: 2,
            fontWeight: 700,
            justifyContent: "flex-end",
          }}
        >
          foid.fun/board
        </div>
      </div>
    </div>
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  const fonts = await loadOgFonts();
  const fontList = fonts
    ? [
        { name: "Inter", data: fonts.regular, style: "normal" as const, weight: 400 as const },
        { name: "Inter", data: fonts.bold, style: "normal" as const, weight: 700 as const },
      ]
    : undefined;

  if (!Number.isFinite(id) || id < 0) {
    return new ImageResponse(<FallbackCard message="Proposal not found" />, {
      width: CARD_W,
      height: CARD_H,
      fonts: fontList,
    });
  }

  const proposal = await readProposal(id);
  if (!proposal) {
    return new ImageResponse(<FallbackCard message="Proposal not found" />, {
      width: CARD_W,
      height: CARD_H,
      fonts: fontList,
    });
  }

  const imageUrl = proposal.ipfsCid ? cidToHttpUrl(proposal.ipfsCid) : null;
  return new ImageResponse(<PlacementCard p={proposal} imageUrl={imageUrl} />, {
    width: CARD_W,
    height: CARD_H,
    fonts: fontList,
  });
}

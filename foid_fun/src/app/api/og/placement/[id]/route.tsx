// /src/app/api/og/placement/[id]/route.ts
// Open-Graph share card for a single Loreboard proposal. When someone posts
// foid.fun/board/proposal/123 to X, Farcaster, iMessage — this 1200×630
// PNG is what renders in the preview.
//
// Reads proposal data directly from the Loreboard contract via viem (no
// extra HTTP round-trip to our own /api/swipe/proposals), fetches the
// placement image from IPFS with a 1-hour revalidate, and composes a
// palette-gradient card using Satori via next/og.

import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import { createPublicClient, http } from "viem";
import { LOREBOARD_ABI } from "@/lib/contracts/abis/loreboard";
import { CONTRACTS, RPC_URL, CHAIN_CONFIG } from "@/lib/contracts/addresses";
import { cidToHttpUrl } from "@/lib/ipfsUrl";
import { loadOgFonts } from "@/lib/ogFont";

// Node runtime — viem's http transport works on node and we want the
// fetch-cache behavior for the IPFS image. (Edge would also work but
// ImageResponse has a larger cold-start on edge when fonts aren't bundled.)
export const runtime = "nodejs";
export const revalidate = 300; // 5min page cache

type ProposalTuple = [
  bigint, // id
  string, // proposer
  string, // ipfsCid
  bigint, // createdAt
  bigint, // votingEndsAt
  boolean, // finalized
  boolean, // approved
  bigint, // placementId
  number, // gridX
  number, // gridY
  number, // gridW
  number, // gridH
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
    // Some viem decode paths return an object with named fields; array
    // access covers both — viem returns tuples as arrays by default.
    const proposer = t[1] as string;
    const ipfsCid = t[2] as string;
    const finalized = t[5] as boolean;
    const approved = t[6] as boolean;
    return {
      id,
      proposer,
      ipfsCid,
      finalized,
      approved,
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

// Palette matches /src/app/tokens.css so the card reads as "FOID" at a glance.
const COLORS = {
  bgA: "#0e0f2b",
  bgB: "#180a38",
  cyan: "#74ffeb",
  purple: "#a78bfa",
  pink: "#f472b6",
  gold: "#fbbf24",
};

function FallbackCard({ message }: { message: string }) {
  return (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(135deg, ${COLORS.bgA} 0%, ${COLORS.bgB} 100%)`,
        color: "#fff",
        fontSize: 48,
        fontFamily: "Inter",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div
          style={{
            fontSize: 22,
            letterSpacing: 8,
            color: COLORS.cyan,
            fontWeight: 700,
          }}
        >
          FOID FOUNDATION
        </div>
        <div style={{ fontSize: 44, fontWeight: 700 }}>{message}</div>
      </div>
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
  return (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        display: "flex",
        background: `linear-gradient(135deg, ${COLORS.bgA} 0%, ${COLORS.bgB} 100%)`,
        color: "#fff",
        fontFamily: "Inter",
        position: "relative",
      }}
    >
      {/* Left — image or placeholder */}
      <div
        style={{
          width: CARD_W * 0.55,
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 48,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 24,
            border: `2px solid ${COLORS.cyan}55`,
            boxShadow: `0 0 60px ${COLORS.purple}33, 0 20px 80px #00000080`,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#00000066",
          }}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              width={560}
              height={510}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div style={{ fontSize: 32, color: "#ffffff66" }}>no preview</div>
          )}
        </div>
      </div>

      {/* Right — meta */}
      <div
        style={{
          width: CARD_W * 0.45,
          display: "flex",
          flexDirection: "column",
          padding: 48,
          paddingLeft: 0,
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              fontSize: 16,
              letterSpacing: 8,
              color: COLORS.cyan,
              fontWeight: 700,
            }}
          >
            FOID · LOREBOARD
          </div>
          <div
            style={{
              fontSize: 84,
              fontWeight: 700,
              lineHeight: 1,
              background: `linear-gradient(135deg, ${COLORS.cyan} 0%, ${COLORS.purple} 50%, ${COLORS.pink} 100%)`,
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            #{p.id}
          </div>
          <div style={{ fontSize: 22, color: "#ffffffcc", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 13, letterSpacing: 4, color: "#ffffff66" }}>PROPOSED BY</div>
            <div style={{ fontFamily: "Inter", fontSize: 28, fontWeight: 700, color: "#fff" }}>
              {shortAddress(p.proposer)}
            </div>
          </div>

          {engraved ? (
            <div
              style={{
                display: "inline-flex",
                alignSelf: "flex-start",
                padding: "10px 18px",
                background: `${COLORS.gold}22`,
                border: `2px solid ${COLORS.gold}`,
                borderRadius: 999,
                color: COLORS.gold,
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: 6,
                marginTop: 12,
              }}
            >
              ENGRAVED ✦
            </div>
          ) : (
            <div
              style={{
                display: "inline-flex",
                alignSelf: "flex-start",
                padding: "10px 18px",
                background: `${COLORS.purple}22`,
                border: `2px solid ${COLORS.purple}`,
                borderRadius: 999,
                color: COLORS.purple,
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: 6,
                marginTop: 12,
              }}
            >
              IN VOTING
            </div>
          )}
        </div>

        <div
          style={{
            fontSize: 18,
            color: "#ffffff66",
            letterSpacing: 2,
            textAlign: "right",
            fontWeight: 700,
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

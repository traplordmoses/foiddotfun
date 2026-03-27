import { TILE, type Rect } from "@/lib/grid";
import { contractToWorldRect } from "@/lib/boardSpace";
import { ipfsToHttp } from "@/lib/ipfsUrl";
import type { ProposalSummary } from "@/lib/api";

// ============================================================================
// CID VALIDATION
// ============================================================================

export const isValidCid = (value: string): boolean => {
  const trimmed = value.trim();
  if (/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(trimmed)) return true;
  if (/^b[a-z2-7]{58,}$/.test(trimmed)) return true;
  if (/^dev-/.test(trimmed)) return true;
  return false;
};

export const normalizeCidString = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Empty CID");

  let cidPart = trimmed;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const parts = url.pathname.replace(/^\/+/, "").split("/");
      cidPart = parts.slice(parts[0] === "ipfs" ? 1 : 0)[0] || "";
    } catch {
      throw new Error("Invalid IPFS URL");
    }
  } else if (trimmed.startsWith("ipfs://")) {
    cidPart = trimmed.replace(/^ipfs:\/\//, "");
  }

  if (!isValidCid(cidPart)) {
    throw new Error(`Invalid CID format: ${cidPart.slice(0, 20)}...`);
  }

  return `ipfs://${cidPart}`;
};

// ============================================================================
// TYPE GUARDS
// ============================================================================

export const isBytes32Hex = (value?: string): value is `0x${string}` =>
  typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

// ============================================================================
// RECT HELPERS
// ============================================================================

export const asWorldRect = (value: unknown): Rect => {
  if (!isRecord(value)) {
    throw new Error("Invalid rect: expected object");
  }

  const src = value;
  const rect = isRecord(src.rect) ? src.rect : src;

  const x = Number(rect.x);
  const y = Number(rect.y);
  const w = Number(rect.w ?? rect.width);
  const h = Number(rect.h ?? rect.height);

  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) {
    throw new Error("Invalid rect: non-numeric or missing coordinates");
  }

  if (w < 0 || h < 0) {
    throw new Error("Invalid rect: negative dimensions");
  }

  return { x, y, w, h };
};

// ============================================================================
// PROPOSAL NORMALIZATION
// ============================================================================

export const normalizeProposals = (list: ProposalSummary[] | undefined): ProposalSummary[] =>
  (list ?? []).map((p) => {
    const contractRect = asWorldRect(p.rect ?? p);
    const rect = contractToWorldRect(contractRect);
    const cells = Math.floor((contractRect.w / TILE) * (contractRect.h / TILE));
    const placementId = isBytes32Hex(p.id) ? p.id : isBytes32Hex(p.placementId) ? p.placementId : isBytes32Hex(p.chainId) ? p.chainId : undefined;
    const yes = p.yesVotes ?? p.yes ?? 0;
    const no = p.noVotes ?? p.no ?? 0;
    return { ...p, rect, cells, placementId, epochId: p.epochSubmitted ?? 0, yes, no };
  });

// ============================================================================
// IPFS HELPERS
// ============================================================================

export function tryNextGateway(el: HTMLImageElement, cid?: string) {
  if (!cid) return;
  const urls = ipfsToHttp(cid);
  const idx = Number(el.dataset.gatewayIndex ?? "-1") + 1;
  if (idx < urls.length) { el.src = urls[idx]; el.dataset.gatewayIndex = String(idx); }
}

// ============================================================================
// IMAGE SIZE HELPERS
// ============================================================================

export async function getImageSize(file: File): Promise<{ w: number; h: number }> {
  try {
    const createBitmap = typeof createImageBitmap === "function" ? createImageBitmap : null;
    const bmp = createBitmap ? await createBitmap(file) : null;
    if (bmp) {
      const w = bmp.width, h = bmp.height;
      bmp.close?.();
      return { w, h };
    }
  } catch { /* fall through */ }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    return { w: img.naturalWidth, h: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ============================================================================
// MISC
// ============================================================================

export const debugWarn = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") {
    console.warn(...args);
  }
};

export type EthereumProvider = {
  request: (args: { method: string; params?: readonly unknown[] }) => Promise<unknown>;
};

import type { Abi, AbiEvent, Address, Hex } from "viem";
import { decodeEventLog, encodePacked, getEventSelector, keccak256 } from "viem";
import type { LogItem } from "./logTypes";
import type { Rect } from "./types";

export function computePlacementId(
  bidder: Address,
  epoch: bigint,
  cidHash: Hex,
  r: Rect
): Hex {
  return keccak256(
    encodePacked(
      ["address", "uint256", "bytes32", "int32", "int32", "uint32", "uint32"],
      [bidder, epoch, cidHash, r.x, r.y, r.w, r.h]
    )
  );
}

export function parseOptionalBigInt(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return BigInt(trimmed);
}

export function coerceRect(raw: any): Rect {
  const src = raw?.rect ?? raw ?? {};
  const x = Number(src.x ?? 0);
  const y = Number(src.y ?? 0);
  const w = Number(src.w ?? src.width ?? 0);
  const h = Number(src.h ?? src.height ?? 0);
  return { x, y, w, h };
}

export function isEmptyCode(code: Hex) {
  return !code || code === "0x" || code === "0x0";
}

export function abiEventSig(event: AbiEvent): string {
  const inputs = event.inputs?.map((input) => input.type).join(",") ?? "";
  return `${event.name}(${inputs})`;
}

export function logAbiEventSelectors(params: { abi: Abi; label: string }) {
  const events = params.abi.filter(
    (item) => item.type === "event"
  ) as AbiEvent[];
  const lines = events.slice(0, 50).map((event) => {
    const sig = abiEventSig(event);
    const selector = getEventSelector(event);
    return `${sig} -> ${selector}`;
  });
  console.log(`[logs] ${params.label} ABI event selectors (first 50):`);
  for (const line of lines) {
    console.log(`[logs] ${line}`);
  }
}

export function logTopTopic0Counts(params: {
  logs: { topics?: Hex[] }[];
  limit?: number;
}) {
  const counts = new Map<string, number>();
  for (const log of params.logs) {
    const topic0 = log.topics?.[0];
    if (!topic0) continue;
    counts.set(topic0, (counts.get(topic0) ?? 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const limit = params.limit ?? 10;
  const top = sorted.slice(0, limit);
  console.log(`[logs] top topic0 counts (limit=${limit})`);
  for (const [topic, count] of top) {
    console.log(`[logs] ${topic} -> ${count}`);
  }
}

export function tryDecodeEventLog(params: {
  log: LogItem;
  debug: boolean;
  event: AbiEvent;
  failureLabel: string;
}): LogItem {
  try {
    const topics = (params.log.topics ?? []) as unknown as [Hex, ...Hex[]];
    const decoded = decodeEventLog({
      abi: [params.event],
      data: params.log.data,
      topics,
    });
    return { ...params.log, args: decoded.args };
  } catch (err) {
    if (params.debug) {
      const msg = err instanceof Error ? err.message : String(err);
      const topicsCount = params.log.topics?.length ?? 0;
      const dataLen = typeof params.log.data === "string" ? params.log.data.length : 0;
      console.warn(
        `[logs] ${params.failureLabel} block=${params.log.blockNumber} topics=${topicsCount} dataLen=${dataLen} error=${msg}`
      );
    }
    return params.log;
  }
}

export function readNumberArg(args: any, keys: string[]): number | null {
  for (const key of keys) {
    const value = args?.[key];
    if (value === undefined || value === null) continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function readHexArg(args: any, keys: string[]): Hex | null {
  for (const key of keys) {
    const value = args?.[key];
    if (typeof value === "string" && value.startsWith("0x")) {
      return value as Hex;
    }
  }
  return null;
}

export function readAddressArg(args: any, keys: string[]): Address | null {
  for (const key of keys) {
    const value = args?.[key];
    if (typeof value === "string" && value.startsWith("0x")) {
      return value as Address;
    }
  }
  return null;
}

export function topicToAddress(topic: Hex | undefined): Address | null {
  if (!topic || !topic.startsWith("0x") || topic.length < 42) return null;
  return (`0x${topic.slice(-40)}`) as Address;
}

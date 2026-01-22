type ViemErrorLike = {
  shortMessage?: string;
  message?: string;
  reason?: string;
  data?: unknown;
  cause?: ViemErrorLike;
};

export function formatViemError(error: unknown): string {
  const err = (typeof error === "object" && error !== null ? (error as ViemErrorLike) : {}) as ViemErrorLike;
  const candidateSources = [
    err.reason,
    err.shortMessage,
    err.message,
    err.cause?.reason,
    err.cause?.shortMessage,
    err.cause?.message,
    err.cause?.cause?.reason,
    err.cause?.cause?.shortMessage,
    err.cause?.cause?.message,
  ];
  const normalized = candidateSources
    .map((value) => (typeof value === "string" ? value.trim() : undefined))
    .filter((value): value is string => Boolean(value && value.length));
  const fallback = normalized[0] ?? "tx failed";
  const reasonMatch = /reason:\s*"?([^"\n]+?)"?/i.exec(fallback);
  if (reasonMatch) return reasonMatch[1].trim();
  const data = err.data ?? err.cause?.data ?? err.cause?.cause?.data;
  if (typeof data === "string" && data.startsWith("0x")) {
    return `${fallback} (${data.slice(0, 10)}…)`;
  }
  return fallback;
}

type ViemErrorLike = {
  shortMessage?: string;
  message?: string;
  reason?: string;
  data?: unknown;
  cause?: ViemErrorLike;
};

// User-friendly error messages for common contract errors
const ERROR_MESSAGES: Record<string, string> = {
  'CooldownActive': 'You can only pray once every 24 hours. Please wait for your cooldown to expire.',
  'InvalidPrayer': 'Your prayer could not be submitted. Please try again with different text.',
  'insufficient funds': 'Insufficient funds to pay for gas. Please add more funds to your wallet.',
  'user rejected': 'You rejected the transaction in your wallet.',
  'nonce too low': 'Transaction nonce error. Please try again.',
  'replacement transaction underpriced': 'Transaction replacement failed. Please try again.',
  'execution reverted': 'Transaction would fail. Please check the error details.',
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

  // Check for known error patterns and return user-friendly message
  for (const [pattern, message] of Object.entries(ERROR_MESSAGES)) {
    if (fallback.toLowerCase().includes(pattern.toLowerCase())) {
      return message;
    }
  }

  // Try to extract reason from error message
  const reasonMatch = /reason:\s*"?([^"\n]+?)"?/i.exec(fallback);
  if (reasonMatch) {
    const reason = reasonMatch[1].trim();
    // Check if the reason matches a known error
    for (const [pattern, message] of Object.entries(ERROR_MESSAGES)) {
      if (reason.toLowerCase().includes(pattern.toLowerCase())) {
        return message;
      }
    }
    return reason;
  }

  const data = err.data ?? err.cause?.data ?? err.cause?.cause?.data;
  if (typeof data === "string" && data.startsWith("0x")) {
    return `${fallback} (${data.slice(0, 10)}…)`;
  }

  return fallback;
}

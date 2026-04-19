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
  'no active session': 'Your wallet is locked. Please unlock and try again.',
  'wallet unlock cancelled': 'You cancelled the wallet unlock.',
};

// Generic viem wrappers that hide the real error. When we see one of these
// at the top of the cause chain we keep walking inward for something specific.
const GENERIC_WRAPPERS = new Set<string>([
  "transaction creation failed.",
  "transaction creation failed",
  "an unknown rpc error occurred.",
  "an internal error was received.",
  "an error occurred while executing a json-rpc request.",
]);

function isGeneric(value: string): boolean {
  return GENERIC_WRAPPERS.has(value.toLowerCase().trim());
}

export function formatViemError(error: unknown): string {
  // Walk the full cause chain (depth-limited for safety)
  const chain: ViemErrorLike[] = [];
  let current: ViemErrorLike | undefined =
    typeof error === "object" && error !== null ? (error as ViemErrorLike) : undefined;
  const seen = new Set<ViemErrorLike>();
  while (current && chain.length < 10 && !seen.has(current)) {
    seen.add(current);
    chain.push(current);
    current = current.cause;
  }

  // Collect all candidate strings, preserving order so outer errors come first
  const candidates: string[] = [];
  for (const err of chain) {
    if (err.reason) candidates.push(String(err.reason).trim());
    if (err.shortMessage) candidates.push(String(err.shortMessage).trim());
    if (err.message) candidates.push(String(err.message).trim());
  }
  const normalized = candidates.filter((value) => value.length > 0);

  // Prefer the first non-generic message (i.e. skip viem's boilerplate wrappers
  // so the user sees the actual underlying error from signing / RPC).
  const specific = normalized.find((value) => !isGeneric(value));
  const fallback = specific ?? normalized[0] ?? "tx failed";

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

  const data =
    chain.map((err) => err.data).find((value) => typeof value === "string");
  if (typeof data === "string" && data.startsWith("0x")) {
    return `${fallback} (${data.slice(0, 10)}…)`;
  }

  return fallback;
}

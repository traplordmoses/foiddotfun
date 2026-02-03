/**
 * Web3 and general error parsing utilities
 * Provides user-friendly error messages for common blockchain errors
 */

// ============================================================================
// TYPES
// ============================================================================

export type ErrorCategory =
  | "user-rejection"
  | "insufficient-funds"
  | "gas-error"
  | "network-error"
  | "contract-error"
  | "timeout"
  | "unknown";

export type ParsedError = {
  category: ErrorCategory;
  message: string;
  originalError?: unknown;
};

// ============================================================================
// ERROR DETECTION HELPERS
// ============================================================================

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const extractErrorMessage = (err: unknown): string => {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (isRecord(err) && typeof err.message === "string") return err.message;
  if (isRecord(err) && typeof err.reason === "string") return err.reason;
  return String(err);
};

const getErrorCode = (err: unknown): string | number | undefined => {
  if (isRecord(err)) {
    if (typeof err.code === "string" || typeof err.code === "number") {
      return err.code;
    }
  }
  return undefined;
};

// ============================================================================
// ERROR PATTERNS
// ============================================================================

const ERROR_PATTERNS = {
  userRejection: [
    /user rejected/i,
    /user denied/i,
    /user cancelled/i,
    /user canceled/i,
    /rejected by user/i,
    /denied by user/i,
    /transaction.*rejected/i,
    /action_rejected/i,
  ],
  insufficientFunds: [
    /insufficient funds/i,
    /insufficient balance/i,
    /not enough.*funds/i,
    /exceeds balance/i,
    /transfer amount exceeds/i,
  ],
  gasError: [
    /gas required exceeds/i,
    /out of gas/i,
    /gas too low/i,
    /intrinsic gas too low/i,
    /gas price.*too low/i,
    /max fee per gas less than/i,
  ],
  networkError: [
    /network error/i,
    /network request failed/i,
    /failed to fetch/i,
    /connection.*failed/i,
    /could not connect/i,
    /network.*timeout/i,
  ],
  timeout: [
    /timeout/i,
    /timed out/i,
    /request.*timeout/i,
    /transaction.*timeout/i,
  ],
  contractError: [
    /execution reverted/i,
    /reverted/i,
    /contract.*error/i,
    /call revert exception/i,
  ],
};

// ============================================================================
// ERROR PARSER
// ============================================================================

/**
 * Parse a Web3 error into a user-friendly message
 *
 * @param err - Error object from wallet/transaction
 * @returns Parsed error with category and friendly message
 */
export function parseWeb3Error(err: unknown): ParsedError {
  const message = extractErrorMessage(err);
  const code = getErrorCode(err);

  // Check error code first (most reliable)
  if (code === 4001 || code === "ACTION_REJECTED") {
    return {
      category: "user-rejection",
      message: "Transaction cancelled by user",
      originalError: err,
    };
  }

  // Check message patterns
  for (const pattern of ERROR_PATTERNS.userRejection) {
    if (pattern.test(message)) {
      return {
        category: "user-rejection",
        message: "Transaction cancelled by user",
        originalError: err,
      };
    }
  }

  for (const pattern of ERROR_PATTERNS.insufficientFunds) {
    if (pattern.test(message)) {
      return {
        category: "insufficient-funds",
        message: "Insufficient funds to complete transaction",
        originalError: err,
      };
    }
  }

  for (const pattern of ERROR_PATTERNS.gasError) {
    if (pattern.test(message)) {
      return {
        category: "gas-error",
        message: "Gas estimation failed. Transaction may fail or cost too much.",
        originalError: err,
      };
    }
  }

  for (const pattern of ERROR_PATTERNS.networkError) {
    if (pattern.test(message)) {
      return {
        category: "network-error",
        message: "Network error. Check your connection and try again.",
        originalError: err,
      };
    }
  }

  for (const pattern of ERROR_PATTERNS.timeout) {
    if (pattern.test(message)) {
      return {
        category: "timeout",
        message: "Request timed out. Please try again.",
        originalError: err,
      };
    }
  }

  for (const pattern of ERROR_PATTERNS.contractError) {
    if (pattern.test(message)) {
      // Try to extract revert reason
      const revertMatch = message.match(/reverted[:\s]+(.+?)(?:\n|$)/i);
      const revertReason = revertMatch?.[1]?.trim();

      return {
        category: "contract-error",
        message: revertReason
          ? `Transaction failed: ${revertReason}`
          : "Transaction failed. Contract execution reverted.",
        originalError: err,
      };
    }
  }

  // Unknown error - return cleaned message
  return {
    category: "unknown",
    message: message || "An unknown error occurred",
    originalError: err,
  };
}

/**
 * Get a short, user-friendly error message
 * Strips technical details and keeps it concise
 *
 * @param err - Error object
 * @returns Short error message string
 */
export function getErrorMessage(err: unknown): string {
  const parsed = parseWeb3Error(err);
  return parsed.message;
}

/**
 * Check if an error is a user rejection (safe to ignore)
 *
 * @param err - Error object
 * @returns true if user rejected the transaction
 */
export function isUserRejection(err: unknown): boolean {
  const parsed = parseWeb3Error(err);
  return parsed.category === "user-rejection";
}

/**
 * Check if an error is an insufficient funds error
 *
 * @param err - Error object
 * @returns true if error is due to insufficient funds
 */
export function isInsufficientFunds(err: unknown): boolean {
  const parsed = parseWeb3Error(err);
  return parsed.category === "insufficient-funds";
}

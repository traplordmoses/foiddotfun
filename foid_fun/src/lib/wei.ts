// /src/lib/wei.ts
export const WEI_PER_GWEI = 10n ** 9n;
export const WEI_PER_ETH = 10n ** 18n;

/** Formats a bigint wei amount as ETH (e.g., 123456...n → "0.1234"). */
export function formatEth(wei: bigint, decimals = 4): string {
  const sign = wei < 0n ? "-" : "";
  const abs = wei < 0n ? -wei : wei;

  const whole = abs / WEI_PER_ETH;
  const frac = abs % WEI_PER_ETH;

  // build 18-digit fractional, then trim to requested decimals
  let fracStr = frac.toString().padStart(18, "0").slice(0, Math.max(0, decimals));
  fracStr = fracStr.replace(/0+$/, ""); // strip trailing zeros

  return sign + (fracStr ? `${whole}.${fracStr}` : whole.toString());
}

/** Formats a bigint wei amount as GWEI (useful for small totals). */
export function formatGwei(wei: bigint, decimals = 2): string {
  const sign = wei < 0n ? "-" : "";
  const abs = wei < 0n ? -wei : wei;

  const whole = abs / WEI_PER_GWEI;
  const frac = abs % WEI_PER_GWEI;

  let fracStr = frac.toString().padStart(9, "0").slice(0, Math.max(0, decimals));
  fracStr = fracStr.replace(/0+$/, "");

  return sign + (fracStr ? `${whole}.${fracStr}` : whole.toString());
}

// Shared between the MiFOID reservation route and the client button so the
// signed text is identical on both sides.
export function reserveMessage(wallet: string, ts: number): string {
  return `reserve my mifoid\nwallet: ${wallet.toLowerCase()}\nts: ${ts}`;
}

import type { AbiEvent } from "viem";

function isAbiEvent(value: unknown): value is AbiEvent {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: string }).type === "event" &&
    typeof (value as { name?: string }).name === "string"
  );
}

export function getAbiEvent(abi: readonly unknown[], name: string): AbiEvent {
  const event = abi.find(
    (item) => isAbiEvent(item) && item.name === name
  );
  if (!event) {
    throw new Error(`Missing ABI event ${name}`);
  }
  return event;
}

import type { Abi, AbiEvent } from "viem";

function isAbiEventFragment(item: Abi[number]): item is AbiEvent {
  return (
    typeof item === "object" &&
    item !== null &&
    item.type === "event" &&
    typeof item.name === "string"
  );
}

export function getAbiEvent<TAbi extends Abi>(
  abi: TAbi,
  name: string
): Extract<TAbi[number], { type: "event" }> {
  type EventFragment = Extract<TAbi[number], { type: "event" }>;
  const event = abi.find(
    (item): item is EventFragment =>
      isAbiEventFragment(item) && item.name === name
  );
  if (!event) {
    throw new Error(`Missing ABI event ${name}`);
  }
  return event;
}

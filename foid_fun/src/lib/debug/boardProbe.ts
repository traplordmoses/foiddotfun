"use client";

import type { PublicClient } from "viem";

export async function runBoardProbe(opts: {
  publicClient: PublicClient;
  boardAddress: `0x${string}`;
  boardAbi: readonly any[];
}) {
  const { publicClient, boardAddress, boardAbi } = opts;

  const latest = await publicClient.getBlockNumber();
  const from = latest > 50_000n ? latest - 50_000n : 0n;

  console.log("[boardProbe] boardAddress", boardAddress);
  console.log("[boardProbe] latest", latest.toString(), "from", from.toString());

  // 1) confirm code exists
  const code = await publicClient.getBytecode({ address: boardAddress });
  console.log("[boardProbe] bytecode length", code?.length ?? 0, "hasCode", Boolean(code && code !== "0x"));

  // 2) list ABI event names
  const abiEvents = boardAbi.filter((x: any) => x?.type === "event");
  console.log("[boardProbe] abi event names", abiEvents.map((e: any) => e.name));

  // 3) find PlacementProposed event in ABI (if present)
  const placementEvent = abiEvents.find((e: any) => e.name === "PlacementProposed");
  console.log("[boardProbe] has PlacementProposed in ABI?", Boolean(placementEvent), placementEvent);

  // 4) fetch logs using ABI event definition (no args filter)
  if (placementEvent) {
    const logs = await publicClient.getLogs({
      address: boardAddress,
      event: placementEvent,
      fromBlock: from,
      toBlock: latest,
    });
    console.log("[boardProbe] PlacementProposed logs (no filter) last 50k blocks:", logs.length);
    if (logs[0]) {
      console.log("[boardProbe] sample PlacementProposed log", {
        block: logs[0].blockNumber?.toString?.(),
        args: (logs[0] as any).args,
        topic0: logs[0].topics?.[0],
      });
    }
  }

  // 5) raw logs query (no event decoding) to prove whether address emitted ANY logs
  // note: this will return ALL events from that address in last 5k blocks only to avoid load.
  const rawFrom = latest > 5_000n ? latest - 5_000n : 0n;
  const raw = await publicClient.getLogs({
    address: boardAddress,
    fromBlock: rawFrom,
    toBlock: latest,
  });
  console.log("[boardProbe] RAW logs from board address last 5k blocks:", raw.length);
  if (raw[0]) {
    console.log("[boardProbe] sample RAW log", {
      block: raw[0].blockNumber?.toString?.(),
      topic0: raw[0].topics?.[0],
      topics: raw[0].topics,
    });
  }
}

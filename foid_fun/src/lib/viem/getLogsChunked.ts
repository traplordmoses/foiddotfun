import type { AbiEvent, Address, Log, PublicClient } from "viem";

const DEFAULT_CHUNK_SIZE = 95_000n;
const RETRY_DELAYS = [400, 900];

interface ChunkedLogParams {
  address?: Address | Address[];
  event?: AbiEvent;
  events?: readonly AbiEvent[] | readonly unknown[];
  args?: Record<string, unknown>;
  strict?: boolean;
  blockHash?: `0x${string}`;
  fromBlock: bigint;
  toBlock: bigint;
  chunkSize?: bigint;
}

export async function getLogsChunked(client: PublicClient, params: ChunkedLogParams): Promise<Log[]> {
  const { chunkSize = DEFAULT_CHUNK_SIZE, fromBlock, toBlock, ...rest } = params;
  if (fromBlock > toBlock) {
    return [];
  }

  const effectiveChunkSize = chunkSize > 0n ? chunkSize : DEFAULT_CHUNK_SIZE;
  const logs: Log[] = [];

  let start = fromBlock;

  while (start <= toBlock) {
    const end = toBlock < start + effectiveChunkSize - 1n ? toBlock : start + effectiveChunkSize - 1n;
    let attempt = 0;

    while (true) {
      try {
        const chunkLogs = await client.getLogs({
          ...(rest as Record<string, unknown>),
          fromBlock: start,
          toBlock: end,
        } as Parameters<PublicClient["getLogs"]>[0]);

        logs.push(...chunkLogs);
        break;
      } catch (error) {
        if (attempt >= RETRY_DELAYS.length) {
          throw error;
        }
        const delayMs = RETRY_DELAYS[attempt];
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        attempt += 1;
      }
    }

    start = end + 1n;
  }

  return logs;
}

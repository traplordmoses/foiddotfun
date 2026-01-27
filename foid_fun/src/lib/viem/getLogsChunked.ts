import type { GetLogsParameters, Log, PublicClient } from "viem";

const DEFAULT_CHUNK_SIZE = 95_000n;
const RETRY_DELAYS = [400, 900];

export async function getLogsChunked<TAbiEvent extends any>(
  client: PublicClient,
  params: Omit<GetLogsParameters<any, any, any, any>, "fromBlock" | "toBlock"> & {
    fromBlock: bigint;
    toBlock: bigint;
    chunkSize?: bigint;
  }
): Promise<Log[]> {
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
          ...rest,
          fromBlock: start,
          toBlock: end,
        });

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

import type { Address, Chain, Hex, PublicClient, Transport } from "viem";

export type RpcLogItem = Awaited<
  ReturnType<PublicClient<Transport, Chain | undefined, any>["getLogs"]>
>[number];

export type BlockscoutLogItem = {
  address: Address;
  topics: Hex[];
  data: Hex;
  blockNumber: bigint;
  transactionHash?: Hex;
  logIndex?: bigint;
};

export type LogItem = (RpcLogItem | BlockscoutLogItem) & { args?: any };
export type LogResult = LogItem[];

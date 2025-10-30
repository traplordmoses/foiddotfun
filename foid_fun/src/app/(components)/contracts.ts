export const NETWORK_DETAILS = {
  chainName: "Fluent Testnet",
  rpcUrl: "https://rpc.testnet.fluent.xyz",
  chainId: 20994,
  explorer: "https://testnet.fluentscan.xyz",
} as const;

export interface ContractDescriptor {
  label: string;
  address: `0x${string}`;
}

export const CONTRACT_ADDRESSES: ContractDescriptor[] = [
  { label: "wFOID", address: "0x403ECF8ba28E58CE4d1847C1C95ac54651fAB151" },
  { label: "FoidFactory", address: "0xaC8433Aa94C3E043b197C25854bAC39Ee914B8F9" },
  { label: "FoidSwap LP", address: "0xe97639fd6Ff7231ed270Ea16BD9Ba2c79f4cD2cc" },
  { label: "FoidSwap Router", address: "0xd71330e54eAA2e4248E75067F8f23bB2a6568613" },
] as const;

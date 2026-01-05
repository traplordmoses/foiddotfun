import path from "node:path";
import dotenv from "dotenv";
import { createPublicClient, defineChain, http, keccak256, stringToHex } from "viem";

dotenv.config({ path: path.join(process.cwd(), ".env") });
dotenv.config({ path: path.join(process.cwd(), ".env.local"), override: true });

const rpcChecks = ["FLUENT_RPC", "NEXT_PUBLIC_FLUENT_RPC", "NEXT_PUBLIC_RPC"] as const;
const rpc =
  process.env.FLUENT_RPC ??
  process.env.NEXT_PUBLIC_FLUENT_RPC ??
  process.env.NEXT_PUBLIC_RPC;
const vmAddressChecks = [
  "NEXT_PUBLIC_LOREBOARD_VM_ADDRESS",
  "LOREBOARD_VM_ADDRESS",
] as const;
const vmAddress =
  (process.env.NEXT_PUBLIC_LOREBOARD_VM_ADDRESS ||
    process.env.LOREBOARD_VM_ADDRESS) as `0x${string}` | undefined;

if (!rpc) {
  throw new Error(
    `Missing rpc URL. Checked env vars: ${rpcChecks.join(", ")}`
  );
}

if (!vmAddress) {
  throw new Error(
    `Missing vm address. Checked env vars: ${vmAddressChecks.join(", ")}`
  );
}

const chain = defineChain({
  id: 20994,
  name: "Fluent Testnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
});

const loreboardVmAbi = [
  {
    type: "function",
    name: "selectWinners",
    stateMutability: "view",
    inputs: [
      {
        name: "base",
        type: "tuple[]",
        components: [
          { name: "id", type: "bytes32" },
          {
            name: "rect",
            type: "tuple",
            components: [
              { name: "x", type: "int32" },
              { name: "y", type: "int32" },
              { name: "w", type: "int32" },
              { name: "h", type: "int32" },
            ],
          },
          { name: "bidPerCellWei", type: "uint256" },
        ],
      },
      {
        name: "candidates",
        type: "tuple[]",
        components: [
          { name: "id", type: "bytes32" },
          {
            name: "rect",
            type: "tuple",
            components: [
              { name: "x", type: "int32" },
              { name: "y", type: "int32" },
              { name: "w", type: "int32" },
              { name: "h", type: "int32" },
            ],
          },
          { name: "bidPerCellWei", type: "uint256" },
        ],
      },
    ],
    outputs: [
      { name: "accepted", type: "bytes32[]" },
      { name: "rejected", type: "bytes32[]" },
    ],
  },
] as const;

const publicClient = createPublicClient({ chain, transport: http(rpc) });

const base = [
  {
    id: keccak256(stringToHex("base-1")),
    rect: { x: 0, y: 0, w: 2, h: 2 },
    bidPerCellWei: 0n,
  },
];

const candidates = [
  {
    id: keccak256(stringToHex("candidate-1")),
    rect: { x: 3, y: 0, w: 2, h: 2 },
    bidPerCellWei: 100n,
  },
  {
    id: keccak256(stringToHex("candidate-2")),
    rect: { x: 1, y: 1, w: 2, h: 2 },
    bidPerCellWei: 50n,
  },
];

async function main() {
  const [accepted, rejected] = await publicClient.readContract({
    address: vmAddress,
    abi: loreboardVmAbi,
    functionName: "selectWinners",
    args: [base, candidates],
  });

  console.log("accepted:", accepted);
  console.log("rejected:", rejected);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { existsSync, readFileSync } from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { concatHex, encodeAbiParameters, keccak256, parseAbiParameters, toHex } from "viem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  name: string;
  symbol: string;
  decimals?: number;
  cap: string;
  initialMintTo: string;
  initialMintAmount?: string;
  creator: string;
};

export async function POST(req: NextRequest) {
  const b = (await req.json()) as Body;

  if (!b?.name || !b?.symbol || !b?.cap || !b?.initialMintTo || !b?.creator) {
    return new Response(JSON.stringify({ ok: false, error: "missing fields" }), { status: 400 });
  }

  const { FACTORY } = process.env;
  if (!FACTORY) {
    return new Response(JSON.stringify({ ok: false, error: "FACTORY not configured" }), { status: 500 });
  }

  const artifactCandidates = [
    path.join(process.cwd(), "src/abis/FOID20.json"),
    path.join(process.cwd(), "conditional_mint_fluent/out/FOID20.sol/FOID20.json"),
    path.join(process.cwd(), "..", "conditional_mint_fluent/out/FOID20.sol/FOID20.json"),
  ];

  let creation: string | undefined;

  for (const candidate of artifactCandidates) {
    if (!existsSync(candidate)) continue;
    try {
      const artifact = JSON.parse(readFileSync(candidate, "utf8"));
      const bytecode = artifact?.bytecode?.object;
      if (typeof bytecode === "string" && bytecode.startsWith("0x")) {
        creation = bytecode;
        break;
      }
    } catch (error) {
      console.warn("Failed to read FOID20 artifact", error);
    }
  }

  if (!creation) {
    const envBytecode = process.env.FOID20_BYTECODE?.trim();
    if (envBytecode && envBytecode.startsWith("0x")) {
      creation = envBytecode;
    }
  }

  if (!creation) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          "FOID20 bytecode unavailable. Ensure conditional_mint_fluent/out/FOID20.sol/FOID20.json is bundled or set FOID20_BYTECODE.",
      }),
      { status: 500 },
    );
  }

  const decimals = Number(b.decimals ?? 18);
  const cap = BigInt(b.cap);
  const initialMintAmount = BigInt(b.initialMintAmount ?? "0");

  const creator = b.creator.toLowerCase() as `0x${string}`;
  const mintTo = (b.initialMintTo || creator).toLowerCase() as `0x${string}`;
  const factory = FACTORY.toLowerCase() as `0x${string}`;

  const ctorArgs = encodeAbiParameters(
    parseAbiParameters("string,string,uint8,uint256,address,address,uint256"),
    [b.name, b.symbol, decimals, cap, creator, mintTo, initialMintAmount],
  );

  const initCode = (`0x${creation}`.replace(/^0x0x/, "0x") + ctorArgs.slice(2)) as `0x${string}`;
  const initHash = keccak256(initCode);

  const target = "f01d";
  let userSalt: `0x${string}` | null = null;
  let predicted: `0x${string}` | null = null;
  let namespacedSalt: `0x${string}` | null = null;

  const encodeAddressSalt = parseAbiParameters("address,bytes32");

  for (let i = 0n; ; i++) {
    const salt = toHex(i, { size: 32 }) as `0x${string}`;
    const ns = keccak256(
      encodeAbiParameters(encodeAddressSalt, [creator, salt]),
    ) as `0x${string}`;
    const digest = keccak256(concatHex(["0xff", factory, ns, initHash]));
    const address = (`0x${digest.slice(-40)}` as `0x${string}`).toLowerCase() as `0x${string}`;
    if (address.endsWith(target)) {
      userSalt = salt;
      predicted = address;
      namespacedSalt = ns;
      break;
    }
  }

  if (!userSalt || !predicted) {
    return new Response(JSON.stringify({ ok: false, error: "Failed to grind vanity salt" }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, userSalt, predicted, namespacedSalt }), {
    headers: { "content-type": "application/json" },
  });
}

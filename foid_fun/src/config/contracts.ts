import { CANONICAL_ADDRESSES, requireCanonicalAddress } from "./canonical";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const manifestStoreCandidates = [
  process.env.NEXT_PUBLIC_LOREBOARD_MANIFEST_STORE_ADDRESS,
  process.env.NEXT_PUBLIC_LOREBOARD_ANCHOR,
  process.env.NEXT_PUBLIC_MANIFEST_STORE,
  process.env.NEXT_PUBLIC_MANIFEST_STORE_ADDRESS,
];

const manifestStoreEnv = manifestStoreCandidates.find(
  (value) => value?.trim() && value.trim().toLowerCase() !== ZERO_ADDRESS
);

export const LOREBOARD_MANIFEST_STORE_ADDRESS = manifestStoreEnv
  ? requireCanonicalAddress({
      label: "LOREBOARD_MANIFEST_STORE_ADDRESS",
      envValue: manifestStoreEnv,
      expected: CANONICAL_ADDRESSES.manifestStore,
      envHint:
        "NEXT_PUBLIC_LOREBOARD_MANIFEST_STORE_ADDRESS (or NEXT_PUBLIC_LOREBOARD_ANCHOR/NEXT_PUBLIC_MANIFEST_STORE)",
    })
  : null;

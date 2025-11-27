import { parseAbiItem } from "viem";

export const FINALIZED_EVENT = parseAbiItem(
  "event Finalized(uint32 indexed epoch, bytes32 manifestRoot, string manifestCID)"
);

export const MANIFEST_ANCHORED_EVENT = parseAbiItem(
  "event ManifestAnchored(uint32 indexed epoch, bytes32 manifestRoot, string manifestCid)"
);

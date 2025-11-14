import { NextRequest, NextResponse } from "next/server";
import { getLatestManifest, getManifestForEpoch } from "../_store";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const epochParam = url.searchParams.get("epoch");

  let record = null;
  if (epochParam && epochParam !== "latest") {
    const parsed = Number(epochParam);
    if (!Number.isNaN(parsed)) {
      record = getManifestForEpoch(parsed);
    }
  }

  if (!record) {
    record = getLatestManifest();
  }

  if (!record) {
    return NextResponse.json(
      { error: "No manifest available yet" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    epoch: record.epoch,
    manifestCID: record.cid,
    manifest: {
      finalizedAt: record.finalizedAt,
      placements: record.placements,
    },
  });
}

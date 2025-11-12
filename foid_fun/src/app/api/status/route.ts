// /src/app/api/status/route.ts
import { NextResponse } from "next/server";
import { currentEpoch, secondsLeftInEpoch } from "@/lib/epoch";
import { latestManifestCID } from "../_store";

export async function GET() {
  return NextResponse.json({
    epoch: currentEpoch(),
    secondsLeft: secondsLeftInEpoch(),
    latestManifestCID: latestManifestCID(),
  });
}

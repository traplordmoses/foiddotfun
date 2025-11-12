// src/app/api/manifest/route.ts
import { NextResponse } from "next/server";
import { TILE } from "@/lib/grid";
import { manifestForEpoch } from "../_store";

export const dynamic = "force-dynamic"; // avoid static caching

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const ep = url.searchParams.get("epoch") ?? "latest";

    const epoch = ep === "latest" ? "latest" : Number(ep);
    if (epoch !== "latest" && (!Number.isFinite(epoch) || epoch < 0)) {
      return NextResponse.json({ error: "bad epoch" }, { status: 400 });
    }

    const entry = manifestForEpoch(epoch);
    const maxCells =
      Number(
        process.env.NEXT_PUBLIC_MAX_CELLS_PER_RECT ??
          process.env.MAX_CELLS_PER_RECT ??
          "400"
      ) || 400;

    const payloadEpoch =
      entry?.epoch ?? (epoch === "latest" ? 0 : Number(epoch) || 0);
    const placements = entry
      ? entry.manifest.placements.map((p: any) => ({
          id: p.id,
          owner: p.owner,
          cid: p.cid,
          name: p.name,
          mime: p.mime,
          x: p.rect.x,
          y: p.rect.y,
          w: p.rect.w,
          h: p.rect.h,
          cells: p.cells,
        }))
      : [];

    return new NextResponse(
      JSON.stringify({
        epoch: payloadEpoch,
        cid: entry?.cid ?? null,
        manifest: { placements },
        maxCellsPerPiece: maxCells,
        cellSize: TILE,
      }),
      {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "internal error" },
      { status: 500 }
    );
  }
}

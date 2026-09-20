import { NextResponse } from "next/server";
import { getHeapStatistics } from "node:v8";
import { performance } from "node:perf_hooks";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Liveness only. Dependency readiness has its own /api/ready endpoint. */
export async function GET() {
  const m = process.memoryUsage();
  const heapLimit = getHeapStatistics().heap_size_limit;
  const containerLimit = Number(process.env.INSTANCE_MEMORY_LIMIT_MB) * 1024 * 1024;
  return NextResponse.json({
    status: m.heapUsed / heapLimit > 0.85 || (containerLimit > 0 && m.rss / containerLimit > 0.9) ? "warning" : "healthy",
    check: "liveness", uptime: Math.round(process.uptime()),
    memory: { heapUsedBytes: m.heapUsed, heapAllocatedBytes: m.heapTotal, heapLimitBytes: heapLimit, rssBytes: m.rss, externalBytes: m.external, arrayBufferBytes: m.arrayBuffers, containerLimitBytes: containerLimit > 0 ? containerLimit : null },
    eventLoopUtilization: performance.eventLoopUtilization().utilization,
    timestamp: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}

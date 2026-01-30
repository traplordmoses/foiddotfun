import { NextResponse } from "next/server";

export async function GET() {
  const memoryUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);

  const usagePercent = (heapUsedMB / heapTotalMB) * 100;
  const status = usagePercent > 80 ? "warning" : "healthy";

  return NextResponse.json({
    status,
    uptime: Math.round(process.uptime()),
    memory: {
      heapUsed: `${heapUsedMB} MB`,
      heapTotal: `${heapTotalMB} MB`,
      usage: `${Math.round(usagePercent)}%`,
    },
    timestamp: new Date().toISOString(),
  });
}

export const dynamic = "force-dynamic";

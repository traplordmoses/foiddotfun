// instrumentation.ts
// Next.js 14 + @sentry/nextjs v10 expect server/edge SDK init to happen
// through the instrumentation hook. This stays a no-op when no DSN is
// configured because each sentry.*.config file guards on that internally.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Surface server-side React Server Component errors through the same pipe.
export { captureRequestError as onRequestError } from "@sentry/nextjs";

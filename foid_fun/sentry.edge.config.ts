// sentry.edge.config.ts
// Edge-runtime init — runs wherever we execute Next middleware / edge routes.
// We don't have any today, but wiring it now avoids a confusing gap later.
// Silent without a DSN.
import * as Sentry from "@sentry/nextjs";

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    environment: process.env.NODE_ENV,
  });
}

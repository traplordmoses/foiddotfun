// sentry.server.config.ts
// Server-side (Node) Sentry init — picks up exceptions from route handlers,
// server actions, and getServerSideProps equivalents. Silent without a DSN.
import * as Sentry from "@sentry/nextjs";

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    environment: process.env.NODE_ENV,
  });
}

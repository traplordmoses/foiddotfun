// sentry.client.config.ts
// Runs on every client page load. Stays silent when the DSN is missing so
// local development (and any env without the Sentry project provisioned)
// doesn't pay the init cost or spam warnings into the browser console.
import * as Sentry from "@sentry/nextjs";

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    // Prod traces are cheap at 10%; full-sample in dev so local repros
    // always surface a trace in the dashboard.
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // Session replays are opt-in — the board canvas would blow the quota.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    environment: process.env.NODE_ENV,
    // Keep the SDK from eating custom console.log calls that the
    // debug panel already surfaces.
    integrations: (defaults) =>
      defaults.filter((i) => i.name !== "Breadcrumbs"),
  });
}

// sentry.client.config.ts
// Runs on every client page load. Stays silent when the DSN is missing so
// local development (and any env without the Sentry project provisioned)
// doesn't pay the init cost or spam warnings into the browser console.
//
// The SDK is imported lazily after the window `load` event. The browser
// SDK is ~340 KB raw and was the single largest main-thread cost on mobile
// (1.6 to 4.7 s of script evaluation per route in Lighthouse). Trade-off,
// per Sentry's own guidance: an error thrown before `load` is not captured.
// Client tracing is off (the server SDK still samples traces); replays
// were already off.
const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

function bootSentry() {
  import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.init({
        dsn: DSN,
        tracesSampleRate: 0,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
        environment: process.env.NODE_ENV,
        // Keep the SDK from eating custom console.log calls that the
        // debug panel already surfaces.
        integrations: (defaults) =>
          defaults.filter((i) => i.name !== "Breadcrumbs"),
      });
    })
    .catch(() => {
      /* offline or blocked: nothing to report to */
    });
}

if (DSN && typeof window !== "undefined") {
  const schedule = () => window.setTimeout(bootSentry, 0);
  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });
}

"use client";

// Root error boundary for the App Router. Sentry's Next.js SDK expects this
// file so React rendering errors in the root layout reach the dashboard;
// without it they were lost (the dev server warned on every start).
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    import("@sentry/nextjs")
      .then((Sentry) => Sentry.captureException(error))
      .catch(() => {});
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#030b12",
          color: "rgba(255,255,255,0.9)",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      >
        <main style={{ textAlign: "center", padding: 24, maxWidth: 420 }}>
          <p style={{ fontSize: 12, letterSpacing: "0.3em", opacity: 0.6 }}>
            FOID OS
          </p>
          <h1 style={{ fontSize: 20, margin: "8px 0 12px" }}>
            something crashed at the root
          </h1>
          <p style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.6 }}>
            the desktop hit an error it could not recover from. reload to
            reboot, or try again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 18,
              padding: "10px 22px",
              borderRadius: 999,
              border: "1px solid rgba(114,225,255,0.4)",
              background: "rgba(114,225,255,0.12)",
              color: "#fff",
              fontSize: 13,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            try again
          </button>
        </main>
      </body>
    </html>
  );
}

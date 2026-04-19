import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Warnings should not fail the production build
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://ipfs.io https://gateway.pinata.cloud https://cloudflare-ipfs.com https://dweb.link",
              "font-src 'self'",
              // Supabase Realtime opens a wss:// connection to `*.supabase.co`
              // (+ https:// for REST). Without these entries, iOS Safari
              // throws `SecurityError: The operation is insecure.` from the
              // WebSocket constructor — which used to escape `usePresence`
              // and crash the entire board. The hook is now try/caught too,
              // but CSP must still whitelist the host for realtime to work.
              "connect-src 'self' https://rpc.testnet.fluent.xyz https://rpc.fluent.xyz https://*.quiknode.pro wss://*.quiknode.pro https://ipfs.io https://gateway.pinata.cloud https://cloudflare-ipfs.com https://dweb.link https://*.supabase.co wss://*.supabase.co",
              "worker-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: '/trest', destination: '/board', permanent: true },
      { source: '/trest/:path*', destination: '/board/:path*', permanent: true },
      { source: '/gallery', destination: '/board', permanent: true },
      { source: '/gallery/:path*', destination: '/board/:path*', permanent: true },
      { source: '/swipe', destination: '/vote', permanent: true },
      { source: '/swipe/:path*', destination: '/vote/:path*', permanent: true },
      { source: '/duel', destination: '/vote', permanent: true },
      { source: '/duel/:path*', destination: '/vote/:path*', permanent: true },
    ];
  },
  experimental: {
    outputFileTracingExcludes: {
      "*": [
        "node_modules/@swc/core-linux-x64-gnu",
        "node_modules/@swc/core-linux-x64-musl",
        "node_modules/@esbuild/linux-x64",
      ],
    },
  },
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? {
            exclude: ["error", "warn"],
          }
        : false,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "ipfs.io" },
      { protocol: "https", hostname: "gateway.pinata.cloud" },
      { protocol: "https", hostname: "cloudflare-ipfs.com" },
      { protocol: "https", hostname: "dweb.link" },
    ],
  },
  webpack(config, { isServer }) {
    const aliases = {
      ...config.resolve.alias,
      "@react-native-async-storage/async-storage": false, // RN-only dep
      "pino-pretty": false,
    };
    if (!isServer) {
      aliases.pino = "pino/browser";
    }
    config.resolve.alias = aliases;
    // Enable Web Worker bundling for wallet session isolation
    if (!isServer) {
      config.output.workerChunkLoading = 'import';
    }
    return config;
  },
};

// Sentry wrapping. Source-map upload only runs in CI (where
// SENTRY_AUTH_TOKEN is set). Everywhere else — local dev, previews without
// the token — `withSentryConfig` is effectively a no-op beyond installing
// the instrumentation wrappers, and those are cheap.
const sentryOptions = {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Only upload source maps when we actually have credentials. Prevents
  // `next build` from blocking waiting on a missing token.
  disableSourceMapUpload: !process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
};

export default withSentryConfig(nextConfig, sentryOptions);

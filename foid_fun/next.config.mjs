/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Warnings should not fail the production build
    ignoreDuringBuilds: true,
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
    return config;
  },
};

export default nextConfig;

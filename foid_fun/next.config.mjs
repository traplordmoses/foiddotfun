/** @type {import('next').NextConfig} */
const nextConfig = {
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

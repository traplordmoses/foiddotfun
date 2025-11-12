/** @type {import('next').NextConfig} */
const nextConfig = {
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

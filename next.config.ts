import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // Avoid stale/corrupt filesystem cache (common when .next lives on OneDrive).
      config.cache = false;
      config.watchOptions = {
        ...config.watchOptions,
        // prisma/ holds the runtime SQLite files (dev.db, test.db, and their
        // -journal/-wal siblings) and a few compliance JSON data files that
        // get rewritten on nearly every API call — without this, webpack
        // treats each write as a source change and triggers a full HMR
        // rebuild, causing a near-continuous reload loop (visible as
        // repeated webpack.*.hot-update.js requests and aborted in-flight
        // fetches/RSC streams in the browser). webpack's schema only accepts
        // a single RegExp OR an array of glob *strings*, not an array of
        // RegExps — one RegExp with alternation, matching regardless of
        // \ vs / path separators on Windows.
        ignored: /node_modules|[\\/]\.next[\\/]|[\\/]\.git[\\/]|[\\/]prisma[\\/]/,
      };
    }
    return config;
  },
};

export default nextConfig;

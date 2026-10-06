import path from "path";
import type { NextConfig } from "next";

// Prisma reads this when the client is created. The hotel launcher sets its own
// path before start; this default keeps `next dev` on prisma/test.db.
if (!process.env.SQLITE_DATABASE_URL) {
  const db = path.join(process.cwd(), "prisma", "test.db").replace(/\\/g, "/");
  process.env.SQLITE_DATABASE_URL = `file:${db}`;
}

const hotelBuild = process.env.HOTEL_BUILD === "1";

const nextConfig: NextConfig = {
  ...(hotelBuild
    ? {
        output: "standalone" as const,
        distDir: ".next-hotel",
        outputFileTracingIncludes: {
          "/*": [
            "./node_modules/.prisma/client/**/*",
            "./node_modules/@prisma/client/**/*",
          ],
        },
        serverExternalPackages: ["@prisma/client", "prisma"],
      }
    : {}),
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // The webpack filesystem cache stays on (it makes restarts much faster). It was
      // turned off while the project lived on OneDrive, where sync corrupted it — keep
      // the project out of synced folders. If a build ever looks stale, run `npm run clean`.
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
        // \ vs / path separators on Windows. .claude/ holds Claude's worktrees
        // (full copies of the project) — their edits aren't this app's sources.
        ignored: /node_modules|[\\/]\.next[\\/]|[\\/]\.git[\\/]|[\\/]prisma[\\/]|[\\/]\.claude[\\/]/,
      };
    }
    return config;
  },
};

export default nextConfig;

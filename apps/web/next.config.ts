import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Production builds use .next; `pnpm dev` uses .next-dev and end-to-end builds .next-e2e, so
  // `pnpm build` (and `pnpm push`) never replace the folder of a running dev server.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  transpilePackages: ['@parle-tcf/shared'],
  // Next.js 16 no longer lints during `next build`: `pnpm lint` (part of `pnpm verify`) does.
};

export default nextConfig;

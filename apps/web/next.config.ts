import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Production builds use .next; `pnpm dev` uses .next-dev and end-to-end builds .next-e2e, so
  // `pnpm build` (and `pnpm push`) never replace the folder of a running dev server.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  transpilePackages: ['@parle-tcf/shared'],
  // Lint runs during the build too, with the repo's root ESLint config.
  eslint: {
    dirs: ['app', 'components', 'hooks', 'lib', 'providers'],
  },
};

export default nextConfig;

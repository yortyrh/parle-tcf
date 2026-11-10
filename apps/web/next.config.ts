import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // End-to-end builds (NEXT_PUBLIC_FAKE_VOICE) go to their own folder so they never replace .next.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  transpilePackages: ['@parle-tcf/shared'],
  // Lint runs during the build too, with the repo's root ESLint config.
  eslint: {
    dirs: ['app', 'components', 'hooks', 'lib', 'providers'],
  },
};

export default nextConfig;

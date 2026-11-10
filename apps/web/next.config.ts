import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@parle-tcf/shared'],
  // Lint runs during the build too, with the repo's root ESLint config.
  eslint: {
    dirs: ['app', 'components', 'hooks', 'lib', 'providers'],
  },
};

export default nextConfig;

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@parle-tcf/shared'],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

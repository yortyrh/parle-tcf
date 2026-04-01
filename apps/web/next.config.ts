import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@yorty-tcf/shared'],
};

export default nextConfig;

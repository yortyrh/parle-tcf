import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable standalone output for Docker optimization
  // This creates a minimal production build with only necessary files
  output: 'standalone',
};

export default nextConfig;

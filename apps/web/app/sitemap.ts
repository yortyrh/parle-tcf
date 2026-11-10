import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/utils';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/confidentialite`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/inscription`, changeFrequency: 'yearly', priority: 0.5 },
  ];
}

import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/utils';

/** Only the public pages are meant for search engines. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/confidentialite'],
      disallow: [
        '/tableau-de-bord',
        '/tcf',
        '/examen',
        '/sujets',
        '/historique',
        '/progression',
        '/resultats',
        '/comparer',
        '/parametres',
      ],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}

import type { MetadataRoute } from 'next';
import { SITE_ORIGIN } from './site/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_ORIGIN}/`,
      lastModified: new Date('2026-10-17'),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}

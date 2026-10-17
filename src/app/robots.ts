import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { SITE_ORIGIN } from './site/seo';

/** The marketing site can be crawled. The hotel app (app.agmsync.com) stays out of search. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = ((await headers()).get('host') || '').toLowerCase().split(':')[0];
  const marketing = host === 'agmsync.com' || host === 'www.agmsync.com';
  if (!marketing) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/site'],
    },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    host: SITE_ORIGIN,
  };
}

import { CONTACT, FAQS } from './content';

/** The public website. The app at app.agmsync.com is a different address and is not indexed. */
export const SITE_ORIGIN = 'https://www.agmsync.com';

export const SITE_TITLE = 'Property management system (PMS) | AGM Sync';

export const SITE_DESCRIPTION =
  'Property management system (PMS) for Ghana. Front desk, POS, stores, payroll and accounts on the cloud, a server on site, or both, with VAT and NHIL built in.';

/** Other names people type. They stay in this list and the structured data, not on the page. */
export const SEARCH_ALIASES = [
  'hotel management system',
  'hotel management system Ghana',
  'property management system',
  'property management system Ghana',
  'facility management system',
  'facility management system Ghana',
  'hotel CRM',
  'hotel CRM Ghana',
  'facility CRM',
  'facility CRM Ghana',
  'property CRM',
  'facilities CRM',
];

/** More searches for the same system. Keywords only, not shown on the page. */
const MORE_KEYWORDS = [
  'hotel software Ghana',
  'hospitality management software Ghana',
  'guest house management system',
  'lodge management software',
  'resort management software',
  'serviced apartment software',
  'hostel management software',
  'restaurant management system Ghana',
  'hotel POS Ghana',
  'bar POS software',
  'hotel booking system Ghana',
  'front office system',
  'night audit system',
  'housekeeping software',
  'hotel inventory software',
  'hotel payroll Ghana',
  'SSNIT payroll software',
  'PAYE payroll Ghana',
  'hotel ERP',
  'hotel billing software',
  'event management software Ghana',
  'conference booking software',
  'cloud hotel software Ghana',
  'offline hotel software',
  'hotel software without internet',
  'GRA e-VAT',
  'Mobile Money POS Ghana',
];

/** Phrases people type. The title is the PMS. Hotel and facility names stay in this list and the structured data. */
export const SEARCH_KEYWORDS = [
  'property management system (PMS)',
  'property management software Ghana',
  'PMS software Ghana',
  ...SEARCH_ALIASES,
  'hotel management software Ghana',
  'hotel PMS Ghana',
  'property management Ghana',
  'facility management software Ghana',
  'facility management Ghana',
  'facilities management software',
  'guest house software Ghana',
  'restaurant POS Ghana',
  'hotel front desk software',
  'night audit software',
  'hotel accounting software Ghana',
  'VAT NHIL GETFund',
  'Tourism Levy',
  'Mobile Money hotel billing',
  'cloud and on-premises hotel software',
  ...MORE_KEYWORDS,
  'AGM Sync',
];

export function siteStructuredData() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_ORIGIN}/#organization`,
        name: 'AGM Sync',
        url: `${SITE_ORIGIN}/`,
        email: CONTACT.email,
        logo: `${SITE_ORIGIN}/apple-touch-icon.png`,
        areaServed: { '@type': 'Country', name: 'Ghana' },
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_ORIGIN}/#website`,
        url: `${SITE_ORIGIN}/`,
        name: 'AGM Sync',
        description: SITE_DESCRIPTION,
        inLanguage: 'en',
        publisher: { '@id': `${SITE_ORIGIN}/#organization` },
      },
      {
        '@type': 'SoftwareApplication',
        name: 'AGM Sync',
        alternateName: SEARCH_ALIASES,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web, Windows',
        url: `${SITE_ORIGIN}/`,
        description: SITE_DESCRIPTION,
        featureList: [
          'Property management for rooms, guests and apartments',
          'Facility management for housekeeping, maintenance and the building',
          'Front desk, reservations and night audit',
          'Restaurant and bar POS',
          'Kitchen, housekeeping and stores',
          'Payroll with PAYE and SSNIT',
          'Accounts with VAT, NHIL, GETFund and the Tourism Levy',
          'Cloud, a server in the hotel, or both with the same records',
        ],
        provider: { '@id': `${SITE_ORIGIN}/#organization` },
      },
      {
        '@type': 'FAQPage',
        '@id': `${SITE_ORIGIN}/#faq`,
        url: `${SITE_ORIGIN}/#faq`,
        mainEntity: FAQS.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
    ],
  };
}

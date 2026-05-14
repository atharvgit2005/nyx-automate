/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://automate.nyxstudio.tech',
  generateRobotsTxt: true,
  sitemapSize: 7000,
  generateIndexSitemap: false,
  // Only the public landing page (/) should be crawled. Everything else
  // is auth-gated (dashboard), admin-only, or an auth/API route.
  exclude: [
    '/api/*',
    '/admin_automate',
    '/admin_automate/*',
    '/dashboard',
    '/dashboard/*',
    '/login',
    '/signin',
    '/signup',
    '/test-voice',
    '/contact',
    '/icon.png',
  ],
  robotsTxtOptions: {
    transformRobotsTxt: async () =>
      [
        'User-agent: *',
        'Allow: /',
        'Disallow: /api/',
        'Disallow: /admin_automate/',
        'Disallow: /dashboard/',
        'Disallow: /login',
        'Disallow: /signin',
        'Disallow: /signup',
        'Disallow: /test-voice',
        'Disallow: /contact',
        '',
        'Sitemap: https://automate.nyxstudio.tech/sitemap.xml',
        '',
      ].join('\n'),
  },
}

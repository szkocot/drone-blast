import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const robotsTxt = readFileSync(resolve(process.cwd(), 'public/robots.txt'), 'utf8');
const sitemapXml = readFileSync(resolve(process.cwd(), 'public/sitemap.xml'), 'utf8');

describe('crawl assets', () => {
  it('defines robots directives and sitemap location', () => {
    expect(robotsTxt).toContain('User-agent: *');
    expect(robotsTxt).toContain('Allow: /');
    expect(robotsTxt).toContain('Sitemap: https://droneblast.ovh/sitemap.xml');
  });

  it('defines a sitemap entry for the root url', () => {
    expect(sitemapXml).toContain('<urlset');
    expect(sitemapXml).toContain('<loc>https://droneblast.ovh/</loc>');
  });
});

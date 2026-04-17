import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

describe('static SEO shell', () => {
  it('defines a brand plus non-brand title and description', () => {
    expect(indexHtml).toContain('<title>Drone Blast - FPV Wind Forecast App | Prognoza Wiatru FPV</title>');
    expect(indexHtml).toContain('name="description"');
    expect(indexHtml).toContain('wind forecast app for FPV drone pilots');
    expect(indexHtml).toContain('Aplikacja pogodowa dla pilotów FPV');
  });

  it('defines canonical and hreflang links for the root URL', () => {
    expect(indexHtml).toContain('<link rel="canonical" href="https://droneblast.ovh/" />');
    expect(indexHtml).toContain('<link rel="alternate" hreflang="en" href="https://droneblast.ovh/" />');
    expect(indexHtml).toContain('<link rel="alternate" hreflang="pl" href="https://droneblast.ovh/" />');
    expect(indexHtml).toContain('<link rel="alternate" hreflang="x-default" href="https://droneblast.ovh/" />');
  });

  it('defines Open Graph, Twitter, and JSON-LD metadata', () => {
    expect(indexHtml).toContain('property="og:title"');
    expect(indexHtml).toContain('property="og:description"');
    expect(indexHtml).toContain('name="twitter:card"');
    expect(indexHtml).toContain('"@type":"SoftwareApplication"');
    expect(indexHtml).toContain('"operatingSystem":"Web, iOS, Android"');
  });

  it('contains visually hidden bilingual crawlable content', () => {
    expect(indexHtml).toContain('class="seo-content"');
    expect(indexHtml).toContain('position: absolute');
    expect(indexHtml).toContain('overflow: hidden');
    expect(indexHtml).toContain('clip-path: inset(50%)');
    expect(indexHtml).toContain('white-space: nowrap');
    expect(indexHtml).toContain('FPV drone pilots');
    expect(indexHtml).toContain('prognoza wiatru FPV');
    expect(indexHtml).toContain('7-day wind forecast');
    expect(indexHtml).not.toContain('display: none');
  });
});

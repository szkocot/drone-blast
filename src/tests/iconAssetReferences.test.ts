import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WEB_ICON_BASENAME } from '../../scripts/icon-artwork.mjs';

describe('versioned web icon references', () => {
  it('uses versioned icon filenames in the manifest', () => {
    const manifest = readFileSync('/Users/szymonkocot/Projects/fpv-blast/public/manifest.json', 'utf8');

    expect(manifest).toContain(`/icons/icon-192-${WEB_ICON_BASENAME}.png`);
    expect(manifest).toContain(`/icons/icon-512-${WEB_ICON_BASENAME}.png`);
  });

  it('uses versioned favicon and touch icon filenames in html', () => {
    const html = readFileSync('/Users/szymonkocot/Projects/fpv-blast/index.html', 'utf8');

    expect(html).toContain(`/icons/icon-192-${WEB_ICON_BASENAME}.png`);
    expect(html).toContain(`/icons/favicon-64-${WEB_ICON_BASENAME}.png`);
  });
});

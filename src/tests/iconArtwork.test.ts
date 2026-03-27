import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  BACKGROUND_COLOR,
  getFaviconSvg,
  getMainIconSvg,
} from '../../scripts/icon-artwork.mjs';

describe('icon artwork sources', () => {
  it('uses the no-wordmark source for the favicon artwork', () => {
    const svg = getFaviconSvg();

    expect(svg).not.toContain('DRONE');
    expect(svg).not.toContain('BLAST');
    expect(svg.toLowerCase()).toContain('fill:black');
    expect(svg).toContain('viewBox="0 0 161.84 161.84"');
  });

  it('uses the full-logo source for the main icon artwork', () => {
    const svg = getMainIconSvg();

    expect(svg.toLowerCase()).toContain('fill:black');
    expect(svg).toContain('viewBox="0 0 176.43 176.43"');
    expect(svg).toContain('fill-rule:nonzero');
  });

  it('renders to the requested square size', async () => {
    const svg = getMainIconSvg();
    const metadata = await sharp(Buffer.from(svg)).png().metadata();

    expect(metadata.width).toBeGreaterThan(0);
    expect(metadata.height).toBeGreaterThan(0);
  });
});

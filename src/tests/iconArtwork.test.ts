import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { BACKGROUND_COLOR, buildIconSvg } from '../../scripts/icon-artwork.mjs';

describe('buildIconSvg', () => {
  it('includes the Drone Blast wordmark and brand colors', () => {
    const svg = buildIconSvg(512);

    expect(svg).toContain('DRONE');
    expect(svg).toContain('BLAST');
    expect(svg).toContain(BACKGROUND_COLOR);
    expect(svg).toContain('#1187de');
    expect(svg).toContain('#ff890f');
  });

  it('renders to the requested square size', async () => {
    const svg = buildIconSvg(256);
    const metadata = await sharp(Buffer.from(svg)).png().metadata();

    expect(metadata.width).toBe(256);
    expect(metadata.height).toBe(256);
  });
});

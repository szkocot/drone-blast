import { readFileSync } from 'node:fs';
import { compile } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';

function compiledCss(path: string): string {
  const source = readFileSync(path, 'utf8');
  return compile(source, { filename: path }).css?.code ?? '';
}

describe('mobile layout regressions', () => {
  it('pads the header for iPhone PWA safe areas', () => {
    const css = compiledCss('/Users/szymonkocot/Projects/fpv-blast/src/lib/components/AppHeader.svelte');

    expect(css).toMatch(/padding:\s*calc\(10px \+ var\(--safe-top\)\)\s+16px\s+10px/);
  });

  it('keeps the weather strip readable on narrow screens', () => {
    const css = compiledCss('/Users/szymonkocot/Projects/fpv-blast/src/lib/components/WeatherStrip.svelte');

    expect(css).toMatch(/overflow-x:\s*auto/);
    expect(css).toMatch(/flex:\s*0 0 34px/);
  });
});

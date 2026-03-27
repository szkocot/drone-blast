import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const BACKGROUND_COLOR = '#2b2a29';
export const WEB_ICON_BASENAME = 'v073';

const FAVICON_SOURCE_PATH = resolve(__dirname, 'icon-sources/favicon-source.svg');
const MAIN_ICON_SOURCE_PATH = resolve(__dirname, 'icon-sources/main-icon-source.svg');

export function getFaviconSvg() {
  return readFileSync(FAVICON_SOURCE_PATH, 'utf8');
}

export function getMainIconSvg() {
  return readFileSync(MAIN_ICON_SOURCE_PATH, 'utf8');
}

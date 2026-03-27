import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const BACKGROUND_COLOR = '#000000';
export const WEB_ICON_BASENAME = 'v076';
export const ANDROID_LAUNCHER_INSET = 0.18;
export const ANDROID_SPLASH_INSET = 0.24;

const FAVICON_SOURCE_PATH = resolve(__dirname, 'icon-sources/favicon-source.svg');
const MAIN_ICON_SOURCE_PATH = resolve(__dirname, 'icon-sources/main-icon-source.svg');

export function getFaviconSvg() {
  return readFileSync(FAVICON_SOURCE_PATH, 'utf8');
}

export function getMainIconSvg() {
  return readFileSync(MAIN_ICON_SOURCE_PATH, 'utf8');
}

/**
 * Generate web and Android app icons from the shared Drone Blast SVG artwork.
 * Run: node scripts/gen-icons.mjs
 */
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { BACKGROUND_COLOR, buildIconSvg } from './icon-artwork.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

mkdirSync(`${root}/public/icons`, { recursive: true });

async function writePng(svg, outputPath, width, height = width) {
  await sharp(Buffer.from(svg))
    .resize(width, height, {
      fit: 'contain',
      background: BACKGROUND_COLOR,
    })
    .png()
    .toFile(outputPath);
  console.log(`Generated ${outputPath.replace(`${root}/`, '')}`);
}

const svg1024 = buildIconSvg(1024);

const webTargets = [
  { path: `${root}/public/icons/favicon-64.png`, width: 64 },
  { path: `${root}/public/icons/icon-192.png`, width: 192 },
  { path: `${root}/public/icons/icon-512.png`, width: 512 },
];

for (const target of webTargets) {
  await writePng(svg1024, target.path, target.width);
}

writeFileSync(`${root}/public/favicon.svg`, buildIconSvg(64));
console.log('Generated public/favicon.svg');

const launcherSizes = [
  { dir: 'mipmap-mdpi', launcher: 48, foreground: 108 },
  { dir: 'mipmap-hdpi', launcher: 72, foreground: 162 },
  { dir: 'mipmap-xhdpi', launcher: 96, foreground: 216 },
  { dir: 'mipmap-xxhdpi', launcher: 144, foreground: 324 },
  { dir: 'mipmap-xxxhdpi', launcher: 192, foreground: 432 },
];

for (const size of launcherSizes) {
  const base = `${root}/android/app/src/main/res/${size.dir}`;
  await writePng(svg1024, `${base}/ic_launcher.png`, size.launcher);
  await writePng(svg1024, `${base}/ic_launcher_round.png`, size.launcher);
  await writePng(svg1024, `${base}/ic_launcher_foreground.png`, size.foreground);
}

const splashTargets = [
  { path: `${root}/android/app/src/main/res/drawable/splash.png`, width: 480, height: 320 },
  { path: `${root}/android/app/src/main/res/drawable-port-mdpi/splash.png`, width: 320, height: 480 },
  { path: `${root}/android/app/src/main/res/drawable-port-hdpi/splash.png`, width: 480, height: 800 },
  { path: `${root}/android/app/src/main/res/drawable-port-xhdpi/splash.png`, width: 720, height: 1280 },
  { path: `${root}/android/app/src/main/res/drawable-port-xxhdpi/splash.png`, width: 960, height: 1600 },
  { path: `${root}/android/app/src/main/res/drawable-port-xxxhdpi/splash.png`, width: 1280, height: 1920 },
  { path: `${root}/android/app/src/main/res/drawable-land-mdpi/splash.png`, width: 480, height: 320 },
  { path: `${root}/android/app/src/main/res/drawable-land-hdpi/splash.png`, width: 800, height: 480 },
  { path: `${root}/android/app/src/main/res/drawable-land-xhdpi/splash.png`, width: 1280, height: 720 },
  { path: `${root}/android/app/src/main/res/drawable-land-xxhdpi/splash.png`, width: 1600, height: 960 },
  { path: `${root}/android/app/src/main/res/drawable-land-xxxhdpi/splash.png`, width: 1920, height: 1280 },
];

for (const target of splashTargets) {
  await writePng(svg1024, target.path, target.width, target.height);
}

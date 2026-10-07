// Renders the PWA icons from public/logo.svg with Playwright's Chromium (no image tooling needed).
// Usage: node scripts/gen-icons.mjs — outputs are committed, rerun only when the logo changes.
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const svg = fs.readFileSync('public/logo.svg', 'utf8');
const BG = '#f7f7f8';

// `pad`: share of the icon left around the crest. Maskable icons keep it inside the 80% safe zone.
const ICONS = [
	{ file: 'public/icons/icon-192.png', size: 192, pad: 0.12 },
	{ file: 'public/icons/icon-512.png', size: 512, pad: 0.12 },
	{ file: 'public/icons/icon-maskable-512.png', size: 512, pad: 0.24 },
	{ file: 'public/apple-touch-icon.png', size: 180, pad: 0.14 },
	{ file: 'public/icons/badge-96.png', size: 96, pad: 0.08, transparent: true }
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const icon of ICONS) {
	await page.setViewportSize({ width: icon.size, height: icon.size });
	const inner = Math.round(icon.size * (1 - 2 * icon.pad));
	await page.setContent(`
		<html><body style="margin:0;width:${icon.size}px;height:${icon.size}px;display:flex;
			align-items:center;justify-content:center;background:${icon.transparent ? 'transparent' : BG}">
			<div style="width:${inner}px;height:${inner}px;display:flex;align-items:center;justify-content:center">
				${svg.replace('<svg', '<svg style="max-width:100%;max-height:100%;width:auto;height:100%"')}
			</div>
		</body></html>`);
	await page.screenshot({ path: icon.file, omitBackground: !!icon.transparent });
	console.log(`✓ ${icon.file}`);
}
await browser.close();

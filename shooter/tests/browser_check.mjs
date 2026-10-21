// Browser-Prüfung (optional, braucht Playwright mit Chromium):
//   node tests/browser_check.mjs [Ausgabeordner]
// Startet einen kleinen Server, öffnet das Spiel in mehreren Bildschirmgrößen, spielt kurz,
// macht Bildschirmfotos und meldet JavaScript-Fehler.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  try { return require('playwright'); } catch { /* weiter */ }
  return require('/opt/node-tools/node_modules/playwright');
}
const { chromium } = loadPlaywright();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(process.argv[2] || path.join(root, 'tests', 'shots'));
fs.mkdirSync(outDir, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
      const file = path.join(root, url === '/' ? 'index.html' : url);
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404);
        res.end('nicht gefunden');
        return;
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const DEVICES = [
  { name: 'pc', width: 1280, height: 720, touch: false, dpr: 1 },
  { name: 'iphone_quer', width: 844, height: 390, touch: true, dpr: 3 },
  { name: 'iphone_hoch', width: 390, height: 844, touch: true, dpr: 3 },
  { name: 'ipad_quer', width: 1180, height: 820, touch: true, dpr: 2 },
];

const scenario = process.env.SCENARIO || 'basic';

async function main() {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  let failures = 0;
  for (const dev of DEVICES) {
    const ctx = await browser.newContext({
      viewport: { width: dev.width, height: dev.height }, deviceScaleFactor: dev.dpr, hasTouch: dev.touch, isMobile: dev.touch,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.goto(base + (process.env.QUERY || '') + (process.env.HASH || ''));
    await page.waitForTimeout(800);
    // direkt ins Spiel (außer der Ablauf testet die Menüs selbst)
    if (!['menus', 'sound', 'touch', 'layout'].includes(scenario)) {
      await page.evaluate(() => document.querySelector('.start-screen .primary').click());
      await page.waitForTimeout(200);
    }
    const mod = await import(path.join(root, 'tests', 'scenarios.mjs'));
    await mod[scenario](page, dev, outDir);
    if (errors.length) {
      failures++;
      console.log(`FEHLER ${dev.name}:\n  ` + errors.join('\n  '));
    } else {
      console.log(`OK ${dev.name}`);
    }
    await ctx.close();
  }
  await browser.close();
  server.close();
  console.log(failures ? `${failures} Gerät(e) mit Fehlern` : 'Browser-Prüfung ohne Fehler');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

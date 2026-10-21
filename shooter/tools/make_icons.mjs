// Erzeugt die App-Symbole (PNG) im Browser aus Code-Zeichnungen:  node tools/make_icons.mjs
// Braucht Playwright mit Chromium (nur für diesen Schritt, nicht für das Spiel).

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'icons');
fs.mkdirSync(out, { recursive: true });

const browser = await pw.chromium.launch();
const page = await browser.newPage();
for (const [name, size, pad] of [['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['apple-touch-icon.png', 180, 0], ['icon-maskable-512.png', 512, 0.12]]) {
  const data = await page.evaluate(([size, pad]) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#07070f';
    ctx.fillRect(0, 0, size, size);
    // Gitter
    ctx.strokeStyle = '#13204a';
    ctx.lineWidth = size / 128;
    for (let i = 1; i < 8; i++) {
      ctx.beginPath(); ctx.moveTo((i * size) / 8, 0); ctx.lineTo((i * size) / 8, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, (i * size) / 8); ctx.lineTo(size, (i * size) / 8); ctx.stroke();
    }
    const s = (size * (1 - pad * 2)) / 64;
    ctx.translate(size / 2, size / 2);
    ctx.scale(s, s);
    // pinker Ring
    ctx.shadowColor = '#ff3b6b';
    ctx.shadowBlur = 6;
    ctx.strokeStyle = '#ff3b6b';
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.stroke();
    // cyanfarbenes Schiff (wie im Spiel)
    ctx.rotate(-Math.PI / 4);
    ctx.shadowColor = '#3ff3ff';
    ctx.shadowBlur = 8;
    ctx.fillStyle = 'rgba(63,243,255,0.25)';
    ctx.strokeStyle = '#3ff3ff';
    ctx.lineWidth = 2.6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(17, 0); ctx.lineTo(-10, -11); ctx.lineTo(-4.5, 0); ctx.lineTo(-10, 11);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#e8ffff';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    return c.toDataURL('image/png');
  }, [size, pad]);
  fs.writeFileSync(path.join(out, name), Buffer.from(data.split(',')[1], 'base64'));
  console.log('geschrieben:', name);
}
await browser.close();

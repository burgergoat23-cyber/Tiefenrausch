// Erzeugt Test-Bildschirmfotos für den Bildklicker-Test (node bildklicker/test/bilder.js <Ordner>)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const out = process.argv[2] || 'bk_bilder';
fs.mkdirSync(out, { recursive: true });

function page(variant) {
  // variant A: OK-Knopf oben links; B: OK-Knopf woanders + Hover-Farbe, Abbrechen bleibt; C: ohne OK-Knopf
  const ok = variant === 'C' ? '' :
    `<button class="btn ${variant === 'B' ? 'hover' : ''}" style="position:absolute;left:${variant === 'A' ? 140 : 700}px;top:${variant === 'A' ? 610 : 800}px">OK</button>`;
  let words = '';
  for (let i = 0; i < 260; i++) words += ['Bildschirm ', 'Maus ', 'klicken ', 'Tiefenrausch ', 'Spiel ', 'Fenster ', 'Knopf ', 'Datei '][(i * 7 + 3) % 8];
  let icons = '';
  for (let i = 0; i < 24; i++) {
    const h = (i * 47) % 360;
    icons += `<div class="ico" style="left:${60 + (i % 12) * 70}px;top:${150 + Math.floor(i / 12) * 70}px;background:hsl(${h},70%,50%)">${'★♥♦♣☀☂✈⚑'[i % 8]}</div>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;width:1920px;height:1080px;font-family:'DejaVu Sans',sans-serif;background:#f3f3f3;position:relative;overflow:hidden}
    .bar{position:absolute;left:0;top:0;right:0;height:44px;background:linear-gradient(#3b6fb6,#2a5390);color:#fff;font-size:18px;line-height:44px;padding-left:16px}
    .ico{position:absolute;width:52px;height:52px;border-radius:12px;color:#fff;font-size:30px;text-align:center;line-height:52px}
    .btn{font:16px 'DejaVu Sans',sans-serif;padding:8px 26px;border:1px solid #888;border-radius:4px;background:#e1e1e1}
    .btn.hover{background:#e5f1fb;border-color:#0078d7}
    .txt{position:absolute;left:960px;top:120px;width:860px;font-size:15px;line-height:22px;color:#222}
    .game{position:absolute;left:960px;top:560px;width:820px;height:440px;background:radial-gradient(circle at 30% 40%,#ffd36b,#c0392b 40%,#2c3e50 80%)}
    .coin{position:absolute;width:40px;height:40px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff7c0,#f1c40f 50%,#b7950b);border:2px solid #7d6608}
  </style></head><body>
    <div class="bar">Testfenster – Bildklicker ${variant}</div>
    ${icons}
    <div class="txt">${words}</div>
    ${ok}
    <button class="btn" style="position:absolute;left:260px;top:610px">Abbrechen</button>
    <button class="btn" style="position:absolute;left:420px;top:610px">Weiter</button>
    <div class="game">
      <div class="coin" style="left:${variant === 'A' ? 100 : 600}px;top:${variant === 'A' ? 80 : 300}px"></div>
      <div class="coin" style="left:300px;top:200px;filter:hue-rotate(180deg)"></div>
    </div>
  </body></html>`;
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  for (const v of ['A', 'B', 'C']) {
    await p.setContent(page(v));
    await p.screenshot({ path: path.join(out, `seite_${v}.png`) });
    // Lage der Knöpfe/Münzen als Textdatei: name x y b h
    const boxes = await p.evaluate(() => [...document.querySelectorAll('button,.coin')].map((e, i) => {
      const r = e.getBoundingClientRect();
      return [(e.textContent || 'coin' + i).trim() || 'coin' + i, Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)].join(' ');
    }));
    fs.writeFileSync(path.join(out, `boxen_${v}.txt`), boxes.join('\n') + '\n');
  }
  await b.close();
  console.log('Bilder in', out);
})();

// Abläufe für tests/browser_check.mjs (je Gerät aufgerufen)

import path from 'node:path';

export async function basic(page, dev, outDir) {
  const shot = (n) => page.screenshot({ path: path.join(outDir, `${dev.name}_${n}.png`) });
  await page.mouse.move(dev.width * 0.7, dev.height * 0.4);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(500);
  await page.keyboard.press('Space');
  await page.waitForTimeout(60);
  await shot('dash');
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(400);
  await shot('stand');
}

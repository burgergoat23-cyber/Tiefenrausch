import { expect, test } from '@playwright/test';
import { expectAudioPlaying, mockMusicApis } from './mocks';

test.beforeEach(async ({ page }) => {
  await mockMusicApis(page);
});

test('Warteschlange per Tastatur umsortieren, entfernen, Zufall', async ({ page }) => {
  await page.goto('/');
  // Trending abspielen → 8 Songs in der Warteschlange
  await page
    .getByRole('button', { name: /„Mitternachtsfahrt“ abspielen/ })
    .first()
    .click();
  await expectAudioPlaying(page);
  await page.goto('/#/warteschlange');
  const titles = () =>
    page.getByTestId('queue-item').locator('span[class*="title"]').allTextContents();
  await expect(page.getByTestId('queue-item')).toHaveCount(7);
  const before = await titles();
  expect(before.slice(0, 2)).toEqual(['Neonlicht', 'Sommerregen']);

  // Ersten kommenden Song mit der Tastatur eine Position nach unten schieben
  // (Die Ansagen für Screenreader zeigen, dass jeder Schritt angekommen ist)
  const live = page.locator('[id^="DndLiveRegion"]');
  await page.getByRole('button', { name: '„Neonlicht“ verschieben' }).focus();
  await page.keyboard.press('Space');
  await expect(live).toHaveText(/„Neonlicht“ (aufgenommen|ist jetzt an Position 1)/);
  await page.keyboard.press('ArrowDown');
  await expect(live).toHaveText('„Neonlicht“ ist jetzt an Position 2.');
  await page.keyboard.press('Space');
  await expect(live).toHaveText('„Neonlicht“ abgelegt an Position 2.');
  await expect.poll(titles).toEqual(['Sommerregen', 'Neonlicht', ...before.slice(2)]);

  // Entfernen
  await page.getByRole('button', { name: '„Tiefsee“ entfernen' }).click();
  await expect(page.getByTestId('queue-item')).toHaveCount(6);

  // Zufall an → andere Reihenfolge, Zufall aus → wieder wie vorher
  const ordered = await titles();
  await page.getByRole('button', { name: 'Zufall ist aus' }).click();
  await expect(page.getByRole('button', { name: 'Zufall ist an' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const mixed = await titles();
  expect([...mixed].sort()).toEqual([...ordered].sort());
  await page.getByRole('button', { name: 'Zufall ist an' }).click();
  await expect.poll(titles).toEqual(ordered);
});

test('Warteschlange mit der Maus/dem Finger umsortieren', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: /„Mitternachtsfahrt“ abspielen/ })
    .first()
    .click();
  await page.goto('/#/warteschlange');
  const handle = page.getByRole('button', { name: '„Neonlicht“ verschieben' });
  const target = page.getByRole('button', { name: '„Tiefsee“ verschieben' });
  const a = await handle.boundingBox();
  const b = await target.boundingBox();
  if (!a || !b) throw new Error('keine Position');
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + 10, { steps: 3 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + 5, { steps: 12 });
  await page.mouse.up();
  const titles = () =>
    page.getByTestId('queue-item').locator('span[class*="title"]').allTextContents();
  await expect
    .poll(async () => (await titles()).slice(0, 3))
    .toEqual(['Sommerregen', 'Tiefsee', 'Neonlicht']);
});

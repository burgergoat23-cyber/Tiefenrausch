import { expect, test } from '@playwright/test';
import { mockMusicApis } from './mocks';

test('Audius fällt aus → freundliche Meldung, Jamendo läuft weiter', async ({ page }) => {
  await mockMusicApis(page, { audiusDown: true });
  await page.goto('/#/suche?q=test');
  await expect(
    page
      .getByTestId('results-audius')
      .getByText('Audius antwortet gerade nicht – versuch es gleich nochmal.'),
  ).toBeVisible();
  await expect(
    page
      .getByTestId('results-jamendo')
      .getByRole('button', { name: /„test Freier Himmel“ abspielen/ }),
  ).toBeVisible();
  await expect(
    page.getByTestId('results-audius').getByRole('button', { name: 'Nochmal versuchen' }),
  ).toBeVisible();
});

test('Langsame Quelle blockiert die schnelle nicht', async ({ page }) => {
  await mockMusicApis(page, { jamendoDelay: 2500 });
  await page.goto('/#/suche?q=nacht');
  await expect(
    page.getByTestId('results-audius').getByRole('button', { name: /„nacht Neonlicht“ abspielen/ }),
  ).toBeVisible();
  await expect(page.getByTestId('results-jamendo').getByText('Jamendo sucht …')).toBeVisible();
  await expect(
    page
      .getByTestId('results-jamendo')
      .getByRole('button', { name: /„nacht Waldlicht“ abspielen/ }),
  ).toBeVisible();
});

test('Kein waagrechtes Scrollen, Touch-Ziele groß genug', async ({ page }) => {
  await mockMusicApis(page);
  for (const path of ['/', '/#/suche?q=lang', '/#/anpassen', '/#/einstellungen', '/#/bibliothek']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
  await page.goto('/#/suche?q=lang');
  await page
    .getByRole('button', { name: /abspielen/ })
    .first()
    .click();
  const small = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>(
        'nav a, [data-testid="mini-player"] button, [data-testid="mini-player"] a, .kr-icon-btn',
      ),
    )
      .filter((el) => el.offsetParent !== null)
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width < 43.5 || r.height < 43.5;
      })
      .map((el) => el.getAttribute('aria-label') ?? el.textContent),
  );
  expect(small).toEqual([]);
});

test('Unbekannte Seite zeigt freundliche Meldung statt weißer Seite', async ({ page }) => {
  await mockMusicApis(page);
  await page.goto('/#/gibt-es-nicht');
  await expect(page.getByRole('heading', { name: 'Diese Seite gibt es nicht.' })).toBeVisible();
});

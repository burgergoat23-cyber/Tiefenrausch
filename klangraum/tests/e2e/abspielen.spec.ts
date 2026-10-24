import { expect, test } from '@playwright/test';
import { expectAudioPlaying, mockMusicApis } from './mocks';

test.beforeEach(async ({ page }) => {
  await mockMusicApis(page);
});

test('Suchen → Song abspielen → in die Warteschlange legen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: 'Suche' }).click();
  await page.getByRole('searchbox').fill('lofi');
  await page.getByRole('searchbox').press('Enter');

  // Ergebnisse aus beiden Quellen, jeweils mit Quellen-Symbol
  const audius = page.getByTestId('results-audius');
  const jamendo = page.getByTestId('results-jamendo');
  await expect(audius.getByRole('button', { name: /„lofi Neonlicht“ abspielen/ })).toBeVisible();
  await expect(
    jamendo.getByRole('button', { name: /Lizenz: CC BY-SA 3\.0/ }).first(),
  ).toBeVisible();

  await audius.getByRole('button', { name: /„lofi Neonlicht“ abspielen/ }).click();
  const mini = page.getByTestId('mini-player');
  await expect(mini).toContainText('lofi Neonlicht');
  await expectAudioPlaying(page);
  await expect(mini.getByRole('button', { name: 'Pause' })).toBeVisible();

  // Jamendo-Song „Ans Ende der Warteschlange“
  await jamendo.getByRole('button', { name: /Mehr zu „lofi Waldlicht“/ }).click();
  await page.getByRole('menuitem', { name: 'Ans Ende der Warteschlange' }).click();
  await expect(page.getByText('„lofi Waldlicht“ ist jetzt in der Warteschlange.')).toBeVisible();

  await page.goto('/#/warteschlange');
  const items = page.getByTestId('queue-item');
  await expect(items.last()).toContainText('lofi Waldlicht');
  // Suche wurde im Verlauf gemerkt
  await page.goto('/#/suche');
  await expect(page.getByRole('button', { name: 'lofi', exact: true })).toBeVisible();
});

test('Vollbild-Player: Steuerung, Quelle und Lizenz, Übergang zwischen Quellen', async ({
  page,
}) => {
  await page.goto('/#/suche?q=wald');
  await page
    .getByTestId('results-jamendo')
    .getByRole('button', { name: /„wald Freier Himmel“ abspielen/ })
    .click();
  await expectAudioPlaying(page);
  await page
    .getByTestId('mini-player')
    .getByRole('link', { name: /Player öffnen/ })
    .click();

  const player = page.getByTestId('full-player');
  await expect(player.getByRole('heading', { name: 'wald Freier Himmel' })).toBeVisible();
  await expect(player.getByRole('link', { name: 'Lizenz: CC BY-SA 3.0' })).toHaveAttribute(
    'href',
    'https://creativecommons.org/licenses/by-sa/3.0/',
  );
  await expect(player.getByRole('img', { name: 'Quelle: Jamendo' })).toBeVisible();

  await player.getByRole('button', { name: 'Pause' }).click();
  await expect(player.getByRole('button', { name: 'Abspielen' })).toBeVisible();
  await player.getByRole('button', { name: 'Nächster Song' }).click();
  await expect(player.getByRole('heading', { name: 'wald Offene Straße' })).toBeVisible();
  await expectAudioPlaying(page);

  await player.getByRole('button', { name: 'Player schließen' }).click();
  await expect(page.getByTestId('full-player')).toHaveCount(0);
  await expect(page.getByTestId('mini-player')).toBeVisible();
});

test('Nach dem Neuladen ist die Warteschlange noch da', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: /„Neonlicht“ abspielen/ })
    .first()
    .click();
  await expectAudioPlaying(page);
  await page.reload();
  const mini = page.getByTestId('mini-player');
  await expect(mini).toContainText('Neonlicht');
  await mini.getByRole('button', { name: 'Abspielen' }).click();
  await expectAudioPlaying(page);
});

test('Am Songende geht es automatisch weiter (Wiederholen: alle)', async ({ page }) => {
  await mockMusicApis(page, { audioSeconds: 1.2 });
  await page.goto('/');
  await page
    .getByRole('button', { name: /„Sternenstaub“ abspielen/ })
    .first()
    .click();
  const mini = page.getByTestId('mini-player');
  await expect(mini).toContainText('Sternenstaub');
  // nach dem letzten Trending-Song von Audius ist Schluss → Wiederholen: alle springt zum ersten
  await mini.getByRole('link', { name: /Player öffnen/ }).click();
  await page.getByRole('button', { name: 'Wiederholen: aus' }).click();
  await expect(page.getByRole('button', { name: 'Wiederholen: alle' })).toBeVisible();
  await expect(page.getByTestId('full-player').getByRole('heading')).toHaveText(
    'Mitternachtsfahrt',
    {
      timeout: 6000,
    },
  );
  await expectAudioPlaying(page);
});

import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../storage/settings';
import { track } from '../test/fixtures';
import { buildBackup, parseBackup } from './backup';
import { emptyLibrary, toggleLike } from './library';

describe('Sicherung', () => {
  it('ohne YouTube-Schlüssel; beim Laden bleibt der eigene erhalten', () => {
    const settings = { ...defaultSettings(), youtubeApiKey: 'GEHEIM', themeId: 'khaki' };
    const lib = toggleLike(emptyLibrary(), track('a'), 1);
    const text = JSON.stringify(buildBackup(settings, lib));
    expect(text).not.toContain('GEHEIM');
    const mine = { ...defaultSettings(), youtubeApiKey: 'MEINER' };
    const parsed = parseBackup(text, mine);
    expect(parsed?.library.likes).toHaveLength(1);
    expect(parsed?.settings?.themeId).toBe('khaki');
    expect(parsed?.settings?.youtubeApiKey).toBe('MEINER');
  });

  it('fremde Dateien werden abgelehnt', () => {
    expect(parseBackup('{"app":"anders"}', defaultSettings())).toBeNull();
    expect(parseBackup('kein json', defaultSettings())).toBeNull();
  });
});

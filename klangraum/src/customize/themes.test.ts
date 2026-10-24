import { describe, expect, it } from 'vitest';
import { contrastRatio, meetsAA, parseHex } from './contrast';
import { applyTheme, cssVarName, findTheme, PRESET_THEMES, themeSchema } from './themes';

describe('Kontrastprüfung (WCAG)', () => {
  it('schwarz auf weiß = 21:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#fff', '#fff')).toBeCloseTo(1, 5);
  });

  it('bekannter Wert: #777 auf weiß ≈ 4.48 (knapp unter AA)', () => {
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
    expect(meetsAA('#777777', '#ffffff')).toBe(false);
    expect(meetsAA('#777777', '#ffffff', true)).toBe(true);
  });

  it('liest Kurz- und Langform, lehnt Unsinn ab', () => {
    expect(parseHex('#abc')).toEqual([170, 187, 204]);
    expect(parseHex('#a1b2c3')).toEqual([161, 178, 195]);
    expect(parseHex('red')).toBeNull();
  });
});

describe('Fertige Themes', () => {
  it('es gibt mindestens drei, alle mit eindeutiger id', () => {
    expect(PRESET_THEMES.length).toBeGreaterThanOrEqual(3);
    expect(new Set(PRESET_THEMES.map((t) => t.id)).size).toBe(PRESET_THEMES.length);
  });

  for (const theme of PRESET_THEMES) {
    describe(theme.name, () => {
      it('ist gültig', () => {
        expect(themeSchema.safeParse(theme).success).toBe(true);
      });
      it('Text ist gut lesbar (AA) auf Hintergrund und Flächen', () => {
        const t = theme.tokens;
        expect(meetsAA(t.text, t.bg)).toBe(true);
        expect(meetsAA(t.text, t.surface)).toBe(true);
        expect(meetsAA(t.text, t.surfaceRaised)).toBe(true);
        expect(meetsAA(t.textMuted, t.bg)).toBe(true);
        expect(meetsAA(t.textMuted, t.surface)).toBe(true);
        expect(meetsAA(t.accentText, t.accent)).toBe(true);
      });
      it('Akzent und Fehlerfarbe sind als Bedienelement erkennbar (3:1)', () => {
        expect(meetsAA(theme.tokens.accent, theme.tokens.bg, true)).toBe(true);
        expect(meetsAA(theme.tokens.error, theme.tokens.bg, true)).toBe(true);
      });
    });
  }
});

describe('Theme-Prüfung (Sicherheit)', () => {
  const good = PRESET_THEMES[0]!;

  it('lehnt eingeschleustes CSS in Farben ab', () => {
    const evil = {
      ...good,
      tokens: { ...good.tokens, bg: '#000; background-image: url(https://evil.test/x)' },
    };
    expect(themeSchema.safeParse(evil).success).toBe(false);
  });

  it('lehnt fehlende Farben und falsche Namen ab', () => {
    const rest: Partial<typeof good.tokens> = { ...good.tokens };
    delete rest.bg;
    expect(themeSchema.safeParse({ ...good, tokens: rest }).success).toBe(false);
    expect(themeSchema.safeParse({ ...good, id: '../../x' }).success).toBe(false);
    expect(themeSchema.safeParse({ ...good, scheme: 'blau' }).success).toBe(false);
  });

  it('applyTheme setzt CSS-Variablen; unbekanntes Theme → Standard', () => {
    const root = document.createElement('div');
    applyTheme(findTheme('hell'), root);
    expect(root.style.getPropertyValue('--kr-surface-raised')).toBe('#eceef6');
    expect(root.dataset.theme).toBe('hell');
    expect(findTheme('gibts-nicht').id).toBe('oliv');
  });

  it('Variablennamen', () => {
    expect(cssVarName('surfaceRaised')).toBe('--kr-surface-raised');
    expect(cssVarName('accentText')).toBe('--kr-accent-text');
  });
});

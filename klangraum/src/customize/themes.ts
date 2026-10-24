import { z } from 'zod';
import { contrastRatio } from './contrast';

/** Nur Farben als #rgb oder #rrggbb – so kann ein Import niemals CSS einschleusen. */
export const hexColorSchema = z.string().regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/);

export const TOKEN_NAMES = [
  'bg',
  'surface',
  'surfaceRaised',
  'text',
  'textMuted',
  'accent',
  'accentText',
  'border',
  'error',
  'success',
  'shadow',
] as const;
export type TokenName = (typeof TOKEN_NAMES)[number];

export const themeTokensSchema = z.object({
  bg: hexColorSchema,
  surface: hexColorSchema,
  surfaceRaised: hexColorSchema,
  text: hexColorSchema,
  textMuted: hexColorSchema,
  accent: hexColorSchema,
  accentText: hexColorSchema,
  border: hexColorSchema,
  error: hexColorSchema,
  success: hexColorSchema,
  shadow: hexColorSchema,
});
export type ThemeTokens = z.infer<typeof themeTokensSchema>;

export const themeSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  name: z.string().min(1).max(60),
  scheme: z.enum(['dark', 'light']),
  tokens: themeTokensSchema,
});
export type Theme = z.infer<typeof themeSchema>;

/** CSS-Variablen-Namen: bg → --kr-bg, surfaceRaised → --kr-surface-raised */
export function cssVarName(token: TokenName): string {
  return `--kr-${token.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

/** Fertige Themes (alle mit geprüftem Kontrast). Dazu kommt eine frei wählbare Akzentfarbe. */
export const PRESET_THEMES: readonly Theme[] = [
  {
    id: 'oliv',
    name: 'Oliv',
    scheme: 'dark',
    tokens: {
      bg: '#0b0c09',
      surface: '#1a1c15',
      surfaceRaised: '#262a1f',
      text: '#f1f2ea',
      textMuted: '#a7ab97',
      accent: '#a8c26b',
      accentText: '#10120c',
      border: '#34382a',
      error: '#ff8a7a',
      success: '#8fd18a',
      shadow: '#000000',
    },
  },
  {
    id: 'khaki',
    name: 'Khaki',
    scheme: 'dark',
    tokens: {
      bg: '#0d0c0a',
      surface: '#1d1b16',
      surfaceRaised: '#2a2720',
      text: '#f3f0e6',
      textMuted: '#ada791',
      accent: '#c9b880',
      accentText: '#15130e',
      border: '#3a3629',
      error: '#ff8a7a',
      success: '#9ccf86',
      shadow: '#000000',
    },
  },
  {
    id: 'mitternacht',
    name: 'Mitternacht',
    scheme: 'dark',
    tokens: {
      bg: '#0e1020',
      surface: '#171a2e',
      surfaceRaised: '#21253d',
      text: '#eef0ff',
      textMuted: '#a3a8c8',
      accent: '#8b7dff',
      accentText: '#0e1020',
      border: '#2f3452',
      error: '#ff7a8a',
      success: '#5fd39a',
      shadow: '#000000',
    },
  },
  {
    id: 'hell',
    name: 'Hell',
    scheme: 'light',
    tokens: {
      bg: '#f6f7fb',
      surface: '#ffffff',
      surfaceRaised: '#eceef6',
      text: '#161827',
      textMuted: '#555a72',
      accent: '#5b3fd6',
      accentText: '#ffffff',
      border: '#d5d8e6',
      error: '#b3261e',
      success: '#1e7a46',
      shadow: '#1a1d33',
    },
  },
  {
    id: 'oled',
    name: 'OLED-Schwarz',
    scheme: 'dark',
    tokens: {
      bg: '#000000',
      surface: '#0b0b0b',
      surfaceRaised: '#161616',
      text: '#f5f5f5',
      textMuted: '#a6a6a6',
      accent: '#1ed760',
      accentText: '#000000',
      border: '#262626',
      error: '#ff6b6b',
      success: '#1ed760',
      shadow: '#000000',
    },
  },
  {
    id: 'wald',
    name: 'Wald',
    scheme: 'dark',
    tokens: {
      bg: '#08100c',
      surface: '#122019',
      surfaceRaised: '#1b2d23',
      text: '#eef4ef',
      textMuted: '#9fb3a6',
      accent: '#6fcf8f',
      accentText: '#06120a',
      border: '#26392e',
      error: '#ff8a7a',
      success: '#6fcf8f',
      shadow: '#000000',
    },
  },
  {
    id: 'sand',
    name: 'Sand',
    scheme: 'light',
    tokens: {
      bg: '#f3efe4',
      surface: '#fbf8f1',
      surfaceRaised: '#e9e3d3',
      text: '#1f1d16',
      textMuted: '#5b5646',
      accent: '#5d6b2c',
      accentText: '#ffffff',
      border: '#d6cfbc',
      error: '#a3261c',
      success: '#3f6b2a',
      shadow: '#3a3423',
    },
  },
  {
    id: 'asphalt',
    name: 'Asphalt',
    scheme: 'dark',
    tokens: {
      bg: '#101112',
      surface: '#1b1d1f',
      surfaceRaised: '#26292c',
      text: '#f1f2f3',
      textMuted: '#a5a9ad',
      accent: '#d9dcdf',
      accentText: '#111213',
      border: '#33373b',
      error: '#ff8a7a',
      success: '#8fd18a',
      shadow: '#000000',
    },
  },
  {
    id: 'ozean',
    name: 'Ozean',
    scheme: 'dark',
    tokens: {
      bg: '#071114',
      surface: '#0f1f24',
      surfaceRaised: '#172d33',
      text: '#ecf6f7',
      textMuted: '#98b4b9',
      accent: '#4fc6c8',
      accentText: '#041214',
      border: '#22393f',
      error: '#ff8a7a',
      success: '#7fd6a0',
      shadow: '#000000',
    },
  },
  {
    id: 'kupfer',
    name: 'Kupfer',
    scheme: 'dark',
    tokens: {
      bg: '#110c09',
      surface: '#1e1611',
      surfaceRaised: '#2b2018',
      text: '#f6efe9',
      textMuted: '#b8a596',
      accent: '#e09a5b',
      accentText: '#170d05',
      border: '#3b2c21',
      error: '#ff8a7a',
      success: '#9ccf86',
      shadow: '#000000',
    },
  },
];

export const DEFAULT_THEME_ID = 'oliv';

export function findTheme(id: string): Theme {
  return PRESET_THEMES.find((t) => t.id === id) ?? (PRESET_THEMES[0] as Theme);
}

/** Schrift auf der Akzentfarbe: schwarz oder weiß, je nachdem was besser lesbar ist */
export function textOn(color: string): string {
  return contrastRatio('#000000', color) >= contrastRatio('#ffffff', color) ? '#000000' : '#ffffff';
}

/** Theme mit eigener Akzentfarbe (leer = Farbe des Themes) */
export function withAccent(theme: Theme, accent: string): Theme {
  if (!accent || !hexColorSchema.safeParse(accent).success) return theme;
  return { ...theme, tokens: { ...theme.tokens, accent, accentText: textOn(accent) } };
}

/** Setzt alle Design-Tokens als CSS-Variablen. Komponenten benutzen nur diese Variablen. */
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement) {
  const parsed = themeSchema.safeParse(theme);
  const t = parsed.success ? parsed.data : findTheme(DEFAULT_THEME_ID);
  for (const name of TOKEN_NAMES) root.style.setProperty(cssVarName(name), t.tokens[name]);
  root.style.colorScheme = t.scheme;
  root.dataset.theme = t.id;
  const meta = root.ownerDocument.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t.tokens.bg);
}

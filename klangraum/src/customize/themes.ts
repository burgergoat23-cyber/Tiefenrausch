import { z } from 'zod';

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

/** Fertige Themes. Phase 1: drei Stück – Phase 4 bringt mindestens zehn und einen Editor. */
export const PRESET_THEMES: readonly Theme[] = [
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
];

export const DEFAULT_THEME_ID = 'mitternacht';

export function findTheme(id: string): Theme {
  return PRESET_THEMES.find((t) => t.id === id) ?? (PRESET_THEMES[0] as Theme);
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

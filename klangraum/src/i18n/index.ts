import { useCallback } from 'react';
import { useSettings } from '../app/settingsStore';
import { de, type Dict } from './de';
import { en } from './en';

export type Language = 'de' | 'en';

const DICTS: Record<Language, Dict> = { de, en };

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

/** Alle erlaubten Text-Schlüssel, z. B. 'player.play' – Tippfehler meldet TypeScript sofort. */
export type TKey = Leaves<Dict>;
export type TParams = Record<string, string | number>;

function lookup(dict: Dict, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (!node || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

export function translate(lang: Language, key: TKey, params?: TParams): string {
  const text = lookup(DICTS[lang], key) ?? lookup(de, key) ?? key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in params ? String(params[name]) : m,
  );
}

export type TFunction = (key: TKey, params?: TParams) => string;

/** Hook für Komponenten: const t = useT(); t('player.play') */
export function useT(): TFunction {
  const lang = useSettings((s) => s.settings.language);
  return useCallback((key, params) => translate(lang, key, params), [lang]);
}

export function allKeys(dict: object, prefix = ''): string[] {
  return Object.entries(dict).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${prefix}${k}`] : allKeys(v as object, `${prefix}${k}.`),
  );
}

export { de, en };

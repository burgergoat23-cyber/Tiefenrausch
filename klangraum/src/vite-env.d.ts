/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_JAMENDO_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Versionsnummer aus package.json (von Vite eingesetzt) */
declare const __APP_VERSION__: string;

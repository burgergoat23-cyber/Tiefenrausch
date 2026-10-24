# Klangraum

Musik-Web-App (PWA), die man fast komplett selbst gestalten kann. Musik kommt nur aus offiziellen
Quellen: Audius und Jamendo (Phase 1), später Spotify, Internet Archive und eigene Dateien.

## Starten (am PC)

```bash
cd klangraum
npm install
cp .env.example .env      # optional: Jamendo-Client-ID eintragen
npm run dev               # öffnet http://localhost:5173
```

Die Jamendo-Client-ID kann man auch direkt in der App unter **Einstellungen → Musik-Quellen** eintragen.

## Prüfen

```bash
npm run lint        # Code-Stil
npm run typecheck   # TypeScript
npm test            # Unit-Tests (Vitest)
npm run e2e         # Browser-Tests (Playwright, PC + iPhone-Ansicht)
SCREENS=1 npx playwright test screens   # Screenshots nach docs/screenshots/
npm run build       # fertige App nach dist/
```

Mehr Details für Entwickler: `UEBERGABE.md`. Der ursprüngliche Auftrag steht in `docs/AUFTRAG.md`.

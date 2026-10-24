import type { CSSProperties } from 'react';
import { useSettings } from '../app/settingsStore';
import { Icon } from '../components/Icon';
import { contrastRatio } from '../customize/contrast';
import { cssVarName, findTheme, PRESET_THEMES, TOKEN_NAMES, type Theme } from '../customize/themes';
import { useT } from '../i18n';
import styles from './CustomizePage.module.css';

/** Die Vorschau-Karte bekommt die Farben des Themes als eigene CSS-Variablen */
function themeVars(theme: Theme): CSSProperties {
  const vars: Record<string, string> = {};
  for (const name of TOKEN_NAMES) vars[cssVarName(name)] = theme.tokens[name];
  return vars as CSSProperties;
}

/** Ruhige, gut lesbare Akzentfarben zur Auswahl (eigene Farbe geht auch) */
const ACCENTS = [
  '#a8c26b',
  '#c9b880',
  '#6fcf8f',
  '#4fc6c8',
  '#6aa8ff',
  '#a99bff',
  '#f28cb1',
  '#ff8a65',
  '#f2c14e',
  '#e8e8e8',
];

function AccentPicker() {
  const t = useT();
  const accent = useSettings((s) => s.settings.accentColor);
  const themeId = useSettings((s) => s.settings.themeId);
  const setAccent = useSettings((s) => s.setAccentColor);
  const bg = findTheme(themeId).tokens.bg;
  const current = accent || findTheme(themeId).tokens.accent;
  const weak = contrastRatio(current, bg) < 3;
  return (
    <section className="kr-section" aria-labelledby="c-accent">
      <h2 id="c-accent">{t('customize.accent')}</h2>
      <p className="kr-muted">{t('customize.accentHint')}</p>
      <div className={styles.swatches} role="group" aria-label={t('customize.accent')}>
        <button
          type="button"
          className={styles.swatch}
          data-default
          aria-pressed={!accent}
          aria-label={t('customize.accentDefault')}
          title={t('customize.accentDefault')}
          style={{ background: findTheme(themeId).tokens.accent }}
          onClick={() => setAccent('')}
        >
          {!accent && <Icon name="check" size={18} />}
        </button>
        {ACCENTS.map((c) => (
          <button
            key={c}
            type="button"
            className={styles.swatch}
            aria-pressed={accent === c}
            aria-label={t('customize.accentPick', { color: c })}
            style={{ background: c }}
            onClick={() => setAccent(c)}
          >
            {accent === c && <Icon name="check" size={18} />}
          </button>
        ))}
        <label className={styles.custom}>
          <input
            type="color"
            value={current}
            onChange={(e) => setAccent(e.target.value)}
            aria-label={t('customize.accentCustom')}
          />
          <span>{t('customize.accentCustom')}</span>
        </label>
      </div>
      {weak && <p className="kr-error-text">{t('customize.accentWeak')}</p>}
    </section>
  );
}

function PlayerOptions() {
  const t = useT();
  const backdrop = useSettings((s) => s.settings.playerBackdrop);
  const setBackdrop = useSettings((s) => s.setPlayerBackdrop);
  return (
    <section className="kr-section" aria-labelledby="c-player">
      <h2 id="c-player">{t('customize.player')}</h2>
      <label className={styles.toggle}>
        <input
          type="checkbox"
          role="switch"
          checked={backdrop}
          onChange={(e) => setBackdrop(e.target.checked)}
        />
        <span>{t('customize.backdrop')}</span>
      </label>
    </section>
  );
}

export default function CustomizePage() {
  const t = useT();
  const themeId = useSettings((s) => s.settings.themeId);
  const setTheme = useSettings((s) => s.setTheme);
  return (
    <div className="kr-page">
      <h1>{t('customize.title')}</h1>
      <section className="kr-section" aria-labelledby="c-themes">
        <h2 id="c-themes">{t('customize.themes')}</h2>
        <ul className={styles.grid}>
          {PRESET_THEMES.map((theme) => {
            const active = theme.id === themeId;
            return (
              <li key={theme.id}>
                <button
                  type="button"
                  className={styles.card}
                  style={themeVars(theme)}
                  aria-pressed={active}
                  aria-label={t('customize.choose', { name: theme.name })}
                  data-theme-id={theme.id}
                  onClick={() => setTheme(theme.id)}
                >
                  <span className={styles.preview} aria-hidden="true">
                    <span className={styles.previewArt} />
                    <span className={styles.previewLines}>
                      <span className={styles.previewTitle} />
                      <span className={styles.previewSub} />
                    </span>
                    <span className={styles.previewPlay}>
                      <Icon name="play" size={16} />
                    </span>
                  </span>
                  <span className={styles.name}>
                    {theme.name}
                    {active && (
                      <span className={styles.active}>
                        <Icon name="check" size={16} />
                        {t('customize.active')}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      <AccentPicker />
      <PlayerOptions />
    </div>
  );
}

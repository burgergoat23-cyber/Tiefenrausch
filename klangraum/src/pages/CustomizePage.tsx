import type { CSSProperties } from 'react';
import { useSettings } from '../app/settingsStore';
import { Icon } from '../components/Icon';
import { cssVarName, PRESET_THEMES, TOKEN_NAMES, type Theme } from '../customize/themes';
import { useT } from '../i18n';
import styles from './CustomizePage.module.css';

/** Die Vorschau-Karte bekommt die Farben des Themes als eigene CSS-Variablen */
function themeVars(theme: Theme): CSSProperties {
  const vars: Record<string, string> = {};
  for (const name of TOKEN_NAMES) vars[cssVarName(name)] = theme.tokens[name];
  return vars as CSSProperties;
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
      <p className="kr-card kr-muted">{t('customize.more')}</p>
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import { useSettings } from '../app/settingsStore';
import { useT } from '../i18n';
import { useSourceStatus } from '../sources/useActiveSources';
import styles from './SettingsPage.module.css';

const CLIENT_ID_RE = /^[A-Za-z0-9_-]*$/;

function JamendoForm() {
  const t = useT();
  const saved = useSettings((s) => s.settings.jamendoClientId);
  const save = useSettings((s) => s.setJamendoClientId);
  const [value, setValue] = useState(saved);
  const [msg, setMsg] = useState<'saved' | 'invalid' | null>(null);
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!CLIENT_ID_RE.test(v) || v.length > 64) {
      setMsg('invalid');
      return;
    }
    save(v);
    setMsg('saved');
  };
  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <label htmlFor="kr-jamendo">{t('settings.jamendoClientId')}</label>
      <div className={styles.inline}>
        <input
          id="kr-jamendo"
          className="kr-input"
          value={value}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setValue(e.target.value);
            setMsg(null);
          }}
        />
        <button type="submit" className="kr-btn">
          {t('settings.save')}
        </button>
      </div>
      <p className="kr-muted">{t('settings.jamendoHint')}</p>
      <p role="status" className={msg === 'invalid' ? 'kr-error-text' : 'kr-muted'}>
        {msg === 'saved'
          ? t('settings.saved')
          : msg === 'invalid'
            ? t('settings.invalidClientId')
            : ''}
      </p>
    </form>
  );
}

export default function SettingsPage() {
  const t = useT();
  const language = useSettings((s) => s.settings.language);
  const setLanguage = useSettings((s) => s.setLanguage);
  const setSourceEnabled = useSettings((s) => s.setSourceEnabled);
  const { statuses } = useSourceStatus();

  return (
    <div className="kr-page">
      <h1>{t('settings.title')}</h1>

      <section className="kr-section kr-card" aria-labelledby="s-sources">
        <h2 id="s-sources">{t('settings.sources')}</h2>
        <ul className={styles.list}>
          {statuses.map(({ source, enabled, available }) => (
            <li key={source.id} className={styles.sourceRow}>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  role="switch"
                  checked={enabled}
                  onChange={(e) => setSourceEnabled(source.id, e.target.checked)}
                />
                <span>{t('settings.useSource', { source: source.name })}</span>
              </label>
              <span className={available ? styles.ok : styles.off}>
                {available ? t('settings.ready') : t('settings.notConfigured')}
              </span>
            </li>
          ))}
        </ul>
        <JamendoForm />
      </section>

      <section className="kr-section kr-card" aria-labelledby="s-lang">
        <h2 id="s-lang">{t('settings.language')}</h2>
        <select
          className="kr-input"
          aria-labelledby="s-lang"
          value={language}
          onChange={(e) => setLanguage(e.target.value === 'en' ? 'en' : 'de')}
        >
          <option value="de">{t('languages.de')}</option>
          <option value="en">{t('languages.en')}</option>
        </select>
      </section>

      <section className="kr-section kr-card" aria-labelledby="s-about">
        <h2 id="s-about">{t('settings.about')}</h2>
        <p className="kr-muted">{t('settings.legal')}</p>
        <p className="kr-muted">{t('settings.version', { version: __APP_VERSION__ })}</p>
      </section>
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import { useSettings } from '../app/settingsStore';
import { Icon } from '../components/Icon';
import { openSuggestions, SUGGESTED_ARTISTS, SUGGESTED_GENRES } from '../library/suggestions';
import { useT } from '../i18n';
import { useSourceStatus } from '../sources/useActiveSources';
import styles from './SettingsPage.module.css';

const KEY_RE = /^[A-Za-z0-9_-]*$/;

/** Eingabefeld für einen öffentlichen Schlüssel (Jamendo-Client-ID, YouTube-API-Schlüssel) */
function KeyForm({
  id,
  label,
  hint,
  invalidText,
  saved,
  maxLength,
  onSave,
}: {
  id: string;
  label: string;
  hint: string;
  invalidText: string;
  saved: string;
  maxLength: number;
  onSave(value: string): void;
}) {
  const t = useT();
  const [value, setValue] = useState(saved);
  const [msg, setMsg] = useState<'saved' | 'invalid' | null>(null);
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!KEY_RE.test(v) || v.length > maxLength) {
      setMsg('invalid');
      return;
    }
    onSave(v);
    setMsg('saved');
  };
  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.inline}>
        <input
          id={id}
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
      <p className="kr-muted">{hint}</p>
      <p role="status" className={msg === 'invalid' ? 'kr-error-text' : 'kr-muted'}>
        {msg === 'saved' ? t('settings.saved') : msg === 'invalid' ? invalidText : ''}
      </p>
    </form>
  );
}

/** Liste mit Chips zum Entfernen und Feld zum Hinzufügen (Künstler oder Genres) */
function FavoriteList({ kind }: { kind: 'favoriteArtists' | 'favoriteGenres' }) {
  const t = useT();
  const items = useSettings((s) => s.settings[kind]);
  const add = useSettings((s) => s.addFavorite);
  const remove = useSettings((s) => s.removeFavorite);
  const [value, setValue] = useState('');
  const isArtists = kind === 'favoriteArtists';
  const inputId = `kr-${kind}`;
  const max = isArtists ? 20 : 10;
  const suggestions =
    items.length < max
      ? openSuggestions(isArtists ? SUGGESTED_ARTISTS : SUGGESTED_GENRES, items)
      : [];
  return (
    <div className={styles.form}>
      <h3>{isArtists ? t('settings.artists') : t('settings.genres')}</h3>
      <ul
        className={styles.chips}
        aria-label={isArtists ? t('settings.artists') : t('settings.genres')}
      >
        {items.map((name) => (
          <li key={name} className={styles.chip}>
            <span>{name}</span>
            <button
              type="button"
              className="kr-icon-btn"
              aria-label={t('settings.removeItem', { name })}
              onClick={() => remove(kind, name)}
            >
              <Icon name="close" size={16} />
            </button>
          </li>
        ))}
      </ul>
      <form
        className={styles.inline}
        onSubmit={(e) => {
          e.preventDefault();
          add(kind, value);
          setValue('');
        }}
      >
        <label htmlFor={inputId} className="kr-visually-hidden">
          {isArtists ? t('settings.addArtist') : t('settings.addGenre')}
        </label>
        <input
          id={inputId}
          className="kr-input"
          value={value}
          maxLength={isArtists ? 60 : 40}
          placeholder={isArtists ? t('settings.addArtist') : t('settings.addGenre')}
          onChange={(e) => setValue(e.target.value)}
        />
        <button type="submit" className="kr-btn" disabled={!value.trim()}>
          {t('settings.add')}
        </button>
      </form>
      {suggestions.length > 0 && (
        <div className={styles.suggest}>
          <span className="kr-muted">{t('settings.suggestions')}</span>
          <div className="kr-chips">
            {suggestions.map((name) => (
              <button
                key={name}
                type="button"
                className="kr-chip"
                aria-label={t('settings.addSuggestion', { name })}
                onClick={() => add(kind, name)}
              >
                + {name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const t = useT();
  const language = useSettings((s) => s.settings.language);
  const setLanguage = useSettings((s) => s.setLanguage);
  const setSourceEnabled = useSettings((s) => s.setSourceEnabled);
  const jamendoClientId = useSettings((s) => s.settings.jamendoClientId);
  const setJamendoClientId = useSettings((s) => s.setJamendoClientId);
  const youtubeApiKey = useSettings((s) => s.settings.youtubeApiKey);
  const setYoutubeApiKey = useSettings((s) => s.setYoutubeApiKey);
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
        <KeyForm
          id="kr-jamendo"
          label={t('settings.jamendoClientId')}
          hint={t('settings.jamendoHint')}
          invalidText={t('settings.invalidClientId')}
          saved={jamendoClientId}
          maxLength={64}
          onSave={setJamendoClientId}
        />
        <KeyForm
          id="kr-youtube"
          label={t('settings.youtubeKey')}
          hint={t('settings.youtubeHint')}
          invalidText={t('settings.invalidKey')}
          saved={youtubeApiKey}
          maxLength={100}
          onSave={setYoutubeApiKey}
        />
      </section>

      <section className="kr-section kr-card" aria-labelledby="s-music">
        <h2 id="s-music">{t('settings.myMusic')}</h2>
        <p className="kr-muted">{t('settings.myMusicHint')}</p>
        <FavoriteList kind="favoriteArtists" />
        <FavoriteList kind="favoriteGenres" />
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
        <p className="kr-muted">
          {t('settings.youtubeTerms')}{' '}
          <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">
            {t('settings.youtubeTos')}
          </a>
          {' · '}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
            {t('settings.googlePrivacy')}
          </a>
        </p>
        <p className="kr-muted">{t('settings.version', { version: __APP_VERSION__ })}</p>
      </section>
    </div>
  );
}

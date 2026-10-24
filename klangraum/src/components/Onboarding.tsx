import { useState } from 'react';
import { useSettings } from '../app/settingsStore';
import { useT } from '../i18n';
import { SUGGESTED_ARTISTS } from '../library/suggestions';
import { markOnboardingDone as markDone } from './onboardingState';
import { Dialog } from './Dialog';
import styles from './Dialog.module.css';

const EXTRA_ARTISTS = ['Apache 207', 'Luciano', 'Ufo361', 'Travis Scott', 'Drake', 'Juice WRLD'];
const GENRES = [
  'Drill',
  'Hip-Hop',
  'Trap',
  'Deutschrap',
  'R&B',
  'Pop',
  'Elektro',
  'Lo-Fi',
  'Rock',
  'Jazz',
];

function Chips({
  all,
  chosen,
  onToggle,
  label,
}: {
  all: string[];
  chosen: string[];
  onToggle(name: string): void;
  label: string;
}) {
  const has = (n: string) => chosen.some((c) => c.toLowerCase() === n.toLowerCase());
  return (
    <div className="kr-chips" role="group" aria-label={label}>
      {all.map((n) => (
        <button
          key={n}
          type="button"
          className="kr-chip"
          aria-pressed={has(n)}
          onClick={() => onToggle(n)}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

/** Willkommen: Lieblingskünstler und -genres wählen – daraus entstehen „Für dich“, Song-Radio und Autoplay */
export function Onboarding({ onDone }: { onDone(): void }) {
  const t = useT();
  const settings = useSettings((s) => s.settings);
  const setFavorites = useSettings((s) => s.setFavorites);
  const [artists, setArtists] = useState(settings.favoriteArtists);
  const [genres, setGenres] = useState(settings.favoriteGenres);
  const allArtists = [
    ...new Set([...settings.favoriteArtists, ...SUGGESTED_ARTISTS, ...EXTRA_ARTISTS]),
  ];
  const toggle = (list: string[], set: (l: string[]) => void, max: number) => (name: string) => {
    const on = list.some((x) => x.toLowerCase() === name.toLowerCase());
    if (on) set(list.filter((x) => x.toLowerCase() !== name.toLowerCase()));
    else if (list.length < max) set([...list, name]);
  };
  const finish = () => {
    setFavorites(artists, genres);
    markDone();
    onDone();
  };
  return (
    <Dialog
      title={t('onboarding.title')}
      onClose={() => {
        markDone();
        onDone();
      }}
    >
      <p>{t('onboarding.intro')}</p>
      <h3 className="kr-label">{t('settings.artists')}</h3>
      <Chips
        all={allArtists}
        chosen={artists}
        onToggle={toggle(artists, setArtists, 20)}
        label={t('settings.artists')}
      />
      <h3 className="kr-label">{t('settings.genres')}</h3>
      <Chips
        all={[...new Set([...settings.favoriteGenres, ...GENRES])]}
        chosen={genres}
        onToggle={toggle(genres, setGenres, 10)}
        label={t('settings.genres')}
      />
      <p className="kr-muted">{t('onboarding.privacy')}</p>
      <div className={styles.row}>
        <button type="button" className="kr-btn kr-btn--primary" onClick={finish}>
          {t('onboarding.start')}
        </button>
      </div>
    </Dialog>
  );
}

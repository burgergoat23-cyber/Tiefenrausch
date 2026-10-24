import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useSettings } from '../app/settingsStore';
import { errorText } from '../components/errorText';
import { TrackShelf } from '../components/Shelf';
import { useAsync } from '../components/useAsync';
import { useT } from '../i18n';
import { useActiveSources } from '../sources/useActiveSources';

/** Genres mit dem passenden Stichwort im Radio-Verzeichnis (dort meist englisch) */
const GENRES: { label: string; tag: string }[] = [
  { label: 'Hip-Hop', tag: 'hip hop' },
  { label: 'Pop', tag: 'pop' },
  { label: 'Rock', tag: 'rock' },
  { label: 'Elektro', tag: 'electronic' },
  { label: 'Lo-Fi', tag: 'lofi' },
  { label: 'Jazz', tag: 'jazz' },
  { label: 'Klassik', tag: 'classical' },
];

export default function RadioPage() {
  const t = useT();
  const { sources, ready } = useActiveSources();
  const radio = sources.find((s) => s.id === 'radio');
  const favorites = useSettings((s) => s.settings.favoriteGenres);
  const genres = useMemo(() => {
    const own = favorites.map((g) => ({ label: g, tag: g.toLowerCase() }));
    const seen = new Set(own.map((g) => g.tag));
    return [...own, ...GENRES.filter((g) => !seen.has(g.tag))];
  }, [favorites]);
  const [genre, setGenre] = useState(genres[0] ?? null);

  const popular = useAsync(async () => (radio?.getTrending ? radio.getTrending() : []), [radio]);
  const byGenre = useAsync(
    async () => (radio && genre ? (await radio.search(genre.tag, { limit: 24 })).tracks : []),
    [radio, genre?.tag],
  );

  return (
    <div className="kr-page">
      <header className="kr-section">
        <h1>{t('radio.title')}</h1>
        <p className="kr-muted">{t('radio.intro')}</p>
      </header>

      {ready && !radio && (
        <div className="kr-card kr-section">
          <p>{t('radio.off')}</p>
          <div>
            <Link to="/einstellungen" className="kr-btn">
              {t('home.toSettings')}
            </Link>
          </div>
        </div>
      )}

      {radio && (
        <>
          {popular.status === 'done' && popular.data.length > 0 && (
            <TrackShelf title={t('radio.popular')} tracks={popular.data} testId="radio-popular" />
          )}
          {popular.status === 'error' && (
            <p className="kr-error-text">{errorText(t, popular.error, 'radio')}</p>
          )}

          <section className="kr-section" aria-labelledby="r-genres">
            <h2 id="r-genres">{t('radio.genres')}</h2>
            <div className="kr-chips kr-chips--scroll" role="group" aria-label={t('radio.genres')}>
              {genres.map((g) => (
                <button
                  key={g.tag}
                  type="button"
                  className="kr-chip"
                  aria-pressed={genre?.tag === g.tag}
                  onClick={() => setGenre(g)}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </section>

          {genre && byGenre.status === 'loading' && <p className="kr-muted">{t('app.loading')}</p>}
          {genre && byGenre.status === 'error' && (
            <p className="kr-error-text">{errorText(t, byGenre.error, 'radio')}</p>
          )}
          {genre && byGenre.status === 'done' && byGenre.data.length > 0 && (
            <TrackShelf
              title={t('radio.stationsFor', { genre: genre.label })}
              tracks={byGenre.data}
              testId="radio-genre"
            />
          )}
        </>
      )}
    </div>
  );
}

import { useMemo } from 'react';
import { Link } from 'react-router';
import { TrackList } from '../../components/TrackList';
import { useT } from '../../i18n';
import { trackKey, type Track } from '../../sources/types';
import { useLibrary } from '../libraryStore';
import { PlaylistArt } from './PlaylistArt';
import styles from '../../pages/LibraryPage.module.css';

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

/** Suche: Treffer in deiner eigenen Bibliothek (Lieblingssongs, Playlists, Verlauf) zuerst */
export function LibraryResults({ query }: { query: string }) {
  const t = useT();
  const data = useLibrary((s) => s.data);
  const { tracks, playlists } = useMemo(() => {
    const q = norm(query.trim());
    if (q.length < 2) return { tracks: [], playlists: [] };
    const hit = (tr: Track) =>
      norm(`${tr.title} ${tr.artists.join(' ')} ${tr.album ?? ''}`).includes(q);
    const seen = new Set<string>();
    const out: Track[] = [];
    const add = (tr: Track) => {
      const k = trackKey(tr);
      if (seen.has(k) || !hit(tr)) return;
      seen.add(k);
      out.push(tr);
    };
    data.likes.forEach((l) => add(l.track));
    data.playlists.forEach((p) => p.tracks.forEach(add));
    Object.values(data.known).forEach(add);
    return {
      tracks: out.slice(0, 5),
      playlists: data.playlists.filter((p) => norm(p.name).includes(q)).slice(0, 4),
    };
  }, [data, query]);
  if (tracks.length === 0 && playlists.length === 0) return null;
  return (
    <section
      className="kr-section"
      aria-label={t('search.inLibrary')}
      data-testid="results-library"
    >
      <h2>{t('search.inLibrary')}</h2>
      {playlists.length > 0 && (
        <ul className={styles.grid}>
          {playlists.map((p) => (
            <li key={p.id}>
              <Link to={`/bibliothek/playlist/${p.id}`} className={styles.card}>
                <PlaylistArt playlist={p} className={styles.cardArt} />
                <span className={styles.cardTitle}>{p.name}</span>
                <span className={styles.cardSub}>
                  {t('track.count', { count: p.tracks.length })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {tracks.length > 0 && <TrackList tracks={tracks} label={t('search.inLibrary')} />}
    </section>
  );
}

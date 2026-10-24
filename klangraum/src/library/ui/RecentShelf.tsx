import { useMemo } from 'react';
import { Link } from 'react-router';
import { TrackShelf } from '../../components/Shelf';
import { useT } from '../../i18n';
import { recentTracks } from '../library';
import { useLibrary } from '../libraryStore';

/** Startseite: „Zuletzt gehört“ zum schnellen Weiterhören */
export function RecentShelf() {
  const t = useT();
  const data = useLibrary((s) => s.data);
  const recent = useMemo(() => recentTracks(data, 12).map((r) => r.track), [data]);
  if (recent.length === 0) return null;
  return (
    <TrackShelf
      title={t('library.history')}
      tracks={recent}
      testId="recent-shelf"
      actions={
        <Link to="/bibliothek/verlauf" className="kr-label">
          {t('home.showAll')}
        </Link>
      }
    />
  );
}

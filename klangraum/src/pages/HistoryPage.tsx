import { useMemo } from 'react';
import { Icon } from '../components/Icon';
import { TrackList } from '../components/TrackList';
import { useT } from '../i18n';
import { recentTracks } from '../library/library';
import { useLibrary } from '../library/libraryStore';

export default function HistoryPage() {
  const t = useT();
  const data = useLibrary((s) => s.data);
  const clear = useLibrary((s) => s.clearHistory);
  const tracks = useMemo(() => recentTracks(data, 200).map((r) => r.track), [data]);
  return (
    <div className="kr-page">
      <div className="kr-section-head">
        <h1>{t('library.history')}</h1>
        {tracks.length > 0 && (
          <button
            type="button"
            className="kr-btn"
            onClick={() => {
              if (window.confirm(t('library.clearHistoryConfirm'))) clear();
            }}
          >
            <Icon name="trash" size={18} />
            {t('library.clearHistory')}
          </button>
        )}
      </div>
      {tracks.length === 0 ? (
        <p className="kr-muted">{t('library.historyEmpty')}</p>
      ) : (
        <TrackList tracks={tracks} label={t('library.history')} />
      )}
    </div>
  );
}

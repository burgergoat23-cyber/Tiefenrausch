import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { useSettings } from '../app/settingsStore';
import { errorText } from '../components/errorText';
import { Icon } from '../components/Icon';
import { CardGrid, MediaCard } from '../components/MediaCard';
import { TrackList } from '../components/TrackList';
import { useT } from '../i18n';
import { sourceName } from '../sources/names';
import { useActiveSources } from '../sources/useActiveSources';
import { useMultiSearch, type SourceSearchState } from '../sources/useMultiSearch';
import type { MusicSource, SearchType, SourceId } from '../sources/types';
import styles from './SearchPage.module.css';

const TYPES: SearchType[] = ['track', 'album', 'artist', 'playlist'];
const DEBOUNCE_MS = 450;

function isType(v: string | null): v is SearchType {
  return !!v && (TYPES as string[]).includes(v);
}

function SourceResults({
  source,
  type,
  state,
  onRetry,
  onUsed,
}: {
  source: MusicSource;
  type: SearchType;
  state: SourceSearchState | undefined;
  onRetry(): void;
  onUsed(): void;
}) {
  const t = useT();
  const heading = t('search.resultsFrom', { source: source.name });
  let body: ReactNode = null;
  if (!state || state.status === 'loading') {
    body = (
      <p className="kr-muted" role="status">
        {t('search.loading', { source: source.name })}
      </p>
    );
  } else if (state.status === 'error') {
    body = (
      <div className="kr-section-head">
        <p className="kr-error-text">{errorText(t, state.error, source.id)}</p>
        <button type="button" className="kr-btn" onClick={onRetry}>
          <Icon name="refresh" size={18} />
          {t('search.retry')}
        </button>
      </div>
    );
  } else {
    const r = state.result;
    const count =
      type === 'track'
        ? r.tracks.length
        : type === 'album'
          ? r.albums.length
          : type === 'artist'
            ? r.artists.length
            : r.playlists.length;
    if (count === 0) {
      body = <p className="kr-muted">{t('search.noResults', { source: source.name })}</p>;
    } else if (type === 'track') {
      body = <TrackList tracks={r.tracks} onPlayed={onUsed} label={heading} />;
    } else {
      body = (
        <CardGrid label={heading}>
          {type === 'album' &&
            r.albums.map((a) => (
              <MediaCard
                key={a.id}
                kind="album"
                sourceId={a.sourceId}
                id={a.id}
                title={a.title}
                subtitle={a.artists.join(', ')}
                artworkUrl={a.artworkUrl}
              />
            ))}
          {type === 'artist' &&
            r.artists.map((a) => (
              <MediaCard
                key={a.id}
                kind="artist"
                sourceId={a.sourceId}
                id={a.id}
                title={a.name}
                artworkUrl={a.imageUrl}
              />
            ))}
          {type === 'playlist' &&
            r.playlists.map((p) => (
              <MediaCard
                key={p.id}
                kind="playlist"
                sourceId={p.sourceId}
                id={p.id}
                title={p.title}
                subtitle={p.owner}
                artworkUrl={p.artworkUrl}
              />
            ))}
        </CardGrid>
      );
    }
  }
  return (
    <section className="kr-section" aria-label={heading} data-testid={`results-${source.id}`}>
      <h2 className={styles.sourceHead}>{heading}</h2>
      {body}
    </section>
  );
}

export default function SearchPage() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const typeParam = params.get('typ');
  const type: SearchType = isType(typeParam) ? typeParam : 'track';
  const sourceFilter = (params.get('quelle') as SourceId | null) ?? null;
  const [input, setInput] = useState(q);
  /** Suche, die mit Enter/„Suchen“ bestätigt wurde – nur dann fragen wir „teure“ Quellen (YouTube) */
  const [committedQ, setCommittedQ] = useState(q);
  const inputRef = useRef<HTMLInputElement>(null);
  const history = useSettings((s) => s.settings.searchHistory);
  const favoriteArtists = useSettings((s) => s.settings.favoriteArtists);
  const addSearch = useSettings((s) => s.addSearch);
  const removeSearch = useSettings((s) => s.removeSearch);
  const clearHistory = useSettings((s) => s.clearSearchHistory);
  const { sources } = useActiveSources();

  // Nur Quellen, die diese Such-Art können (Radio kennt z. B. keine Alben)
  const typeSources = useMemo(
    () => sources.filter((s) => !s.searchTypes || s.searchTypes.includes(type)),
    [sources, type],
  );
  const shown = useMemo(
    () => typeSources.filter((s) => !sourceFilter || s.id === sourceFilter),
    [typeSources, sourceFilter],
  );
  const cheap = useMemo(() => shown.filter((s) => !s.costlySearch), [shown]);
  const costly = useMemo(() => shown.filter((s) => s.costlySearch), [shown]);
  const costlyQ = committedQ.trim() === q.trim() ? q : '';
  const cheapSearch = useMultiSearch(q, type, cheap);
  const costlySearch = useMultiSearch(costlyQ, type, costly);
  const states = { ...cheapSearch.states, ...costlySearch.states };
  const retrySource = (id: SourceId) =>
    costly.some((s) => s.id === id) ? costlySearch.retrySource(id) : cheapSearch.retrySource(id);

  const setParam = (key: string, value: string | null) => {
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };

  // Beim Tippen kurz warten, dann suchen
  useEffect(() => {
    if (input.trim() === q.trim()) return;
    const timer = setTimeout(() => setParam('q', input.trim() || null), DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  // Zurück-Navigation o. Ä.: Eingabefeld an die Adresse anpassen
  useEffect(() => {
    if (input.trim() === q.trim()) return;
    // kam nicht vom Tippen, sondern z. B. vom Zurück-Knopf → gilt als bestätigte Suche
    setInput(q);
    setCommittedQ(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const v = input.trim();
    setParam('q', v || null);
    if (v) addSearch(v);
    setCommittedQ(v);
    inputRef.current?.blur();
  };

  const runHistory = (h: string) => {
    setInput(h);
    setParam('q', h);
    setCommittedQ(h);
    addSearch(h);
  };

  return (
    <div className="kr-page">
      <h1>{t('search.title')}</h1>
      <form role="search" className={styles.form} onSubmit={onSubmit}>
        <label htmlFor="kr-search" className="kr-visually-hidden">
          {t('search.label')}
        </label>
        <span className={styles.field}>
          <Icon name="search" size={20} />
          <input
            id="kr-search"
            ref={inputRef}
            className={styles.input}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder={t('search.placeholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          {input && (
            <button
              type="button"
              className="kr-icon-btn"
              aria-label={t('search.clear')}
              onClick={() => {
                setInput('');
                setParam('q', null);
                inputRef.current?.focus();
              }}
            >
              <Icon name="close" size={18} />
            </button>
          )}
        </span>
        <button type="submit" className="kr-btn kr-btn--primary">
          {t('search.submit')}
        </button>
      </form>

      <div className={styles.filters}>
        <div className="kr-chips kr-chips--scroll" role="group" aria-label={t('search.filterType')}>
          {TYPES.map((ty) => (
            <button
              key={ty}
              type="button"
              className="kr-chip"
              aria-pressed={type === ty}
              onClick={() => setParam('typ', ty === 'track' ? null : ty)}
            >
              {t(`types.${ty}`)}
            </button>
          ))}
        </div>
        {typeSources.length > 1 && (
          <div
            className="kr-chips kr-chips--scroll"
            role="group"
            aria-label={t('search.filterSource')}
          >
            <button
              type="button"
              className="kr-chip"
              aria-pressed={!sourceFilter}
              onClick={() => setParam('quelle', null)}
            >
              {t('search.all')}
            </button>
            {typeSources.map((s) => (
              <button
                key={s.id}
                type="button"
                className="kr-chip"
                aria-pressed={sourceFilter === s.id}
                onClick={() => setParam('quelle', s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {!q && favoriteArtists.length > 0 && (
        <section className="kr-section" aria-labelledby="s-fav">
          <h2 id="s-fav">{t('forYou.yourArtists')}</h2>
          <div className="kr-chips">
            {favoriteArtists.map((a) => (
              <button key={a} type="button" className="kr-chip" onClick={() => runHistory(a)}>
                {a}
              </button>
            ))}
          </div>
        </section>
      )}

      {!q && history.length > 0 && (
        <section className="kr-section" aria-label={t('search.history')}>
          <div className="kr-section-head">
            <h2>{t('search.history')}</h2>
            <button type="button" className="kr-btn" onClick={clearHistory}>
              {t('search.clearHistory')}
            </button>
          </div>
          <ul className={styles.history}>
            {history.map((h) => (
              <li key={h}>
                <button type="button" className={styles.historyItem} onClick={() => runHistory(h)}>
                  <Icon name="search" size={18} />
                  <span>{h}</span>
                </button>
                <button
                  type="button"
                  className="kr-icon-btn"
                  aria-label={t('search.removeHistoryItem', { q: h })}
                  onClick={() => removeSearch(h)}
                >
                  <Icon name="close" size={18} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!q && history.length === 0 && <p className="kr-muted">{t('search.empty')}</p>}

      {q && shown.length === 0 && sourceFilter && (
        <p className="kr-muted">
          {t('search.typeUnsupported', {
            source: sourceName(sourceFilter),
            type: t(`types.${type}`),
          })}
        </p>
      )}

      {q &&
        shown.map((source) =>
          source.costlySearch && !costlyQ ? (
            <section
              key={source.id}
              className="kr-section"
              aria-label={t('search.resultsFrom', { source: source.name })}
              data-testid={`results-${source.id}`}
            >
              <h2 className={styles.sourceHead}>
                {t('search.resultsFrom', { source: source.name })}
              </h2>
              <p className="kr-muted">{t('search.costly', { source: source.name })}</p>
              <div>
                <button type="button" className="kr-btn" onClick={() => setCommittedQ(q)}>
                  <Icon name="search" size={18} />
                  {t('search.searchNow', { source: source.name })}
                </button>
              </div>
            </section>
          ) : (
            <SourceResults
              key={source.id}
              source={source}
              type={type}
              state={states[source.id]}
              onRetry={() => retrySource(source.id)}
              onUsed={() => addSearch(q)}
            />
          ),
        )}
    </div>
  );
}

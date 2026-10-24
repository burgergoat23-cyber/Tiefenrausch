import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { usePlayer, usePlayerState } from '../app/context';
import { Artwork } from '../components/Artwork';
import { Icon } from '../components/Icon';
import { RepeatButton, ShuffleButton } from '../components/PlayerControls';
import { SourceBadge } from '../components/SourceBadge';
import { formatDuration } from '../components/format';
import { useT } from '../i18n';
import type { QueueItem } from '../player/queue';
import styles from './QueuePage.module.css';

function ItemBody({ item }: { item: QueueItem }) {
  const t = useT();
  const { track } = item;
  return (
    <>
      <Artwork src={track.artworkUrl} size={44} />
      <span className={styles.text}>
        <span className={styles.title}>{track.title}</span>
        <span className={styles.meta}>
          <SourceBadge sourceId={track.sourceId} />
          <span className={styles.artist}>
            {track.artists.join(', ') || t('track.unknownArtist')}
          </span>
        </span>
      </span>
      <span className={styles.dur}>
        {track.live
          ? t('player.live')
          : track.durationMs > 0
            ? formatDuration(track.durationMs)
            : ''}
      </span>
    </>
  );
}

function SortableRow({ item, index }: { item: QueueItem; index: number }) {
  const t = useT();
  const player = usePlayer();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.uid });
  return (
    <li
      ref={setNodeRef}
      className={styles.row}
      data-dragging={isDragging || undefined}
      data-testid="queue-item"
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className={`kr-icon-btn ${styles.handle}`}
        aria-label={t('queue.drag', { title: item.track.title })}
        {...attributes}
        {...listeners}
      >
        <Icon name="grip" size={20} />
      </button>
      <button
        type="button"
        className={styles.main}
        aria-label={t('track.play', { title: item.track.title })}
        onClick={() => player.jumpTo(index)}
      >
        <ItemBody item={item} />
      </button>
      <button
        type="button"
        className="kr-icon-btn"
        aria-label={t('queue.remove', { title: item.track.title })}
        onClick={() => player.removeFromQueue(index)}
      >
        <Icon name="close" size={20} />
      </button>
    </li>
  );
}

export default function QueuePage() {
  const t = useT();
  const player = usePlayer();
  const queue = usePlayerState((s) => s.queue);
  const current = queue.index >= 0 ? queue.items[queue.index] : undefined;
  const upcoming = queue.items.slice(queue.index + 1);
  const played = queue.index > 0 ? queue.items.slice(0, queue.index) : [];
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const titleOf = (id: string | number) => queue.items.find((i) => i.uid === id)?.track.title ?? '';
  const posOf = (id: string | number) => upcoming.findIndex((i) => i.uid === id) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => t('queue.dndPicked', { title: titleOf(active.id) }),
    onDragOver: ({ active, over }) =>
      over ? t('queue.dndOver', { title: titleOf(active.id), pos: posOf(over.id) }) : undefined,
    onDragEnd: ({ active, over }) =>
      over ? t('queue.dndDropped', { title: titleOf(active.id), pos: posOf(over.id) }) : undefined,
    onDragCancel: () => t('queue.dndCancelled'),
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = queue.items.findIndex((i) => i.uid === active.id);
    const to = queue.items.findIndex((i) => i.uid === over.id);
    if (from >= 0 && to >= 0) player.moveInQueue(from, to);
  };

  return (
    <div className="kr-page">
      <div className="kr-section-head">
        <h1>{t('queue.title')}</h1>
        <div className={styles.tools}>
          <ShuffleButton />
          <RepeatButton />
        </div>
      </div>

      {!current && <p className="kr-muted">{t('queue.empty')}</p>}

      {current && (
        <section className="kr-section" aria-labelledby="q-now">
          <h2 id="q-now">{t('queue.nowPlaying')}</h2>
          <div className={`${styles.row} ${styles.current}`}>
            <span className={styles.main}>
              <ItemBody item={current} />
            </span>
          </div>
        </section>
      )}

      {current && (
        <section className="kr-section" aria-labelledby="q-next">
          <div className="kr-section-head">
            <h2 id="q-next">{t('queue.upNext')}</h2>
            {upcoming.length > 0 && (
              <button type="button" className="kr-btn" onClick={() => player.clearUpcoming()}>
                <Icon name="trash" size={18} />
                {t('queue.clear')}
              </button>
            )}
          </div>
          {upcoming.length === 0 ? (
            <p className="kr-muted">{t('queue.nothingNext')}</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
              accessibility={{
                announcements,
                screenReaderInstructions: { draggable: t('queue.dndInstructions') },
              }}
            >
              <SortableContext
                items={upcoming.map((i) => i.uid)}
                strategy={verticalListSortingStrategy}
              >
                <ol className={styles.list} aria-label={t('queue.upNext')}>
                  {upcoming.map((item, i) => (
                    <SortableRow key={item.uid} item={item} index={queue.index + 1 + i} />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
          )}
        </section>
      )}

      {played.length > 0 && (
        <section className="kr-section" aria-labelledby="q-played">
          <h2 id="q-played">{t('queue.history')}</h2>
          <ol className={styles.list}>
            {played.map((item, i) => (
              <li key={item.uid} className={`${styles.row} ${styles.played}`}>
                <button
                  type="button"
                  className={styles.main}
                  aria-label={t('track.play', { title: item.track.title })}
                  onClick={() => player.jumpTo(i)}
                >
                  <ItemBody item={item} />
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

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
import { useT } from '../i18n';
import type { QueueItem } from '../player/queue';
import { TrackArtwork } from './Artwork';
import { formatDuration } from './format';
import { Icon } from './Icon';
import { SourceBadge } from './SourceBadge';
import styles from './QueueList.module.css';

export function QueueItemBody({ item }: { item: QueueItem }) {
  const t = useT();
  const { track } = item;
  return (
    <>
      <TrackArtwork track={track} size={48} />
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
        <QueueItemBody item={item} />
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

/** „Als Nächstes“: per Finger, Maus oder Tastatur umsortieren (in der Warteschlange und im großen Player) */
export function UpNextList() {
  const t = useT();
  const player = usePlayer();
  const queue = usePlayerState((s) => s.queue);
  const upcoming = queue.items.slice(queue.index + 1);
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

  if (upcoming.length === 0) return <p className="kr-muted">{t('queue.nothingNext')}</p>;
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: t('queue.dndInstructions') },
      }}
    >
      <SortableContext items={upcoming.map((i) => i.uid)} strategy={verticalListSortingStrategy}>
        <ol className={styles.list} aria-label={t('queue.upNext')}>
          {upcoming.map((item, i) => (
            <SortableRow key={item.uid} item={item} index={queue.index + 1 + i} />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

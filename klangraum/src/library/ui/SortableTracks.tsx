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
import { Icon } from '../../components/Icon';
import { QueueItemBody } from '../../components/QueueList';
import styles from '../../components/QueueList.module.css';
import { useT } from '../../i18n';
import { trackKey, type Track } from '../../sources/types';

function Row({
  track,
  index,
  onRemove,
}: {
  track: Track;
  index: number;
  onRemove(index: number): void;
}) {
  const t = useT();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: trackKey(track) });
  return (
    <li
      ref={setNodeRef}
      className={styles.row}
      data-dragging={isDragging || undefined}
      data-testid="sortable-track"
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className={`kr-icon-btn ${styles.handle}`}
        aria-label={t('queue.drag', { title: track.title })}
        {...attributes}
        {...listeners}
      >
        <Icon name="grip" size={20} />
      </button>
      <span className={styles.main}>
        <QueueItemBody item={{ uid: trackKey(track), track }} />
      </span>
      <button
        type="button"
        className="kr-icon-btn"
        aria-label={t('queue.remove', { title: track.title })}
        onClick={() => onRemove(index)}
      >
        <Icon name="close" size={20} />
      </button>
    </li>
  );
}

/** Songs per Finger, Maus oder Tastatur umsortieren (eigene Playlists) */
export function SortableTracks({
  tracks,
  label,
  onMove,
  onRemove,
}: {
  tracks: Track[];
  label: string;
  onMove(from: number, to: number): void;
  onRemove(index: number): void;
}) {
  const t = useT();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = tracks.map(trackKey);
  const titleOf = (id: string | number) => tracks[ids.indexOf(String(id))]?.title ?? '';
  const posOf = (id: string | number) => ids.indexOf(String(id)) + 1;
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
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from >= 0 && to >= 0) onMove(from, to);
  };
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
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol className={styles.list} aria-label={label}>
          {tracks.map((track, i) => (
            <Row key={ids[i]} track={track} index={i} onRemove={onRemove} />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

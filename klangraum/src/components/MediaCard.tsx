import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { SourceId } from '../sources/types';
import { Artwork } from './Artwork';
import { collectionPath, type CollectionKind } from './paths';
import { SourceBadge } from './SourceBadge';
import styles from './MediaCard.module.css';

interface Props {
  kind: CollectionKind;
  sourceId: SourceId;
  id: string;
  title: string;
  subtitle?: string;
  artworkUrl?: string;
}

/** Kachel für Album, Künstler oder Playlist – führt zur Detailseite */
export function MediaCard({ kind, sourceId, id, title, subtitle, artworkUrl }: Props) {
  return (
    <li>
      <Link className={styles.card} to={collectionPath(kind, sourceId, id)}>
        <Artwork src={artworkUrl} size="100%" round={kind === 'artist'} className={styles.art} />
        <span className={styles.title}>{title}</span>
        <span className={styles.meta}>
          <SourceBadge sourceId={sourceId} />
          {subtitle && <span className={styles.sub}>{subtitle}</span>}
        </span>
      </Link>
    </li>
  );
}

export function CardGrid({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul className={styles.grid} aria-label={label}>
      {children}
    </ul>
  );
}

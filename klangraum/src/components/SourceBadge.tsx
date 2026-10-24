import { useT } from '../i18n';
import { SOURCE_INFO } from '../sources/names';
import type { SourceId } from '../sources/types';
import styles from './SourceBadge.module.css';

/** Kleines Quellen-Symbol, damit man bei jedem Song sieht, woher er kommt */
export function SourceBadge({ sourceId }: { sourceId: SourceId }) {
  const t = useT();
  const info = SOURCE_INFO[sourceId];
  const label = t('track.source', { source: info.name });
  return (
    <span
      className={styles.badge}
      data-source={sourceId}
      title={label}
      aria-label={label}
      role="img"
    >
      {info.short}
    </span>
  );
}

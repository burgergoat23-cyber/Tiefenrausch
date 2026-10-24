import { useState } from 'react';
import { Icon } from './Icon';
import styles from './Artwork.module.css';

interface Props {
  src?: string;
  size?: number | string;
  round?: boolean;
  className?: string;
}

/** Cover-Bild: lädt erst, wenn es sichtbar wird; ohne Bild ein Platzhalter mit Note */
export function Artwork({ src, size = 48, round = false, className }: Props) {
  const [failed, setFailed] = useState(false);
  const dim = typeof size === 'number' ? `${size}px` : size;
  return (
    <span
      className={[styles.art, round ? styles.round : '', className ?? ''].join(' ')}
      style={{ width: dim, height: dim }}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <Icon name="note" size={typeof size === 'number' ? Math.max(16, size * 0.4) : 32} />
      )}
    </span>
  );
}

import { useEffect, useRef, useState, type CSSProperties, type Ref } from 'react';
import { useCover } from '../library/covers';
import type { Track } from '../sources/types';
import styles from './Artwork.module.css';

interface Props {
  /** Bilder in Reihenfolge – lädt eins nicht, kommt das nächste */
  srcs?: (string | undefined)[];
  /** Für den Platzhalter (Farbe + Anfangsbuchstaben), wenn es gar kein Bild gibt */
  seed?: string;
  size?: number | string;
  round?: boolean;
  className?: string;
  /** Zugriff auf das Element (z. B. um zu erkennen, wann es sichtbar wird) */
  boxRef?: Ref<HTMLSpanElement>;
}

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

function initials(s: string): string {
  const words = s
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return words
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/** Cover-Bild: lädt erst, wenn es sichtbar wird; ohne Bild ein ruhiger Farbverlauf aus dem Theme */
export function Artwork({
  srcs = [],
  seed = '',
  size = 48,
  round = false,
  className,
  boxRef,
}: Props) {
  const list = srcs.filter((s): s is string => !!s);
  const listKey = list.join('|');
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [listKey]);
  const dim = typeof size === 'number' ? `${size}px` : size;
  const src = list[index];
  const h = hash(seed || 'klangraum');
  const placeholder = {
    '--kr-art-mix': `${25 + (h % 45)}%`,
    '--kr-art-angle': `${h % 360}deg`,
    fontSize: typeof size === 'number' ? `${Math.max(11, size * 0.32)}px` : undefined,
  } as CSSProperties;
  return (
    <span
      ref={boxRef}
      className={[styles.art, round ? styles.round : '', className ?? ''].join(' ')}
      style={{ width: dim, height: dim, ...(src ? {} : placeholder) }}
      data-placeholder={src ? undefined : true}
    >
      {src ? (
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setIndex((i) => i + 1)}
        />
      ) : (
        <span className={styles.initials} aria-hidden="true">
          {initials(seed)}
        </span>
      )}
    </span>
  );
}

/** Cover eines Songs: das originale Album-/Single-Cover (falls gefunden), sonst das Bild der Quelle */
export function TrackArtwork({
  track,
  size,
  className,
  eager = false,
}: {
  track: Track;
  size?: number | string;
  className?: string;
  /** sofort suchen (z. B. im Player), statt erst wenn sichtbar */
  eager?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(eager || typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (visible || !ref.current) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisible(true);
        io.disconnect();
      }
    });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [visible]);
  const cover = useCover(track, visible);
  return (
    <Artwork
      boxRef={ref}
      srcs={[cover, track.artworkUrl]}
      seed={track.album || track.title}
      size={size}
      className={className}
    />
  );
}

import { useEffect, useRef, useState, type Ref } from 'react';
import { useCover } from '../library/covers';
import type { Track } from '../sources/types';
import styles from './Artwork.module.css';

interface Props {
  /** Bilder in Reihenfolge – lädt eins nicht, kommt das nächste */
  srcs?: (string | undefined)[];
  /** Bestimmt die Farbe des gestalteten Covers (immer gleich für denselben Song) */
  seed?: string;
  /** Gestaltetes Cover, wenn es kein Bild gibt: großer Titel … */
  title?: string;
  /** … und kleine Zeile darüber (Künstler, „Radio“ …) */
  label?: string;
  /** kleines Logo im gestalteten Cover (z. B. Sender-Logo), nur wenn es scharf genug ist */
  logo?: string;
  size?: number | string;
  round?: boolean;
  className?: string;
  /** Zugriff auf das Element (z. B. um zu erkennen, wann es sichtbar wird) */
  boxRef?: Ref<HTMLSpanElement>;
}

const SLEEVES = 8;

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

function initials(s: string): string {
  return s
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/** Logo nur zeigen, wenn es groß genug ist – verpixelte Mini-Symbole sehen schlechter aus als keins */
function SleeveLogo({ src }: { src: string }) {
  const [ok, setOk] = useState(false);
  return (
    <img
      className={styles.logo}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      data-ok={ok || undefined}
      onLoad={(e) => setOk(e.currentTarget.naturalWidth >= 64)}
      onError={() => setOk(false)}
    />
  );
}

/**
 * Cover-Bild. Gibt es kein (funktionierendes) Bild, entsteht ein gestaltetes Plattencover:
 * ruhige Farbe, kleine Zeile oben, großer Titel unten – wie ein schlichtes Album-Cover.
 */
export function Artwork({
  srcs = [],
  seed = '',
  title = '',
  label = '',
  logo,
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
  const sleeve = (hash(seed || title || 'klangraum') % SLEEVES) + 1;
  // Kleine Cover (Listen): nur Anfangsbuchstaben – Titel wäre dort unlesbar und stünde doppelt im Text
  const small = typeof size === 'number' && size < 90;
  return (
    <span
      ref={boxRef}
      className={[styles.art, round ? styles.round : '', className ?? ''].join(' ')}
      style={{ width: dim, height: dim }}
      data-placeholder={src ? undefined : true}
      data-sleeve={src ? undefined : sleeve}
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
        <span className={styles.sleeve} aria-hidden="true" data-small={small || undefined}>
          {!small && (
            <>
              <span className={styles.sleeveTop}>
                <span className={styles.label}>{label}</span>
                {logo && <SleeveLogo src={logo} />}
              </span>
              <span className={styles.sleeveTitle}>{title}</span>
            </>
          )}
          <span className={styles.initials}>{initials(title || seed)}</span>
        </span>
      )}
    </span>
  );
}

/** Cover eines Songs: originales Album-/Single-Cover (falls gefunden), sonst das Bild der Quelle */
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
  const radio = track.sourceId === 'radio';
  // Mitschnitte aus dem Live Music Archive haben kein echtes Cover (nur das Archiv-Logo)
  const concert = track.sourceId === 'archive' && track.license?.name === 'Live Music Archive';
  const srcs = radio ? [] : concert ? [cover] : [cover, track.artworkUrl];
  return (
    <Artwork
      boxRef={ref}
      srcs={srcs}
      seed={radio ? track.title : track.album || track.title}
      title={radio || !concert ? track.title : (track.album ?? track.title)}
      label={track.artists[0] ?? ''}
      logo={radio ? track.artworkUrl : undefined}
      size={size}
      className={className}
    />
  );
}

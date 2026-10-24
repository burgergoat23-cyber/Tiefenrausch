import type { Stats } from './stats';

export interface CardTexts {
  heading: string;
  period: string;
  minutesLabel: string;
  artistsLabel: string;
  tracksLabel: string;
  footer: string;
}

const W = 1080;
const H = 1920;

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

/** Zeichnet den Rückblick als Bild im Story-Format (1080×1920) – zum Teilen */
export async function drawStatsCard(stats: Stats, texts: CardTexts): Promise<Blob | null> {
  await document.fonts?.ready;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const bg = cssVar('--kr-bg', '#0b0c09');
  const text = cssVar('--kr-text', '#f1f2ea');
  const muted = cssVar('--kr-text-muted', '#a7ab97');
  const accent = cssVar('--kr-accent', '#a8c26b');
  const border = cssVar('--kr-border', '#34382a');
  const head = "'Archivo Variable', system-ui, sans-serif";
  const body = 'system-ui, -apple-system, sans-serif';
  const setStretch = (v: 'condensed' | 'normal') => {
    if ('fontStretch' in ctx) (ctx as unknown as { fontStretch: string }).fontStretch = v;
  };

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // Akzent-Balken links
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 18, H);

  const x = 96;
  let y = 170;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = muted;
  ctx.font = `600 38px ${body}`;
  ctx.fillText(texts.period.toUpperCase(), x, y);
  y += 120;
  setStretch('condensed');
  ctx.fillStyle = text;
  // Schrift so groß wie möglich, aber ganz sichtbar
  let size = 140;
  const heading = texts.heading.toUpperCase();
  do {
    ctx.font = `800 ${size}px ${head}`;
    size -= 4;
  } while (size > 60 && ctx.measureText(heading).width > W - 2 * x);
  ctx.fillText(heading, x, y);

  y += 250;
  ctx.fillStyle = accent;
  ctx.font = `800 260px ${head}`;
  ctx.fillText(Math.round(stats.ms / 60000).toLocaleString(), x - 8, y);
  y += 70;
  setStretch('normal');
  ctx.fillStyle = muted;
  ctx.font = `600 40px ${body}`;
  ctx.fillText(texts.minutesLabel.toUpperCase(), x, y);

  const section = (label: string, rows: string[]) => {
    y += 110;
    ctx.strokeStyle = border;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y - 60);
    ctx.lineTo(W - x, y - 60);
    ctx.stroke();
    ctx.fillStyle = muted;
    ctx.font = `600 36px ${body}`;
    ctx.fillText(label.toUpperCase(), x, y);
    rows.forEach((r, i) => {
      y += 92;
      setStretch('condensed');
      ctx.fillStyle = muted;
      ctx.font = `800 64px ${head}`;
      ctx.fillText(String(i + 1), x, y);
      ctx.fillStyle = text;
      ctx.font = `700 64px ${head}`;
      ctx.fillText(fit(ctx, r, W - 2 * x - 90), x + 90, y);
      setStretch('normal');
    });
  };
  section(
    texts.artistsLabel,
    stats.topArtists.slice(0, 5).map((a) => a.name),
  );
  section(
    texts.tracksLabel,
    stats.topTracks.slice(0, 3).map((s) => s.track.title),
  );

  ctx.fillStyle = muted;
  ctx.font = `500 32px ${body}`;
  ctx.fillText(fit(ctx, texts.footer, W - 2 * x), x, H - 110);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

export type CardShareResult = 'shared' | 'downloaded' | 'cancelled' | 'failed';

/** Teilen-Menü mit Bild (Handy) oder als Datei herunterladen */
export async function shareCard(
  blob: Blob,
  filename: string,
  title: string,
): Promise<CardShareResult> {
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & {
    canShare?: (d: ShareData) => boolean;
    share?: (d: ShareData) => Promise<void>;
  };
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}

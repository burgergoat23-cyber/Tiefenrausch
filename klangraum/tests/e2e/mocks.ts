import type { Page, Route } from '@playwright/test';

/** Kleine WAV-Datei mit leisem Ton (für „Song abspielen“ ohne echte Musik) */
export function toneWav(seconds = 30, freq = 440): Buffer {
  const rate = 8000;
  const n = Math.floor(rate * seconds);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 2000), 44 + i * 2);
  }
  return buf;
}

const COLORS = [
  '#e76f51',
  '#2a9d8f',
  '#e9c46a',
  '#8ab17d',
  '#6d597a',
  '#457b9d',
  '#f4a261',
  '#b5838d',
];

function coverSvg(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const a = COLORS[h % COLORS.length];
  const b = COLORS[(h >> 3) % COLORS.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/><circle cx="50" cy="50" r="22" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="4"/></svg>`;
}

const CORS = { 'Access-Control-Allow-Origin': '*' };

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    headers: CORS,
    body: JSON.stringify(body),
  });

const AUDIUS_NAMES = [
  'Mitternachtsfahrt',
  'Neonlicht',
  'Sommerregen',
  'Tiefsee',
  'Polarlicht',
  'Stadtrauschen',
  'Kaffee & Vinyl',
  'Sternenstaub',
];
const JAMENDO_NAMES = [
  'Freier Himmel',
  'Offene Straße',
  'Waldlicht',
  'Wellen',
  'Leiser Morgen',
  'Bergluft',
];

export function audiusTrack(i: number, prefix = '') {
  const id = `au${i}`;
  return {
    id,
    title: `${prefix}${AUDIUS_NAMES[i % AUDIUS_NAMES.length]}`,
    duration: 180 + i * 7,
    permalink: `/test/${id}`,
    artwork: { '480x480': `https://img.test/${id}.svg` },
    user: { id: `u${i % 3}`, name: ['Lumen', 'Kiko', 'Nachtfalter'][i % 3], handle: `h${i}` },
    is_streamable: true,
  };
}

export function jamendoTrack(i: number, prefix = '') {
  const id = String(1000 + i);
  return {
    id,
    name: `${prefix}${JAMENDO_NAMES[i % JAMENDO_NAMES.length]}`,
    duration: 150 + i * 11,
    artist_id: '7',
    artist_name: ['Offene Band', 'Creative Duo'][i % 2],
    album_id: '55',
    album_name: 'Freie Klänge',
    album_image: `https://img.test/j${id}.svg`,
    audio: `https://audio.jamendo.test/${id}.wav`,
    license_ccurl: 'http://creativecommons.org/licenses/by-sa/3.0/',
    shareurl: `https://www.jamendo.com/track/${id}`,
  };
}

export interface MockOptions {
  audiusDown?: boolean;
  /** Verzögerung für Jamendo in ms (zeigt: langsame Quelle blockiert nicht) */
  jamendoDelay?: number;
  audioSeconds?: number;
  /** Begrüßung beim ersten Start zeigen */
  welcome?: boolean;
}

/** Fängt alle Anfragen an Audius, Jamendo und Bilder ab */
export async function mockMusicApis(page: Page, opts: MockOptions = {}) {
  // Begrüßung beim ersten Start überspringen (eigener Test in extras.spec.ts)
  if (!opts.welcome)
    await page.addInitScript(() => localStorage.setItem('klangraum.onboarded', '1'));
  const wav = toneWav(opts.audioSeconds ?? 30);
  // Mit Range-Anfragen (wie echte Server) – sonst kann der Browser nicht spulen
  const audio = (route: Route) => {
    const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers()['range'] ?? '');
    if (!range)
      return route.fulfill({
        status: 200,
        contentType: 'audio/wav',
        headers: { ...CORS, 'Accept-Ranges': 'bytes' },
        body: wav,
      });
    const start = Number(range[1]);
    const end = range[2] ? Math.min(Number(range[2]), wav.length - 1) : wav.length - 1;
    return route.fulfill({
      status: 206,
      contentType: 'audio/wav',
      headers: {
        ...CORS,
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${end}/${wav.length}`,
      },
      body: wav.subarray(start, end + 1),
    });
  };

  await page.route(/^https:\/\/api\.audius\.co\//, async (route) => {
    const url = new URL(route.request().url());
    if (opts.audiusDown) return route.fulfill({ status: 503, headers: CORS, body: 'down' });
    const p = url.pathname;
    if (p === '/' || p === '') return json(route, { data: [] });
    if (/\/v1\/tracks\/[^/]+\/stream$/.test(p)) return audio(route);
    if (p === '/v1/tracks/trending')
      return json(route, { data: Array.from({ length: 8 }, (_, i) => audiusTrack(i)) });
    if (p === '/v1/tracks/search') {
      const q = url.searchParams.get('query') ?? '';
      // Blättern: neue Songs bis Offset 150, danach ist Schluss
      const offset = Number(url.searchParams.get('offset') ?? '0');
      if (offset >= 150) return json(route, { data: [] });
      const n = offset === 0 ? 6 : 50;
      return json(route, {
        data: Array.from({ length: n }, (_, i) => {
          const t = audiusTrack(i, `${q} `);
          return offset === 0
            ? t
            : { ...t, id: `au${offset + i}`, title: `${q} Song ${offset + i}` };
        }),
      });
    }
    if (p === '/v1/playlists/search')
      return json(route, {
        data: [
          {
            id: 'al1',
            playlist_name: 'Nachtalbum',
            is_album: true,
            artwork: { '480x480': 'https://img.test/al1.svg' },
            user: { name: 'Lumen' },
          },
          {
            id: 'pl1',
            playlist_name: 'Chill-Mix',
            is_album: false,
            artwork: { '480x480': 'https://img.test/pl1.svg' },
            user: { name: 'Kiko' },
          },
        ],
      });
    if (p === '/v1/playlists/al1')
      return json(route, {
        data: [
          {
            id: 'al1',
            playlist_name: 'Nachtalbum',
            is_album: true,
            artwork: { '480x480': 'https://img.test/al1.svg' },
            user: { name: 'Lumen' },
          },
        ],
      });
    if (p === '/v1/playlists/al1/tracks')
      return json(route, { data: [audiusTrack(1), audiusTrack(2), audiusTrack(3)] });
    if (p === '/v1/users/u0')
      return json(route, {
        data: {
          id: 'u0',
          name: 'Lumen',
          handle: 'lumen',
          profile_picture: { '480x480': 'https://img.test/u0.svg' },
        },
      });
    if (p === '/v1/users/u0/tracks')
      return json(route, { data: [audiusTrack(0), audiusTrack(3), audiusTrack(6)] });
    if (p === '/v1/users/search')
      return json(route, {
        data: [
          {
            id: 'u0',
            name: 'Lumen',
            handle: 'lumen',
            profile_picture: { '480x480': 'https://img.test/u0.svg' },
          },
        ],
      });
    return json(route, { data: null }, 404);
  });

  await page.route(/^https:\/\/api\.jamendo\.com\//, async (route) => {
    if (opts.jamendoDelay) await new Promise((r) => setTimeout(r, opts.jamendoDelay));
    const url = new URL(route.request().url());
    const ok = (results: unknown[]) =>
      json(route, {
        headers: { status: 'success', code: 0, results_count: results.length },
        results,
      });
    if (url.pathname === '/v3.0/tracks/') {
      if (url.searchParams.get('fullcount') === 'true')
        return json(route, {
          headers: { status: 'success', code: 0, results_count: 1, results_fullcount: 41250 },
          results: [jamendoTrack(0)],
        });
      const id = url.searchParams.get('id');
      if (id) return ok([jamendoTrack(Number(id) - 1000)]);
      const q = url.searchParams.get('search');
      return ok(Array.from({ length: 4 }, (_, i) => jamendoTrack(i, q ? `${q} ` : '')));
    }
    return ok([]);
  });

  // Internet Archive
  await page.route(/^https:\/\/archive\.org\//, async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname;
    if (p === '/advancedsearch.php') {
      if (url.searchParams.get('rows') === '0')
        return json(route, { response: { numFound: 8750, docs: [] } });
      return json(route, {
        response: {
          docs: [
            {
              identifier: 'band1999-05-01',
              title: 'Live im Park 1999',
              creator: 'Die Parkband',
              year: '1999',
              collection: ['etree'],
            },
            {
              identifier: 'netlabel-ep',
              title: 'Freie EP',
              creator: 'Netlabel-Künstler',
              licenseurl: 'http://creativecommons.org/licenses/by-nc/3.0/',
              collection: ['netlabels'],
            },
          ],
        },
      });
    }
    const m = /^\/metadata\/(.+)$/.exec(p);
    if (m) {
      const id = decodeURIComponent(m[1] ?? '');
      const etree = id.startsWith('band');
      return json(route, {
        metadata: {
          identifier: id,
          title: etree ? 'Live im Park 1999' : 'Freie EP',
          creator: etree ? 'Die Parkband' : 'Netlabel-Künstler',
          collection: [etree ? 'etree' : 'netlabels'],
          licenseurl: etree ? undefined : 'http://creativecommons.org/licenses/by-nc/3.0/',
        },
        files: [
          {
            name: 't01.mp3',
            format: 'VBR MP3',
            title: etree ? 'Intro im Park' : 'Offener Anfang',
            track: '1',
            length: '95.0',
          },
          {
            name: 't02.mp3',
            format: 'VBR MP3',
            title: etree ? 'Abendlied' : 'Freies Ende',
            track: '2',
            length: '201.3',
          },
        ],
      });
    }
    if (p.startsWith('/download/')) return audio(route);
    if (p.startsWith('/services/img/')) {
      return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: coverSvg(p) });
    }
    return route.fulfill({ status: 404, headers: CORS, body: '' });
  });

  // Internetradio-Verzeichnis
  await page.route(/^https:\/\/[a-z0-9]+\.api\.radio-browser\.info\//, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/json/url/')) return json(route, { ok: true });
    const q = url.searchParams.get('name') ?? url.searchParams.get('tag') ?? '';
    const names = ['Welle Nord', 'Rockradio 24', 'Klassik Plus', 'Charts Live'];
    return json(
      route,
      names.map((name, i) => ({
        stationuuid: `9${i}a0b1c2-0000-4000-8000-00000000000${i}`,
        name: q ? `${name} ${q}`.trim() : name,
        url_resolved: `https://radio.stream.test/${i}.mp3`,
        homepage: `https://radio.test/${i}`,
        favicon: `https://img.test/radio${i}.svg`,
        tags: 'pop,rock',
        country: 'Germany',
        codec: 'MP3',
        bitrate: 128,
        hls: 0,
        lastcheckok: 1,
      })),
    );
  });
  await page.route(/^https:\/\/radio\.stream\.test\//, audio);

  // YouTube Data API (Suche, Charts)
  await page.route(/^https:\/\/www\.googleapis\.com\/youtube\/v3\//, async (route) => {
    const url = new URL(route.request().url());
    const kind = url.pathname.split('/').pop();
    if (kind === 'search' && url.searchParams.get('type') === 'playlist') {
      const q = url.searchParams.get('q') ?? '';
      return json(route, {
        items: [1, 2].map((n) => ({
          id: { playlistId: `PLtest${n}${q.replace(/\W/g, '')}` },
          snippet: {
            title: `${q} Playlist ${n}`,
            channelTitle: 'Playlist-Kanal',
            thumbnails: { high: { url: `https://img.test/pl${n}.svg` } },
          },
        })),
      });
    }
    if (kind === 'playlists') {
      const id = url.searchParams.get('id') ?? '';
      return json(route, {
        items: [{ id, snippet: { title: `Playlist ${id}`, channelTitle: 'Playlist-Kanal' } }],
      });
    }
    if (kind === 'playlistItems') {
      return json(route, {
        items: YT_VIDEOS.map((v) => ({ contentDetails: { videoId: v.id } })),
      });
    }
    if (kind === 'search') {
      const q = url.searchParams.get('q') ?? '';
      return json(route, {
        items: YT_VIDEOS.map((v) => ({ id: { videoId: v.id }, snippet: ytSnippet(v, q) })),
      });
    }
    if (kind === 'videos') {
      const ids = (url.searchParams.get('id') ?? YT_VIDEOS.map((v) => v.id).join(',')).split(',');
      return json(route, {
        items: YT_VIDEOS.filter((v) => ids.includes(v.id)).map((v) => ({
          id: v.id,
          snippet: ytSnippet(v, ''),
          contentDetails: { duration: v.duration },
          status: { embeddable: true },
        })),
      });
    }
    return json(route, { items: [] });
  });
  // Nachgebauter offizieller YouTube-Player (das echte Skript ist in der Testumgebung gesperrt)
  await page.route('https://www.youtube.com/iframe_api', (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: FAKE_YT_API }),
  );

  // MusicBrainz (Album/Single zum Song) und Cover Art Archive (Bild)
  await page.route(/^https:\/\/musicbrainz\.org\/ws\/2\//, (route) =>
    json(route, {
      recordings: [
        {
          score: 100,
          releases: [
            {
              status: 'Official',
              date: '2020-01-01',
              'release-group': {
                id: '0f0f0f0f-1111-2222-3333-444444444444',
                'primary-type': 'Single',
              },
            },
          ],
        },
      ],
    }),
  );
  await page.route(/^https:\/\/coverartarchive\.org\//, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#e9c46a"/><circle cx="5" cy="5" r="3" fill="#264653"/></svg>',
    }),
  );

  // LRCLIB: zu jedem Song ein synchroner Songtext (Zeilen alle 1,5 Sekunden)
  await page.route(/^https:\/\/lrclib\.net\/api\//, (route) => {
    const url = new URL(route.request().url());
    const name = url.searchParams.get('track_name') ?? '';
    if (!name || name.includes('Ohne Text')) return json(route, []);
    const lines = Array.from(
      { length: 20 },
      (_, i) =>
        `[00:${String(Math.floor(i * 1.5)).padStart(2, '0')}.${i % 2 ? '50' : '00'}]Zeile ${i + 1} von ${name}`,
    );
    return json(route, [
      {
        trackName: name,
        artistName: url.searchParams.get('artist_name'),
        duration: null,
        plainLyrics: 'Text',
        syncedLyrics: lines.join('\n'),
      },
    ]);
  });

  await page.route(/^https:\/\/audio\.jamendo\.test\//, audio);
  await page.route(/^https:\/\/img\.test\//, (route) => {
    const name = new URL(route.request().url()).pathname;
    return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: coverSvg(name) });
  });
}

/** Wartet, bis das Audio-Element wirklich läuft */
export async function expectAudioPlaying(page: Page) {
  await page.waitForFunction(() => {
    const a = document.querySelector<HTMLAudioElement>('audio[data-kr="player"]');
    return !!a && !a.paused && a.currentTime > 0.2;
  });
}

const YT_VIDEOS = [
  {
    id: 'ytvideo0001',
    title: 'Sommerhit 2026 (Official Video)',
    channel: 'Popstar - Topic',
    duration: 'PT3M12S',
  },
  {
    id: 'ytvideo0002',
    title: 'Ballade &amp; Klavier',
    channel: 'SängerinVEVO',
    duration: 'PT4M01S',
  },
  { id: 'ytvideo0003', title: 'Club Remix', channel: 'DJ Test', duration: 'PT2M45S' },
];

function ytSnippet(v: (typeof YT_VIDEOS)[number], q: string) {
  return {
    title: q ? `${q} – ${v.title}` : v.title,
    channelTitle: v.channel,
    thumbnails: { high: { url: `https://img.test/${v.id}.svg` } },
    liveBroadcastContent: 'none',
  };
}

/** Verhält sich wie die offizielle IFrame-API: Zustände 1 = läuft, 2 = Pause, 0 = Ende */
const FAKE_YT_API = `
(function () {
  function Player(el, opts) {
    var self = this;
    var box = document.createElement('div');
    box.setAttribute('data-testid', 'fake-youtube');
    box.style.cssText = 'width:100%;height:100%;background:linear-gradient(135deg,#c4302b,#282828);color:#fff;display:grid;place-items:center;font:600 14px sans-serif';
    el.appendChild(box);
    self.box = box; self.t = 0; self.state = -1; self.vol = 100; self.muted = false; self.dur = 0; self.timer = null;
    self.emit = function (s) { self.state = s; box.setAttribute('data-state', String(s)); opts.events && opts.events.onStateChange && opts.events.onStateChange({ data: s, target: self }); };
    setTimeout(function () { opts.events && opts.events.onReady && opts.events.onReady({ target: self }); }, 30);
  }
  Player.prototype.cueVideoById = function (o) { this.id = o.videoId; this.t = o.startSeconds || 0; this.dur = 180; this.box.textContent = 'YouTube: ' + o.videoId; this.box.setAttribute('data-video', o.videoId); this.emit(5); };
  Player.prototype.isMuted = function () { return this.muted; };
  Player.prototype.playVideo = function () { var self = this; if (window.__ytNeedsTap && !self.muted && !self.tapped) return; clearInterval(self.timer); self.timer = setInterval(function () { self.t += 0.25; }, 250); setTimeout(function () { self.emit(1); }, 50); };
  Player.prototype.pauseVideo = function () { clearInterval(this.timer); this.emit(2); };
  Player.prototype.stopVideo = function () { clearInterval(this.timer); this.t = 0; this.emit(-1); };
  Player.prototype.seekTo = function (s) { this.t = s; };
  Player.prototype.setVolume = function (v) { this.vol = v; this.box.setAttribute('data-volume', String(v)); };
  Player.prototype.mute = function () { this.muted = true; };
  Player.prototype.unMute = function () { if (window.__ytNeedsTap && !window.__ytGesture) return; this.muted = false; this.tapped = true; };
  Player.prototype.getCurrentTime = function () { return this.t; };
  Player.prototype.getDuration = function () { return this.dur; };
  window.YT = { Player: Player };
  setTimeout(function () { window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady(); }, 10);
})();
`;

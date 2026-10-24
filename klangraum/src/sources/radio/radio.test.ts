import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, seededRandom } from '../../test/fixtures';
import { RadioSource } from './index';

const station = (uuid: string, extra: Record<string, unknown> = {}) => ({
  stationuuid: uuid,
  name: `Sender ${uuid}`,
  url_resolved: `https://stream.test/${uuid}.mp3`,
  homepage: `https://radio.test/${uuid}`,
  favicon: `https://radio.test/${uuid}.png`,
  tags: 'pop,rock,charts,hits',
  country: 'Germany',
  codec: 'MP3',
  bitrate: 128,
  hls: 0,
  lastcheckok: 1,
  ...extra,
});

const UUID = (n: number) => `0000000${n}-aaaa-bbbb-cccc-000000000000`;

describe('Internetradio-Adapter', () => {
  it('sucht nach Name und Musikrichtung und mischt doppelte Sender aus', async () => {
    const fetch = vi.fn(async (url: string) => {
      const u = new URL(url);
      if (u.searchParams.get('name')) return jsonResponse([station(UUID(1)), station(UUID(2))]);
      return jsonResponse([station(UUID(2)), station(UUID(3))]);
    });
    const res = await new RadioSource({ fetch, random: seededRandom(1) }).search('Rock');
    expect(res.tracks.map((t) => t.id)).toEqual([UUID(1), UUID(2), UUID(3)]);
    const first = new URL(fetch.mock.calls[0]![0]);
    expect(first.pathname).toBe('/json/stations/search');
    expect(first.searchParams.get('is_https')).toBe('true');
    expect(first.searchParams.get('hidebroken')).toBe('true');
    expect(new URL(fetch.mock.calls[1]![0]).searchParams.get('tag')).toBe('rock');
    expect(res.tracks[0]).toEqual({
      id: UUID(1),
      sourceId: 'radio',
      title: `Sender ${UUID(1)}`,
      artists: ['Germany'],
      album: 'pop, rock, charts',
      durationMs: 0,
      artworkUrl: `https://radio.test/${UUID(1)}.png`,
      permalink: `https://radio.test/${UUID(1)}`,
      live: true,
    });
  });

  it('lässt unsichere, kaputte und nicht abspielbare Sender weg', async () => {
    const fetch = vi.fn(async () =>
      jsonResponse([
        station(UUID(1)),
        station(UUID(2), { url_resolved: 'http://unsicher.test/a.mp3' }),
        station(UUID(3), { hls: 1 }),
        station(UUID(4), { lastcheckok: 0 }),
        station(UUID(5), { codec: 'OGG' }),
        station(UUID(6), { url_resolved: 'javascript:alert(1)' }),
        { stationuuid: 'kaputt' },
      ]),
    );
    const res = await new RadioSource({ fetch }).search('x');
    expect(res.tracks.map((t) => t.id)).toEqual([UUID(1)]);
  });

  it('nimmt den nächsten Server, wenn einer nicht antwortet', async () => {
    let calls = 0;
    const fetch = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new TypeError('down');
      return jsonResponse([station(UUID(1))]);
    });
    const res = await new RadioSource({ fetch }).getTrending();
    expect(res).toHaveLength(1);
    const hosts = fetch.mock.calls.map((c) => new URL((c as unknown as [string])[0]).host);
    expect(hosts[0]).not.toBe(hosts[1]);
  });

  it('beliebte Sender im eigenen Land', async () => {
    const fetch = vi.fn(async (_url: string) => jsonResponse([station(UUID(1))]));
    await new RadioSource({ fetch, getCountryCode: () => 'de' }).getTrending();
    expect(new URL(fetch.mock.calls[0]![0]).searchParams.get('countrycode')).toBe('DE');
  });

  it('Stream-Adresse kommt aus der Suche, der Start wird beim Verzeichnis gemeldet', async () => {
    const fetch = vi.fn(async (url: string) =>
      url.includes('/json/url/') ? jsonResponse({ ok: true }) : jsonResponse([station(UUID(7))]),
    );
    const src = new RadioSource({ fetch });
    const [t] = (await src.search('x')).tracks;
    expect(await src.getStreamUrl(t!)).toBe(`https://stream.test/${UUID(7)}.mp3`);
    expect(fetch.mock.calls.some((c) => c[0].includes(`/json/url/${UUID(7)}`))).toBe(true);
  });

  it('kann nur Sender suchen (keine Alben)', async () => {
    const fetch = vi.fn();
    const src = new RadioSource({ fetch });
    expect(src.searchTypes).toEqual(['track']);
    expect((await src.search('x', { type: 'album' })).albums).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});

// Song search via Apple's free iTunes Search API (no account or key needed).
// Used so that everybody - also people who join privately - can find songs with
// cover art and a 30-second preview.
import { HttpError } from '../public/js/lib/model.js';
import { mapItunesResponse } from '../public/js/lib/itunes-map.js';

export { bigArtwork, mapItunesResult, pickBestMatch } from '../public/js/lib/itunes-map.js';

const ITUNES_BASE = 'https://itunes.apple.com';

export async function itunesSearch(fetchImpl, term, { limit = 20, country = 'US' } = {}) {
  const q = String(term || '').trim().slice(0, 120);
  if (!q) return [];
  const url = new URL('/search', ITUNES_BASE);
  url.search = new URLSearchParams({
    term: q,
    media: 'music',
    entity: 'song',
    limit: String(Math.min(50, Math.max(1, limit))),
    country: /^[A-Z]{2}$/.test(country) ? country : 'US',
  }).toString();
  let res;
  try {
    res = await fetchImpl(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(7000),
    });
  } catch {
    throw new HttpError(502, 'The music search is not reachable right now.');
  }
  if (!res.ok) throw new HttpError(502, 'The music search is busy right now. Please try again in a minute.');
  let data;
  try {
    data = JSON.parse(await res.text());
  } catch {
    throw new HttpError(502, 'The music search sent an unexpected answer.');
  }
  return mapItunesResponse(data);
}

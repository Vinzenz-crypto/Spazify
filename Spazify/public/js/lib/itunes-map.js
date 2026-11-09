// Shared (browser + server): turns iTunes Search API results into Spazify songs.
import { normText, cleanTitle, primaryArtist } from './normalize.js';

export function bigArtwork(url, size = 600) {
  if (!url) return null;
  return String(url).replace(/\/(\d+)x(\d+)(bb|cc|sr)?\.(jpg|jpeg|png|webp)$/i, `/${size}x${size}bb.jpg`);
}

export function mapItunesResult(r) {
  if (!r || !r.trackName || !r.artistName) return null;
  const year = r.releaseDate ? new Date(r.releaseDate).getUTCFullYear() : null;
  return {
    id: r.trackId ? String(r.trackId) : undefined,
    title: r.trackName,
    artist: r.artistName,
    album: r.collectionName || undefined,
    cover: bigArtwork(r.artworkUrl100 || r.artworkUrl60) || undefined,
    preview: r.previewUrl || undefined,
    url: r.trackViewUrl || undefined,
    duration: r.trackTimeMillis || undefined,
    genre: r.primaryGenreName || undefined,
    year: Number.isFinite(year) ? year : undefined,
    explicit: r.trackExplicitness === 'explicit' || undefined,
    source: 'itunes',
  };
}

export function mapItunesResponse(data) {
  return (data?.results || [])
    .filter((r) => r.wrapperType === 'track' && (r.kind === 'song' || !r.kind))
    .map(mapItunesResult)
    .filter(Boolean);
}

// Picks the search result that really is the song we are looking for.
export function pickBestMatch(results, title, artist) {
  const wantTitle = normText(cleanTitle(title));
  const wantArtist = normText(primaryArtist(artist));
  let best = null;
  let bestScore = 0;
  for (const r of results) {
    const t = normText(cleanTitle(r.title));
    const a = normText(r.artist);
    let score = 0;
    if (t === wantTitle) score += 6;
    else if (t.startsWith(wantTitle) || wantTitle.startsWith(t)) score += 3;
    else continue;
    if (a === wantArtist) score += 5;
    else if (a.includes(wantArtist) || wantArtist.includes(normText(primaryArtist(r.artist)))) score += 3;
    else score -= 2;
    if (r.cover) score += 1;
    if (r.preview) score += 1;
    if (score > bestScore) {
      best = r;
      bestScore = score;
    }
  }
  return bestScore >= 7 ? best : null;
}

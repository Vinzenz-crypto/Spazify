// Song search, cover art and listening links.
// Search uses the iTunes Search API - through our server function when it is
// available, otherwise directly from the browser (JSONP).
import { storage, sleep, countryCode } from './util.js';
import { primaryArtist } from './normalize.js';
import { mapItunesResponse, pickBestMatch } from './itunes-map.js';

let apiAvailable = false;
export function setMusicApiAvailable(value) {
  apiAvailable = value;
}

// ---- JSONP (works without any server, no CORS needed) ----
let jsonpCount = 0;
function jsonp(url, timeout = 9000) {
  return new Promise((resolve, reject) => {
    const name = `__spazify_cb_${Date.now()}_${jsonpCount++}`;
    const script = document.createElement('script');
    const timer = setTimeout(() => {
      window[name] = () => {};
      script.remove();
      reject(new Error('timeout'));
    }, timeout);
    window[name] = (data) => {
      clearTimeout(timer);
      delete window[name];
      script.remove();
      resolve(data);
    };
    script.onerror = () => {
      clearTimeout(timer);
      delete window[name];
      script.remove();
      reject(new Error('network'));
    };
    script.src = `${url}&callback=${name}`;
    document.head.appendChild(script);
  });
}

function itunesUrl(term, limit) {
  const params = new URLSearchParams({ term, media: 'music', entity: 'song', limit: String(limit), country: countryCode() });
  return `https://itunes.apple.com/search?${params}`;
}

export class SearchError extends Error {}

export async function searchSongs(term, { limit = 20 } = {}) {
  const q = String(term || '').trim();
  if (!q) return [];
  if (apiAvailable) {
    try {
      const res = await fetch(`/api/search?term=${encodeURIComponent(q)}&limit=${limit}&country=${countryCode()}`);
      if (res.ok) {
        const data = await res.json();
        return data.results || [];
      }
    } catch {
      /* fall back to JSONP below */
    }
  }
  try {
    return mapItunesResponse(await jsonp(itunesUrl(q, limit)));
  } catch {
    throw new SearchError('The song search is not reachable right now. You can still add a song by typing the title and artist.');
  }
}

// ---- Cover art + previews for songs that don't have them (e.g. demo songs) ----
const ART_KEY = 'spazify.art.v1';
const art = storage.get(ART_KEY, {});
const queue = new Map();
let running = false;
let persistTimer = null;
const artListeners = new Set();

function persist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const entries = Object.entries(art);
    // keep the cache small
    if (entries.length > 1500) entries.sort((a, b) => (b[1].t || 0) - (a[1].t || 0)).slice(1500).forEach(([k]) => delete art[k]);
    storage.set(ART_KEY, art);
  }, 400);
}

function remember(key, hit) {
  if (hit) {
    art[key] = { c: hit.cover || null, p: hit.preview || null, u: hit.url || null, g: hit.genre || null, a: hit.album || null, t: Date.now() };
  } else {
    art[key] = { miss: Date.now(), t: Date.now() };
  }
  persist();
  artListeners.forEach((fn) => fn(key, art[key]));
}

export function onArtResolved(fn) {
  artListeners.add(fn);
  return () => artListeners.delete(fn);
}

export function cachedArt(key) {
  const a = art[key];
  return a && !a.miss ? a : null;
}

export function coverUrl(track) {
  return track?.cover || cachedArt(track?.key)?.c || null;
}

// Only songs WITHOUT a cover are looked up in the background. Previews are
// looked up when somebody presses play (see findPreview).
export function needsArt(track) {
  if (!track?.key || track.cover) return false;
  const a = art[track.key];
  if (!a) return true;
  if (a.miss) return Date.now() - a.miss > 3 * 86400000;
  return false;
}

export function requestArt(track) {
  if (!needsArt(track) || queue.has(track.key)) return;
  queue.set(track.key, { key: track.key, title: track.title, artist: track.artist });
  if (!running) setTimeout(processQueue, 50);
}

async function lookupViaServer(items) {
  const res = await fetch('/api/lookup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items, country: countryCode() }),
  });
  if (!res.ok) throw new Error(`lookup ${res.status}`);
  return res.json();
}

async function lookupViaJsonp(item) {
  const data = await jsonp(itunesUrl(`${item.title} ${primaryArtist(item.artist)}`, 10));
  return pickBestMatch(mapItunesResponse(data), item.title, item.artist);
}

let serverFailures = 0;
async function processQueue() {
  if (running) return;
  running = true;
  let rounds = 0;
  try {
    while (queue.size && rounds < 200) {
      rounds++;
      const items = [...queue.values()].slice(0, 40);
      if (apiAvailable && serverFailures < 3) {
        try {
          const { found = {}, missing = [], pending = [] } = await lookupViaServer(items);
          for (const [key, hit] of Object.entries(found)) {
            queue.delete(key);
            remember(key, hit);
          }
          for (const key of missing) {
            queue.delete(key);
            remember(key, null);
          }
          const progress = Object.keys(found).length + missing.length;
          if (!progress && pending.length) serverFailures++;
          else serverFailures = 0;
          if (pending.length) await sleep(progress ? 4500 : 7000);
        } catch {
          serverFailures++;
          await sleep(1500);
        }
      } else {
        // iTunes allows roughly 20 requests per minute from one browser.
        const item = items[0];
        queue.delete(item.key);
        try {
          remember(item.key, await lookupViaJsonp(item));
        } catch {
          /* offline - try again another time */
        }
        await sleep(3100);
      }
    }
  } finally {
    running = false;
  }
}

// Finds a 30-second preview right now (when somebody presses play).
export async function findPreview(track) {
  if (track.preview) return track.preview;
  const cached = art[track.key];
  if (cached?.p) return cached.p;
  const item = { key: track.key, title: track.title, artist: track.artist };
  if (apiAvailable) {
    try {
      const { found = {} } = await lookupViaServer([item]);
      if (found[track.key]) {
        remember(track.key, found[track.key]);
        return found[track.key].preview || null;
      }
    } catch {
      /* fall back */
    }
  }
  try {
    const hit = await lookupViaJsonp(item);
    remember(track.key, hit);
    return hit?.preview || null;
  } catch {
    return null;
  }
}

// Links to open a song in every music app (search links work for everybody).
export function listenLinks(track) {
  const q = encodeURIComponent(`${track.title} ${primaryArtist(track.artist)}`);
  const links = track.links || {};
  const appleUrl = links.apple || (track.source === 'apple' || track.source === 'itunes' ? track.url : null) || cachedArt(track.key)?.u;
  const spotifyUrl = links.spotify || (track.source === 'spotify' ? track.url : null);
  return [
    { id: 'spotify', label: 'Spotify', url: spotifyUrl || `https://open.spotify.com/search/${q}` },
    { id: 'apple', label: 'Apple Music', url: appleUrl || `https://music.apple.com/search?term=${q}` },
    { id: 'amazon', label: 'Amazon Music', url: `https://music.amazon.com/search/${q}` },
    { id: 'youtube', label: 'YouTube Music', url: `https://music.youtube.com/search?q=${q}` },
  ];
}

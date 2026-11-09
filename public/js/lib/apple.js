// Apple Music via MusicKit JS. Needs a developer token from the server
// (Apple Developer Program account, see README). Without it, Apple Music users
// simply add their favourite songs by hand.
import { CONFIG } from '../config.js';
import { dateKey } from './util.js';

const MUSICKIT_SRC = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js';
let music = null;
let preparing = null;

export class AppleError extends Error {}

function loadScript() {
  if (window.MusicKit) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const done = () => resolve();
    document.addEventListener('musickitloaded', done, { once: true });
    const s = document.createElement('script');
    s.src = MUSICKIT_SRC;
    s.async = true;
    s.dataset.webComponents = '';
    s.onerror = () => reject(new AppleError('Apple Music could not be loaded. Please check your internet connection.'));
    document.head.appendChild(s);
    setTimeout(() => (window.MusicKit ? resolve() : reject(new AppleError('Apple Music took too long to load.'))), 15000);
  });
}

// Load everything BEFORE the user presses "Connect", so the Apple popup is not blocked.
export function prepareAppleMusic() {
  if (music) return Promise.resolve(music);
  if (preparing) return preparing;
  preparing = (async () => {
    const res = await fetch('/api/apple-token');
    if (!res.ok) throw new AppleError('Apple Music is not set up on this site.');
    const { token } = await res.json();
    await loadScript();
    const instance = await window.MusicKit.configure({ developerToken: token, app: { name: CONFIG.appName, build: '1.0.0' } });
    music = instance || window.MusicKit.getInstance();
    return music;
  })();
  preparing.catch(() => {
    preparing = null;
  });
  return preparing;
}

export async function authorizeAppleMusic() {
  const m = music || (await prepareAppleMusic());
  await m.authorize();
  if (!m.isAuthorized) throw new AppleError('Apple Music access was not allowed.');
  return m;
}

export function disconnectAppleMusic() {
  try {
    music?.unauthorize?.();
  } catch {
    /* ignore */
  }
}

function artwork(art, size = 300) {
  if (!art?.url) return undefined;
  return art.url.replace('{w}', size).replace('{h}', size).replace('{f}', 'jpg');
}

export function mapAppleSong(item) {
  const a = item?.attributes;
  if (!a?.name) return null;
  return {
    id: item.id,
    title: a.name,
    artist: a.artistName || 'Unknown artist',
    album: a.albumName,
    cover: artwork(a.artwork),
    duration: a.durationInMillis,
    url: a.url,
    preview: a.previews?.[0]?.url,
    genre: (a.genreNames || []).find((g) => g !== 'Music'),
    explicit: a.contentRating === 'explicit' || undefined,
    source: 'apple',
  };
}

async function get(path, params = {}) {
  const res = await music.api.music(path, params);
  return res?.data?.data || [];
}

export async function collectAppleData() {
  if (!music?.isAuthorized) throw new AppleError('Please connect Apple Music first.');
  const recentRaw = await get('/v1/me/recent/played/tracks', { limit: 30 }).catch(() => []);
  const recent = recentRaw.map(mapAppleSong).filter(Boolean);
  const playlistsRaw = await get('/v1/me/library/playlists', { limit: 50 }).catch(() => []);
  const playlists = playlistsRaw
    .filter((p) => p?.attributes?.name)
    .map((p) => ({
      id: p.id,
      name: p.attributes.name,
      description: p.attributes.description?.standard || '',
      cover: artwork(p.attributes.artwork),
      trackCount: 0,
      own: true,
      source: 'apple',
    }));
  return { recent, top: recent.slice(0, 30), playlists, recentIds: recentRaw.map((r) => r.id) };
}

export async function fetchApplePlaylistTracks(id) {
  const items = await get(`/v1/me/library/playlists/${encodeURIComponent(id)}/tracks`, { limit: 50 });
  return items.map(mapAppleSong).filter(Boolean);
}

// Apple's "recently played" list has no timestamps, so we count the songs that
// appeared at the top since the last sync and add their length to today.
export function appleMinutes(recent, recentIds, previousIds) {
  let newCount = recentIds.length;
  if (previousIds?.length) {
    const idx = recentIds.indexOf(previousIds[0]);
    newCount = idx === -1 ? recentIds.length : idx;
  }
  const minutes = Math.round(recent.slice(0, newCount).reduce((sum, t) => sum + (t.duration || 180000) / 60000, 0));
  return { perDay: minutes ? { [dateKey()]: minutes } : {}, cursor: recentIds.slice(0, 10) };
}

// Brings data from Spotify / Apple Music into my class profile.
import { state, updateMe, cleanTrackForSave } from '../store.js';
import * as spotify from './spotify.js';
import * as apple from './apple.js';

export function topForSave(list) {
  return (list || []).slice(0, 30).map((t) => ({ ...cleanTrackForSave(t), ...(t.plays ? { plays: t.plays } : {}) }));
}

export function mergeMinutes(listening, perDay) {
  const out = { ...(listening || {}) };
  for (const [day, minutes] of Object.entries(perDay || {})) {
    const cur = out[day] || { s: 0, m: 0 };
    const s = Math.min(1440 - (cur.m || 0), (cur.s || 0) + minutes);
    out[day] = { s: Math.max(0, s), m: cur.m || 0 };
  }
  return out;
}

export async function playlistWithTracks(provider, p) {
  const tracks = provider === 'spotify' ? await spotify.fetchPlaylistTracks(p.id) : await apple.fetchApplePlaylistTracks(p.id);
  return {
    id: p.id,
    name: p.name,
    description: p.description || '',
    cover: p.cover,
    url: p.url,
    source: provider,
    tracks: tracks.slice(0, 100).map(cleanTrackForSave),
    trackCount: Math.max(p.trackCount || 0, tracks.length),
    createdAt: Date.now(),
  };
}

// Re-reads top songs + recent plays (and refreshes shared playlists).
export async function resync({ playlists = true } = {}) {
  const me = state.me;
  if (!me) throw new Error('Please join a class first.');
  if (me.provider === 'spotify') {
    if (!spotify.isSpotifyConnected()) throw new spotify.SpotifyError('not-connected', 'Please connect Spotify again to sync.');
    const data = await spotify.collectSpotifyData({ playlists: false });
    const { perDay, cursor } = spotify.minutesFromRecent(data.recent, me.syncCursor?.spotify);
    let refreshed = null;
    if (playlists) {
      const shared = (me.playlists || []).filter((p) => p.source === 'spotify');
      refreshed = await Promise.all(shared.map((p) => playlistWithTracks('spotify', p).catch(() => p)));
    }
    await updateMe((m) => {
      m.topTracks = topForSave(data.top);
      m.listening = mergeMinutes(m.listening, perDay);
      m.syncCursor = { ...(m.syncCursor || {}), spotify: cursor };
      m.lastSyncAt = Date.now();
      if (refreshed) {
        const byId = new Map(refreshed.map((p) => [p.id, p]));
        m.playlists = (m.playlists || []).map((p) => (byId.has(p.id) ? { ...byId.get(p.id), createdAt: p.createdAt } : p));
      }
    });
    return { songs: data.top.length, minutes: Object.values(perDay).reduce((a, b) => a + b, 0) };
  }
  if (me.provider === 'apple') {
    await apple.authorizeAppleMusic();
    const data = await apple.collectAppleData();
    const { perDay, cursor } = apple.appleMinutes(data.recent, data.recentIds, me.syncCursor?.apple);
    await updateMe((m) => {
      m.topTracks = topForSave(data.top);
      m.listening = mergeMinutes(m.listening, perDay);
      m.syncCursor = { ...(m.syncCursor || {}), apple: cursor };
      m.lastSyncAt = Date.now();
    });
    return { songs: data.top.length, minutes: Object.values(perDay).reduce((a, b) => a + b, 0) };
  }
  throw new Error('Nothing to sync - you joined without a music account.');
}

export function canAutoSync() {
  const me = state.me;
  if (!me || state.session?.demo) return false;
  if (me.provider !== 'spotify' || !spotify.isSpotifyConnected()) return false;
  return !me.lastSyncAt || Date.now() - me.lastSyncAt > 60 * 60 * 1000;
}

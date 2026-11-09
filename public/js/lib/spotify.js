// Spotify login (Authorization Code with PKCE - no secret needed, safe for a
// static website) and reading the user's music data.
//
// Notes for 2026: apps in "Development Mode" work for up to 5 Spotify users that
// are added in the Spotify Developer Dashboard. Playlist songs are read from
// /playlists/{id}/items (older apps: /tracks) - both are supported below.
import { storage, session, sleep, dateKey } from './util.js';

const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1';
const SCOPES = ['user-top-read', 'user-read-recently-played', 'playlist-read-private'];
const TOKEN_KEY = 'spazify.spotify.v1';
const PENDING_KEY = 'spazify.oauth.v1';

export class SpotifyError extends Error {
  constructor(code, message, status = 0) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function randomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((b) => chars[b % chars.length]).join('');
}

async function challengeFor(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// The exact address Spotify sends people back to. It must be added to the
// "Redirect URIs" of your Spotify app.
export function spotifyRedirectUri() {
  const url = new URL('./', window.location.href);
  url.hash = '';
  url.search = '';
  return url.href;
}

export function isSpotifyConnected() {
  return Boolean(storage.get(TOKEN_KEY, null)?.refresh);
}

export function disconnectSpotify() {
  storage.remove(TOKEN_KEY);
}

export async function startSpotifyLogin(clientId, intent) {
  if (!clientId) throw new SpotifyError('config', 'Spotify is not set up on this site yet.');
  const verifier = randomString(64);
  const state = randomString(16);
  const redirectUri = spotifyRedirectUri();
  session.set(PENDING_KEY, { verifier, state, intent, redirectUri, clientId, createdAt: Date.now() });
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SCOPES.join(' '),
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: await challengeFor(verifier),
    state,
  });
  window.location.assign(`${AUTH_URL}?${params}`);
}

export function hasSpotifyCallback() {
  const p = new URLSearchParams(window.location.search);
  return p.has('state') && (p.has('code') || p.has('error')) && Boolean(session.get(PENDING_KEY, null));
}

function saveTokens(data, clientId, previousRefresh = null) {
  storage.set(TOKEN_KEY, {
    access: data.access_token,
    refresh: data.refresh_token || previousRefresh,
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    clientId,
  });
}

// Called when Spotify sends the user back to our site (?code=...&state=...).
export async function finishSpotifyLogin() {
  const params = new URLSearchParams(window.location.search);
  const pending = session.get(PENDING_KEY, null);
  session.remove(PENDING_KEY);
  window.history.replaceState(null, '', window.location.pathname + window.location.hash);
  if (!pending || pending.state !== params.get('state')) {
    throw new SpotifyError('state', 'The Spotify login could not be verified. Please try again.');
  }
  const intent = pending.intent || {};
  if (params.get('error')) {
    const cancelled = params.get('error') === 'access_denied';
    throw Object.assign(new SpotifyError(cancelled ? 'cancelled' : 'auth', cancelled ? 'You cancelled the Spotify login.' : `Spotify login failed (${params.get('error')}).`), { intent });
  }
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.get('code'),
      redirect_uri: pending.redirectUri,
      client_id: pending.clientId,
      code_verifier: pending.verifier,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw Object.assign(new SpotifyError('token', data.error_description || 'Spotify did not accept the login. Please try again.'), { intent });
  }
  saveTokens(data, pending.clientId);
  return intent;
}

async function accessToken(force = false) {
  const t = storage.get(TOKEN_KEY, null);
  if (!t?.refresh) throw new SpotifyError('not-connected', 'Please connect Spotify first.');
  if (!force && t.access && Date.now() < t.expiresAt - 60000) return t.access;
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refresh, client_id: t.clientId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    storage.remove(TOKEN_KEY);
    throw new SpotifyError('expired', 'Your Spotify login has expired. Please connect Spotify again.');
  }
  saveTokens(data, t.clientId, t.refresh);
  return data.access_token;
}

async function api(path, { retried = false, forceToken = false } = {}) {
  const token = await accessToken(forceToken);
  let res;
  try {
    res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new SpotifyError('network', 'Could not reach Spotify. Please check your internet connection.');
  }
  if (res.status === 401 && !retried) return api(path, { retried: true, forceToken: true });
  if (res.status === 429 && !retried) {
    const wait = Number(res.headers.get('Retry-After') || 2);
    if (wait <= 10) {
      await sleep(wait * 1000);
      return api(path, { retried: true });
    }
    throw new SpotifyError('rate', 'Spotify is busy right now. Please try again in a few minutes.', 429);
  }
  if (res.status === 403) {
    throw new SpotifyError(
      'forbidden',
      "Spotify didn't allow access. While a Spotify app is in Development Mode, only people on its user list can log in (max. 5). Ask your project team to add the email of your Spotify account - or join privately.",
      403,
    );
  }
  if (res.status === 204) return null;
  if (!res.ok) throw new SpotifyError('http', `Spotify answered with an error (${res.status}).`, res.status);
  return res.json();
}

function pickImage(images, ideal = 300) {
  if (!Array.isArray(images) || !images.length) return undefined;
  const sorted = [...images].filter((i) => i?.url).sort((a, b) => (a.width || 0) - (b.width || 0));
  return (sorted.find((i) => (i.width || 0) >= ideal) || sorted[sorted.length - 1])?.url;
}

export function mapSpotifyTrack(t) {
  if (!t || !t.name || (t.type && t.type !== 'track') || t.is_local) return null;
  return {
    id: t.id || undefined,
    title: t.name,
    artist: (t.artists || []).map((a) => a.name).filter(Boolean).join(', ') || 'Unknown artist',
    album: t.album?.name,
    cover: pickImage(t.album?.images),
    duration: t.duration_ms,
    url: t.external_urls?.spotify,
    explicit: t.explicit || undefined,
    source: 'spotify',
  };
}

function plainText(htmlText) {
  if (!htmlText) return '';
  const doc = new DOMParser().parseFromString(String(htmlText), 'text/html');
  return (doc.body.textContent || '').trim();
}

export async function fetchSpotifyProfile() {
  const me = await api('/me');
  return { id: me.id, name: me.display_name || me.id };
}

export async function fetchTopTracks() {
  let data = await api('/me/top/tracks?time_range=short_term&limit=30');
  if (!data?.items?.length) data = await api('/me/top/tracks?time_range=medium_term&limit=30');
  return (data?.items || []).map(mapSpotifyTrack).filter(Boolean);
}

export async function fetchRecentlyPlayed() {
  const data = await api('/me/player/recently-played?limit=50');
  return (data?.items || [])
    .map((item) => ({ track: mapSpotifyTrack(item.track), playedAt: Date.parse(item.played_at) }))
    .filter((x) => x.track && Number.isFinite(x.playedAt));
}

export async function fetchSpotifyPlaylists(myId) {
  const data = await api('/me/playlists?limit=50');
  return (data?.items || [])
    .filter((p) => p && p.id && p.name)
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: plainText(p.description),
      cover: pickImage(p.images, 300),
      url: p.external_urls?.spotify,
      trackCount: (p.items || p.tracks)?.total ?? 0,
      own: p.owner?.id === myId,
      ownerName: p.owner?.display_name || '',
      source: 'spotify',
    }));
}

export async function fetchPlaylistTracks(id) {
  let data;
  try {
    data = await api(`/playlists/${encodeURIComponent(id)}/items?limit=50`);
  } catch (err) {
    if (err.status === 404 || err.status === 400) data = await api(`/playlists/${encodeURIComponent(id)}/tracks?limit=50`);
    else throw err;
  }
  return (data?.items || []).map((entry) => mapSpotifyTrack(entry?.item || entry?.track)).filter(Boolean);
}

// Combines top tracks with how often they were played recently.
export function buildTopList(top, recent) {
  const counts = new Map();
  for (const r of recent) {
    const k = `${r.track.title}|${r.track.artist}`;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const list = top.map((t) => ({ ...t, plays: counts.get(`${t.title}|${t.artist}`) || 0 }));
  const seen = new Set(list.map((t) => `${t.title}|${t.artist}`));
  // Songs played a lot recently but not (yet) in the top list.
  const extra = [...counts.entries()]
    .filter(([k, n]) => n >= 2 && !seen.has(k))
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => ({ ...recent.find((r) => `${r.track.title}|${r.track.artist}` === k).track, plays: n }));
  return [...list, ...extra].slice(0, 30);
}

// Listening minutes per day from the recently played list (only new plays).
export function minutesFromRecent(recent, cursorIso) {
  const cursor = cursorIso ? Date.parse(cursorIso) : 0;
  const perDay = {};
  let newest = cursor || 0;
  for (const { track, playedAt } of recent) {
    if (playedAt <= cursor) continue;
    const day = dateKey(new Date(playedAt));
    perDay[day] = (perDay[day] || 0) + (track.duration || 180000) / 60000;
    newest = Math.max(newest, playedAt);
  }
  Object.keys(perDay).forEach((d) => {
    perDay[d] = Math.round(perDay[d]);
  });
  return { perDay, cursor: newest ? new Date(newest).toISOString() : cursorIso || null };
}

export async function collectSpotifyData({ playlists = true } = {}) {
  const profile = await fetchSpotifyProfile();
  const [top, recent] = await Promise.all([fetchTopTracks(), fetchRecentlyPlayed().catch(() => [])]);
  const lists = playlists ? await fetchSpotifyPlaylists(profile.id).catch(() => []) : [];
  return { profile, top: buildTopList(top, recent), recent, playlists: lists };
}

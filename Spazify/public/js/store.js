// App state + every action that changes data. Views read `state` and call
// these functions; after a change, subscribers (the renderer) are notified.
import { CONFIG } from './config.js';
import { analyzeClass } from './lib/aggregate.js';
import { backendFor, remoteBackend, localBackend, resetDemo } from './lib/backend.js';
import { publicMember, LIMITS } from './lib/model.js';
import { trackKey } from './lib/normalize.js';
import { setMusicApiAvailable } from './lib/music.js';
import { storage, dateKey, uid } from './lib/util.js';

const SESSION_KEY = 'spazify.session.v1';
const OWNER_KEY = 'spazify.owners.v1';
const SNAP_KEY = 'spazify.chartsnap.v1';

export const state = {
  booted: false,
  apiAvailable: false,
  config: { spotifyClientId: null, apple: false, amazon: false, storage: null },
  session: null, // { code, backend: 'remote' | 'local', memberId, token, demo }
  data: null, // raw class data from the backend
  stats: null, // analyzeClass(data)
  me: null, // my full member document
  loading: false,
  loadError: null,
  lastLoadedAt: 0,
  dataVersion: 0,
};

const subscribers = new Set();
let scheduled = false;
export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}
export function notify() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    subscribers.forEach((fn) => fn(state));
  });
}

export function backend() {
  return backendFor(state.session);
}

// ---------------------------------------------------------------------------
// Boot + loading
// ---------------------------------------------------------------------------
export async function boot() {
  try {
    const health = await remoteBackend.health();
    state.apiAvailable = Boolean(health?.ok);
  } catch {
    state.apiAvailable = false;
  }
  setMusicApiAvailable(state.apiAvailable);
  if (state.apiAvailable) {
    try {
      const cfg = await remoteBackend.config();
      state.config = { ...state.config, ...cfg };
    } catch {
      /* keep defaults */
    }
  }
  if (!state.config.spotifyClientId && CONFIG.spotifyClientId) state.config.spotifyClientId = CONFIG.spotifyClientId;
  state.session = storage.get(SESSION_KEY, null);
  if (state.session && state.session.backend === 'remote' && !state.apiAvailable) {
    state.loadError = 'The class server is not reachable right now. Please check your internet connection.';
  }
  if (state.session) await loadClass().catch(() => {});
  state.booted = true;
  notify();
}

function setData(data) {
  state.data = data;
  state.stats = analyzeClass(data, { meId: state.session?.memberId, now: Date.now() });
  state.lastLoadedAt = Date.now();
  state.dataVersion++;
  notify();
}

function signature(data) {
  return `${data.class?.name}|${data.members?.length}|${data.members?.map((m) => m.updatedAt).join(',')}|${data.challenges?.map((c) => c.id + c.goal).join(',')}`;
}

export async function loadClass({ silent = false, fresh = !silent } = {}) {
  const s = state.session;
  if (!s) return;
  if (!silent) {
    state.loading = true;
    notify();
  }
  try {
    const be = backend();
    const [data, meRes] = await Promise.all([be.getClass(s.code, { fresh }), state.me ? Promise.resolve(null) : be.me(s.code, s.token)]);
    if (meRes) state.me = meRes.member;
    state.loadError = null;
    if (!silent || !state.data || signature(data) !== signature(state.data)) setData(mergeMe(data));
  } catch (err) {
    if (err.status === 401 || err.status === 404) {
      const message = err.status === 404 ? 'This class does not exist anymore.' : 'You are not a member of this class anymore.';
      clearSession();
      state.loadError = message;
    } else if (!silent) {
      state.loadError = err.message;
    }
  } finally {
    state.loading = false;
    notify();
  }
}

// Use my freshest local copy for my own entry (avoids flicker after saving).
function mergeMe(data) {
  if (!state.me || !data?.members) return data;
  const pub = publicMember(state.me);
  const exists = data.members.some((m) => m.id === pub.id);
  return { ...data, members: exists ? data.members.map((m) => (m.id === pub.id ? { ...m, ...pub } : m)) : [...data.members, pub] };
}

function applyMe(member) {
  state.me = member;
  if (state.data) setData(mergeMe(state.data));
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------
function saveSession(session) {
  state.session = session;
  storage.set(SESSION_KEY, session);
}

export function clearSession() {
  state.session = null;
  state.data = null;
  state.stats = null;
  state.me = null;
  storage.remove(SESSION_KEY);
}

export function signOut() {
  if (state.session?.demo) resetDemo();
  clearSession();
  notify();
}

export function isDemo() {
  return Boolean(state.session?.demo);
}

export function ownerTokenFor(code) {
  return storage.get(OWNER_KEY, {})[code] || null;
}

export function rememberOwnerToken(code, token) {
  const all = storage.get(OWNER_KEY, {});
  all[code] = token;
  storage.set(OWNER_KEY, all);
}

export function backendKindFor(code) {
  if (code === CONFIG.demoCode) return 'local';
  if (/^L[A-Z0-9]{5}$/.test(code) && storage.get('spazify.local.v1', { classes: {} }).classes?.[code]) return 'local';
  return state.apiAvailable ? 'remote' : 'local';
}

export async function previewClass(code) {
  const kind = backendKindFor(code);
  const data = await backendFor(kind).getClass(code, { fresh: true });
  return { data, kind };
}

export async function createClass(input) {
  const kind = state.apiAvailable ? 'remote' : 'local';
  const res = await backendFor(kind).createClass(input);
  rememberOwnerToken(res.class.code, res.ownerToken);
  return { ...res, kind };
}

export async function joinClass({ code, kind, member }) {
  const be = backendFor(kind);
  const res = await be.join(code, member, ownerTokenFor(code));
  saveSession({ code, backend: kind, memberId: res.member.id, token: res.token, demo: code === CONFIG.demoCode });
  state.me = res.member;
  state.data = null;
  await loadClass();
  return res.member;
}

export async function enterDemo() {
  resetDemo();
  // Show the confetti for completed demo challenges again (nice for presentations).
  const celebrated = storage.get('spazify.celebrated.v1', {});
  delete celebrated[CONFIG.demoCode];
  storage.set('spazify.celebrated.v1', celebrated);
  return joinClass({
    code: CONFIG.demoCode,
    kind: 'local',
    member: { name: 'You', avatar: { emoji: '😎', color: 290 }, provider: 'private', songs: [], listening: {} },
  });
}

export function personalKey() {
  const s = state.session;
  if (!s) return '';
  return `SPZ1.${s.backend === 'local' ? 'L' : 'R'}.${s.code}.${s.token}`;
}

export async function signInWithKey(key) {
  const m = String(key || '').trim().match(/^SPZ1\.([LR])\.([A-Z0-9]{4,12})\.(m_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/);
  if (!m) throw new Error('This does not look like a Spazify personal key.');
  const [, kindLetter, code, token] = m;
  const kind = kindLetter === 'L' ? 'local' : 'remote';
  if (kind === 'remote' && !state.apiAvailable) throw new Error('The class server is not reachable right now.');
  const be = backendFor(kind);
  const { member } = await be.me(code, token);
  saveSession({ code, backend: kind, memberId: member.id, token, demo: code === CONFIG.demoCode });
  state.me = member;
  state.data = null;
  await loadClass();
  return member;
}

// ---------------------------------------------------------------------------
// Changing my own data (optimistic, saved in the background, in order)
// ---------------------------------------------------------------------------
const WRITABLE = ['name', 'avatar', 'provider', 'topTracks', 'songs', 'likes', 'playlists', 'listening', 'shareListening', 'syncCursor', 'lastSyncAt'];
function writable(member) {
  const out = {};
  for (const k of WRITABLE) if (member[k] !== undefined) out[k] = member[k];
  return out;
}

let saveChain = Promise.resolve();
export function updateMe(mutate) {
  const s = state.session;
  if (!s || !state.me) return Promise.reject(new Error('Please join a class first.'));
  const before = state.me;
  const next = structuredClone(before);
  try {
    mutate(next);
  } catch (err) {
    return Promise.reject(err);
  }
  applyMe(next);
  const run = async () => {
    try {
      const { member } = await backend().updateMember(s.code, s.token, s.memberId, writable(next));
      if (state.session?.memberId === s.memberId) applyMe(member);
      return member;
    } catch (err) {
      if (state.session?.memberId === s.memberId) applyMe(before);
      throw err;
    }
  };
  saveChain = saveChain.then(run, run);
  return saveChain;
}

export function cleanTrackForSave(track) {
  const t = {
    title: track.title,
    artist: track.artist,
    album: track.album,
    cover: track.cover,
    url: track.url,
    preview: track.preview,
    duration: track.duration,
    genre: track.genre,
    id: track.id,
    source: track.source,
    explicit: track.explicit,
  };
  Object.keys(t).forEach((k) => t[k] === undefined && delete t[k]);
  t.key = trackKey(t.title, t.artist);
  return t;
}

export function hasSong(key) {
  return Boolean(state.me?.songs?.some((s) => s.key === key));
}

export function addSong(track, note = '') {
  const t = cleanTrackForSave(track);
  if (hasSong(t.key)) return Promise.resolve(state.me);
  if ((state.me?.songs?.length || 0) >= LIMITS.songs) return Promise.reject(new Error(`You can add up to ${LIMITS.songs} songs. Remove one first.`));
  return updateMe((m) => {
    m.songs = [{ ...t, note: String(note || '').trim().slice(0, LIMITS.note), addedAt: Date.now() }, ...(m.songs || [])];
  });
}

export function updateSongNote(key, note) {
  return updateMe((m) => {
    m.songs = (m.songs || []).map((s) => (s.key === key ? { ...s, note: String(note || '').trim().slice(0, LIMITS.note) } : s));
  });
}

export function removeSong(key) {
  return updateMe((m) => {
    m.songs = (m.songs || []).filter((s) => s.key !== key);
  });
}

export function toggleLike(key) {
  const liked = state.me?.likes?.includes(key);
  return updateMe((m) => {
    m.likes = liked ? (m.likes || []).filter((k) => k !== key) : [key, ...(m.likes || [])].slice(0, LIMITS.likes);
  });
}

export function logMinutes(minutes, day = dateKey()) {
  const add = Math.max(1, Math.min(600, Math.round(minutes)));
  return updateMe((m) => {
    m.listening = { ...(m.listening || {}) };
    const cur = m.listening[day] || { s: 0, m: 0 };
    const total = (cur.s || 0) + (cur.m || 0);
    const room = Math.max(0, 1440 - total);
    m.listening[day] = { s: cur.s || 0, m: (cur.m || 0) + Math.min(add, room) };
  });
}

export function setShareListening(value) {
  return updateMe((m) => {
    m.shareListening = Boolean(value);
  });
}

export function updateProfile({ name, avatar }) {
  return updateMe((m) => {
    if (name) m.name = name;
    if (avatar) m.avatar = avatar;
  });
}

// ---- mixtapes (playlists made inside Spazify) ----
export function createMixtape({ name, description = '', emoji = '🎶', color = 280 }) {
  const id = uid('mx_', 10);
  return updateMe((m) => {
    m.playlists = [
      ...(m.playlists || []),
      { id, name, description, emoji, color, source: 'spazify', tracks: [], trackCount: 0, createdAt: Date.now(), updatedAt: Date.now() },
    ];
  }).then(() => id);
}

export function updatePlaylist(id, fn) {
  return updateMe((m) => {
    m.playlists = (m.playlists || []).map((p) => {
      if (p.id !== id) return p;
      const next = { ...p, tracks: [...(p.tracks || [])] };
      fn(next);
      next.trackCount = next.tracks.length || next.trackCount || 0;
      next.updatedAt = Date.now();
      return next;
    });
  });
}

export function addToMixtape(id, track) {
  const t = cleanTrackForSave(track);
  return updatePlaylist(id, (p) => {
    if (p.tracks.some((x) => x.key === t.key)) return;
    if (p.tracks.length >= LIMITS.playlistTracks) throw new Error('This mixtape is full.');
    p.tracks.push(t);
  });
}

export function removeFromPlaylist(id, key) {
  return updatePlaylist(id, (p) => {
    p.tracks = p.tracks.filter((t) => t.key !== key);
  });
}

export function deletePlaylist(id) {
  return updateMe((m) => {
    m.playlists = (m.playlists || []).filter((p) => p.id !== id);
  });
}

// ---- challenges + class ----
export async function createChallenge(input) {
  const s = state.session;
  const { challenge } = await backend().createChallenge(s.code, s.token, input);
  await loadClass({ silent: true, fresh: true });
  return challenge;
}

export async function deleteChallenge(id) {
  const s = state.session;
  await backend().deleteChallenge(s.code, s.token, id);
  await loadClass({ silent: true, fresh: true });
}

export async function renameClass(input) {
  const s = state.session;
  await backend().renameClass(s.code, s.token, input);
  await loadClass({ silent: true, fresh: true });
}

export async function removeMember(id) {
  const s = state.session;
  await backend().removeMember(s.code, s.token, id);
  await loadClass({ silent: true, fresh: true });
}

export async function leaveClass() {
  const s = state.session;
  await backend().removeMember(s.code, s.token, s.memberId);
  signOut();
}

export async function getPlaylist(memberId, playlistId) {
  const s = state.session;
  if (memberId === s.memberId && state.me) {
    const p = state.me.playlists?.find((x) => x.id === playlistId);
    if (p) return { playlist: p, owner: state.me };
  }
  return backend().getPlaylist(s.code, memberId, playlistId);
}

// ---- chart movement (compares with the chart a day ago, per device) ----
export function previousRanks(currentRanks) {
  const code = state.session?.code;
  if (!code) return null;
  if (state.data?.prevRanks) return state.data.prevRanks;
  const all = storage.get(SNAP_KEY, {});
  const snap = all[code] || {};
  const today = dateKey();
  if (snap.cur?.day !== today) {
    snap.prev = snap.cur && Object.keys(snap.cur.ranks || {}).length ? snap.cur : snap.prev;
    snap.cur = { day: today, ranks: currentRanks };
  } else {
    snap.cur.ranks = currentRanks;
  }
  all[code] = snap;
  storage.set(SNAP_KEY, all);
  return snap.prev?.ranks || null;
}

export { localBackend };

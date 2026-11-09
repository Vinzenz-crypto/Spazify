// Shared data model (used by the browser AND the server function).
// Every value that comes from a browser is cleaned here, so the stored data
// always has the same, safe shape.
import { trackKey } from './normalize.js';

export const PROVIDERS = ['spotify', 'apple', 'amazon', 'private'];
export const TRACK_SOURCES = ['spotify', 'apple', 'itunes', 'manual', 'amazon', 'demo'];
export const PLAYLIST_SOURCES = ['spotify', 'apple', 'spazify'];
export const CHALLENGE_TYPES = ['minutes', 'songs', 'artists', 'members'];

export const LIMITS = {
  name: 32,
  className: 48,
  emoji: 16,
  title: 120,
  artist: 120,
  album: 120,
  url: 600,
  note: 280,
  topTracks: 30,
  songs: 60,
  likes: 300,
  playlists: 12,
  playlistTracks: 100,
  playlistName: 80,
  playlistDescription: 300,
  listeningDays: 400,
  minutesPerDay: 1440,
  membersPerClass: 80,
  challengesPerClass: 30,
  challengeTitle: 60,
  challengeDescription: 200,
};

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g;

export function cleanString(value, max, { multiline = false } = {}) {
  if (value === undefined || value === null) return '';
  let s = String(value);
  if (multiline) {
    s = s.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, '');
    s = s.replace(/\n{3,}/g, '\n\n');
  } else {
    s = s.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ');
  }
  s = s.trim();
  // Cut by code points so we never split an emoji in half.
  const chars = Array.from(s);
  return chars.length > max ? chars.slice(0, max).join('').trim() : s;
}

export function cleanInt(value, min, max, fallback = min) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function cleanUrl(value) {
  if (!value) return null;
  try {
    const u = new URL(String(value));
    if (u.protocol !== 'https:') return null;
    const s = u.toString();
    return s.length <= LIMITS.url ? s : null;
  } catch {
    return null;
  }
}

export function cleanId(value, max = 64) {
  const s = String(value ?? '').replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, max);
  return s || null;
}

export function cleanTimestamp(value, now) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < Date.UTC(2020, 0, 1) || n > now + 2 * 86400000) return null;
  return Math.round(n);
}

export function cleanEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function cleanTrack(input, now) {
  if (!input || typeof input !== 'object') return null;
  const title = cleanString(input.title, LIMITS.title);
  const artist = cleanString(input.artist, LIMITS.artist);
  if (!title || !artist) return null;
  const track = {
    key: trackKey(title, artist),
    title,
    artist,
  };
  const album = cleanString(input.album, LIMITS.album);
  if (album) track.album = album;
  const cover = cleanUrl(input.cover);
  if (cover) track.cover = cover;
  const url = cleanUrl(input.url);
  if (url) track.url = url;
  const preview = cleanUrl(input.preview);
  if (preview) track.preview = preview;
  const duration = cleanInt(input.duration, 0, 3600000, 0);
  if (duration) track.duration = duration;
  const genre = cleanString(input.genre, 40);
  if (genre) track.genre = genre;
  const id = cleanId(input.id);
  if (id) track.id = id;
  track.source = cleanEnum(input.source, TRACK_SOURCES, 'manual');
  if (input.explicit === true) track.explicit = true;
  if (input.plays !== undefined) {
    const plays = cleanInt(input.plays, 0, 999, 0);
    if (plays) track.plays = plays;
  }
  if (input.note !== undefined) {
    const note = cleanString(input.note, LIMITS.note, { multiline: true });
    if (note) track.note = note;
  }
  if (input.addedAt !== undefined) {
    const addedAt = cleanTimestamp(input.addedAt, now);
    if (addedAt) track.addedAt = addedAt;
  }
  return track;
}

function cleanTrackList(list, max, now, { unique = true } = {}) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (out.length >= max) break;
    const t = cleanTrack(item, now);
    if (!t) continue;
    if (unique) {
      if (seen.has(t.key)) continue;
      seen.add(t.key);
    }
    out.push(t);
  }
  return out;
}

export function cleanPlaylist(input, now) {
  if (!input || typeof input !== 'object') return null;
  const name = cleanString(input.name, LIMITS.playlistName);
  const id = cleanId(input.id);
  if (!name || !id) return null;
  const tracks = cleanTrackList(input.tracks, LIMITS.playlistTracks, now, { unique: false })
    .map(({ plays, addedAt, ...t }) => t);
  const playlist = {
    id,
    name,
    source: cleanEnum(input.source, PLAYLIST_SOURCES, 'spazify'),
    tracks,
    trackCount: cleanInt(input.trackCount ?? tracks.length, 0, 100000, tracks.length),
  };
  const description = cleanString(input.description, LIMITS.playlistDescription, { multiline: true });
  if (description) playlist.description = description;
  const cover = cleanUrl(input.cover);
  if (cover) playlist.cover = cover;
  const url = cleanUrl(input.url);
  if (url) playlist.url = url;
  const emoji = cleanString(input.emoji, LIMITS.emoji);
  if (emoji) playlist.emoji = emoji;
  if (input.color !== undefined) playlist.color = cleanInt(input.color, 0, 359, 260);
  playlist.createdAt = cleanTimestamp(input.createdAt, now) || now;
  playlist.updatedAt = cleanTimestamp(input.updatedAt, now) || now;
  return playlist;
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function cleanListening(input, now) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  const maxDate = new Date(now + 2 * 86400000).toISOString().slice(0, 10);
  const keys = Object.keys(input).filter((k) => DATE_KEY.test(k) && k >= '2020-01-01' && k <= maxDate).sort().slice(-LIMITS.listeningDays);
  for (const k of keys) {
    const v = input[k] || {};
    const s = cleanInt(v.s, 0, LIMITS.minutesPerDay, 0);
    const m = cleanInt(v.m, 0, LIMITS.minutesPerDay, 0);
    if (s || m) {
      // Nobody listens more than 24 hours a day.
      const total = s + m;
      out[k] = total > LIMITS.minutesPerDay ? { s: Math.min(s, LIMITS.minutesPerDay), m: Math.max(0, LIMITS.minutesPerDay - s) } : { s, m };
    }
  }
  return out;
}

export function cleanAvatar(input) {
  const emoji = cleanString(input?.emoji, LIMITS.emoji) || '🎧';
  return { emoji, color: cleanInt(input?.color, 0, 359, 265) };
}

export function cleanSyncCursor(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  if (typeof input.spotify === 'string') out.spotify = cleanString(input.spotify, 40);
  if (Array.isArray(input.apple)) out.apple = input.apple.slice(0, 30).map((x) => cleanId(x, 80)).filter(Boolean);
  return out;
}

// Cleans the part of a member document that the member is allowed to write.
export function cleanMemberInput(input, now) {
  if (!input || typeof input !== 'object') throw new HttpError(400, 'Missing member data.');
  const name = cleanString(input.name, LIMITS.name);
  if (!name) throw new HttpError(400, 'Please choose a name.');
  const likes = Array.isArray(input.likes)
    ? [...new Set(input.likes.map((k) => cleanString(k, 200)).filter((k) => k.includes('|')))].slice(0, LIMITS.likes)
    : [];
  const playlists = [];
  if (Array.isArray(input.playlists)) {
    const ids = new Set();
    for (const p of input.playlists) {
      if (playlists.length >= LIMITS.playlists) break;
      const clean = cleanPlaylist(p, now);
      if (clean && !ids.has(clean.id)) {
        ids.add(clean.id);
        playlists.push(clean);
      }
    }
  }
  return {
    name,
    avatar: cleanAvatar(input.avatar),
    provider: cleanEnum(input.provider, PROVIDERS, 'private'),
    topTracks: cleanTrackList(input.topTracks, LIMITS.topTracks, now).map(({ note, addedAt, ...t }) => t),
    songs: cleanTrackList(input.songs, LIMITS.songs, now).map((t) => ({ ...t, addedAt: t.addedAt || now })),
    likes,
    playlists,
    listening: cleanListening(input.listening, now),
    shareListening: input.shareListening !== false,
    syncCursor: cleanSyncCursor(input.syncCursor),
    lastSyncAt: cleanTimestamp(input.lastSyncAt, now),
  };
}

export function cleanChallengeInput(input, now) {
  if (!input || typeof input !== 'object') throw new HttpError(400, 'Missing challenge data.');
  const title = cleanString(input.title, LIMITS.challengeTitle);
  if (!title) throw new HttpError(400, 'Please give the challenge a title.');
  const type = cleanEnum(input.type, CHALLENGE_TYPES, null);
  if (!type) throw new HttpError(400, 'Unknown challenge type.');
  const startAt = cleanTimestamp(input.startAt, now + 400 * 86400000) || now;
  let endAt = cleanTimestamp(input.endAt, now + 400 * 86400000);
  if (!endAt || endAt <= startAt) endAt = startAt + 14 * 86400000;
  endAt = Math.min(endAt, startAt + 366 * 86400000);
  return {
    title,
    description: cleanString(input.description, LIMITS.challengeDescription, { multiline: true }),
    emoji: cleanString(input.emoji, LIMITS.emoji) || '🏆',
    type,
    goal: cleanInt(input.goal, 1, 100000, 10),
    startAt,
    endAt,
  };
}

export function cleanClassInput(input) {
  const name = cleanString(input?.name, LIMITS.className);
  if (!name) throw new HttpError(400, 'Please give your class a name.');
  return { name, emoji: cleanString(input?.emoji, LIMITS.emoji) || '🎧' };
}

const DAY_MS = 86400000;

// What other classmates may see of a member.
export function publicMember(m) {
  return {
    id: m.id,
    name: m.name,
    avatar: m.avatar,
    provider: m.provider,
    role: m.role || 'member',
    joinedAt: m.joinedAt,
    updatedAt: m.updatedAt,
    lastSyncAt: m.lastSyncAt || null,
    topTracks: m.topTracks || [],
    songs: m.songs || [],
    likes: m.likes || [],
    listening: m.shareListening === false ? {} : m.listening || {},
    shareListening: m.shareListening !== false,
    playlists: (m.playlists || []).map((p) => {
      const covers = [];
      for (const t of p.tracks || []) {
        if (t.cover && !covers.includes(t.cover)) covers.push(t.cover);
        if (covers.length === 4) break;
      }
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        cover: p.cover,
        covers,
        url: p.url,
        source: p.source,
        emoji: p.emoji,
        color: p.color,
        trackCount: (p.tracks || []).length || p.trackCount || 0,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        sample: (p.tracks || []).slice(0, 4).map((t) => ({ key: t.key, title: t.title, artist: t.artist, cover: t.cover })),
      };
    }),
  };
}

// What a member sees of their own document (everything except secrets).
export function ownMember(m) {
  return {
    ...publicMember(m),
    playlists: m.playlists || [],
    listening: m.listening || {},
    syncCursor: m.syncCursor || {},
  };
}

export const CHALLENGE_TEMPLATES = [
  {
    type: 'minutes',
    label: 'Listen together',
    emoji: '🎧',
    title: 'Class Marathon',
    goal: 50,
    days: 30,
    description: 'Listen to 50 hours of music together. Every minute counts!',
    help: 'Counts the listening time of everybody in the class (synced from Spotify / Apple Music or logged by hand).',
  },
  {
    type: 'songs',
    label: 'Collect songs',
    emoji: '💿',
    title: 'Mixtape Mania',
    goal: 30,
    days: 30,
    description: 'Everybody adds the songs they love. Can we collect 30 favourites together?',
    help: 'Counts the songs that classmates add by hand during the challenge.',
  },
  {
    type: 'artists',
    label: 'Discover artists',
    emoji: '🌍',
    title: 'Artist Explorers',
    goal: 25,
    days: 30,
    description: 'Discover 25 different artists as a class.',
    help: 'Counts all different artists in the class collection.',
  },
  {
    type: 'members',
    label: 'Get everyone on board',
    emoji: '🙋',
    title: 'Full House',
    goal: 20,
    days: 14,
    description: 'Get 20 classmates on board - share the class code!',
    help: 'Counts the classmates who joined before the end date.',
  },
];

export function defaultChallenges(now) {
  return CHALLENGE_TEMPLATES.map((t) => ({
    title: t.title,
    emoji: t.emoji,
    type: t.type,
    goal: t.goal,
    description: t.description,
    startAt: now,
    endAt: now + t.days * DAY_MS,
  }));
}

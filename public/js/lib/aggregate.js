// Turns the raw class data (one document per classmate) into everything the
// dashboard shows: the class charts, top artists, genres, listening time,
// challenge progress and the activity feed. Pure functions - no DOM.
import { artistKey, primaryArtist } from './normalize.js';
import { DAY, dateKey, lastDays } from './util.js';

// How a song collects points for the class charts (explained on the Charts page).
export const POINTS = {
  topTrack: (rank) => Math.max(1, 31 - rank), // a classmate's #1 song = 30 points, #30 = 1 point
  play: 2, // every recent play (max 10 per person and song)
  maxPlays: 10,
  added: 20, // a song somebody added by hand
  like: 5, // every heart from a classmate
};

const LINK_SOURCES = { spotify: 'spotify', apple: 'apple', itunes: 'apple', amazon: 'amazon' };

function mergeTrack(target, t) {
  for (const field of ['album', 'cover', 'preview', 'duration', 'genre', 'year']) {
    if (!target[field] && t[field]) target[field] = t[field];
  }
  const linkKey = LINK_SOURCES[t.source];
  if (linkKey && t.url) {
    target.links = target.links || {};
    if (!target.links[linkKey]) target.links[linkKey] = t.url;
  }
}

function newEntry(t) {
  const track = {
    key: t.key,
    title: t.title,
    artist: t.artist,
    source: t.source,
  };
  mergeTrack(track, t);
  return {
    key: t.key,
    track,
    score: 0,
    listeners: new Set(),
    likedBy: new Set(),
    plays: 0,
    adds: [],
    topRanks: [],
    firstSeen: Infinity,
  };
}

export function minutesOf(day) {
  return (day?.s || 0) + (day?.m || 0);
}

export function memberMinutes(member, fromKey = '0000-00-00', toKey = '9999-99-99') {
  let total = 0;
  for (const [k, v] of Object.entries(member.listening || {})) {
    if (k >= fromKey && k <= toKey) total += minutesOf(v);
  }
  return total;
}

export function buildSongChart(members) {
  const songs = new Map();
  const ensure = (t) => {
    let e = songs.get(t.key);
    if (!e) {
      e = newEntry(t);
      songs.set(t.key, e);
    } else {
      mergeTrack(e.track, t);
    }
    return e;
  };
  for (const m of members) {
    (m.topTracks || []).forEach((t, i) => {
      if (!t?.key) return;
      const e = ensure(t);
      const rank = i + 1;
      e.score += POINTS.topTrack(rank);
      const plays = Math.min(POINTS.maxPlays, t.plays || 0);
      e.plays += plays;
      e.score += plays * POINTS.play;
      e.listeners.add(m.id);
      e.topRanks.push({ memberId: m.id, rank });
      e.firstSeen = Math.min(e.firstSeen, m.lastSyncAt || m.joinedAt || Infinity);
    });
    for (const t of m.songs || []) {
      if (!t?.key) continue;
      const e = ensure(t);
      e.score += POINTS.added;
      e.listeners.add(m.id);
      e.adds.push({ memberId: m.id, note: t.note || '', addedAt: t.addedAt || m.joinedAt });
      e.firstSeen = Math.min(e.firstSeen, t.addedAt || m.joinedAt || Infinity);
    }
  }
  for (const m of members) {
    for (const key of m.likes || []) {
      const e = songs.get(key);
      if (e && !e.likedBy.has(m.id)) {
        e.likedBy.add(m.id);
        e.score += POINTS.like;
      }
    }
  }
  const chart = [...songs.values()].sort(
    (a, b) => b.score - a.score || b.listeners.size - a.listeners.size || a.track.title.localeCompare(b.track.title),
  );
  chart.forEach((e, i) => {
    e.rank = i + 1;
    e.adds.sort((a, b) => b.addedAt - a.addedAt);
  });
  return chart;
}

export function buildArtists(chart) {
  const artists = new Map();
  for (const e of chart) {
    const key = artistKey(e.track.artist);
    if (!key) continue;
    let a = artists.get(key);
    if (!a) {
      a = { key, name: primaryArtist(e.track.artist), score: 0, listeners: new Set(), songs: [], cover: null };
      artists.set(key, a);
    }
    a.score += e.score;
    e.listeners.forEach((id) => a.listeners.add(id));
    a.songs.push(e);
    if (!a.cover && e.track.cover) a.cover = e.track.cover;
  }
  const list = [...artists.values()].sort((a, b) => b.score - a.score || b.listeners.size - a.listeners.size);
  list.forEach((a, i) => {
    a.rank = i + 1;
    a.topSong = a.songs[0];
  });
  return list;
}

export function buildGenres(chart) {
  const genres = new Map();
  for (const e of chart) {
    const g = e.track.genre;
    if (!g) continue;
    const entry = genres.get(g) || { name: g, songs: 0, score: 0 };
    entry.songs += 1;
    entry.score += e.score;
    genres.set(g, entry);
  }
  return [...genres.values()].sort((a, b) => b.score - a.score);
}

export function challengeProgress(ch, members, now = Date.now()) {
  const fromKey = dateKey(new Date(ch.startAt));
  const toKey = dateKey(new Date(ch.endAt));
  const contributions = new Map();
  let value = 0;
  if (ch.type === 'minutes') {
    for (const m of members) {
      const minutes = memberMinutes(m, fromKey, toKey);
      if (minutes) contributions.set(m.id, minutes);
      value += minutes;
    }
    value = value / 60; // goal is in hours
  } else if (ch.type === 'songs') {
    for (const m of members) {
      const n = (m.songs || []).filter((s) => (s.addedAt || 0) >= ch.startAt && (s.addedAt || 0) <= ch.endAt).length;
      if (n) contributions.set(m.id, n);
      value += n;
    }
  } else if (ch.type === 'artists') {
    const seen = new Set();
    const ordered = [...members].sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
    for (const m of ordered) {
      for (const t of [...(m.topTracks || []), ...(m.songs || [])]) {
        const k = artistKey(t.artist);
        if (k && !seen.has(k)) {
          seen.add(k);
          contributions.set(m.id, (contributions.get(m.id) || 0) + 1);
        }
      }
    }
    value = seen.size;
  } else if (ch.type === 'members') {
    value = members.filter((m) => (m.joinedAt || 0) <= ch.endAt).length;
  }
  const goal = Math.max(1, ch.goal || 1);
  const pct = Math.min(1, value / goal);
  let status = 'active';
  if (value >= goal) status = 'completed';
  else if (now > ch.endAt) status = 'ended';
  else if (now < ch.startAt) status = 'upcoming';
  const contributors = [...contributions.entries()]
    .map(([memberId, amount]) => ({ memberId, amount }))
    .sort((a, b) => b.amount - a.amount);
  return { ...ch, value, goal, pct, status, contributors };
}

export const CHALLENGE_UNITS = {
  minutes: { unit: 'h', label: 'hours listened', verb: 'Listen' },
  songs: { unit: 'songs', label: 'songs added', verb: 'Add' },
  artists: { unit: 'artists', label: 'different artists', verb: 'Discover' },
  members: { unit: 'classmates', label: 'classmates joined', verb: 'Invite' },
};

function buildActivity(members, challenges) {
  const events = [];
  for (const m of members) {
    if (m.joinedAt) events.push({ type: 'join', memberId: m.id, at: m.joinedAt });
    for (const s of m.songs || []) events.push({ type: 'add', memberId: m.id, at: s.addedAt || m.joinedAt, track: s, note: s.note });
    for (const p of m.playlists || []) {
      if (p.source === 'spazify') events.push({ type: 'mixtape', memberId: m.id, at: p.createdAt, playlist: p });
      else events.push({ type: 'playlist', memberId: m.id, at: p.createdAt || m.joinedAt, playlist: p });
    }
    if (m.lastSyncAt && m.provider !== 'private') events.push({ type: 'sync', memberId: m.id, at: m.lastSyncAt, provider: m.provider });
  }
  for (const c of challenges) {
    if (c.createdBy) events.push({ type: 'challenge', memberId: c.createdBy, at: c.createdAt, challenge: c });
  }
  return events.filter((e) => e.at).sort((a, b) => b.at - a.at);
}

// Music taste match between two classmates (0-100), based on shared artists and songs.
export function tasteMatch(a, b) {
  if (!a || !b) return 0;
  const artistsOf = (m) => new Set([...(m.topTracks || []), ...(m.songs || [])].map((t) => artistKey(t.artist)).filter(Boolean));
  const songsOf = (m) => new Set([...(m.topTracks || []), ...(m.songs || [])].map((t) => t.key));
  const A = artistsOf(a);
  const B = artistsOf(b);
  if (!A.size || !B.size) return 0;
  let shared = 0;
  A.forEach((x) => B.has(x) && shared++);
  const SA = songsOf(a);
  const SB = songsOf(b);
  let sharedSongs = 0;
  SA.forEach((x) => SB.has(x) && sharedSongs++);
  const artistScore = shared / Math.min(A.size, B.size);
  const songScore = sharedSongs / Math.max(1, Math.min(SA.size, SB.size));
  return Math.round(Math.min(1, artistScore * 0.65 + songScore * 0.6) * 100);
}

export function analyzeClass(data, { meId = null, now = Date.now() } = {}) {
  const members = data?.members || [];
  const challenges = data?.challenges || [];
  const chart = buildSongChart(members);
  const artists = buildArtists(chart);
  const genres = buildGenres(chart);

  const days14 = lastDays(14, now);
  const todayKey = days14[days14.length - 1];
  const weekStart = days14[7];
  const prevWeekStart = days14[0];
  const prevWeekEnd = days14[6];
  const monthStart = dateKey(new Date(now - 29 * DAY));

  const byDay = days14.map((key) => ({ key, minutes: 0 }));
  const dayIndex = new Map(byDay.map((d, i) => [d.key, i]));
  const providers = { spotify: 0, apple: 0, amazon: 0, private: 0 };
  let minutesTotal = 0;
  let minutesWeek = 0;
  let minutesPrevWeek = 0;
  let minutesMonth = 0;
  let songsAdded = 0;
  let playlists = 0;
  const memberStats = new Map();

  for (const m of members) {
    providers[m.provider] = (providers[m.provider] || 0) + 1;
    let total = 0;
    let week = 0;
    let today = 0;
    for (const [k, v] of Object.entries(m.listening || {})) {
      const min = minutesOf(v);
      total += min;
      if (k >= weekStart) week += min;
      if (k >= prevWeekStart && k <= prevWeekEnd) minutesPrevWeek += min;
      if (k >= monthStart) minutesMonth += min;
      if (k === todayKey) today += min;
      const idx = dayIndex.get(k);
      if (idx !== undefined) byDay[idx].minutes += min;
    }
    minutesTotal += total;
    minutesWeek += week;
    songsAdded += (m.songs || []).length;
    playlists += (m.playlists || []).length;
    const top = (m.topTracks || [])[0] || (m.songs || [])[0] || null;
    memberStats.set(m.id, {
      minutesTotal: total,
      minutesWeek: week,
      minutesToday: today,
      songsAdded: (m.songs || []).length,
      topSong: top,
      artists: new Set([...(m.topTracks || []), ...(m.songs || [])].map((t) => artistKey(t.artist))).size,
    });
  }

  const challengeList = challenges
    .map((c) => challengeProgress(c, members, now))
    .sort((a, b) => {
      const order = { active: 0, upcoming: 1, completed: 2, ended: 3 };
      return order[a.status] - order[b.status] || a.endAt - b.endAt;
    });

  const membersById = new Map(members.map((m) => [m.id, m]));
  const me = meId ? membersById.get(meId) || null : null;

  return {
    members,
    membersById,
    me,
    chart,
    chartByKey: new Map(chart.map((e) => [e.key, e])),
    artists,
    genres,
    challenges: challengeList,
    activity: buildActivity(members, challenges),
    memberStats,
    totals: {
      members: members.length,
      songs: chart.length,
      artists: artists.length,
      songsAdded,
      playlists,
      minutesTotal,
      minutesWeek,
      minutesPrevWeek,
      minutesMonth,
      providers,
    },
    byDay,
  };
}

// Compare today's chart with an older snapshot to show ▲ ▼ and NEW markers.
export function rankMovement(chart, previousRanks) {
  const moves = new Map();
  if (!previousRanks) return moves;
  for (const e of chart) {
    const before = previousRanks[e.key];
    if (!before) moves.set(e.key, { type: 'new' });
    else if (before > e.rank) moves.set(e.key, { type: 'up', by: before - e.rank });
    else if (before < e.rank) moves.set(e.key, { type: 'down', by: e.rank - before });
    else moves.set(e.key, { type: 'same' });
  }
  return moves;
}

export function ranksOf(chart, limit = 100) {
  const out = {};
  chart.slice(0, limit).forEach((e) => {
    out[e.key] = e.rank;
  });
  return out;
}

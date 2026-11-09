// Talks to the server (Netlify Function). If the site runs without server
// functions (e.g. a drag & drop deploy) or for the demo class, the "local"
// backend stores everything in this browser instead - with the same interface.
import { CONFIG } from '../config.js';
import { storage, uid } from './util.js';
import { cleanChallengeInput, cleanClassInput, cleanMemberInput, defaultChallenges, ownMember, publicMember, HttpError } from './model.js';
import { buildDemoClass } from './demo.js';

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status;
  }
}

async function request(method, path, { body, token, timeout = 15000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const headers = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
      cache: 'no-store',
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!res.ok) throw new ApiError(data?.error || `The server answered with an error (${res.status}).`, res.status);
    if (data === null) throw new ApiError('The server sent an unexpected answer.', res.status);
    return data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err.name === 'AbortError') throw new ApiError('The server took too long to answer. Please check your internet connection.');
    throw new ApiError('Could not reach the server. Please check your internet connection.');
  } finally {
    clearTimeout(timer);
  }
}

const enc = encodeURIComponent;

export const remoteBackend = {
  kind: 'remote',
  health: () => request('GET', '/health', { timeout: 6000 }),
  config: () => request('GET', '/config', { timeout: 6000 }),
  createClass: (input) => request('POST', '/classes', { body: input }),
  getClass: (code, { fresh = false } = {}) => request('GET', `/classes/${enc(code)}${fresh ? `?fresh=${Date.now()}` : ''}`),
  join: (code, member, ownerToken) => request('POST', `/classes/${enc(code)}/members`, { body: { member, ownerToken } }),
  me: (code, token) => request('GET', `/classes/${enc(code)}/me`, { token }),
  updateMember: (code, token, id, member) => request('PUT', `/classes/${enc(code)}/members/${enc(id)}`, { body: { member }, token }),
  removeMember: (code, token, id) => request('DELETE', `/classes/${enc(code)}/members/${enc(id)}`, { token }),
  getPlaylist: (code, memberId, playlistId) => request('GET', `/classes/${enc(code)}/members/${enc(memberId)}/playlists/${enc(playlistId)}`),
  createChallenge: (code, token, challenge) => request('POST', `/classes/${enc(code)}/challenges`, { body: { challenge }, token }),
  deleteChallenge: (code, token, id) => request('DELETE', `/classes/${enc(code)}/challenges/${enc(id)}`, { token }),
  renameClass: (code, token, input) => request('PATCH', `/classes/${enc(code)}`, { body: input, token }),
};

// ---------------------------------------------------------------------------
// Local backend: same API, stored in localStorage (only on this device).
// ---------------------------------------------------------------------------
const LOCAL_KEY = 'spazify.local.v1';
const DEMO_KEY = 'spazify.demo.v1';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function localCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return `L${[...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')}`;
}

function wrap(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) throw new ApiError(err.message, err.status);
      throw err;
    }
  };
}

function loadDb() {
  return storage.get(LOCAL_KEY, { classes: {} });
}

function saveDb(db) {
  if (!storage.set(LOCAL_KEY, db)) throw new ApiError('Your browser does not allow saving data (private mode or storage full).');
}

function loadDemo() {
  return storage.get(DEMO_KEY, { members: {}, challenges: {}, removed: [] });
}

function saveDemo(demo) {
  if (!storage.set(DEMO_KEY, demo)) throw new ApiError('Your browser does not allow saving data (private mode or storage full).');
}

const isDemo = (code) => code === CONFIG.demoCode;

// Returns a "table" object for a code, plus a save() function.
function openClass(code) {
  if (isDemo(code)) {
    const demo = loadDemo();
    return {
      demo: true,
      members: demo.members,
      challenges: demo.challenges,
      removed: demo.removed || [],
      info: { code, name: 'English 10b', emoji: '🇬🇧' },
      save: () => saveDemo(demo),
      raw: demo,
    };
  }
  const db = loadDb();
  const cls = db.classes[code];
  if (!cls) throw new ApiError('This class code does not exist on this device.', 404);
  return { demo: false, members: cls.members, challenges: cls.challenges, info: cls.info, save: () => saveDb(db), raw: cls };
}

function checkToken(table, token) {
  const id = String(token || '').split('.')[0];
  const member = table.members[id];
  if (!member || member.token !== token) throw new ApiError('Your personal key is not valid for this class.', 401);
  return member;
}

function stripSecret(m) {
  const { token, ...rest } = m;
  return rest;
}

export const localBackend = {
  kind: 'local',
  health: async () => ({ ok: true, storage: 'browser' }),
  config: async () => ({ spotifyClientId: null, apple: false, amazon: false, storage: 'browser' }),

  createClass: wrap(async (input) => {
    const clean = cleanClassInput(input);
    const db = loadDb();
    const now = Date.now();
    let code = localCode();
    while (db.classes[code]) code = localCode();
    const ownerToken = uid('own_', 20);
    const challenges = {};
    defaultChallenges(now).forEach((c, i) => {
      const id = `c_${uid('', 8)}${i}`;
      challenges[id] = { id, ...c, createdBy: null, createdAt: now + i };
    });
    db.classes[code] = { info: { code, ...clean, createdAt: now, ownerToken }, members: {}, challenges };
    saveDb(db);
    return { class: { code, ...clean, createdAt: now }, ownerToken };
  }),

  getClass: wrap(async (code) => {
    const now = Date.now();
    if (isDemo(code)) {
      const base = buildDemoClass(now);
      const demo = loadDemo();
      const removed = new Set(demo.removed || []);
      return {
        ...base,
        members: [...base.members, ...Object.values(demo.members).map((m) => publicMember(stripSecret(m)))],
        challenges: [...base.challenges, ...Object.values(demo.challenges)].filter((c) => !removed.has(c.id)),
      };
    }
    const table = openClass(code);
    const members = Object.values(table.members).map((m) => publicMember(stripSecret(m))).sort((a, b) => a.joinedAt - b.joinedAt);
    const challenges = Object.values(table.challenges).sort((a, b) => a.createdAt - b.createdAt);
    const { ownerToken, ...info } = table.info;
    return { class: info, members, challenges, local: true, serverTime: now };
  }),

  join: wrap(async (code, memberInput, ownerToken) => {
    const table = openClass(code);
    const now = Date.now();
    const clean = cleanMemberInput(memberInput, now);
    const id = `m_${uid('', 12)}`;
    const token = `${id}.${uid('', 24)}`;
    const isOwner = !table.demo && ownerToken && ownerToken === table.info.ownerToken;
    const member = { id, ...clean, role: isOwner ? 'owner' : 'member', joinedAt: now, updatedAt: now, token };
    table.members[id] = member;
    table.save();
    return { member: ownMember(stripSecret(member)), token };
  }),

  me: wrap(async (code, token) => {
    const table = openClass(code);
    return { member: ownMember(stripSecret(checkToken(table, token))) };
  }),

  updateMember: wrap(async (code, token, id, memberInput) => {
    const table = openClass(code);
    const me = checkToken(table, token);
    if (me.id !== id) throw new ApiError('You can only change your own profile.', 403);
    const next = { ...me, ...cleanMemberInput(memberInput, Date.now()), updatedAt: Date.now() };
    table.members[id] = next;
    table.save();
    return { member: ownMember(stripSecret(next)) };
  }),

  removeMember: wrap(async (code, token, id) => {
    const table = openClass(code);
    const me = checkToken(table, token);
    if (me.id !== id && me.role !== 'owner') throw new ApiError('You can only remove yourself.', 403);
    delete table.members[id];
    table.save();
    return { ok: true };
  }),

  getPlaylist: wrap(async (code, memberId, playlistId) => {
    let owner;
    if (isDemo(code)) {
      owner = buildDemoClass(Date.now()).members.find((m) => m.id === memberId) || loadDemo().members[memberId];
    } else {
      owner = openClass(code).members[memberId];
    }
    const playlist = owner?.playlists?.find((p) => p.id === playlistId);
    if (!playlist) throw new ApiError('This playlist does not exist (anymore).', 404);
    return { playlist, owner: { id: owner.id, name: owner.name, avatar: owner.avatar, provider: owner.provider } };
  }),

  createChallenge: wrap(async (code, token, input) => {
    const table = openClass(code);
    const me = checkToken(table, token);
    const now = Date.now();
    const challenge = { id: `c_${uid('', 10)}`, ...cleanChallengeInput(input, now), createdBy: me.id, createdAt: now };
    table.challenges[challenge.id] = challenge;
    table.save();
    return { challenge };
  }),

  deleteChallenge: wrap(async (code, token, id) => {
    const table = openClass(code);
    const me = checkToken(table, token);
    const challenge = table.challenges[id];
    if (challenge) {
      if (challenge.createdBy !== me.id && me.role !== 'owner') throw new ApiError('Only the person who created this challenge can delete it.', 403);
      delete table.challenges[id];
    } else if (table.demo) {
      // A built-in demo challenge: hide it on this device.
      table.raw.removed = [...new Set([...(table.raw.removed || []), id])];
    }
    table.save();
    return { ok: true };
  }),

  renameClass: wrap(async (code, token, input) => {
    const table = openClass(code);
    const me = checkToken(table, token);
    if (me.role !== 'owner') throw new ApiError('Only the class owner can change the class.', 403);
    Object.assign(table.info, cleanClassInput(input));
    table.save();
    const { ownerToken, ...info } = table.info;
    return { class: info };
  }),
};

export function resetDemo() {
  storage.remove(DEMO_KEY);
}

export function backendFor(sessionOrKind) {
  const kind = typeof sessionOrKind === 'string' ? sessionOrKind : sessionOrKind?.backend;
  return kind === 'local' ? localBackend : remoteBackend;
}

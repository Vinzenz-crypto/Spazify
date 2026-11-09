// The Spazify API. It is a plain function (Request -> Response), so the same code
// runs as a Netlify Function in production and in scripts/dev.mjs locally.
//
// Storage layout (key -> JSON):
//   class/<CODE>/info                 class name, emoji, owner key hash
//   class/<CODE>/member/<ID>          one document per classmate (only they can change it)
//   class/<CODE>/challenge/<ID>       group challenges
//   art/<HASH>                        cached cover art / preview lookups
import crypto from 'node:crypto';
import {
  HttpError,
  LIMITS,
  cleanChallengeInput,
  cleanClassInput,
  cleanId,
  cleanMemberInput,
  cleanString,
  cleanTrack,
  defaultChallenges,
  ownMember as ownMemberView,
  publicMember,
} from '../public/js/lib/model.js';
import { itunesSearch, pickBestMatch } from './itunes.mjs';
import { appleConfigured, appleDeveloperToken } from './apple-token.mjs';

export const API_VERSION = '1.0.0';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DAY = 86400000;
const MAX_BODY = 512 * 1024;

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const randomToken = (bytes = 24) => crypto.randomBytes(bytes).toString('base64url');

function randomCode(len = 6) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

function memberId() {
  return `m_${randomToken(9)}`;
}

function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

async function readJson(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_BODY) throw new HttpError(413, 'That is too much data at once.');
  const text = await request.text();
  if (text.length > MAX_BODY) throw new HttpError(413, 'That is too much data at once.');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'The request was not valid JSON.');
  }
}

function normalizeCode(code) {
  const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c.length < 4 || c.length > 12) throw new HttpError(404, 'This class code does not exist.');
  return c;
}

function ownMember(m) {
  return ownMemberView(m);
}

function publicClass(info) {
  return { code: info.code, name: info.name, emoji: info.emoji, createdAt: info.createdAt };
}

export function createApi({ store, env = {}, fetch: fetchImpl = globalThis.fetch, now: clock = () => Date.now() }) {
  const keys = {
    info: (code) => `class/${code}/info`,
    member: (code, id) => `class/${code}/member/${id}`,
    members: (code) => `class/${code}/member/`,
    challenge: (code, id) => `class/${code}/challenge/${id}`,
    challenges: (code) => `class/${code}/challenge/`,
    art: (key) => `art/${sha256(key).slice(0, 40)}`,
  };

  async function loadClass(code) {
    const info = await store.get(keys.info(code));
    if (!info) throw new HttpError(404, 'This class code does not exist.');
    return info;
  }

  async function listDocs(prefix) {
    const list = await store.list(prefix);
    const docs = await Promise.all(list.map((k) => store.get(k)));
    return docs.filter(Boolean);
  }

  async function authenticate(request, code) {
    const header = request.headers.get('authorization') || '';
    const match = header.match(/^Bearer\s+(m_[A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/);
    if (!match) throw new HttpError(401, 'Please join the class first.');
    const [, id, secret] = match;
    const member = await store.get(keys.member(code, id));
    if (!member || !safeEqualHex(member.secretHash, sha256(secret))) {
      throw new HttpError(401, 'Your personal key is not valid for this class.');
    }
    return member;
  }

  // ---- route handlers ----

  async function getConfig() {
    return json({
      spotifyClientId: env.SPOTIFY_CLIENT_ID ? String(env.SPOTIFY_CLIENT_ID).trim() : null,
      apple: appleConfigured(env),
      amazon: false,
      storage: store.kind,
      version: API_VERSION,
    });
  }

  async function getAppleToken() {
    if (!appleConfigured(env)) throw new HttpError(404, 'Apple Music is not set up on this site.');
    try {
      const { token, exp } = appleDeveloperToken(env, clock());
      return json({ token, expiresAt: exp * 1000 });
    } catch (err) {
      console.error('Apple token error', err);
      throw new HttpError(500, 'The Apple Music key on the server is not valid.');
    }
  }

  async function search(url) {
    const term = cleanString(url.searchParams.get('term'), 120);
    if (!term) return json({ results: [] });
    const limit = Math.min(30, Math.max(1, Number(url.searchParams.get('limit')) || 20));
    const country = String(url.searchParams.get('country') || 'US').toUpperCase();
    const results = await itunesSearch(fetchImpl, term, { limit, country });
    return json({ results }, 200, {
      'cache-control': 'public, max-age=600',
      'netlify-cdn-cache-control': 'public, durable, s-maxage=86400, stale-while-revalidate=604800',
    });
  }

  // Finds cover art + previews for songs that don't have them yet (e.g. songs added
  // by hand). Results are cached for everybody, so iTunes is asked only once per song.
  async function lookup(request) {
    const body = await readJson(request);
    const country = String(body.country || 'US').toUpperCase();
    const items = (Array.isArray(body.items) ? body.items : [])
      .slice(0, 60)
      .map((it) => ({ key: cleanString(it?.key, 200), title: cleanString(it?.title, 120), artist: cleanString(it?.artist, 120) }))
      .filter((it) => it.key && it.title && it.artist);
    const now = clock();
    const cached = await Promise.all(items.map((it) => store.get(keys.art(it.key)).catch(() => null)));
    const found = {};
    const missing = [];
    const misses = [];
    items.forEach((it, i) => {
      const c = cached[i];
      if (c && c.hit) found[it.key] = c.hit;
      else if (c && !c.hit && now - c.at < 7 * DAY) missing.push(it.key);
      else misses.push(it);
    });
    // iTunes allows only ~20 searches per minute, so we look up a few songs per call.
    const batch = misses.slice(0, 3);
    const pending = misses.slice(3).map((it) => it.key);
    await Promise.all(
      batch.map(async (it) => {
        try {
          const results = await itunesSearch(fetchImpl, `${it.title} ${it.artist}`, { limit: 10, country });
          const best = pickBestMatch(results, it.title, it.artist);
          const hit = best
            ? { cover: best.cover, preview: best.preview, url: best.url, album: best.album, genre: best.genre, duration: best.duration }
            : null;
          await store.set(keys.art(it.key), { hit, at: now });
          if (hit) found[it.key] = hit;
          else missing.push(it.key);
        } catch {
          pending.push(it.key);
        }
      }),
    );
    return json({ found, missing, pending });
  }

  async function createClass(request) {
    const body = await readJson(request);
    const input = cleanClassInput(body);
    const now = clock();
    const ownerToken = randomToken(18);
    let info = null;
    for (let attempt = 0; attempt < 8 && !info; attempt++) {
      const code = randomCode(6);
      const candidate = { code, ...input, createdAt: now, updatedAt: now, ownerHash: sha256(ownerToken) };
      if (await store.create(keys.info(code), candidate)) info = candidate;
    }
    if (!info) throw new HttpError(503, 'Could not create a class right now. Please try again.');
    const challenges = defaultChallenges(now);
    await Promise.all(
      challenges.map((c, i) => {
        const id = `c_${randomToken(6)}${i}`;
        return store.set(keys.challenge(info.code, id), { id, ...c, createdBy: null, createdAt: now + i });
      }),
    );
    return json({ class: publicClass(info), ownerToken }, 201);
  }

  async function getClass(code, url) {
    const info = await loadClass(code);
    const [members, challenges] = await Promise.all([listDocs(keys.members(code)), listDocs(keys.challenges(code))]);
    members.sort((a, b) => a.joinedAt - b.joinedAt);
    challenges.sort((a, b) => a.createdAt - b.createdAt);
    // Polling requests may be served from Netlify's CDN for a few seconds, so a
    // whole class refreshing the page costs only a few function calls.
    // "?fresh=..." (sent right after your own changes) always skips the cache.
    const cacheHeaders = url.searchParams.has('fresh')
      ? {}
      : {
          'cache-control': 'public, max-age=0, must-revalidate',
          'netlify-cdn-cache-control': 'public, s-maxage=15, stale-while-revalidate=45',
          'netlify-vary': 'query',
        };
    return json({ class: publicClass(info), members: members.map(publicMember), challenges, serverTime: clock() }, 200, cacheHeaders);
  }

  async function updateClass(request, code) {
    const info = await loadClass(code);
    const me = await authenticate(request, code);
    if (me.role !== 'owner') throw new HttpError(403, 'Only the class owner can change the class.');
    const input = cleanClassInput(await readJson(request));
    const next = { ...info, ...input, updatedAt: clock() };
    await store.set(keys.info(code), next);
    return json({ class: publicClass(next) });
  }

  async function join(request, code) {
    const info = await loadClass(code);
    const body = await readJson(request);
    const now = clock();
    const existing = await store.list(keys.members(code));
    if (existing.length >= LIMITS.membersPerClass) throw new HttpError(409, 'This class is full.');
    const input = cleanMemberInput(body.member, now);
    const secret = randomToken(24);
    const isOwner = typeof body.ownerToken === 'string' && safeEqualHex(info.ownerHash, sha256(body.ownerToken));
    const member = {
      id: memberId(),
      ...input,
      role: isOwner ? 'owner' : 'member',
      joinedAt: now,
      updatedAt: now,
      secretHash: sha256(secret),
    };
    await store.set(keys.member(code, member.id), member);
    return json({ member: ownMember(member), token: `${member.id}.${secret}` }, 201);
  }

  async function getMe(request, code) {
    await loadClass(code);
    const me = await authenticate(request, code);
    return json({ member: ownMember(me) });
  }

  async function updateMember(request, code, id) {
    await loadClass(code);
    const me = await authenticate(request, code);
    if (me.id !== id) throw new HttpError(403, 'You can only change your own profile.');
    const body = await readJson(request);
    const input = cleanMemberInput(body.member, clock());
    const next = { ...me, ...input, updatedAt: clock() };
    await store.set(keys.member(code, id), next);
    return json({ member: ownMember(next) });
  }

  async function removeMember(request, code, id) {
    await loadClass(code);
    const me = await authenticate(request, code);
    if (me.id !== id && me.role !== 'owner') throw new HttpError(403, 'You can only remove yourself.');
    await store.delete(keys.member(code, id));
    return json({ ok: true });
  }

  async function getPlaylist(code, id, pid) {
    await loadClass(code);
    const member = await store.get(keys.member(code, id));
    const playlist = member?.playlists?.find((p) => p.id === pid);
    if (!playlist) throw new HttpError(404, 'This playlist does not exist (anymore).');
    return json({ playlist, owner: { id: member.id, name: member.name, avatar: member.avatar, provider: member.provider } });
  }

  async function createChallenge(request, code) {
    await loadClass(code);
    const me = await authenticate(request, code);
    const existing = await store.list(keys.challenges(code));
    if (existing.length >= LIMITS.challengesPerClass) throw new HttpError(409, 'This class already has a lot of challenges. Delete an old one first.');
    const now = clock();
    const input = cleanChallengeInput((await readJson(request)).challenge, now);
    const challenge = { id: `c_${randomToken(8)}`, ...input, createdBy: me.id, createdAt: now };
    await store.set(keys.challenge(code, challenge.id), challenge);
    return json({ challenge }, 201);
  }

  async function deleteChallenge(request, code, cid) {
    await loadClass(code);
    const me = await authenticate(request, code);
    const challenge = await store.get(keys.challenge(code, cid));
    if (!challenge) return json({ ok: true });
    if (challenge.createdBy !== me.id && me.role !== 'owner') {
      throw new HttpError(403, 'Only the person who created this challenge (or the class owner) can delete it.');
    }
    await store.delete(keys.challenge(code, cid));
    return json({ ok: true });
  }

  async function route(request) {
    const url = new URL(request.url);
    const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    const method = request.method.toUpperCase();
    const [first, codeRaw, sub, subId, sub2, sub2Id] = parts;

    if (method === 'GET' && first === 'health') return json({ ok: true, version: API_VERSION, storage: store.kind, time: clock() });
    if (method === 'GET' && first === 'config') return getConfig();
    if (method === 'GET' && first === 'apple-token') return getAppleToken();
    if (method === 'GET' && first === 'search') return search(url);
    if (method === 'POST' && first === 'lookup') return lookup(request);

    if (first === 'classes') {
      if (!codeRaw) {
        if (method === 'POST') return createClass(request);
        throw new HttpError(405, 'Method not allowed.');
      }
      const code = normalizeCode(codeRaw);
      if (!sub) {
        if (method === 'GET') return getClass(code, url);
        if (method === 'PATCH') return updateClass(request, code);
      }
      if (sub === 'me' && !subId && method === 'GET') return getMe(request, code);
      if (sub === 'members') {
        if (!subId && method === 'POST') return join(request, code);
        const id = cleanId(subId);
        if (id && !sub2) {
          if (method === 'PUT') return updateMember(request, code, id);
          if (method === 'DELETE') return removeMember(request, code, id);
        }
        if (id && sub2 === 'playlists' && sub2Id && method === 'GET') return getPlaylist(code, id, cleanId(sub2Id));
      }
      if (sub === 'challenges') {
        if (!subId && method === 'POST') return createChallenge(request, code);
        if (subId && method === 'DELETE') return deleteChallenge(request, code, cleanId(subId));
      }
    }
    throw new HttpError(404, 'Not found.');
  }

  return async function handle(request) {
    try {
      return await route(request);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error('[spazify api]', err);
      return json({ error: 'Something went wrong on the server. Please try again.' }, 500);
    }
  };
}

// Exposed for tests.
export const _internal = { cleanTrack, randomCode };

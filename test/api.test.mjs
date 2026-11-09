import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createApi } from '../server/api.mjs';
import { memoryAdapter, blobsAdapter, fileAdapter } from '../server/stores.mjs';
import { appleDeveloperToken } from '../server/apple-token.mjs';
import { pickBestMatch, bigArtwork } from '../server/itunes.mjs';
import { trackKey } from '../public/js/lib/normalize.js';

const ITUNES_FIXTURE = {
  resultCount: 2,
  results: [
    {
      wrapperType: 'track', kind: 'song', trackId: 111, trackName: 'Golden', artistName: 'HUNTR/X, EJAE, AUDREY NUNA & REI AMI',
      collectionName: 'KPop Demon Hunters', artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music/x/100x100bb.jpg',
      previewUrl: 'https://audio-ssl.itunes.apple.com/preview.m4a', trackViewUrl: 'https://music.apple.com/us/album/golden/1?i=111',
      trackTimeMillis: 194000, primaryGenreName: 'Soundtrack', releaseDate: '2025-06-20T07:00:00Z',
    },
    {
      wrapperType: 'track', kind: 'song', trackId: 222, trackName: 'Golden Hour', artistName: 'JVKE',
      artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music/y/100x100bb.jpg', trackTimeMillis: 209000,
    },
  ],
};

function fakeFetch(calls = []) {
  return async (url) => {
    calls.push(String(url));
    return new Response(JSON.stringify(ITUNES_FIXTURE), { status: 200, headers: { 'content-type': 'text/javascript' } });
  };
}

function client(api) {
  const call = async (method, path, body, token) => {
    const res = await api(
      new Request(`https://spazify.test/api${path}`, {
        method,
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
    return { status: res.status, data: await res.json() };
  };
  return {
    get: (p, t) => call('GET', p, undefined, t),
    post: (p, b, t) => call('POST', p, b, t),
    put: (p, b, t) => call('PUT', p, b, t),
    del: (p, t) => call('DELETE', p, undefined, t),
    patch: (p, b, t) => call('PATCH', p, b, t),
  };
}

const member = (name, extra = {}) => ({
  name,
  avatar: { emoji: '🦊', color: 20 },
  provider: 'private',
  songs: [{ title: 'Espresso', artist: 'Sabrina Carpenter', note: 'So catchy!', source: 'itunes', cover: 'https://example.com/a.jpg' }],
  listening: { '2026-11-01': { m: 45 } },
  ...extra,
});

function runSuite(label, makeStore) {
  describe(`API (${label})`, () => {
    let api;
    let c;
    let store;
    before(async () => {
      store = await makeStore();
      api = createApi({ store, env: { SPOTIFY_CLIENT_ID: 'abc123' }, fetch: fakeFetch(), now: () => Date.UTC(2026, 10, 9, 12) });
      c = client(api);
    });

    test('health and config', async () => {
      const h = await c.get('/health');
      assert.equal(h.status, 200);
      assert.equal(h.data.ok, true);
      const cfg = await c.get('/config');
      assert.equal(cfg.data.spotifyClientId, 'abc123');
      assert.equal(cfg.data.apple, false);
    });

    test('full class flow', async () => {
      const created = await c.post('/classes', { name: '  English 10b  ', emoji: '🇬🇧' });
      assert.equal(created.status, 201);
      const code = created.data.class.code;
      assert.match(code, /^[A-Z2-9]{6}$/);
      assert.equal(created.data.class.name, 'English 10b');
      assert.ok(created.data.ownerToken);

      const fresh = await c.get(`/classes/${code.toLowerCase()}`);
      assert.equal(fresh.status, 200);
      assert.equal(fresh.data.members.length, 0);
      assert.equal(fresh.data.challenges.length, 4, 'default challenges are created');

      const owner = await c.post(`/classes/${code}/members`, { member: member('Ms Taylor'), ownerToken: created.data.ownerToken });
      assert.equal(owner.status, 201);
      assert.equal(owner.data.member.role, 'owner');
      const ownerToken = owner.data.token;

      const mia = await c.post(`/classes/${code}/members`, {
        member: member('Mia <script>', { provider: 'spotify', topTracks: [{ title: 'Golden', artist: 'HUNTR/X', source: 'spotify' }] }),
      });
      assert.equal(mia.status, 201);
      assert.equal(mia.data.member.role, 'member');
      assert.equal(mia.data.member.songs[0].key, trackKey('Espresso', 'Sabrina Carpenter'));
      const miaToken = mia.data.token;
      const miaId = mia.data.member.id;

      // secret hash never leaks
      const cls = await c.get(`/classes/${code}`);
      assert.equal(cls.data.members.length, 2);
      assert.ok(!JSON.stringify(cls.data).includes('secretHash'));
      assert.ok(!JSON.stringify(cls.data).includes('ownerHash'));

      // update own profile
      const upd = await c.put(`/classes/${code}/members/${miaId}`, {
        member: member('Mia', {
          provider: 'spotify',
          likes: [trackKey('Golden', 'HUNTR/X')],
          playlists: [{ id: 'pl1', name: 'Gym Hype', source: 'spotify', tracks: [{ title: 'Golden', artist: 'HUNTR/X', cover: 'https://example.com/g.jpg' }] }],
        }),
      }, miaToken);
      assert.equal(upd.status, 200);
      assert.equal(upd.data.member.name, 'Mia');
      assert.equal(upd.data.member.playlists[0].tracks.length, 1, 'own view keeps playlist tracks');

      // class view strips playlist tracks but keeps covers + count
      const cls2 = await c.get(`/classes/${code}`);
      const miaPublic = cls2.data.members.find((m) => m.id === miaId);
      assert.equal(miaPublic.playlists[0].trackCount, 1);
      assert.equal(miaPublic.playlists[0].tracks, undefined);
      assert.deepEqual(miaPublic.playlists[0].covers, ['https://example.com/g.jpg']);

      const pl = await c.get(`/classes/${code}/members/${miaId}/playlists/pl1`);
      assert.equal(pl.status, 200);
      assert.equal(pl.data.playlist.tracks[0].title, 'Golden');

      // cannot edit someone else
      const forbidden = await c.put(`/classes/${code}/members/${owner.data.member.id}`, { member: member('Hacker') }, miaToken);
      assert.equal(forbidden.status, 403);
      const noAuth = await c.put(`/classes/${code}/members/${miaId}`, { member: member('Nope') });
      assert.equal(noAuth.status, 401);
      const badAuth = await c.put(`/classes/${code}/members/${miaId}`, { member: member('Nope') }, `${miaId}.wrongsecret`);
      assert.equal(badAuth.status, 401);

      // me endpoint
      const me = await c.get(`/classes/${code}/me`, miaToken);
      assert.equal(me.data.member.id, miaId);

      // challenges
      const ch = await c.post(`/classes/${code}/challenges`, {
        challenge: { title: 'Weekend Warriors', type: 'minutes', goal: 10, emoji: '⚡', endAt: Date.UTC(2026, 10, 20) },
      }, miaToken);
      assert.equal(ch.status, 201);
      assert.equal(ch.data.challenge.createdBy, miaId);
      const badType = await c.post(`/classes/${code}/challenges`, { challenge: { title: 'x', type: 'hack' } }, miaToken);
      assert.equal(badType.status, 400);

      // only owner/creator can delete default challenges
      const defaultId = fresh.data.challenges[0].id;
      const delForbidden = await c.del(`/classes/${code}/challenges/${defaultId}`, miaToken);
      assert.equal(delForbidden.status, 403);
      const delOk = await c.del(`/classes/${code}/challenges/${defaultId}`, ownerToken);
      assert.equal(delOk.status, 200);
      const delOwn = await c.del(`/classes/${code}/challenges/${ch.data.challenge.id}`, miaToken);
      assert.equal(delOwn.status, 200);

      // owner can rename class, members cannot
      assert.equal((await c.patch(`/classes/${code}`, { name: 'Hack' }, miaToken)).status, 403);
      const renamed = await c.patch(`/classes/${code}`, { name: 'English 10b ✨' }, ownerToken);
      assert.equal(renamed.data.class.name, 'English 10b ✨');

      // leave
      const left = await c.del(`/classes/${code}/members/${miaId}`, miaToken);
      assert.equal(left.status, 200);
      const cls3 = await c.get(`/classes/${code}`);
      assert.equal(cls3.data.members.length, 1);
      assert.equal(cls3.data.challenges.length, 3);
    });

    test('unknown class and routes', async () => {
      assert.equal((await c.get('/classes/ZZZZZZ')).status, 404);
      assert.equal((await c.get('/classes/!!')).status, 404);
      assert.equal((await c.get('/nope')).status, 404);
      assert.equal((await c.post('/classes', { name: '   ' })).status, 400);
    });

    test('search and cached lookup', async () => {
      const calls = [];
      const api2 = createApi({ store, env: {}, fetch: fakeFetch(calls), now: () => Date.UTC(2026, 10, 9) });
      const c2 = client(api2);
      const s = await c2.get('/search?term=golden&country=de');
      assert.equal(s.status, 200);
      assert.equal(s.data.results.length, 2);
      assert.equal(s.data.results[0].cover, 'https://is1-ssl.mzstatic.com/image/thumb/Music/x/600x600bb.jpg');
      assert.match(calls[0], /country=DE/);

      const key = trackKey('Golden', 'HUNTR/X');
      const l1 = await c2.post('/lookup', { items: [{ key, title: 'Golden', artist: 'HUNTR/X' }] });
      assert.equal(l1.data.found[key].preview, 'https://audio-ssl.itunes.apple.com/preview.m4a');
      const before = calls.length;
      const l2 = await c2.post('/lookup', { items: [{ key, title: 'Golden', artist: 'HUNTR/X' }] });
      assert.equal(calls.length, before, 'second lookup is served from cache');
      assert.ok(l2.data.found[key]);
    });
  });
}

runSuite('memory', async () => memoryAdapter());
runSuite('files', async () => fileAdapter(await fs.mkdtemp(path.join(os.tmpdir(), 'spazify-'))));

describe('API (Netlify Blobs local server)', () => {
  let server;
  let dir;
  before(async () => {
    const { BlobsServer } = await import('@netlify/blobs/server');
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'spazify-blobs-'));
    server = new BlobsServer({ directory: dir, token: 'test-token', port: 0 });
    const { port } = await server.start();
    const { getStore } = await import('@netlify/blobs');
    // Same mode as inside a deployed Netlify Function (edge URLs + strong consistency).
    const blobStore = getStore({
      name: 'spazify',
      siteID: 'site-1',
      token: 'test-token',
      edgeURL: `http://127.0.0.1:${port}`,
      uncachedEdgeURL: `http://127.0.0.1:${port}`,
      consistency: 'strong',
    });
    globalThis.__blobStore = blobsAdapter(blobStore);
  });
  after(async () => {
    await server?.stop();
  });
  test('create, join and read a class through @netlify/blobs', async () => {
    const api = createApi({ store: globalThis.__blobStore, env: {}, fetch: fakeFetch() });
    const c = client(api);
    const created = await c.post('/classes', { name: 'Blob Class' });
    assert.equal(created.status, 201);
    const code = created.data.class.code;
    const joined = await c.post(`/classes/${code}/members`, { member: member('Leon') });
    assert.equal(joined.status, 201);
    const cls = await c.get(`/classes/${code}`);
    assert.equal(cls.status, 200);
    assert.equal(cls.data.members.length, 1);
    assert.equal(cls.data.challenges.length, 4);
    assert.equal(await globalThis.__blobStore.create(`class/${code}/info`, {}), false, 'onlyIfNew prevents overwriting');
  });
});

test('apple developer token is a valid ES256 JWT', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).replace(/\n/g, '\\n');
  const { token } = appleDeveloperToken({ APPLE_TEAM_ID: 'TEAM123456', APPLE_KEY_ID: 'KEY1234567', APPLE_PRIVATE_KEY: pem }, Date.UTC(2026, 0, 1));
  const [h, p, s] = token.split('.');
  const header = JSON.parse(Buffer.from(h, 'base64url'));
  const payload = JSON.parse(Buffer.from(p, 'base64url'));
  assert.equal(header.alg, 'ES256');
  assert.equal(header.kid, 'KEY1234567');
  assert.equal(payload.iss, 'TEAM123456');
  assert.ok(payload.exp > payload.iat);
  const ok = crypto.verify('sha256', Buffer.from(`${h}.${p}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url'));
  assert.equal(ok, true);
});

test('matching helpers', () => {
  assert.equal(bigArtwork('https://x.test/a/100x100bb.jpg'), 'https://x.test/a/600x600bb.jpg');
  const results = [
    { title: 'Golden Hour', artist: 'JVKE' },
    { title: 'Golden', artist: 'HUNTR/X, EJAE', cover: 'c' },
  ];
  assert.equal(pickBestMatch(results, 'Golden', 'HUNTR/X').artist, 'HUNTR/X, EJAE');
  assert.equal(pickBestMatch(results, 'Silver', 'Nobody'), null);
  assert.equal(trackKey('APT.', 'ROSÉ & Bruno Mars'), trackKey('APT', 'ROSÉ, Bruno Mars'));
  assert.equal(trackKey('Blinding Lights - 2020 Remaster', 'The Weeknd'), trackKey('Blinding Lights', 'The Weeknd'));
  assert.equal(trackKey('Die With A Smile (feat. Bruno Mars)', 'Lady Gaga'), trackKey('Die With A Smile', 'Lady Gaga & Bruno Mars'));
});

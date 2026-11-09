// Creates the "developer token" that Apple's MusicKit JS needs.
// It is a JSON Web Token signed with the private key (.p8 file) from an Apple
// Developer account. The key stays on the server (Netlify environment variable).
import crypto from 'node:crypto';

let cache = null;

function toPem(raw) {
  let key = String(raw || '').replace(/\\n/g, '\n').trim();
  if (!key.includes('BEGIN')) {
    const body = key.replace(/\s+/g, '');
    key = `-----BEGIN PRIVATE KEY-----\n${body.match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----`;
  }
  return key;
}

export function appleConfigured(env) {
  return Boolean(env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY);
}

export function appleDeveloperToken(env, now = Date.now()) {
  if (!appleConfigured(env)) return null;
  const nowSec = Math.floor(now / 1000);
  if (cache && cache.kid === env.APPLE_KEY_ID && cache.exp - 3600 > nowSec) return cache;
  const header = { alg: 'ES256', kid: String(env.APPLE_KEY_ID).trim() };
  const payload = { iss: String(env.APPLE_TEAM_ID).trim(), iat: nowSec, exp: nowSec + 60 * 60 * 24 * 30 };
  const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsigned = `${encode(header)}.${encode(payload)}`;
  const signature = crypto.sign('sha256', Buffer.from(unsigned), {
    key: crypto.createPrivateKey(toPem(env.APPLE_PRIVATE_KEY)),
    dsaEncoding: 'ieee-p1363',
  });
  cache = { token: `${unsigned}.${signature.toString('base64url')}`, exp: payload.exp, kid: header.kid };
  return cache;
}

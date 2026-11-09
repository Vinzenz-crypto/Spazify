// Netlify Function (Functions API v2): handles every request to /api/*.
// Data is stored in Netlify Blobs, which needs no setup on Netlify.
import { getStore } from '@netlify/blobs';
import { createApi } from '../../server/api.mjs';
import { blobsAdapter } from '../../server/stores.mjs';

export default async function handler(request) {
  let store;
  try {
    store = blobsAdapter(getStore({ name: 'spazify', consistency: 'strong' }));
  } catch (err) {
    console.error('[spazify] Netlify Blobs is not available:', err);
    return new Response(JSON.stringify({ ok: false, error: 'The storage (Netlify Blobs) is not available. Try redeploying the site.' }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  const api = createApi({ store, env: process.env });
  return api(request);
}

export const config = {
  path: '/api/*',
};

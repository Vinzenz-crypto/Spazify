// Small key-value storage adapters with the same interface:
//   get(key) -> object | null
//   set(key, value)
//   create(key, value) -> true if created, false if the key already existed
//   delete(key)
//   list(prefix) -> [keys]
// On Netlify we use Netlify Blobs. Locally (npm run dev) we use JSON files.
import fs from 'node:fs/promises';
import path from 'node:path';

export function blobsAdapter(blobStore) {
  return {
    kind: 'netlify-blobs',
    async get(key) {
      const value = await blobStore.get(key, { type: 'json' });
      return value ?? null;
    },
    async set(key, value) {
      await blobStore.setJSON(key, value);
    },
    async create(key, value) {
      const result = await blobStore.setJSON(key, value, { onlyIfNew: true });
      return result?.modified !== false;
    },
    async delete(key) {
      await blobStore.delete(key);
    },
    async list(prefix) {
      const { blobs } = await blobStore.list({ prefix });
      return blobs.map((b) => b.key);
    },
  };
}

export function memoryAdapter() {
  const map = new Map();
  return {
    kind: 'memory',
    async get(key) {
      return map.has(key) ? structuredClone(map.get(key)) : null;
    },
    async set(key, value) {
      map.set(key, structuredClone(value));
    },
    async create(key, value) {
      if (map.has(key)) return false;
      map.set(key, structuredClone(value));
      return true;
    },
    async delete(key) {
      map.delete(key);
    },
    async list(prefix) {
      return [...map.keys()].filter((k) => k.startsWith(prefix)).sort();
    },
  };
}

export function fileAdapter(dir) {
  const fileFor = (key) => path.join(dir, `${encodeURIComponent(key)}.json`);
  const ensure = () => fs.mkdir(dir, { recursive: true });
  return {
    kind: 'local-files',
    async get(key) {
      try {
        return JSON.parse(await fs.readFile(fileFor(key), 'utf8'));
      } catch (err) {
        if (err.code === 'ENOENT') return null;
        throw err;
      }
    },
    async set(key, value) {
      await ensure();
      const file = fileFor(key);
      const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(value));
      await fs.rename(tmp, file);
    },
    async create(key, value) {
      await ensure();
      try {
        await fs.writeFile(fileFor(key), JSON.stringify(value), { flag: 'wx' });
        return true;
      } catch (err) {
        if (err.code === 'EEXIST') return false;
        throw err;
      }
    },
    async delete(key) {
      await fs.rm(fileFor(key), { force: true });
    },
    async list(prefix) {
      await ensure();
      const names = await fs.readdir(dir);
      return names
        .filter((n) => n.endsWith('.json'))
        .map((n) => decodeURIComponent(n.slice(0, -5)))
        .filter((k) => k.startsWith(prefix))
        .sort();
    },
  };
}

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export class CacheService {
  constructor(cacheDir) {
    this.cacheDir = cacheDir;
  }

  async read(key, options = {}) {
    const file = this.pathFor(key);

    try {
      const raw = await fs.readFile(file, 'utf8');
      const payload = JSON.parse(raw);

      if (!options.allowExpired && options.ttlMs) {
        const age = Date.now() - new Date(payload.fetchedAt).getTime();
        if (!Number.isFinite(age) || age > options.ttlMs) {
          return null;
        }
      }

      return payload;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }

      return null;
    }
  }

  async write(key, payload) {
    await fs.mkdir(this.cacheDir, { recursive: true });
    const file = this.pathFor(key);
    const tmpFile = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmpFile, `${JSON.stringify(payload)}\n`, 'utf8');
    await fs.rename(tmpFile, file);
  }

  pathFor(key) {
    const hash = createHash('sha256').update(key).digest('hex');
    return path.join(this.cacheDir, `${hash}.json`);
  }
}

import fs from 'node:fs/promises';
import path from 'node:path';

export class SnapshotStore {
  constructor(snapshotsDir) {
    this.snapshotsDir = snapshotsDir;
  }

  async saveDaily(snapshot) {
    await fs.mkdir(this.snapshotsDir, { recursive: true });
    const date = snapshot.date ?? toUtcDate(snapshot.capturedAt);
    const payload = {
      ...snapshot,
      date,
      savedAt: new Date().toISOString()
    };
    const file = path.join(this.snapshotsDir, `${date}.json`);
    const tmpFile = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmpFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    await fs.rename(tmpFile, file);
    return { file, snapshot: payload };
  }

  async list() {
    let entries;

    try {
      entries = await fs.readdir(this.snapshotsDir, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }

      throw error;
    }

    const snapshots = await Promise.all(
      entries
        .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
        .map(async entry => {
          const file = path.join(this.snapshotsDir, entry.name);
          const raw = await fs.readFile(file, 'utf8');
          return { file, snapshot: JSON.parse(raw) };
        })
    );

    return snapshots.sort((a, b) => a.snapshot.date.localeCompare(b.snapshot.date));
  }
}

export function toUtcDate(dateLike = new Date()) {
  return new Date(dateLike).toISOString().slice(0, 10);
}

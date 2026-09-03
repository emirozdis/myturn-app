import * as FileSystem from 'expo-file-system/legacy';
import { storage } from '../storage';

const debugMediaCache = (...args: unknown[]) => console.log('[DEBUG][MediaCache]', ...args);

const MEDIA_CACHE_BASE_DIR = `${FileSystem.cacheDirectory}media_cache/`;
const CHUNKS_DIR = `${MEDIA_CACHE_BASE_DIR}chunks/`;
const PLAYLISTS_DIR = `${MEDIA_CACHE_BASE_DIR}playlists/`;

export interface CachedChunk {
  chunkKey: string;
  localPath: string;
  resLevel: number;
  byteSize: number;
  downloadedAt: number;
  lastAccessed: number;
}

const CACHE_KEY = 'hls_media_cache_registry';

export const cacheStore = {
  getRegistry(): Record<string, CachedChunk> {
    try {
      const raw = storage.getString(CACHE_KEY);
      const reg = raw ? JSON.parse(raw) : {};
      debugMediaCache('[cacheStore] getRegistry', { count: Object.keys(reg).length, rawLength: raw?.length || 0 });
      return reg;
    } catch (error) {
      debugMediaCache('[cacheStore] getRegistry-failed', { error: error instanceof Error ? error.message : String(error) });
      return {};
    }
  },

  saveRegistry(registry: Record<string, CachedChunk>) {
    storage.set(CACHE_KEY, JSON.stringify(registry));
    debugMediaCache('[cacheStore] saveRegistry', { count: Object.keys(registry).length });
  },

  getChunk(chunkKey: string): CachedChunk | undefined {
    const chunk = this.getRegistry()[chunkKey];
    if (chunk) {
      debugMediaCache('[cacheStore] getChunk-hit', { chunkKey, resLevel: chunk.resLevel, byteSize: chunk.byteSize, localPath: chunk.localPath, lastAccessed: chunk.lastAccessed });
    } else {
      debugMediaCache('[cacheStore] getChunk-miss', { chunkKey });
    }
    return chunk;
  },

  addChunk(chunk: CachedChunk) {
    const reg = this.getRegistry();
    const existing = reg[chunk.chunkKey];
    reg[chunk.chunkKey] = chunk;
    this.saveRegistry(reg);
    debugMediaCache('[cacheStore] addChunk', { chunkKey: chunk.chunkKey, resLevel: chunk.resLevel, byteSize: chunk.byteSize, localPath: chunk.localPath, replaced: !!existing });
  },

  removeChunk(chunkKey: string) {
    const reg = this.getRegistry();
    const removed = reg[chunkKey];
    delete reg[chunkKey];
    this.saveRegistry(reg);
    debugMediaCache('[cacheStore] removeChunk', { chunkKey, removed: !!removed });
  },

  touchChunk(chunkKey: string) {
    const reg = this.getRegistry();
    if (reg[chunkKey]) {
      reg[chunkKey].lastAccessed = Date.now();
      this.saveRegistry(reg);
      debugMediaCache('[cacheStore] touchChunk', { chunkKey, lastAccessed: reg[chunkKey].lastAccessed });
    } else {
      debugMediaCache('[cacheStore] touchChunk-miss', { chunkKey });
    }
  },

  getTotalSize(): number {
    const reg = this.getRegistry();
    const size = Object.values(reg).reduce((sum, chunk) => sum + chunk.byteSize, 0);
    debugMediaCache('[cacheStore] getTotalSize', { size, chunkCount: Object.keys(reg).length });
    return size;
  },

  async invalidate(): Promise<number> {
    const registry = this.getRegistry();
    const sizeToClear = Object.values(registry).reduce((sum, chunk) => sum + chunk.byteSize, 0);

    try {
      await FileSystem.deleteAsync(MEDIA_CACHE_BASE_DIR, { idempotent: true }).catch(() => {});
      await FileSystem.makeDirectoryAsync(CHUNKS_DIR, { intermediates: true }).catch(() => {});
      await FileSystem.makeDirectoryAsync(PLAYLISTS_DIR, { intermediates: true }).catch(() => {});
      this.saveRegistry({});
      debugMediaCache('[cacheStore] invalidate', { sizeToClear, chunkCount: Object.keys(registry).length, cacheBaseDir: MEDIA_CACHE_BASE_DIR });
      return sizeToClear;
    } catch (error) {
      this.saveRegistry({});
      debugMediaCache('[cacheStore] invalidate-failed', { error: error instanceof Error ? error.message : String(error), sizeToClear });
      return sizeToClear;
    }
  }
};

export async function invalidateMediaCache(): Promise<number> {
  return cacheStore.invalidate();
}
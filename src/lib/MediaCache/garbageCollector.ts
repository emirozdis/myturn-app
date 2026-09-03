import * as FileSystem from 'expo-file-system/legacy';
import { cacheStore } from './cacheStore';

const MAX_CACHE_AGE_MS = 2 * 24 * 60 * 60 * 1000; // 2 days
const MAX_CACHE_SIZE_BYTES = 250 * 1024 * 1024;   // 250 MB
const SAFE_CACHE_SIZE_BYTES = 200 * 1024 * 1024;  // 200 MB

export async function runGarbageCollection() {
  try {
    const registry = cacheStore.getRegistry();
    const now = Date.now();
    let registryModified = false;
    let expiredChunks = 0;
    let evictedChunks = 0;

    // Rule 1: Time Expirity (Lifespan > 2 days)
    for (const [key, chunk] of Object.entries(registry)) {
      if (now - chunk.downloadedAt > MAX_CACHE_AGE_MS) {
        expiredChunks += 1;
        await FileSystem.deleteAsync(chunk.localPath, { idempotent: true }).catch(() => {});
        delete registry[key];
        registryModified = true;
      }
    }

    if (registryModified) {
      cacheStore.saveRegistry(registry);
    }

    // Rule 2: Storage Limit (LRU Eviction > 250MB)
    let totalSize = Object.values(registry).reduce((sum, c) => sum + c.byteSize, 0);

    if (totalSize > MAX_CACHE_SIZE_BYTES) {
      // Sort by oldest accessed time
      const sortedChunks = Object.values(registry).sort((a, b) => a.lastAccessed - b.lastAccessed);

      for (const chunk of sortedChunks) {
        if (totalSize <= SAFE_CACHE_SIZE_BYTES) break;

        evictedChunks += 1;
        await FileSystem.deleteAsync(chunk.localPath, { idempotent: true }).catch(() => {});
        delete registry[chunk.chunkKey];
        totalSize -= chunk.byteSize;
        registryModified = true;
      }

      if (registryModified) {
        cacheStore.saveRegistry(registry);
      }
    }
  } catch (error) {
    console.warn('[GarbageCollector] Background cleanup error:', error);
  }
}
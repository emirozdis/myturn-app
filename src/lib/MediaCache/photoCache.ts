import * as FileSystem from 'expo-file-system/legacy';
import { cacheStore } from './cacheStore';

const IMAGES_DIR = `${FileSystem.cacheDirectory}media_cache/images/`;
const inFlight = new Map<string, Promise<string>>();

function hash(value: string): string {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function imageExtension(url: string): string {
  try {
    const extension = new URL(url).pathname.split('.').pop()?.toLowerCase();
    return extension && /^(jpe?g|png|webp|heic)$/.test(extension) ? extension : 'jpg';
  } catch {
    return 'jpg';
  }
}

/**
 * Returns a disk URI for a remote photo. Query parameters are intentionally
 * excluded from the key because media URLs are re-signed between feed loads.
 */
export async function prepareCachedPhoto(remoteUrl: string): Promise<string> {
  if (!remoteUrl || remoteUrl.startsWith('file://')) return remoteUrl;

  const stableUrl = remoteUrl.split('?')[0];
  const cacheKey = `photo_${hash(stableUrl)}`;
  const cached = cacheStore.getChunk(cacheKey);
  if (cached) {
    const info = await FileSystem.getInfoAsync(cached.localPath);
    if (info.exists) {
      cacheStore.touchChunk(cacheKey);
      return cached.localPath;
    }
    cacheStore.removeChunk(cacheKey);
  }

  const pending = inFlight.get(cacheKey);
  if (pending) return pending;

  const download = (async () => {
    await FileSystem.makeDirectoryAsync(IMAGES_DIR, { intermediates: true });
    const destination = `${IMAGES_DIR}${cacheKey}.${imageExtension(stableUrl)}`;
    const temporary = `${destination}.tmp`;
    const response = await FileSystem.downloadAsync(remoteUrl, temporary);
    if (response.status !== 200) {
      await FileSystem.deleteAsync(temporary, { idempotent: true }).catch(() => {});
      throw new Error(`Photo download failed with HTTP ${response.status}`);
    }

    const info = await FileSystem.getInfoAsync(temporary);
    if (!info.exists || typeof info.size !== 'number' || info.size === 0) {
      throw new Error('Downloaded photo is empty');
    }

    await FileSystem.deleteAsync(destination, { idempotent: true });
    await FileSystem.moveAsync({ from: temporary, to: destination });
    cacheStore.addChunk({
      chunkKey: cacheKey,
      localPath: destination,
      resLevel: 0,
      byteSize: info.size,
      downloadedAt: Date.now(),
      lastAccessed: Date.now(),
    });
    return destination;
  })();

  inFlight.set(cacheKey, download);
  try {
    return await download;
  } finally {
    inFlight.delete(cacheKey);
  }
}

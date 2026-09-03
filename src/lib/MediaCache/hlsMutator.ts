import * as FileSystem from 'expo-file-system/legacy';
import { cacheStore } from './cacheStore';
import { enqueueChunkDownload, PLAYLISTS_DIR } from './chunkDownloader';
import { fetchWithTimeout } from '../network';

function getResolutionLevel(url: string): number {
  if (url.includes('stream_0')) return 3;
  if (url.includes('stream_1')) return 2;
  if (url.includes('stream_2')) return 1;
  return 0;
}

function resolveHlsUrl(reference: string, parentUrl: string): string {
  const resolved = new URL(reference, parentUrl);
  const parent = new URL(parentUrl);
  // Signed HLS endpoints commonly put a directory-wide token on the manifest.
  if (!resolved.search && parent.search) resolved.search = parent.search;
  return resolved.toString();
}

function safeKey(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

async function fetchPlaylist(url: string): Promise<string> {
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Failed to fetch HLS playlist: ${response.status}`);
  return response.text();
}

interface LocalPlaylistRecord {
  playlistPath: string;
  chunkKeys: string[];
}

function playlistRecordPath(clipId: string, remoteUrl: string): string {
  return `${PLAYLISTS_DIR}${clipId}_${safeKey(remoteUrl.split('?')[0])}.json`;
}

async function getCompleteLocalPlaylist(recordPath: string): Promise<string | null> {
  const pointerInfo = await FileSystem.getInfoAsync(recordPath);
  if (!pointerInfo.exists) return null;

  try {
    const record = JSON.parse(await FileSystem.readAsStringAsync(recordPath)) as LocalPlaylistRecord;
    const playlistInfo = await FileSystem.getInfoAsync(record.playlistPath);
    if (!playlistInfo.exists || !Array.isArray(record.chunkKeys) || record.chunkKeys.length === 0) {
      return null;
    }

    for (const chunkKey of record.chunkKeys) {
      const chunk = cacheStore.getChunk(chunkKey);
      if (!chunk) return null;
      const chunkInfo = await FileSystem.getInfoAsync(chunk.localPath);
      if (!chunkInfo.exists || (typeof chunkInfo.size === 'number' && chunkInfo.size === 0)) {
        return null;
      }
      cacheStore.touchChunk(chunkKey);
    }

    return record.playlistPath;
  } catch {
    await FileSystem.deleteAsync(recordPath, { idempotent: true }).catch(() => {});
    return null;
  }
}

function selectVariant(masterText: string, masterUrl: string): string | null {
  const lines = masterText.split(/\r?\n/);
  const variants: Array<{ url: string; bandwidth: number }> = [];

  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].trim().startsWith('#EXT-X-STREAM-INF:')) continue;
    const bandwidth = Number(lines[i].match(/BANDWIDTH=(\d+)/)?.[1] ?? 0);
    let uri = '';
    for (let j = i + 1; j < lines.length; j += 1) {
      const candidate = lines[j].trim();
      if (!candidate) continue;
      if (!candidate.startsWith('#')) uri = candidate;
      break;
    }
    if (uri) variants.push({ url: resolveHlsUrl(uri, masterUrl), bandwidth });
  }

  // Cache one complete rendition. A partially local adaptive master is not a
  // valid offline asset; the player can still use ABR during the first stream.
  variants.sort((a, b) => b.bandwidth - a.bandwidth);
  return variants[0]?.url ?? null;
}

export async function prepareHlsStream(clipId: string, remoteUrl: string): Promise<string> {
  if (!remoteUrl.includes('.m3u8')) return remoteUrl;

  await FileSystem.makeDirectoryAsync(PLAYLISTS_DIR, { intermediates: true }).catch(() => {});

  // A completed local rendition must be usable without touching the remote
  // manifest. Signed media URLs expire after an hour, while cached media lives
  // for days. Validate every segment before returning the offline playlist.
  const recordPath = playlistRecordPath(clipId, remoteUrl);
  const existingLocalPlaylist = await getCompleteLocalPlaylist(recordPath);
  if (existingLocalPlaylist) return existingLocalPlaylist;

  const firstText = await fetchPlaylist(remoteUrl);
  const variantUrl = selectVariant(firstText, remoteUrl);
  const mediaUrl = variantUrl ?? remoteUrl;
  const mediaText = variantUrl ? await fetchPlaylist(variantUrl) : firstText;
  const resLevel = getResolutionLevel(mediaUrl);
  const renditionKey = safeKey(mediaUrl.split('?')[0]);
  const output: string[] = [];
  let complete = true;
  let segmentIndex = 0;
  const chunkKeys: string[] = [];

  for (const rawLine of mediaText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('#')) {
      output.push(line);
      continue;
    }

    const absoluteUrl = resolveHlsUrl(line, mediaUrl);
    const chunkKey = `${clipId}_${renditionKey}_${segmentIndex}_${safeKey(absoluteUrl.split('?')[0])}`;
    chunkKeys.push(chunkKey);
    const cached = cacheStore.getChunk(chunkKey);
    const exists = cached ? await FileSystem.getInfoAsync(cached.localPath) : null;

    const localSegmentName = `${chunkKey}_res${resLevel}.ts`;
    output.push(`../chunks/${localSegmentName}`);

    if (cached && exists?.exists) {
      cacheStore.touchChunk(chunkKey);
    } else {
      complete = false;
      if (cached) cacheStore.removeChunk(chunkKey);
      enqueueChunkDownload({ clipId, chunkKey, absoluteUrl, resLevel });
    }
    segmentIndex += 1;
  }

  const localPlaylistPath = `${PLAYLISTS_DIR}${clipId}_${renditionKey}.m3u8`;
  await FileSystem.writeAsStringAsync(localPlaylistPath, `${output.join('\n')}\n`);
  await FileSystem.writeAsStringAsync(recordPath, JSON.stringify({
    playlistPath: localPlaylistPath,
    chunkKeys,
  } satisfies LocalPlaylistRecord));

  // Never hand AVPlayer an incomplete file:// playlist. Stream remotely while
  // downloads finish; on the next load the record above can be validated and
  // used even if the original signed URL has expired.
  if (!complete || segmentIndex === 0) return remoteUrl;

  return localPlaylistPath;
}

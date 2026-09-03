import * as FileSystem from 'expo-file-system/legacy';

import { fetchWithTimeout } from './network';

/**
 * Returns an HLS playlist URL for playback. When maximum quality is requested,
 * a master playlist is narrowed to its highest rendition. Already restricted
 * rendition playlists (for example, server-enforced SD) are left unchanged.
 */
export function getHlsPlaybackUrl(hlsUrl: string, alwaysHighestQuality: boolean): string {
  if (!alwaysHighestQuality) return hlsUrl;
  return hlsUrl.replace(/\/master\.m3u8(?=\?|$)/, '/stream_0/playlist.m3u8');
}

const ANDROID_HLS_PLAYBACK_DIR = `${FileSystem.cacheDirectory}android_hls_playback/`;

function safePlaybackKey(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function resolveSignedHlsReference(reference: string, parentUrl: string): string {
  const resolved = new URL(reference, parentUrl);
  const parent = new URL(parentUrl);
  if (!resolved.search && parent.search) resolved.search = parent.search;
  return resolved.toString();
}

function rewriteTagUris(line: string, parentUrl: string): string {
  return line.replace(/URI="([^"]+)"/g, (_match, reference: string) => (
    `URI="${resolveSignedHlsReference(reference, parentUrl)}"`
  ));
}

function rewriteMediaPlaylist(playlistText: string, playlistUrl: string): string {
  return playlistText
    .split(/\r?\n/)
    .map((rawLine) => {
      const line = rawLine.trim();
      if (!line) return '';
      if (line.startsWith('#')) return rewriteTagUris(line, playlistUrl);
      return resolveSignedHlsReference(line, playlistUrl);
    })
    .join('\n')
    .concat('\n');
}

/**
 * Android authentication adapter for signed HLS playlists. This writes only
 * tiny manifest files with absolute authenticated media URLs. It never
 * downloads or persists video segments.
 */
export async function prepareAndroidHlsPlayback(
  clipId: string,
  remoteUrl: string,
): Promise<string> {
  if (!remoteUrl.includes('.m3u8')) return remoteUrl;

  await FileSystem.makeDirectoryAsync(ANDROID_HLS_PLAYBACK_DIR, { intermediates: true }).catch(() => {});

  const rootResponse = await fetchWithTimeout(remoteUrl, {}, 10_000);
  if (!rootResponse.ok) {
    throw new Error(`Android HLS root request failed with HTTP ${rootResponse.status}.`);
  }

  const rootText = await rootResponse.text();
  const playbackKey = `${clipId}_${safePlaybackKey(remoteUrl.split('?')[0])}`;
  const rootPath = `${ANDROID_HLS_PLAYBACK_DIR}${playbackKey}.m3u8`;

  if (!rootText.includes('#EXT-X-STREAM-INF')) {
    await FileSystem.writeAsStringAsync(rootPath, rewriteMediaPlaylist(rootText, remoteUrl));
    return rootPath;
  }

  const rootLines = rootText.split(/\r?\n/);
  const rewrittenRoot: string[] = [];
  let expectsVariant = false;
  let variantIndex = 0;

  for (const rawLine of rootLines) {
    const line = rawLine.trim();
    if (!line) {
      rewrittenRoot.push('');
      continue;
    }
    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      expectsVariant = true;
      rewrittenRoot.push(line);
      continue;
    }
    if (line.startsWith('#')) {
      rewrittenRoot.push(rewriteTagUris(line, remoteUrl));
      continue;
    }
    if (!expectsVariant) {
      rewrittenRoot.push(resolveSignedHlsReference(line, remoteUrl));
      continue;
    }

    const variantUrl = resolveSignedHlsReference(line, remoteUrl);
    const variantResponse = await fetchWithTimeout(variantUrl, {}, 10_000);
    if (!variantResponse.ok) {
      throw new Error(`Android HLS variant request failed with HTTP ${variantResponse.status}.`);
    }

    const variantText = await variantResponse.text();
    const variantFilename = `${playbackKey}_variant_${variantIndex}.m3u8`;
    await FileSystem.writeAsStringAsync(
      `${ANDROID_HLS_PLAYBACK_DIR}${variantFilename}`,
      rewriteMediaPlaylist(variantText, variantUrl),
    );
    rewrittenRoot.push(variantFilename);
    expectsVariant = false;
    variantIndex += 1;
  }

  await FileSystem.writeAsStringAsync(rootPath, `${rewrittenRoot.join('\n')}\n`);
  return rootPath;
}

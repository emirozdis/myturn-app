import { storage } from './storage';

// v2 only records videos after native playback begins. The previous key can
// contain clips that were marked seen while Android displayed an HLS error.
const SEEN_MEDIA_KEY = 'myturn_viewed_clips_playback_v2';
const MAX_SEEN_MEDIA_ENTRIES = 2000;

export const SEEN_MEDIA_VIEW_THRESHOLD_MS = 2000;

export type SeenMediaMap = Record<string, number>;

function persistSeenMedia(seenMedia: SeenMediaMap) {
  storage.set(SEEN_MEDIA_KEY, JSON.stringify(seenMedia));
}

export function getSeenMedia(): SeenMediaMap {
  try {
    const raw = storage.getString(SEEN_MEDIA_KEY);
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      persistSeenMedia({});
      return {};
    }

    const seenMedia: SeenMediaMap = {};
    let needsRewrite = false;

    for (const [mediaId, seenAt] of Object.entries(parsed)) {
      if (mediaId && typeof seenAt === 'number' && Number.isFinite(seenAt)) {
        seenMedia[mediaId] = seenAt;
      } else {
        needsRewrite = true;
      }
    }

    if (needsRewrite) persistSeenMedia(seenMedia);
    return seenMedia;
  } catch (error) {
    console.warn('[SeenMedia] Failed to read local seen state:', error);
    return {};
  }
}

export function hasSeenMedia(mediaId: string): boolean {
  return Boolean(mediaId && getSeenMedia()[mediaId]);
}

export function markMediaAsSeen(mediaId: string, seenAt = Date.now()): boolean {
  if (!mediaId) return false;

  try {
    const seenMedia = getSeenMedia();
    const wasAlreadySeen = Boolean(seenMedia[mediaId]);
    seenMedia[mediaId] = seenAt;

    const entries = Object.entries(seenMedia);
    if (entries.length > MAX_SEEN_MEDIA_ENTRIES) {
      entries
        .sort(([, firstSeenAt], [, secondSeenAt]) => secondSeenAt - firstSeenAt)
        .slice(MAX_SEEN_MEDIA_ENTRIES)
        .forEach(([staleMediaId]) => delete seenMedia[staleMediaId]);
    }

    persistSeenMedia(seenMedia);
    return !wasAlreadySeen;
  } catch (error) {
    console.warn('[SeenMedia] Failed to persist local seen state:', error);
    return false;
  }
}

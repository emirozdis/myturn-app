export type MediaMetadata = Record<string, any>;

export function parseMediaMetadata(value: unknown): MediaMetadata | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as MediaMetadata
        : null;
    } catch {
      return null;
    }
  }
  return typeof value === "object" && !Array.isArray(value)
    ? value as MediaMetadata
    : null;
}

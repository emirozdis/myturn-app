const SHORT_CODE = /^[A-Z0-9]{6}$/;
const LEGACY_CODE = /^[A-Z0-9]{6}-[A-Z0-9]{6}$/;

export function normalizeInviteCodeInput(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 13);
}

export function buildGroupInviteQrValue(inviteCode: string): string {
  return `https://myturn.emirozdis.tr/group/join?code=${encodeURIComponent(inviteCode)}`;
}

export function extractInviteCodeFromQr(value: string): string | null {
  const trimmed = value.trim();
  const queryMatch = trimmed.match(/[?&]code=([^&#]+)/i);
  let candidate = trimmed;
  if (queryMatch) {
    try {
      candidate = decodeURIComponent(queryMatch[1]);
    } catch {
      return null;
    }
  }
  const normalized = normalizeInviteCodeInput(candidate);
  return SHORT_CODE.test(normalized) || LEGACY_CODE.test(normalized) ? normalized : null;
}

import { storage } from './storage';
import { extractInviteCodeFromQr } from './groupInvite';

const PENDING_GROUP_INVITE_KEY = 'pending_group_invite_code';

export function savePendingGroupInvite(value: string): string | null {
  const code = extractInviteCodeFromQr(value);
  if (!code) return null;
  storage.set(PENDING_GROUP_INVITE_KEY, code);
  return code;
}

export function getPendingGroupInvite(): string | null {
  const value = storage.getString(PENDING_GROUP_INVITE_KEY);
  return value ? extractInviteCodeFromQr(value) : null;
}

export function clearPendingGroupInvite(): void {
  storage.delete(PENDING_GROUP_INVITE_KEY);
}

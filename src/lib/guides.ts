import { storage } from './storage';

export type GuideId = 'groups' | 'today' | 'record' | 'archive';

export const GUIDE_IDS: GuideId[] = ['groups', 'today', 'record', 'archive'];

const GUIDE_VERSIONS: Record<GuideId, number> = {
  groups: 2,
  today: 3,
  record: 2,
  archive: 2,
};
const guideKey = (id: GuideId) => `app_guide_${id}_v${GUIDE_VERSIONS[id]}`;
const INITIAL_GUIDE_PENDING_KEY = 'initial_app_guide_pending';
const GUIDE_REPLAY_REQUEST_KEY = 'app_guide_replay_request';

export function isGuideComplete(id: GuideId): boolean {
  return storage.getBoolean(guideKey(id)) === true;
}

export function completeGuide(id: GuideId): void {
  storage.set(guideKey(id), true);
}

export function resetGuideProgress(): void {
  GUIDE_IDS.forEach((id) => storage.delete(guideKey(id)));
  storage.delete(GUIDE_REPLAY_REQUEST_KEY);
}

export function queueInitialGuide(): void {
  // Profile creation is account-specific even when multiple people use the
  // same device. Always give a newly created profile its one introduction.
  storage.delete(guideKey('groups'));
  storage.set(INITIAL_GUIDE_PENDING_KEY, true);
}

export function shouldShowInitialGuide(): boolean {
  return storage.getBoolean(INITIAL_GUIDE_PENDING_KEY) === true
    && !isGuideComplete('groups');
}

export function clearInitialGuideRequest(): void {
  storage.delete(INITIAL_GUIDE_PENDING_KEY);
}

export function requestGuideReplay(id: GuideId): void {
  storage.set(GUIDE_REPLAY_REQUEST_KEY, id);
}

export function isGuideReplayRequested(id: GuideId): boolean {
  return storage.getString(GUIDE_REPLAY_REQUEST_KEY) === id;
}

export function clearGuideReplayRequest(id: GuideId): void {
  if (isGuideReplayRequested(id)) storage.delete(GUIDE_REPLAY_REQUEST_KEY);
}

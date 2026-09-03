import { useCallback, useRef, useState } from 'react';

import { useGroupStore } from '../store/useGroupStore';
import { useProfileStore } from '../store/useProfileStore';
import { useSocialStore } from '../store/useSocialStore';
import { useStreaksStore } from '../store/useStreaksStore';
import { useTodayStore } from '../store/useTodayStore';

const REFRESH_DEBOUNCE_MS = 1200;

export function useRefreshAllData() {
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  const lastRefreshStartedAtRef = useRef(0);

  const refreshAllData = useCallback(async () => {
    const now = Date.now();
    if (
      refreshingRef.current
      || now - lastRefreshStartedAtRef.current < REFRESH_DEBOUNCE_MS
    ) {
      return false;
    }

    refreshingRef.current = true;
    lastRefreshStartedAtRef.current = now;
    setRefreshing(true);

    try {
      // The group directory owns the active group used by the scoped requests.
      await useGroupStore.getState().fetchGroups({ force: true });
      const groupId = useGroupStore.getState().activeGroupId;

      await Promise.allSettled([
        useProfileStore.getState().fetchProfileData(),
        useSocialStore.getState().fetchSocialData({ force: true }),
        ...(groupId
          ? [
              useTodayStore.getState().fetchTodayVlogs(groupId),
              useStreaksStore.getState().fetchStreaksData(groupId, { force: true }),
            ]
          : []),
      ]);
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }

    return true;
  }, []);

  return { refreshing, refreshAllData };
}

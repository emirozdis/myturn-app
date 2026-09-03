// ./src/store/useStreaksStore.ts
import { create } from 'zustand';
import { apiClient } from '../lib/apiClient';
import { getWidgetDuration, syncWidgetData } from '../lib/widgetSync';
import { storage } from '../lib/storage';

export interface LeaderboardUser {
  name: string;
  streak: number;
  img: string | null;
  isMe: boolean;
  xp: number;
  archetype: string;
  rank: number;
}

export interface CalendarDay {
  d: number;
  type: 'vlogged' | 'missed' | 'empty';
  avatar?: string;
  isToday?: boolean;
  assignment?: {
    id: string;
    user: { id: string; name: string; handle: string; image: string | null };
    clips: any[];
    date: string;
  };
}

export interface HistoricalDay {
  id: string;
  user: { id: string; name: string; handle: string; image: string | null };
  clips: any[];
  date: string;
}

interface StreaksState {
  currentStreak: number;
  bestStreak: number;
  totalVlogs: number;
  friendsStreaks: LeaderboardUser[];
  calendarDays: CalendarDay[];
  historicalDays: HistoricalDay[];
  loading: boolean;
  error: string | null;

  // Actions
  hydrateForUser: (userId: string, groupId: string) => boolean;
  fetchStreaksData: (groupId: string, options?: { force?: boolean }) => Promise<void>;
}

const streaksCacheKey = (userId: string, groupId: string) => `cached_streaks_${userId}_${groupId}`;

export const useStreaksStore = create<StreaksState>((set) => ({
  currentStreak: 0,
  bestStreak: 0,
  totalVlogs: 0,
  friendsStreaks: [],
  calendarDays: [],
  historicalDays: [],
  loading: false,
  error: null,

  hydrateForUser: (userId, groupId) => {
    try {
      const raw = storage.getString(streaksCacheKey(userId, groupId));
      if (!raw) return false;
      const cached = JSON.parse(raw);
      set({
        currentStreak: cached.currentStreak || 0,
        bestStreak: cached.bestStreak || 0,
        totalVlogs: cached.totalVlogs || 0,
        friendsStreaks: cached.friendsStreaks || [],
        calendarDays: cached.calendarDays || [],
        historicalDays: cached.historicalDays || [],
        loading: false,
        error: null,
      });
      return true;
    } catch {
      return false;
    }
  },

  fetchStreaksData: async (groupId: string, options) => {
    console.log(`[DEBUG] [useStreaksStore] [fetchStreaksData] Fetching streaks/data for Group: ${groupId}`);
    set({ loading: true, error: null });
    const res = (await apiClient.request<any>(
      'streaks/data',
      [groupId],
      options?.force ? { cachePolicy: 'network-only' } : undefined,
    )) as any;
    set({ loading: false });

    if (res.success) {
      console.log(`[DEBUG] [useStreaksStore] [fetchStreaksData] Success response received.`);
      console.log(`  - currentStreak: ${res.currentStreak}`);
      console.log(`  - bestStreak: ${res.bestStreak}`);
      console.log(`  - totalVlogs: ${res.totalVlogs}`);
      console.log(`  - friendsStreaks count: ${res.friendsStreaks?.length || 0}`);
      console.log(`  - calendarDays count: ${res.calendarDays?.length || 0}`);
      console.log(`  - historicalDays count: ${res.historicalDays?.length || 0}`);

      const previousStory = res.historicalDays?.[0];
      const previousClips = previousStory?.clips || [];
      const previousClip = previousClips[0];
      syncWidgetData({
        hasYesterdayStory: !!previousStory && previousClips.length > 0,
        yesterdayThumbnail: previousClip?.thumbnailUrl || '',
        yesterdayDuration: getWidgetDuration(previousClip),
        yesterdayDate: previousStory?.date || previousClip?.recordedAt || '',
        yesterdayVloggerName: previousStory?.user?.name || '',
        yesterdayVloggerAvatar: previousStory?.user?.image || '',
        yesterdayClipsCount: previousClips.length,
      });

      set({
        currentStreak: res.currentStreak || 0,
        bestStreak: res.bestStreak || 0,
        totalVlogs: res.totalVlogs || 0,
        friendsStreaks: res.friendsStreaks || [],
        calendarDays: res.calendarDays || [],
        historicalDays: res.historicalDays || [],
      });
      const cacheUserId = storage.getString('auth_firebase_uid');
      if (cacheUserId) {
        storage.set(streaksCacheKey(cacheUserId, groupId), JSON.stringify({
          currentStreak: res.currentStreak || 0,
          bestStreak: res.bestStreak || 0,
          totalVlogs: res.totalVlogs || 0,
          friendsStreaks: res.friendsStreaks || [],
          calendarDays: res.calendarDays || [],
          historicalDays: res.historicalDays || [],
          savedAt: Date.now(),
        }));
      }
    } else {
      console.error(`[DEBUG] [useStreaksStore] [fetchStreaksData] Endpoint error: ${res.error}`);
      set({ error: res.error || 'Failed to sync streaks history.' });
    }
  },
}));

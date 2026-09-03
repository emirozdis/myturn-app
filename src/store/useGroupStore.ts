// src/store/useGroupStore.ts
import { create } from 'zustand';
import { waitForAuthInitialization } from '../lib/authState';
import { apiClient } from '../lib/apiClient';
import { storage } from '../lib/storage';

export type Group = {
  id: string;
  name: string;
  image: string | null;
  timezone: string;
  memberCount: number;
  level: number;
  boostCount: number;
  hasBoosted: boolean;
  userBoostCount: number;
  boostGracePeriodEndsAt: string | null;
  isFrozen: boolean;
  inviteCode: string;
  role: string;
  boosters?: Array<{ id: string; name: string; image: string | null }>;
  members?: Array<{ id: string; name: string; handle: string | null; image: string | null; role: string }>;
};

interface GroupState {
  groups: Group[];
  activeGroupId: string | null;
  loading: boolean;
  hasLoaded: boolean;
  error: string | null;
  hydrateForUser: (userId: string) => boolean;
  fetchGroups: (options?: { force?: boolean }) => Promise<void>;
  setActiveGroupId: (id: string) => void;
  toggleGroupBoost: (groupId: string, action?: 'add' | 'remove') => Promise<{ success: boolean; boosted?: boolean; boostCount?: number; userBoostCount?: number; error?: string }>;
  rotateInviteCode: (groupId: string) => Promise<{ success: boolean; inviteCode?: string; error?: string }>;
  transferLeadership: (groupId: string, targetUserId: string) => Promise<{ success: boolean; error?: string }>;
  kickMember: (groupId: string, targetUserId: string) => Promise<{ success: boolean; error?: string }>;
  deleteGroup: (groupId: string) => Promise<{ success: boolean; error?: string }>;
  updateGroupImage: (groupId: string, localUri: string) => Promise<{ success: boolean; imageUrl?: string }>;
  removeGroupImage: (groupId: string) => Promise<{ success: boolean }>;
  clearGroups: () => void;
}

const groupCacheKey = (userId: string) => `cached_groups_${userId}`;

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: [],
  activeGroupId: storage.getString('active_group_id') || null,
  loading: false,
  hasLoaded: false,
  error: null,

  hydrateForUser: (userId) => {
    try {
      const raw = storage.getString(groupCacheKey(userId));
      if (!raw) {
        storage.delete('active_group_id');
        set({ groups: [], activeGroupId: null, loading: false, hasLoaded: false, error: null });
        return false;
      }
      const cached = JSON.parse(raw) as { groups?: Group[]; activeGroupId?: string | null };
      if (!Array.isArray(cached.groups)) return false;
      const activeGroupId = cached.groups.some((group) => group.id === cached.activeGroupId)
        ? cached.activeGroupId || null
        : cached.groups[0]?.id || null;
      if (activeGroupId) storage.set('active_group_id', activeGroupId);
      else storage.delete('active_group_id');
      set({
        groups: cached.groups,
        activeGroupId,
        loading: false,
        hasLoaded: true,
        error: null,
      });
      return true;
    } catch {
      storage.delete('active_group_id');
      set({ groups: [], activeGroupId: null, loading: false, hasLoaded: false, error: null });
      return false;
    }
  },

  fetchGroups: async (options) => {
    const user = await waitForAuthInitialization();
    if (!user) {
      console.log(`[DEBUG] [useGroupStore] fetchGroups aborted - no active Firebase user.`);
      set({ loading: false, hasLoaded: true });
      return;
    }

    console.log(`[DEBUG] [useGroupStore] Fetching dynamic group directory listings...`);
    set({ loading: true, error: null });
    const res = (await apiClient.request<any>(
      'group/list',
      [],
      options?.force ? { cachePolicy: 'network-only' } : undefined,
    )) as any;
    
    if (res.success && res.groups) {
      const fetchedGroups = res.groups;
      console.log(`[DEBUG] [useGroupStore] fetchGroups success. Groups found: ${fetchedGroups.length}`);
      set({ groups: fetchedGroups, loading: false, hasLoaded: true });

      if (fetchedGroups.length > 0) {
        const savedId = storage.getString('active_group_id');
        const isValid = fetchedGroups.some((g: Group) => g.id === savedId);
        
        if (savedId && isValid) {
          console.log(`[DEBUG] [useGroupStore] Retained active group selection ID: ${savedId}`);
          set({ activeGroupId: savedId });
        } else {
          const firstId = fetchedGroups[0].id;
          console.log(`[DEBUG] [useGroupStore] Defaulting active group selection to: ${firstId}`);
          storage.set('active_group_id', firstId);
          set({ activeGroupId: firstId });
        }
      } else {
        console.log(`[DEBUG] [useGroupStore] WARNING: No groups found for current user.`);
        storage.delete('active_group_id');
        set({ activeGroupId: null });
      }
      const activeGroupId = get().activeGroupId;
      storage.set(groupCacheKey(user.uid), JSON.stringify({
        groups: fetchedGroups,
        activeGroupId,
        savedAt: Date.now(),
      }));
    } else {
      console.log(`[DEBUG] [useGroupStore] Silent abort on fetch groups: ${res.error}`);
      set({ loading: false, hasLoaded: true, error: res.error || 'Gruplar yüklenemedi.' });
    }
  },

  setActiveGroupId: (id: string) => {
    console.log(`[DEBUG] [useGroupStore] Setting active group selection ID: ${id}`);
    storage.set('active_group_id', id);
    set({ activeGroupId: id });
  },

  toggleGroupBoost: async (groupId: string, action: 'add' | 'remove' = 'add') => {
    const res = (await apiClient.request<any>('group/boost', [{ groupId, action }])) as any;
    if (res.success) {
      set(state => ({
        groups: state.groups.map(g => {
          if (g.id === groupId) {
            return {
              ...g,
              hasBoosted: res.userBoostCount > 0,
              boostCount: res.boostCount,
              userBoostCount: res.userBoostCount,
            };
          }
          return g;
        })
      }));
      await get().fetchGroups();
      return { success: true, boosted: res.boosted, boostCount: res.boostCount, userBoostCount: res.userBoostCount };
    }
    return { success: false, error: res.error };
  },

  rotateInviteCode: async (groupId: string) => {
    const res = (await apiClient.request<any>('group', [{ action: 'rotateInviteCode', groupId }])) as any;
    if (!res.success || !res.group?.inviteCode) {
      return { success: false, error: res.error || 'Davet kodu yenilenemedi.' };
    }

    const inviteCode = res.group.inviteCode as string;
    set((state) => ({
      groups: state.groups.map((group) => group.id === groupId ? { ...group, inviteCode } : group),
    }));
    return { success: true, inviteCode };
  },

  transferLeadership: async (groupId: string, targetUserId: string) => {
    const res = await apiClient.request<void>('group', [{ action: 'transferLeadership', groupId, targetUserId }]);
    if (!res.success) return { success: false, error: res.error };
    await get().fetchGroups();
    return { success: true };
  },

  kickMember: async (groupId: string, targetUserId: string) => {
    const res = await apiClient.request<void>('group', [{ action: 'kickMember', groupId, targetUserId }]);
    if (!res.success) return { success: false, error: res.error };
    await get().fetchGroups();
    return { success: true };
  },

  deleteGroup: async (groupId: string) => {
    const res = await apiClient.request<void>('group', [{ action: 'deleteGroup', groupId }]);
    if (!res.success) return { success: false, error: res.error };

    const remainingGroups = get().groups.filter((group) => group.id !== groupId);
    const nextActiveGroupId = get().activeGroupId === groupId ? (remainingGroups[0]?.id || null) : get().activeGroupId;
    if (nextActiveGroupId) storage.set('active_group_id', nextActiveGroupId);
    else storage.delete('active_group_id');
    set({ groups: remainingGroups, activeGroupId: nextActiveGroupId });
    await get().fetchGroups();
    return { success: true };
  },

  updateGroupImage: async (groupId: string, localUri: string) => {
    const fileId = Math.random().toString(36).substring(7);
    const path = `group_avatars/${groupId}_${fileId}.jpg`;
    
    const uploadRes = await apiClient.uploadMedia('avatars', localUri, path);
    if (!uploadRes.success) return { success: false };
    
    const res = (await apiClient.request<any>('group', [{ action: 'updateImage', groupId, image: path }])) as any;
    if (res.success && res.group) {
      await get().fetchGroups();
      return { success: true, imageUrl: res.group.image };
    }
    return { success: false };
  },

  removeGroupImage: async (groupId: string) => {
    const res = (await apiClient.request<any>('group', [{ action: 'updateImage', groupId, image: null }])) as any;
    if (res.success && res.group) {
      await get().fetchGroups();
      return { success: true };
    }
    return { success: false };
  },

  clearGroups: () => {
    console.log(`[DEBUG] [useGroupStore] Flushing group variables from MMKV storage and state.`);
    storage.delete('active_group_id');
    set({ groups: [], activeGroupId: null, error: null, loading: false, hasLoaded: false });
  }
}));

// Changelog:
// - Substituted synchronous authentication queries with promise-based initialization checkpoints on active stores.

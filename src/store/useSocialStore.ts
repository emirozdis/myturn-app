// src/store/useSocialStore.ts
import { create } from 'zustand';
import { waitForAuthInitialization } from '../lib/authState';
import { apiClient } from '../lib/apiClient';
import analytics from '@react-native-firebase/analytics';
import { getDeviceUtcOffset } from '../lib/businessTime';

export interface Group {
  id: string;
  name: string;
  memberCount: number;
  image: string | null;
  inviteCode: string;
  timezone: string;
  members: Array<{ id: string; name: string; image: string | null; role: string }>;
}

export interface Friend {
  id: string;
  name: string;
  handle: string;
  image: string | null;
  hasStory: boolean;
}

export interface FriendRequest {
  id: string;
  user: {
    id: string;
    name: string;
    handle: string;
    image: string | null;
  };
}

interface SocialState {
  friends: Friend[];
  pendingRequests: FriendRequest[];
  sentRequests: FriendRequest[];
  groups: Group[];
  suggestions: Array<{ id: string; name: string; image: string | null; mutual: number; requested: boolean }>;
  loading: boolean;
  error: string | null;

  fetchSocialData: (options?: { force?: boolean }) => Promise<void>;
  sendFriendRequest: (targetUserId: string) => Promise<{ success: boolean; error?: string }>;
  respondFriendRequest: (requestId: string, accept: boolean) => Promise<{ success: boolean; error?: string }>;
  cancelFriendRequest: (requestId: string) => Promise<{ success: boolean; error?: string }>;
  joinGroup: (inviteCode: string) => Promise<{ success: boolean; error?: string }>;
  createGroup: (name: string, timezone?: string, localImageUri?: string | null) => Promise<string | null>;
  leaveGroup: (groupId: string) => Promise<{ success: boolean; error?: string }>;
}

export const useSocialStore = create<SocialState>((set, get) => ({
  friends: [],
  pendingRequests: [],
  sentRequests: [],
  groups: [],
  suggestions: [],
  loading: false,
  error: null,

  fetchSocialData: async (options) => {
    const user = await waitForAuthInitialization();
    if (!user) {
      console.log(`[DEBUG] [useSocialStore] fetchSocialData aborted - no active Firebase user.`);
      return;
    }

    set({ loading: true, error: null });
    const res = (await apiClient.request<any>(
      'social/data',
      [],
      options?.force ? { cachePolicy: 'network-only' } : undefined,
    )) as any;
    set({ loading: false });

    if (res.success) {
      set({
        friends: res.friends || [],
        pendingRequests: res.pendingRequests || [],
        sentRequests: res.sentRequests || [],
        groups: res.groups || [],
        suggestions: res.suggestions || [],
      });
    } else {
      console.log(`[DEBUG] [useSocialStore] Silent abort on fetch social: ${res.error}`);
    }
  },

  sendFriendRequest: async (targetUserId: string) => {
    const res = await apiClient.request<void>('social/friend-request', [targetUserId]);
    if (res.success) {
      analytics().logEvent('send_friend_request');
      get().fetchSocialData();
      return { success: true };
    }
    return { success: false, error: res.error };
  },

  respondFriendRequest: async (requestId: string, accept: boolean) => {
    const res = await apiClient.request<void>('social/respond-friend-request', [requestId, accept]);
    if (res.success) {
      analytics().logEvent('respond_friend_request', { accepted: accept });
      get().fetchSocialData();
      return { success: true };
    }
    return { success: false, error: res.error };
  },

  cancelFriendRequest: async (requestId: string) => {
    const res = await apiClient.request<void>('social/cancel-friend-request', [requestId]);
    if (res.success) {
      get().fetchSocialData();
      return { success: true };
    }
    return { success: false, error: res.error };
  },

  joinGroup: async (inviteCode: string) => {
    const res = (await apiClient.request<any>('group/join', [inviteCode])) as any;
    if (res.success) {
      analytics().logJoinGroup({ group_id: inviteCode });
      get().fetchSocialData();
      return { success: true };
    }
    return { success: false, error: res.error };
  },

  createGroup: async (name: string, timezone = getDeviceUtcOffset(), localImageUri: string | null = null) => {
    const res = (await apiClient.request<any>('group/create', [name, timezone, null])) as any;
    if (res.success && res.group) {
      const groupId = res.group.id;

      if (localImageUri) {
         const fileId = Math.random().toString(36).substring(7);
         const path = `group_avatars/${groupId}_${fileId}.jpg`;
         const uploadRes = await apiClient.uploadMedia('avatars', localImageUri, path);
         if (uploadRes.success) {
           const updateRes = (await apiClient.request<any>('group', [{ action: 'updateImage', groupId, image: path }])) as any;
           if (updateRes.success) {
             console.log(`[DEBUG] Created group and successfully mapped the avatar path using Group UUID: ${path}`);
           }
         }
      }

      analytics().logEvent('create_group', { group_id: groupId });
      get().fetchSocialData();
      return res.group.inviteCode;
    }
    return null;
  },

  leaveGroup: async (groupId: string) => {
    const res = await apiClient.request<void>('group/leave', [groupId]);
    if (res.success) {
      analytics().logEvent('leave_group', { group_id: groupId });
      set((state) => ({
        groups: state.groups.filter((g) => g.id !== groupId),
      }));
      return { success: true };
    }
    return { success: false, error: res.error };
  },
}));

// Changelog:
// - Substituted synchronous authentication queries with promise-based initialization checkpoints on active stores.

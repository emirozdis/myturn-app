// src/store/useProfileStore.ts
import { create } from 'zustand';
import { waitForAuthInitialization } from '../lib/authState';
import { apiClient } from '../lib/apiClient';
import { storage } from '../lib/storage';
import { parseMediaMetadata } from '../lib/mediaMetadata';

export type ProfileClip = {
  id: string;
  videoUrl: string;
  thumbnailUrl: string;
  thumbnailBlurUrl?: string;
  hlsUrl?: string;
  location: string;
  recordedAt: string;
  mediaType?: string;
  prompt?: string | null;
  photoResponses: any[];
  _count?: {
    reactions: number;
    comments: number;
  };
  metadata?: string | Record<string, any>;
};

export type CalendarDay = {
  d: number;
  type: 'vlogged' | 'missed' | 'empty';
};

type ProfileUser = {
  id: string;
  name: string;
  handle: string;
  image: string;
  bio: string;
  location: string;
  xp: number;
  archetype: string;
  createdAt: string;
};

type ProfileDataResponse = {
  user: ProfileUser;
  totalVlogs?: number;
  totalLikes?: number;
  totalComments?: number;
  totalPhotos?: number;
  groupsCount?: number;
  friendsCount?: number;
  clips?: ProfileClip[];
  calendarDays?: CalendarDay[];
};

interface ProfileState {
  user: ProfileUser;
  totalVlogs: number;
  totalLikes: number;
  totalComments: number;
  totalPhotos: number;
  groupsCount: number;
  friendsCount: number;
  clips: ProfileClip[];
  calendarDays: CalendarDay[];
  alwaysHighestQuality: boolean;
  
  // Actions
  hydrateForUser: (userId: string) => boolean;
  fetchProfileData: () => Promise<void>;
  updateProfile: (data: { name: string; handle: string; bio: string; location: string }) => Promise<void>;
  uploadAvatar: (localUri: string) => Promise<void>;
  deleteClip: (clipId: string) => Promise<void>;
  setAlwaysHighestQuality: (val: boolean) => void;
}

type ProfileDataState = Pick<
  ProfileState,
  'user' | 'totalVlogs' | 'totalLikes' | 'totalComments' | 'totalPhotos' |
  'groupsCount' | 'friendsCount' | 'clips' | 'calendarDays'
>;

const normalizeProfileData = (res: ProfileDataResponse): ProfileDataState => ({
  user: res.user,
  totalVlogs: res.totalVlogs || 0,
  totalLikes: res.totalLikes || 0,
  totalComments: res.totalComments || 0,
  totalPhotos: res.totalPhotos || 0,
  groupsCount: res.groupsCount || 0,
  friendsCount: res.friendsCount || 0,
  clips: (res.clips || []).map((clip: ProfileClip) => {
    let isPhoto = clip.mediaType === 'photo';
    if (!isPhoto && clip.metadata) {
      isPhoto = parseMediaMetadata(clip.metadata)?.mediaType === 'photo';
    }
    return isPhoto && clip.videoUrl
      ? { ...clip, thumbnailUrl: clip.videoUrl, thumbnailBlurUrl: clip.videoUrl }
      : clip;
  }),
  calendarDays: res.calendarDays || [],
});

const profileDataChanged = (current: ProfileState, next: ProfileDataState) =>
  JSON.stringify({
    user: current.user,
    totalVlogs: current.totalVlogs,
    totalLikes: current.totalLikes,
    totalComments: current.totalComments,
    totalPhotos: current.totalPhotos,
    groupsCount: current.groupsCount,
    friendsCount: current.friendsCount,
    clips: current.clips,
    calendarDays: current.calendarDays,
  }) !== JSON.stringify(next);

const profileCacheKey = (userId: string) => `cached_profile_${userId}`;
const emptyProfileData = (): ProfileDataState => ({
  user: {
    id: '', name: '', handle: '', image: '', bio: '', location: '',
    xp: 0, archetype: 'Ghost Watcher', createdAt: '',
  },
  totalVlogs: 0,
  totalLikes: 0,
  totalComments: 0,
  totalPhotos: 0,
  groupsCount: 0,
  friendsCount: 0,
  clips: [],
  calendarDays: [],
});

export const useProfileStore = create<ProfileState>((set, get) => ({
  user: {
    id: '',
    name: '',
    handle: '',
    image: '',
    bio: '',
    location: '',
    xp: 0,
    archetype: 'Ghost Watcher',
    createdAt: '',
  },
  totalVlogs: 0,
  totalLikes: 0,
  totalComments: 0,
  totalPhotos: 0,
  groupsCount: 0,
  friendsCount: 0,
  clips: [],
  calendarDays: [],
  alwaysHighestQuality:
    storage.getString('always_highest_quality') === 'true' ||
    storage.getString('disable_abr') === 'true',

  hydrateForUser: (userId) => {
    try {
      const raw = storage.getString(profileCacheKey(userId));
      if (!raw) {
        set(emptyProfileData());
        return false;
      }
      const cached = normalizeProfileData(JSON.parse(raw));
      set(cached);
      return true;
    } catch {
      set(emptyProfileData());
      return false;
    }
  },

  fetchProfileData: async () => {
    const user = await waitForAuthInitialization();
    if (!user) {
      console.log(`[DEBUG] [useProfileStore] fetchProfileData aborted - no active Firebase user.`);
      return;
    }

    console.log(`[DEBUG] [useProfileStore] [fetchProfileData] Revalidating profile/data from network.`);
    const res = await apiClient.request<ProfileDataResponse>('profile/data', [], { cachePolicy: 'network-only' });
    
    if (res.success) {
      console.log(`[DEBUG] [useProfileStore] [fetchProfileData] Success response received.`);
      console.log(`  - User: @${res.user?.handle || "None"}`);
      console.log(`  - Clips count: ${res.clips?.length || 0}`);
      console.log(`  - Calendar days count: ${res.calendarDays?.length || 0}`);

      const freshData = normalizeProfileData(res);
      if (profileDataChanged(get(), freshData)) {
        console.log(`[DEBUG] [useProfileStore] [fetchProfileData] Fresh profile differs; updating UI.`);
        set(freshData);
      } else {
        console.log(`[DEBUG] [useProfileStore] [fetchProfileData] Fresh profile matches current data; keeping UI state.`);
      }
      storage.set(profileCacheKey(user.uid), JSON.stringify({
        ...freshData,
        savedAt: Date.now(),
      }));
    } else {
      console.log(`[DEBUG] [useProfileStore] [fetchProfileData] Silent abort on fetch profile: ${res.error}`);
    }
  },

  updateProfile: async (data) => {
    const res = await apiClient.request<{ user?: ProfileUser }>('profile/update', [data]);
    if (res.success && res.user) {
      set({ user: res.user });
    }
  },

  uploadAvatar: async (localUri: string) => {
    console.log(`[DEBUG] [useProfileStore] Initiating avatar base64 request for local file: ${localUri}`);
    const res = await apiClient.request<{ imagePath?: string; imageUrl?: string }>('profile/avatar', [localUri]);
    
    if (res.success && res.imagePath) {
      console.log(`[DEBUG] [useProfileStore] Avatar upload succeeded. imagePath: ${res.imagePath}`);
      const image = res.imageUrl || res.imagePath;
      set((state) => ({
        user: { ...state.user, image },
      }));
    } else {
      throw new Error(res.error || "Sunucu profil fotoğrafı güncellemeyi reddetti.");
    }
  },

  deleteClip: async (clipId) => {
    const res = await apiClient.request<void>('vlog/delete-clip', [clipId]);
    if (res.success) {
      set((state) => ({
        clips: state.clips.filter((c) => c.id !== clipId),
        totalVlogs: Math.max(0, state.totalVlogs - 1),
      }));
    }
  },

  setAlwaysHighestQuality: (val) => {
    storage.set('always_highest_quality', String(val));
    storage.delete('disable_abr');
    set({ alwaysHighestQuality: val });
  },
}));

// Changelog:
// - Substituted synchronous authentication queries with promise-based initialization checkpoints on active stores.

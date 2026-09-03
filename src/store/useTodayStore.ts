// src/store/useTodayStore.ts
import { create } from 'zustand';
import { Image as NativeImage } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { FileSystemUploadType } from 'expo-file-system/legacy';
import { apiClient } from '../lib/apiClient';
import { storage } from '../lib/storage';
import { useAchievementStore } from './useAchievementStore';
import { useProfileStore } from './useProfileStore';
import { getWidgetDuration, syncWidgetData } from '../lib/widgetSync';
import { getSeenMedia, markMediaAsSeen } from '../lib/seenMedia';
import analytics from '@react-native-firebase/analytics';
import { getBusinessHour } from '../lib/businessTime';
import { getHlsPlaybackUrl } from '../lib/hlsPlayback';
import { addDiagnosticBreadcrumb, reportHttpFailure } from '../lib/diagnostics';
import { parseMediaMetadata } from '../lib/mediaMetadata';

const debugTodayFeed = (...args: unknown[]) => console.log('[DEBUG][TodayFeed]', ...args);

export type Clip = {
  id: string;
  assignmentId: string;
  userId: string;
  groupId: string;
  videoUrl: string;
  thumbnailUrl: string;
  thumbnailBlurUrl?: string;
  hlsUrl?: string;
  transcodeStatus: string;
  location: string;
  recordedAt: string;
  mediaType?: string;
  prompt?: string | null;
  comments: any[];
  views: any[];
  reactions: any[];
  photoResponses?: any[];
  metadata?: string | Record<string, any>;
  caption?: string;
};

export type AssignmentAvailability = {
  status: 'assigned' | 'waiting_for_members' | 'sleep_mode' | 'unavailable';
  memberCount: number;
  minimumMemberCount: number;
};

interface TodayState {
  assignment: any;
  assignmentAvailability: AssignmentAvailability | null;
  clips: Clip[];
  resolvedClipUrls: Record<string, string>;
  resolvedClipThumbnails: Record<string, string>;
  resolvedClipBlurThumbnails: Record<string, string>;
  isSleepMode: boolean;
  isVideoExpanded: boolean;
  isPaused: boolean;
  currentClipIndex: number;
  currentHourIndex: number;
  actualHourIndex: number;
  hasVolunteeredForTomorrow: boolean;
  canVolunteer: boolean;
  volunteerEligibilityReason: string;
  isVolunteering: boolean;
  volunteerError: string;
  poking: boolean;
  pokeCooldown: number;
  liked: boolean;
  likeCount: number;
  uploadingPhoto: boolean;
  dailyPrompt: string | null;
  loading: boolean;
  loadedGroupId: string | null;
  
  // Actions
  hydrateForUser: (userId: string, groupId: string) => boolean;
  fetchTodayVlogs: (groupId: string) => Promise<void>;
  refreshTodayTurnState: (groupId: string) => Promise<void>;
  toggleLike: () => Promise<void>;
  setPaused: (paused: boolean) => void;
  setVideoExpanded: (expanded: boolean) => void;
  setCurrentHourIndex: (index: number) => void;
  selectClip: (clipId: string) => boolean;
  nextSubClip: () => void;
  prevSubClip: () => void;
  pokeVlogger: () => Promise<void>;
  passTurn: () => Promise<void>;
  claimTurn: () => Promise<void>;
  skipPrompt: () => Promise<void>;
  toggleVolunteer: () => Promise<void>;
  addComment: (text: string, parentId?: string) => Promise<void>;
  toggleCommentLike: (id: string) => Promise<void>;
  deleteComment: (id: string) => Promise<void>;
  uploadPhotoResponse: (localUri: string) => Promise<void>;
  trackView: (clipId: string) => Promise<void>;
}

export function getSlotForClip(recordedAt: Date | string, timezone?: string): number {
  const date = new Date(recordedAt);
  const hours = getBusinessHour(date, timezone || "UTC");

  if (hours >= 9 && hours < 12) return 0;
  if (hours >= 12 && hours < 15) return 1;
  if (hours >= 15 && hours < 18) return 2;
  if (hours >= 18 && hours < 21) return 3;
  if (hours >= 21 && hours < 24) return 4;
  return 5;
}

let cooldownInterval: any = null;
let latestTodayFetchId = 0;
const todayCacheKey = (userId: string, groupId: string) => `cached_today_${userId}_${groupId}`;
const getCurrentUserId = () =>
  storage.getString('auth_user_id') || storage.getString('auth_firebase_uid') || '';

const getClipReactionState = (clip: Clip | null | undefined, userId = getCurrentUserId()) => ({
  liked: !!clip?.reactions?.some((reaction: any) => reaction.userId === userId),
  likeCount: clip?.reactions?.length || 0,
});

const resolveStartupSelection = (clips: Clip[], timezone: string) => {
  const actualHourIndex = getSlotForClip(new Date(), timezone);
  if (clips.length === 0) {
    return {
      currentClipIndex: -1,
      currentHourIndex: actualHourIndex,
      actualHourIndex,
    };
  }

  const seenMedia = getSeenMedia();
  const firstUnseenIndex = clips.findIndex((clip) => !seenMedia[clip.id]);
  const currentClipIndex = firstUnseenIndex >= 0
    ? firstUnseenIndex
    : clips.length - 1;

  return {
    currentClipIndex,
    currentHourIndex: getSlotForClip(clips[currentClipIndex].recordedAt, timezone),
    actualHourIndex,
  };
};

const startCooldownCountdown = (set: any, get: any) => {
  if (cooldownInterval) {
    clearInterval(cooldownInterval);
    cooldownInterval = null;
  }
  
  cooldownInterval = setInterval(() => {
    const current = get().pokeCooldown;
    if (current > 0) {
      set({ pokeCooldown: current - 1 });
    } else {
      if (cooldownInterval) {
        clearInterval(cooldownInterval);
        cooldownInterval = null;
      }
    }
  }, 1000);
};

export const useTodayStore = create<TodayState>((set, get) => ({
  assignment: null,
  assignmentAvailability: null,
  clips: [],
  currentClipIndex: 0,
  currentHourIndex: 0, 
  actualHourIndex: 0,
  isPaused: false,
  isVideoExpanded: false,
  isSleepMode: false,
  liked: false,
  likeCount: 0,
  poking: false,
  pokeCooldown: 0,
  hasVolunteeredForTomorrow: false,
  canVolunteer: false,
  volunteerEligibilityReason: '',
  isVolunteering: false,
  volunteerError: '',
  uploadingPhoto: false,
  resolvedClipUrls: {},
  resolvedClipThumbnails: {},
  resolvedClipBlurThumbnails: {},
  dailyPrompt: null,
  loading: false,
  loadedGroupId: null,

  hydrateForUser: (userId, groupId) => {
    try {
      const raw = storage.getString(todayCacheKey(userId, groupId));
      if (!raw) return false;
      const cached = JSON.parse(raw);
      if (!Array.isArray(cached.clips)) return false;
      const timezone = cached.assignment?.group?.timezone || 'UTC';
      const startupSelection = resolveStartupSelection(cached.clips, timezone);
      const reactionState = getClipReactionState(cached.clips[startupSelection.currentClipIndex]);
      set({
        assignment: cached.assignment || null,
        assignmentAvailability: cached.assignmentAvailability || null,
        clips: cached.clips,
        resolvedClipUrls: cached.resolvedClipUrls || {},
        resolvedClipThumbnails: cached.resolvedClipThumbnails || {},
        resolvedClipBlurThumbnails: cached.resolvedClipBlurThumbnails || {},
        isSleepMode: !!cached.isSleepMode,
        hasVolunteeredForTomorrow: !!cached.hasVolunteeredForTomorrow,
        canVolunteer: !!cached.canVolunteer,
        volunteerEligibilityReason: cached.volunteerEligibilityReason || '',
        ...startupSelection,
        ...reactionState,
        dailyPrompt: cached.dailyPrompt || null,
        loading: false,
        loadedGroupId: groupId,
      });
      return true;
    } catch {
      return false;
    }
  },

  fetchTodayVlogs: async (groupId: string) => {
    const fetchId = ++latestTodayFetchId;
    debugTodayFeed('[fetchTodayVlogs] request-start', { groupId });
    set({ loading: true });
    const res = (await apiClient.request<any>('vlog/today-assignment', [groupId])) as any;

    // Ignore a slower response for a group the user has already switched away from.
    if (fetchId !== latestTodayFetchId) return;
    
    if (res.success) {
      const { assignment, assignmentAvailability, isSleepMode, hasVolunteered, canVolunteer, volunteerEligibilityReason, dailyPrompt } = res;
      const fetchedClips = (assignment?.clips || [])
        .map((clip: any) => {
          let isPhoto = clip.mediaType === 'photo';
          if (!isPhoto && clip.metadata) {
            isPhoto = parseMediaMetadata(clip.metadata)?.mediaType === 'photo';
          }
          return isPhoto && clip.videoUrl
            ? { ...clip, thumbnailUrl: clip.videoUrl, thumbnailBlurUrl: clip.videoUrl }
            : clip;
        })
        .sort((first: Clip, second: Clip) => {
          const firstRecordedAt = new Date(first.recordedAt).getTime();
          const secondRecordedAt = new Date(second.recordedAt).getTime();
          if (!Number.isFinite(firstRecordedAt) || !Number.isFinite(secondRecordedAt)) return 0;
          return firstRecordedAt - secondRecordedAt;
        });
      debugTodayFeed('[fetchTodayVlogs] response-success', {
        groupId,
        assignmentId: assignment?.id || null,
        hasAssignment: !!assignment,
        clipCount: fetchedClips.length,
        isSleepMode: !!isSleepMode,
        hasVolunteered: !!hasVolunteered,
        canVolunteer: !!canVolunteer,
        dailyPrompt: dailyPrompt || null,
      });
      
      const timezone = assignment?.group?.timezone || "UTC";
      const actualHourIdx = getSlotForClip(new Date(), timezone);

      // Cached hydration and the network refresh must not make two different
      // startup choices. Keep the currently visible clip by ID when it still
      // exists in the refreshed response, including navigation made while this
      // request was in flight. Only choose an unseen clip when no stable
      // selection exists.
      const stateBeforeRefresh = get();
      const visibleClipId = stateBeforeRefresh.loadedGroupId === groupId
        ? stateBeforeRefresh.clips[stateBeforeRefresh.currentClipIndex]?.id
        : null;
      const preservedClipIndex = visibleClipId
        ? fetchedClips.findIndex((clip: Clip) => clip.id === visibleClipId)
        : -1;
      const startupSelection = preservedClipIndex < 0
        ? resolveStartupSelection(fetchedClips, timezone)
        : null;
      const initialClipIdx = preservedClipIndex >= 0
        ? preservedClipIndex
        : startupSelection!.currentClipIndex;
      const initialHourIdx = initialClipIdx >= 0
        ? getSlotForClip(fetchedClips[initialClipIdx].recordedAt, timezone)
        : actualHourIdx;

      debugTodayFeed('[fetchTodayVlogs] selection-resolved', {
        visibleClipId,
        preservedVisibleClip: preservedClipIndex >= 0,
        selectedClipId: fetchedClips[initialClipIdx]?.id || null,
        initialHourIdx,
        initialClipIdx,
      });

      const urls: Record<string, string> = {};
      const thumbUrls: Record<string, string> = {};
      const blurThumbUrls: Record<string, string> = {};
      const alwaysHighestQuality =
        storage.getString('always_highest_quality') === 'true' ||
        storage.getString('disable_abr') === 'true';

      for (const clip of fetchedClips) {
        const isPhoto = clip.mediaType === 'photo';
        urls[clip.id] = isPhoto
          ? clip.videoUrl
          : clip.transcodeStatus === 'COMPLETED' && clip.hlsUrl
            ? getHlsPlaybackUrl(clip.hlsUrl, alwaysHighestQuality)
            : '';
        thumbUrls[clip.id] = clip.thumbnailUrl;
        blurThumbUrls[clip.id] = clip.thumbnailBlurUrl || clip.thumbnailUrl;
      }
      debugTodayFeed('[fetchTodayVlogs] resolved-media-urls', {
        groupId,
        clipCount: fetchedClips.length,
        hlsEnabled: true,
        alwaysHighestQuality,
        resolvedUrlCount: Object.keys(urls).length,
      });

      let initialPokeCooldown = 0;
      if (assignment?.pokes?.length > 0) {
        const lastPokeTime = new Date(assignment.pokes[0].createdAt).getTime();
        const diff = Date.now() - lastPokeTime;
        if (diff < 30 * 60 * 1000) {
          initialPokeCooldown = Math.floor((30 * 60 * 1000 - diff) / 1000);
        }
      }

      const currentUserId = getCurrentUserId();

      debugTodayFeed('[fetchTodayVlogs] state-update', {
        groupId,
        assignmentId: assignment?.id || null,
        initialHourIdx,
        initialClipIdx,
        currentUserId: currentUserId || null,
        pokeCooldown: initialPokeCooldown,
      });

      const latestClip = fetchedClips.length > 0 ? fetchedClips[fetchedClips.length - 1] : null;
      const initialReactionState = getClipReactionState(fetchedClips[initialClipIdx], currentUserId);

      // Push the API response to WidgetKit immediately after every refresh.
      syncWidgetData({
        hasTodayAssignment: !!assignment,
        hasLatestClip: !!latestClip,
        vloggerName: assignment?.user?.name || "No vlogger yet",
        vloggerHandle: assignment?.user?.handle || "",
        vloggerAvatar: assignment?.user?.image || "",
        isCurrentUserVlogger: assignment?.user?.id === currentUserId,
        clipsRecorded: fetchedClips.length,
        clipsGoal: 12,
        photosRecorded: fetchedClips.reduce((acc: number, c: any) => acc + (c.photoResponses?.length || 0), 0),
        timezone: assignment?.group?.timezone || "UTC",
        latestClipThumbnail: latestClip?.thumbnailUrl || "",
        latestClipDuration: getWidgetDuration(latestClip),
        latestClipRecordedAt: latestClip?.recordedAt || "",
      });

      set({
        assignment,
        assignmentAvailability: assignmentAvailability || null,
        clips: fetchedClips,
        isSleepMode: !!isSleepMode,
        hasVolunteeredForTomorrow: !!hasVolunteered,
        canVolunteer: !!canVolunteer,
        volunteerEligibilityReason: volunteerEligibilityReason || '',
        currentHourIndex: initialHourIdx,
        actualHourIndex: actualHourIdx,
        resolvedClipUrls: urls,
        resolvedClipBlurThumbnails: blurThumbUrls,
        resolvedClipThumbnails: thumbUrls,
        currentClipIndex: initialClipIdx,
        ...initialReactionState,
        poking: false,
        pokeCooldown: initialPokeCooldown,
        dailyPrompt,
        loading: false,
        loadedGroupId: groupId,
      });

      if (initialPokeCooldown > 0) {
        startCooldownCountdown(set, get);
      }

      const cacheUserId = storage.getString('auth_firebase_uid');
      if (cacheUserId) {
        storage.set(todayCacheKey(cacheUserId, groupId), JSON.stringify({
          assignment,
          assignmentAvailability: assignmentAvailability || null,
          clips: fetchedClips,
          resolvedClipUrls: urls,
          resolvedClipThumbnails: thumbUrls,
          resolvedClipBlurThumbnails: blurThumbUrls,
          isSleepMode: !!isSleepMode,
          hasVolunteeredForTomorrow: !!hasVolunteered,
          canVolunteer: !!canVolunteer,
          volunteerEligibilityReason: volunteerEligibilityReason || '',
          currentHourIndex: initialHourIdx,
          actualHourIndex: actualHourIdx,
          currentClipIndex: initialClipIdx,
          savedAt: Date.now(),
          dailyPrompt: dailyPrompt || null,
        }));
      }
      debugTodayFeed('[fetchTodayVlogs] cached-state-saved', { groupId, clipCount: fetchedClips.length });
    } else {
      console.error('[DEBUG][TodayFeed] [fetchTodayVlogs] endpoint-error', { groupId, error: res.error });
      set({ loading: false, loadedGroupId: groupId });
    }
  },

  refreshTodayTurnState: async (groupId: string) => {
    const res = await apiClient.request<any>('vlog/today-turn-state', [groupId], { cachePolicy: 'network-only' });
    if (!res.success || get().loadedGroupId !== groupId) return;

    const currentAssignment = get().assignment;
    const latestAssignment = res.assignment;

    // A day rollover or a newly-created assignment changes more than camera
    // ownership, so replace the complete Today snapshot in that case.
    if (!currentAssignment || !latestAssignment || currentAssignment.id !== latestAssignment.id) {
      await get().fetchTodayVlogs(groupId);
      return;
    }

    set({
      assignment: {
        ...currentAssignment,
        ...latestAssignment,
        group: {
          ...(currentAssignment.group || {}),
          ...(latestAssignment.group || {}),
        },
      },
    });
  },

  setPaused: (paused) => {
    const state = get();
    debugTodayFeed('[playback] set-paused', {
      clipId: state.clips[state.currentClipIndex]?.id || null,
      currentClipIndex: state.currentClipIndex,
      previousPaused: state.isPaused,
      nextPaused: paused,
    });
    set({ isPaused: paused });
  },

  setVideoExpanded: (expanded) => {
    set({ isVideoExpanded: expanded });
  },
  
  setCurrentHourIndex: (index) => {
    const clips = get().clips;
    const timezone = get().assignment?.group?.timezone || "UTC";
    const slotClips = clips.filter(c => getSlotForClip(c.recordedAt, timezone) === index);
    debugTodayFeed('[navigation] select-hour-request', {
      requestedHourIndex: index,
      slotClipCount: slotClips.length,
      previousHourIndex: get().currentHourIndex,
      previousClipIndex: get().currentClipIndex,
      previousClipId: clips[get().currentClipIndex]?.id || null,
    });
    
    if (slotClips.length > 0) {
      const viewed = getSeenMedia();
      const oldestUnseenInSlot = slotClips.find((c) => !viewed[c.id]);
      
      let targetClip = slotClips[0];
      if (oldestUnseenInSlot) {
        targetClip = oldestUnseenInSlot;
      } else {
        targetClip = slotClips[slotClips.length - 1];
      }

      const masterIdx = clips.findIndex(c => c.id === targetClip.id);
      const resolvedMasterIdx = masterIdx !== -1 ? masterIdx : 0;
      const activeClip = clips[resolvedMasterIdx];
      const currentUserId = getCurrentUserId();
      debugTodayFeed('[navigation] select-hour-resolved', {
        requestedHourIndex: index,
        targetClipId: activeClip?.id || null,
        targetClipIndex: resolvedMasterIdx,
      });

      set({ 
        currentHourIndex: index, 
        currentClipIndex: resolvedMasterIdx,
        isPaused: false,
        ...getClipReactionState(activeClip, currentUserId),
      });
    } else {
      set({ 
        currentHourIndex: index,
        currentClipIndex: -1
      });
    }
  },

  selectClip: (clipId) => {
    const { clips, assignment } = get();
    const clipIndex = clips.findIndex((clip) => clip.id === clipId);
    if (clipIndex === -1) {
      debugTodayFeed('[navigation] select-clip-missing', { clipId, clipCount: clips.length });
      return false;
    }

    const clip = clips[clipIndex];
    debugTodayFeed('[navigation] select-clip', {
      clipId,
      clipIndex,
      previousClipId: clips[get().currentClipIndex]?.id || null,
      previousClipIndex: get().currentClipIndex,
    });
    const currentUserId = getCurrentUserId();
    set({
      currentClipIndex: clipIndex,
      currentHourIndex: getSlotForClip(clip.recordedAt, assignment?.group?.timezone || 'UTC'),
      isPaused: false,
      ...getClipReactionState(clip, currentUserId),
    });
    return true;
  },

  nextSubClip: () => {
    const { clips, currentClipIndex, currentHourIndex, assignment } = get();
    if (clips.length === 0 || currentClipIndex === -1) {
      debugTodayFeed('[navigation] next-rejected-empty', { clipCount: clips.length, currentClipIndex });
      return;
    }

    const timezone = assignment?.group?.timezone || "UTC";
    const slotClips = clips.filter(c => getSlotForClip(c.recordedAt, timezone) === currentHourIndex);
    const activeClip = clips[currentClipIndex];
    
    if (!activeClip) {
      debugTodayFeed('[navigation] next-rejected-no-active-clip', { currentClipIndex });
      return;
    }
    const subIdx = slotClips.findIndex(c => c.id === activeClip.id);
    const currentUserId = getCurrentUserId();
    debugTodayFeed('[navigation] next-request', {
      activeClipId: activeClip.id,
      currentClipIndex,
      currentHourIndex,
      subIndex: subIdx,
      slotClipCount: slotClips.length,
    });

    if (subIdx < slotClips.length - 1) {
      const nextId = slotClips[subIdx + 1].id;
      const overallIdx = clips.findIndex(c => c.id === nextId);
      if (overallIdx !== -1) {
        debugTodayFeed('[navigation] next-within-slot', {
          fromClipId: activeClip.id,
          toClipId: nextId,
          fromClipIndex: currentClipIndex,
          toClipIndex: overallIdx,
        });
        set({ 
          currentClipIndex: overallIdx, 
          isPaused: false,
          ...getClipReactionState(clips[overallIdx], currentUserId),
        });
      }
    } else {
      const activeSlotsSorted = Array.from(new Set(clips.map(c => getSlotForClip(c.recordedAt, timezone)))).sort((a, b) => a - b);
      const currentIdx = activeSlotsSorted.indexOf(currentHourIndex);
      if (currentIdx !== -1 && currentIdx < activeSlotsSorted.length - 1) {
        const nextSlot = activeSlotsSorted[currentIdx + 1];
        const nextSlotClips = clips.filter(c => getSlotForClip(c.recordedAt, timezone) === nextSlot);
        if (nextSlotClips.length > 0) {
          const viewed = getSeenMedia();
          const oldestUnseenInSlot = nextSlotClips.find((c) => !viewed[c.id]);
          const targetClip = oldestUnseenInSlot || nextSlotClips[0];
          const overallIdx = clips.findIndex(c => c.id === targetClip.id);
          
          if (overallIdx !== -1) {
            debugTodayFeed('[navigation] next-slot', {
              fromClipId: activeClip.id,
              toClipId: targetClip.id,
              fromHourIndex: currentHourIndex,
              toHourIndex: nextSlot,
              fromClipIndex: currentClipIndex,
              toClipIndex: overallIdx,
            });
            set({ 
              currentHourIndex: nextSlot, 
              currentClipIndex: overallIdx, 
              isPaused: false,
              ...getClipReactionState(clips[overallIdx], currentUserId),
            });
          }
        }
      }
    }
  },

  prevSubClip: () => {
    const { clips, currentClipIndex, currentHourIndex, assignment } = get();
    if (clips.length === 0 || currentClipIndex === -1) {
      debugTodayFeed('[navigation] prev-rejected-empty', { clipCount: clips.length, currentClipIndex });
      return;
    }

    const timezone = assignment?.group?.timezone || "UTC";
    const slotClips = clips.filter(c => getSlotForClip(c.recordedAt, timezone) === currentHourIndex);
    const activeClip = clips[currentClipIndex];
    
    if (!activeClip) {
      debugTodayFeed('[navigation] prev-rejected-no-active-clip', { currentClipIndex });
      return;
    }
    const subIdx = slotClips.findIndex(c => c.id === activeClip.id);
    debugTodayFeed('[navigation] prev-request', {
      activeClipId: activeClip.id,
      currentClipIndex,
      currentHourIndex,
      subIndex: subIdx,
      slotClipCount: slotClips.length,
    });

    if (subIdx > 0) {
      const prevId = slotClips[subIdx - 1].id;
      const overallIdx = clips.findIndex(c => c.id === prevId);
      const currentUserId = getCurrentUserId();
      if (overallIdx !== -1) {
        debugTodayFeed('[navigation] prev-within-slot', {
          fromClipId: activeClip.id,
          toClipId: prevId,
          fromClipIndex: currentClipIndex,
          toClipIndex: overallIdx,
        });
        set({ 
          currentClipIndex: overallIdx, 
          isPaused: false,
          ...getClipReactionState(clips[overallIdx], currentUserId),
        });
      }
    } else {
      let prevSlot = -1;
      for (let s = currentHourIndex - 1; s >= 0; s--) {
        const hasClips = clips.some(c => getSlotForClip(c.recordedAt, timezone) === s);
        if (hasClips) {
          prevSlot = s;
          break;
        }
      }

      if (prevSlot !== -1) {
        const prevSlotClips = clips.filter(c => getSlotForClip(c.recordedAt, timezone) === prevSlot);
        const targetClip = prevSlotClips[prevSlotClips.length - 1];
        const overallIdx = clips.findIndex(c => c.id === targetClip?.id);
        const currentUserId = getCurrentUserId();
        if (overallIdx !== -1) {
          debugTodayFeed('[navigation] prev-slot', {
            fromClipId: activeClip.id,
            toClipId: targetClip?.id || null,
            fromHourIndex: currentHourIndex,
            toHourIndex: prevSlot,
            fromClipIndex: currentClipIndex,
            toClipIndex: overallIdx,
          });
          set({
            currentHourIndex: prevSlot,
            currentClipIndex: overallIdx,
            isPaused: false,
            ...getClipReactionState(clips[overallIdx], currentUserId),
          });
        }
      }
    }
  },

  toggleLike: async () => {
    const activeClipIndex = get().currentClipIndex;
    const activeClip = get().clips[activeClipIndex];
    if (!activeClip || activeClipIndex === -1) return;

    const currentUserId = getCurrentUserId();
    const previousReactions = activeClip.reactions || [];
    const prevLiked = previousReactions.some((reaction: any) => reaction.userId === currentUserId);
    const optimisticReactions = prevLiked
      ? previousReactions.filter((reaction: any) => reaction.userId !== currentUserId)
      : [...previousReactions, { id: `optimistic-${currentUserId}`, userId: currentUserId, emoji: '❤️' }];

    set((state) => {
      const clips = [...state.clips];
      clips[activeClipIndex] = { ...clips[activeClipIndex], reactions: optimisticReactions };
      return {
        clips,
        ...getClipReactionState(clips[activeClipIndex], currentUserId),
      };
    });

    const res = (await apiClient.request<any>('vlog/reaction', [activeClip.id, '❤️'])) as any;
    if (!res.success) {
      set((state) => {
        const clips = [...state.clips];
        const clipIndex = clips.findIndex((clip) => clip.id === activeClip.id);
        if (clipIndex === -1) return {};
        clips[clipIndex] = { ...clips[clipIndex], reactions: previousReactions };
        return {
          clips,
          ...(clipIndex === state.currentClipIndex
            ? getClipReactionState(clips[clipIndex], currentUserId)
            : {}),
        };
      });
    } else {
      set((state) => {
        const clips = [...state.clips];
        const currentClip = clips.find((clip) => clip.id === activeClip.id);
        if (!currentClip) return {};

        const withoutOptimisticReaction = (currentClip.reactions || []).filter(
          (reaction: any) => reaction.id !== `optimistic-${currentUserId}`,
        );
        const reactions = res.removed
          ? withoutOptimisticReaction.filter((reaction: any) => reaction.userId !== currentUserId)
          : res.reaction && !withoutOptimisticReaction.some((reaction: any) => reaction.id === res.reaction.id)
            ? [...withoutOptimisticReaction, res.reaction]
            : withoutOptimisticReaction;
        const clipIndex = clips.findIndex((clip) => clip.id === activeClip.id);
        clips[clipIndex] = { ...currentClip, reactions };
        return {
          clips,
          ...(clipIndex === state.currentClipIndex
            ? getClipReactionState(clips[clipIndex], currentUserId)
            : {}),
        };
      });
      analytics().logEvent('like_vlog', { clip_id: activeClip.id });
      const achievementStore = useAchievementStore.getState();
      if (res.newlyUnlocked?.length) {
        res.newlyUnlocked.forEach((id: string) => {
          achievementStore.enqueue({ type: 'achievement', id });
        });
      }
    }
  },

  pokeVlogger: async () => {
    if (!get().assignment?.id) return;
    set({ poking: true });
    const res = await apiClient.request<any>('vlog/pokeVlogger', [get().assignment.id]);
    set({ poking: false });
    if (res.success) {
      analytics().logEvent('poke_vlogger', { assignment_id: get().assignment.id });
      set({ pokeCooldown: 30 * 60 });
      startCooldownCountdown(set, get);
    }
  },

  passTurn: async () => {
    const assignmentId = get().assignment?.id;
    if (!assignmentId) return;
    const res = await apiClient.request<any>('vlog', [{ action: "passTurn", assignmentId }]);
    if (res.success) {
      set((state) => ({
        assignment: {
          ...state.assignment,
          ...res.assignment,
          user: state.assignment?.user,
          group: state.assignment?.group,
        },
      }));
      const groupId = res.assignment?.groupId || get().assignment?.groupId;
      if (groupId) await get().refreshTodayTurnState(groupId);
    } else {
      throw new Error(res.error || "Failed to pass turn.");
    }
  },

  claimTurn: async () => {
    const assignmentId = get().assignment?.id;
    if (!assignmentId) return;
    const res = await apiClient.request<any>('vlog', [{ action: "claimTurn", assignmentId }]);
    if (res.success) {
      const claimedUserId = res.assignment?.userId || storage.getString('auth_user_id');
      const claimedMember = get().assignment?.group?.members?.find(
        (member: any) => member.userId === claimedUserId,
      );
      set((state) => ({
        assignment: {
          ...state.assignment,
          ...res.assignment,
          isPassed: false,
          isClaimed: true,
          userId: claimedUserId,
          user: claimedMember?.user || state.assignment?.user,
          group: state.assignment?.group,
        },
      }));
      const groupId = res.assignment?.groupId || get().assignment?.groupId;
      if (groupId) await get().refreshTodayTurnState(groupId);
    } else {
      throw new Error(res.error || "Failed to claim turn.");
    }
  },

  skipPrompt: async () => {
    const assignmentId = get().assignment?.id;
    if (!assignmentId) throw new Error("No active assignment");
    
    const res = (await apiClient.request<any>('vlog', [{ action: "skipPrompt", assignmentId }])) as any;
    if (res.success && res.activePrompt) {
      set((state) => ({
        assignment: {
          ...state.assignment,
          activePrompt: res.activePrompt,
          promptSkips: res.promptSkips
        }
      }));
    } else {
      throw new Error(res.error || "Konu değiştirilemedi.");
    }
  },

  toggleVolunteer: async () => {
    const activeGroupId = get().assignment?.groupId || storage.getString('active_group_id');
    if (!activeGroupId) return;

    set({ isVolunteering: true, volunteerError: "" });
    const res = (await apiClient.request<any>('vlog/toggleVolunteer', [activeGroupId])) as any;
    set({ isVolunteering: false });

    if (res.error) {
      set({ volunteerError: res.error });
    } else {
      set({ hasVolunteeredForTomorrow: res.hasVolunteered || false });
    }
  },

  addComment: async (text: string, parentId?: string) => {
    const activeClip = get().clips[get().currentClipIndex];
    if (!activeClip || get().currentClipIndex === -1) return;

    const res = (await apiClient.request<any>('vlog/comment', [activeClip.id, text, parentId])) as any;
    if (res.success && res.comment) {
      analytics().logEvent('post_comment', { clip_id: activeClip.id, has_parent: !!parentId });
      const newComment = res.comment;
      
      const achievementStore = useAchievementStore.getState();
      if (res.newlyUnlocked?.length) {
        res.newlyUnlocked.forEach((id: string) => {
          achievementStore.enqueue({ type: 'achievement', id });
        });
      }

      set((state) => {
        return {
          clips: state.clips.map((clip) => clip.id === activeClip.id ? {
            ...clip,
            comments: [...(clip.comments || []), newComment],
          } : clip),
        };
      });
    }
  },

  toggleCommentLike: async (id: string) => {
    const clipIndex = get().currentClipIndex;
    const activeClip = get().clips[clipIndex];
    const comment = activeClip?.comments.find((item: any) => item.id === id);
    if (!activeClip || !comment) return;
    const clipId = activeClip.id;

    const wasLiked = comment.likedByCurrentUser ?? (comment.likes?.length > 0);
    const previousCount = comment.likeCount ?? comment._count?.likes ?? 0;
    const applyLikeState = (liked: boolean, likeCount: number) => set((state) => ({
      clips: state.clips.map((clip) => clip.id === clipId ? {
        ...clip,
        comments: clip.comments.map((item: any) => item.id === id ? {
          ...item,
          likedByCurrentUser: liked,
          likeCount,
          _count: { ...item._count, likes: likeCount },
        } : item),
      } : clip),
    }));

    applyLikeState(!wasLiked, Math.max(0, previousCount + (wasLiked ? -1 : 1)));
    try {
      const res = await apiClient.request<any>('vlog/toggleCommentLike', [id]);
      if (!res.success) throw new Error(res.error || 'Failed to update comment like.');
      applyLikeState(Boolean(res.liked), Number(res.likeCount) || 0);
      analytics().logEvent('toggle_comment_like', { comment_id: id, liked: Boolean(res.liked) });
    } catch (error) {
      applyLikeState(Boolean(wasLiked), previousCount);
      throw error;
    }
  },

  deleteComment: async (id: string) => {
    const res = await apiClient.request<any>('vlog/deleteComment', [id]);
    if (res.success) {
      set((state) => ({
        clips: state.clips.map((clip) => ({
          ...clip,
          comments: clip.comments.filter((comment: any) => comment.id !== id),
        })),
      }));
    }
  },

  uploadPhotoResponse: async (localUri: string) => {
    const activeClip = get().clips[get().currentClipIndex];
    if (!activeClip || get().currentClipIndex === -1) return;

    set({ uploadingPhoto: true });

    try {
      const initRes = (await apiClient.request<any>('vlog', [{ action: 'requestPhotoResponseUpload', clipId: activeClip.id, mediaType: 'photo' }])) as any;
      if (!initRes.success || !initRes.uploadUrl || !initRes.path) {
        throw new Error(initRes.error || "Failed to initialize photo response upload.");
      }

      const { uploadUrl, path } = initRes;

      const uploadResult = await FileSystem.uploadAsync(uploadUrl, localUri, {
        httpMethod: 'PUT',
        uploadType: FileSystemUploadType.BINARY_CONTENT,
        headers: {
          'Content-Type': 'image/jpeg',
        },
      });

      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        reportHttpFailure({
          route: 'storage/photo-response',
          method: 'PUT',
          status: uploadResult.status,
          code: 'PHOTO_RESPONSE_UPLOAD_FAILED',
          errorType: 'PhotoResponseUploadHttpError',
        });
        throw new Error(`Photo upload failed with status ${uploadResult.status}: ${uploadResult.body}`);
      }
      addDiagnosticBreadcrumb({
        category: 'upload',
        name: 'photo_response_upload',
        outcome: 'success',
        status: uploadResult.status,
      });

      const res = (await apiClient.request<any>('vlog/photo-response', [activeClip.id, path, 'photo'])) as any;
      if (res.success) {
        analytics().logEvent('post_photo_response', { clip_id: activeClip.id });
        const achievementStore = useAchievementStore.getState();
        if (res.newlyUnlocked?.length) {
          res.newlyUnlocked.forEach((id: string) => {
            achievementStore.enqueue({ type: 'achievement', id });
          });
        }

        if (res.photoResponse) {
          const remoteImageUrl = res.photoResponse.imageUrl as string;
          const immediateResponse = {
            ...res.photoResponse,
            // The captured file is already on-device, so it can be painted in
            // the very same state update without waiting for CDN propagation.
            imageUrl: localUri,
            remoteImageUrl,
          };
          set((state) => {
            const updatedClips = [...state.clips];
            const responseClipIndex = updatedClips.findIndex((clip) => clip.id === activeClip.id);
            if (responseClipIndex === -1) return {};
            const clip = { ...updatedClips[responseClipIndex] };
            const existingResponses = clip.photoResponses || [];
            clip.photoResponses = existingResponses.some((response: any) => response.id === immediateResponse.id)
              ? existingResponses.map((response: any) => response.id === immediateResponse.id ? immediateResponse : response)
              : [...existingResponses, immediateResponse];
            updatedClips[responseClipIndex] = clip;
            return { clips: updatedClips };
          });

          if (remoteImageUrl?.startsWith('http')) {
            NativeImage.prefetch(remoteImageUrl)
              .then((loaded) => {
                if (!loaded) return;
                set((state) => {
                  const updatedClips = [...state.clips];
                  const responseClipIndex = updatedClips.findIndex((clip) => clip.id === activeClip.id);
                  if (responseClipIndex === -1) return {};
                  const clip = { ...updatedClips[responseClipIndex] };
                  clip.photoResponses = (clip.photoResponses || []).map((response: any) =>
                    response.id === immediateResponse.id
                      ? { ...response, imageUrl: remoteImageUrl, remoteImageUrl: undefined }
                      : response
                  );
                  updatedClips[responseClipIndex] = clip;
                  return { clips: updatedClips };
                });
              })
              .catch(() => {
                // Keep displaying the local capture; a normal feed refresh will
                // replace it with a newly signed remote URL later.
              });
          }
        }
      } else {
        throw new Error(res.error || "Failed to save photo response.");
      }
    } catch (err: any) {
      console.error("[uploadPhotoResponse] Error:", err);
      if (!(err instanceof Error && err.message.startsWith('Photo upload failed with status'))) {
        reportHttpFailure({
          route: 'storage/photo-response',
          method: 'PUT',
          status: 0,
          code: 'PHOTO_RESPONSE_UPLOAD_FAILED',
          errorType: err?.name || 'PhotoResponseUploadError',
          errorMessage: err?.message,
        });
      }
      throw err;
    } finally {
      set({ uploadingPhoto: false });
    }
  },

  trackView: async (clipId: string) => {
    // Local seen state drives feed ordering and must not depend on the network.
    markMediaAsSeen(clipId);

    const res = (await apiClient.request<any>('vlog/trackView', [clipId])) as any;

    if (res.success && res.newlyUnlocked?.length) {
      const achievementStore = useAchievementStore.getState();
      res.newlyUnlocked.forEach((id: string) => {
        achievementStore.enqueue({ type: 'achievement', id });
      });
    }

    if (res.success && res.view) {
      const profileUser = useProfileStore.getState().user;
      
      const currentUserProfile = {
        id: profileUser.id || storage.getString('auth_user_id') || "",
        name: profileUser.name || "Siz",
        handle: profileUser.handle || "ben",
        image: profileUser.image || null,
      };

      const resolvedViewPayload = {
        ...res.view,
        user: currentUserProfile
      };

      set((state) => {
        const updatedClips = [...state.clips];
        const viewedClipIndex = updatedClips.findIndex((clip) => clip.id === clipId);
        if (viewedClipIndex === -1) return {};

        const viewedClip = updatedClips[viewedClipIndex];
        const currentViews = viewedClip.views || [];
        const exists = currentViews.some((v: any) => v.userId === resolvedViewPayload.userId);
        if (exists) return {};

        updatedClips[viewedClipIndex] = {
          ...viewedClip,
          views: [...currentViews, resolvedViewPayload],
        };
        return { clips: updatedClips };
      });
    }
  }
}));

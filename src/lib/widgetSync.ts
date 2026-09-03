// ./src/lib/widgetSync.ts
import { Platform } from 'react-native';
import { File } from 'expo-file-system';

import DailyStoryProgressWidget from '../../widgets/DailyStoryProgress';
import LatestClipWidget from '../../widgets/LatestClip';
import TodayVloggerWidget from '../../widgets/TodayVlogger';
import YesterdayRecapWidget from '../../widgets/YesterdayRecap';
import YourTurnWidget from '../../widgets/YourTurn';
import { widgetsDirectory } from 'expo-widgets';
import { storage } from './storage';
import { formatBusinessDate, getBusinessClock } from './businessTime';

const WIDGET_DATA_KEY = 'myturn_widget_data_v1';

export interface WidgetPayload {
  isAuthenticated: boolean;
  hasActiveGroup: boolean;
  hasTodayAssignment: boolean;
  hasLatestClip: boolean;
  hasYesterdayStory: boolean;
  vloggerName: string;
  vloggerHandle: string;
  vloggerAvatar: string;
  vloggerAvatarLocal: string;
  isCurrentUserVlogger: boolean;
  clipsRecorded: number;
  clipsGoal: number;
  photosRecorded: number;
  timezone: string;
  latestClipThumbnail: string;
  latestClipThumbnailLocal: string;
  latestClipDuration: string;
  latestClipRecordedAt: string;
  yesterdayThumbnail: string;
  yesterdayThumbnailLocal: string;
  yesterdayDuration: string;
  yesterdayDate: string;
  yesterdayVloggerName: string;
  yesterdayVloggerAvatar: string;
  yesterdayVloggerAvatarLocal: string;
  yesterdayClipsCount: number;
}

export interface WidgetData extends WidgetPayload {
  latestClipTime: string;
  yesterdayDateText: string;
  storyProgressPercent: number;
  progressWidth: number;
  countdownText: string;
  countdownEndAt: number;
  lastUpdated: number;
}

const EMPTY_WIDGET_DATA: WidgetData = {
  isAuthenticated: false,
  hasActiveGroup: false,
  hasTodayAssignment: false,
  hasLatestClip: false,
  hasYesterdayStory: false,
  vloggerName: 'No vlogger yet',
  vloggerHandle: '',
  vloggerAvatar: '',
  vloggerAvatarLocal: '',
  isCurrentUserVlogger: false,
  clipsRecorded: 0,
  clipsGoal: 12,
  photosRecorded: 0,
  timezone: 'UTC',
  latestClipThumbnail: '',
  latestClipThumbnailLocal: '',
  latestClipDuration: '',
  latestClipRecordedAt: '',
  latestClipTime: '',
  yesterdayThumbnail: '',
  yesterdayThumbnailLocal: '',
  yesterdayDuration: '',
  yesterdayDate: '',
  yesterdayDateText: '',
  yesterdayVloggerName: '',
  yesterdayVloggerAvatar: '',
  yesterdayVloggerAvatarLocal: '',
  yesterdayClipsCount: 0,
  storyProgressPercent: 0,
  progressWidth: 0,
  countdownText: '--:--',
  countdownEndAt: 0,
  lastUpdated: 0,
};

function readStoredWidgetData(): WidgetData {
  try {
    const stored = storage.getString(WIDGET_DATA_KEY);
    return stored ? { ...EMPTY_WIDGET_DATA, ...JSON.parse(stored) } : EMPTY_WIDGET_DATA;
  } catch {
    return EMPTY_WIDGET_DATA;
  }
}

async function cacheImageForWidget(source: string, filename: string, previousUri: string) {
  if (!source) return '';
  try {
    if (!widgetsDirectory) return '';
    const destination = new File(widgetsDirectory, filename);

    if (source.startsWith('http://') || source.startsWith('https://')) {
      const downloaded = await File.downloadFileAsync(source, destination, { idempotent: true });
      return downloaded.uri;
    }

    const sourceFile = new File(source);
    if (sourceFile.uri === destination.uri) return destination.uri;
    await sourceFile.copy(destination, { overwrite: true });
    return destination.uri;
  } catch (error) {
    console.warn(`[widgetSync] Could not cache ${filename}:`, error);
    return previousUri;
  }
}

function zonedClock(date: Date, timezone: string) {
  return getBusinessClock(date, timezone);
}

function countdownText(date: Date, timezone: string) {
  const { hour, minute, second } = zonedClock(date, timezone);
  const elapsed = hour * 3600 + minute * 60 + second;
  const remaining = hour < 9 ? 9 * 3600 - elapsed : 24 * 3600 - elapsed;
  const hours = String(Math.floor(remaining / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((remaining % 3600) / 60)).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function countdownEndAt(date: Date, timezone: string) {
  const { hour, minute, second } = zonedClock(date, timezone);
  const elapsed = hour * 3600 + minute * 60 + second;
  const remaining = hour < 9 ? 9 * 3600 - elapsed : 24 * 3600 - elapsed;
  return date.getTime() + remaining * 1000;
}

function relativeTime(recordedAt: string, now: Date) {
  if (!recordedAt) return '';
  const timestamp = new Date(recordedAt).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const minutes = Math.max(0, Math.floor((now.getTime() - timestamp) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function dateText(value: string, timezone: string) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return formatBusinessDate(date, timezone, { month: 'short', day: 'numeric', year: 'numeric' });
}

function dataForDate(data: WidgetData, date: Date): WidgetData {
  return {
    ...data,
    latestClipTime: relativeTime(data.latestClipRecordedAt, date),
    yesterdayDateText: dateText(data.yesterdayDate, data.timezone),
    countdownText: countdownText(date, data.timezone),
    countdownEndAt: countdownEndAt(date, data.timezone),
  };
}

function timeline(data: WidgetData) {
  const now = new Date();
  const entries = [{ date: now, props: dataForDate(data, now) }];

  // WidgetKit chooses when to render timeline entries. Half-hour entries keep
  // relative time and the day countdown fresh while the app is suspended.
  for (let offset = 30; offset <= 24 * 60; offset += 30) {
    const date = new Date(now.getTime() + offset * 60_000);
    entries.push({ date, props: dataForDate(data, date) });
  }
  return entries;
}

function publishWidgetData(data: WidgetData) {
  storage.set(WIDGET_DATA_KEY, JSON.stringify(data));
  const entries = timeline(data);
  TodayVloggerWidget.updateTimeline(entries);
  YourTurnWidget.updateTimeline(entries);
  YesterdayRecapWidget.updateTimeline(entries);
  LatestClipWidget.updateTimeline(entries);
  DailyStoryProgressWidget.updateTimeline(entries);
}

export function syncWidgetSessionState(isAuthenticated: boolean, hasActiveGroup: boolean) {
  if (Platform.OS !== 'ios') return;
  if (!isAuthenticated && widgetsDirectory) {
    for (const filename of [
      'widget-vlogger-avatar.jpg',
      'widget-latest-clip.jpg',
      'widget-yesterday-story.jpg',
      'widget-yesterday-avatar.jpg',
    ]) {
      try {
        const file = new File(widgetsDirectory, filename);
        if (file.exists) file.delete();
      } catch {}
    }
  }
  const now = new Date();
  const data = dataForDate({
    ...EMPTY_WIDGET_DATA,
    isAuthenticated,
    hasActiveGroup,
    lastUpdated: Date.now(),
  }, now);
  publishWidgetData(data);
}

export function getWidgetDuration(clip: any): string {
  if (!clip) return '';
  if (clip.mediaType === 'photo') return 'PHOTO';
  let metadata: any = {};
  try {
    metadata = typeof clip.metadata === 'string' ? JSON.parse(clip.metadata) : (clip.metadata || {});
  } catch {}
  if (metadata.mediaType === 'photo') return 'PHOTO';
  const raw = Number(clip.duration ?? clip.durationSeconds ?? metadata.duration ?? metadata.durationSeconds);
  if (!Number.isFinite(raw) || raw <= 0) return '';
  const seconds = Math.round(raw);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export async function syncWidgetData(payload: Partial<WidgetPayload>) {
  try {
    if (Platform.OS !== 'ios') return;

    const previous = readStoredWidgetData();
    const mediaPayload = { ...payload };
    const mediaTasks: Promise<void>[] = [];
    if (payload.vloggerAvatar !== undefined) {
      mediaTasks.push(cacheImageForWidget(
        payload.vloggerAvatar,
        'widget-vlogger-avatar.jpg',
        payload.vloggerAvatar === previous.vloggerAvatar ? previous.vloggerAvatarLocal : '',
      ).then((uri) => { mediaPayload.vloggerAvatarLocal = uri; }));
    }
    if (payload.latestClipThumbnail !== undefined) {
      mediaTasks.push(cacheImageForWidget(
        payload.latestClipThumbnail,
        'widget-latest-clip.jpg',
        payload.latestClipThumbnail === previous.latestClipThumbnail ? previous.latestClipThumbnailLocal : '',
      ).then((uri) => { mediaPayload.latestClipThumbnailLocal = uri; }));
    }
    if (payload.yesterdayThumbnail !== undefined) {
      mediaTasks.push(cacheImageForWidget(
        payload.yesterdayThumbnail,
        'widget-yesterday-story.jpg',
        payload.yesterdayThumbnail === previous.yesterdayThumbnail ? previous.yesterdayThumbnailLocal : '',
      ).then((uri) => { mediaPayload.yesterdayThumbnailLocal = uri; }));
    }
    if (payload.yesterdayVloggerAvatar !== undefined) {
      mediaTasks.push(cacheImageForWidget(
        payload.yesterdayVloggerAvatar,
        'widget-yesterday-avatar.jpg',
        payload.yesterdayVloggerAvatar === previous.yesterdayVloggerAvatar ? previous.yesterdayVloggerAvatarLocal : '',
      ).then((uri) => { mediaPayload.yesterdayVloggerAvatarLocal = uri; }));
    }
    await Promise.all(mediaTasks);

    // Re-read after asynchronous media work so concurrent Today/Archive
    // refreshes merge instead of replacing one another.
    const merged = {
      ...readStoredWidgetData(),
      ...mediaPayload,
      isAuthenticated: true,
      hasActiveGroup: true,
    };
    const goal = Math.max(1, merged.clipsGoal || 12);
    const progress = Math.min(100, Math.round((merged.clipsRecorded / goal) * 100));
    const nextData: WidgetData = dataForDate({
      ...merged,
      storyProgressPercent: progress,
      progressWidth: Math.round(progress * 1.1),
      lastUpdated: Date.now(),
    }, new Date());

    publishWidgetData(nextData);
  } catch (error) {
    console.warn('[widgetSync] Failed to sync widget data:', error);
  }
}

// ./app/(app)/streaks.tsx
"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Dimensions,
  Modal,
  Platform,
  ActivityIndicator,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  ChevronDown,
  Grid, 
  BookOpen,
  ChevronRight,
} from 'lucide-react-native';
import { MenuView } from '@expo/ui/community/menu';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useStreaksStore } from '../../src/store/useStreaksStore';
import { useGroupStore } from '../../src/store/useGroupStore';
import { useProStore } from '../../src/store/useProStore';
import { useProfileStore } from '../../src/store/useProfileStore';
import { getSlotForClip } from '../../src/store/useTodayStore';
import { parseMediaMetadata } from '../../src/lib/mediaMetadata';
import { Text } from '../../src/components/ui/Text';
import { ACCENT, NEUTRAL_PAGE_BG } from '../../src/lib/theme';
import { lightTap, selectionTick } from '../../src/lib/haptics';

// Decoupled subcomponents imports
import { StreaksStatsView } from '../../src/components/streaks/StreakStatsView';
import { JournalModeView } from '../../src/components/streaks/JournalModeView';
import { GridModeView } from '../../src/components/streaks/GridModeView';
import { StreakClipPlaybackOverlay } from '../../src/components/streaks/StreakClipPlaybackOverlay';
import { DAY_ITEM_INTERVAL } from '../../src/components/streaks/InteractiveDayCard';
import { JoinOrCreateGroupWall } from '../../src/components/group/JoinOrCreateGroupWall';
import { PaywallModal } from '../../src/components/paywall/PaywallModal';
import { LiveGuideCoachmark } from '../../src/components/guides/LiveGuideCoachmark';
import { getGuideDefinition } from '../../src/components/guides/guideContent';
import { useLiveGuide } from '../../src/components/guides/useLiveGuide';
import { useTranslation } from '../../src/lib/i18n';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MONTH_NAMES = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

const serifFont = Platform.OS === 'ios' ? 'Georgia' : 'serif';

export const isArchiveLocked = (dateString: string, isUserPro: boolean, isGroupPro: boolean) => {
  if (isUserPro || isGroupPro) return false;
  const vlogDate = new Date(dateString);
  const now = new Date();
  
  vlogDate.setUTCHours(0, 0, 0, 0);
  now.setUTCHours(0, 0, 0, 0);
  
  const diffTime = now.getTime() - vlogDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays > 14;
};

export default function StreaksScreen() {
  const groupStore = useGroupStore();
  const insets = useSafeAreaInsets();
  const streaksStore = useStreaksStore();
  const router = useRouter();
  const isFocused = useIsFocused();
  const { locale } = useTranslation();
  const notificationParams = useLocalSearchParams<{ groupId?: string; clipId?: string; date?: string }>();
  const handledNotificationRef = useRef<string | null>(null);
  const { isPro: isUserPro } = useProStore();
  const currentUserId = useProfileStore((state) => state.user.id);

  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState<'journal' | 'grid'>('journal');
  const [filterType, setFilterType] = useState<'all' | 'mine' | 'stats'>('all');
  
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [paywallOpen, setPaywallOpen] = useState(false);

  // Programmatic Day & Clip Selection for Integrated Immersive Playback
  const [activePlaybackDayIndex, setActivePlaybackDayIndex] = useState<number | null>(null);
  const [activePlaybackClipIndex, setActivePlaybackClipIndex] = useState<number>(0);

  const topFlatListRef = useRef<FlatList<any>>(null);
  const isProgrammaticScrollRef = useRef(false);
  const pendingDayIndexRef = useRef<number | null>(null);
  const dayScrollOffsetRef = useRef(0);

  // Determine group boost settings
  const activeGroup = groupStore.groups.find(g => g.id === groupStore.activeGroupId);
  const isGroupPro = (activeGroup as any)?.level >= 3 || false; // Evaluates level threshold rules

  // The authenticated app layout owns initial and group-change refreshes.
  useEffect(() => {
    setLoading(streaksStore.loading);
  }, [streaksStore.loading]);

  // Extract valid vlogged days from the exhaustive historical array
  const vloggedDays = useMemo(() => {
    const days = streaksStore.historicalDays.map((h) => ({
      d: new Date(h.date).getUTCDate(),
      type: "vlogged" as const,
      assignment: h,
    }));

    // Sort so newest days appear first
    return days.sort((a, b) => {
      const dateA = new Date(a.assignment?.date || 0).getTime();
      const dateB = new Date(b.assignment?.date || 0).getTime();
      return dateB - dateA;
    });
  }, [streaksStore.historicalDays]);

  const archiveGuideSteps = useMemo(() => (
    getGuideDefinition('archive', locale).steps.filter((step) => step.motion !== 'days' || vloggedDays.length > 1)
  ), [locale, vloggedDays.length]);
  const activePlaybackClip = activePlaybackDayIndex === null
    ? null
    : vloggedDays[activePlaybackDayIndex]?.assignment?.clips?.[activePlaybackClipIndex];
  const archiveGuide = useLiveGuide({
    guideId: 'archive',
    steps: archiveGuideSteps,
    enabled: Boolean(isFocused && !loading && vloggedDays.length > 0),
    delay: 850,
    isStepAvailable: (step) => {
      if (step.motion === 'edges' || step.motion === 'hold' || step.motion === 'dismiss') {
        if (!activePlaybackClip) return false;
        if (step.motion === 'edges') {
          return (vloggedDays[activePlaybackDayIndex!]?.assignment?.clips?.length || 0) > 1;
        }
        if (step.motion === 'hold') {
          const metadata = parseMediaMetadata(activePlaybackClip.metadata) || {};
          return activePlaybackClip.mediaType !== 'photo' && metadata.mediaType !== 'photo';
        }
      }
      return true;
    },
  });
  const playbackGuideVisible = archiveGuide.visible
    && (archiveGuide.step?.motion === 'edges'
      || archiveGuide.step?.motion === 'hold'
      || archiveGuide.step?.motion === 'dismiss');

  // Fallback if index gets out of bounds during a store reload
  useEffect(() => {
    if (vloggedDays.length > 0 && selectedDayIndex >= vloggedDays.length) {
      setSelectedDayIndex(0);
    }
  }, [vloggedDays, selectedDayIndex]);

  const currentMonthLabel = useMemo(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + monthOffset);
    return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
  }, [monthOffset]);

  // Map and group clips for currently selected day by circadian periods (Morning, Noon, etc.)
  const groupedPeriodClips = useMemo(() => {
    const dayData = vloggedDays[selectedDayIndex];
    if (!dayData || !dayData.assignment?.clips) return [];

    const timezone = (dayData.assignment as any).group?.timezone;
    const activeSlotClipsList = dayData.assignment.clips;

    const periods = [
      { id: 0, title: "Morning Vlog", timeRange: "9AM - 12PM", clips: [] as any[] },
      { id: 1, title: "Midday Vlog", timeRange: "12PM - 3PM", clips: [] as any[] },
      { id: 2, title: "Afternoon Vlog", timeRange: "3PM - 6PM", clips: [] as any[] },
      { id: 3, title: "Evening Vlog", timeRange: "6PM - 9PM", clips: [] as any[] },
      { id: 4, title: "Late Night Vlog", timeRange: "9PM - 12AM", clips: [] as any[] },
      { id: 5, title: "Late Night / Rest", timeRange: "12AM - 9AM", clips: [] as any[] }
    ];

    activeSlotClipsList.forEach((clip: any) => {
      const slot = getSlotForClip(clip.recordedAt, timezone);
      const matchedPeriod = periods.find(p => p.id === slot);
      if (matchedPeriod) {
        matchedPeriod.clips.push({
          ...clip,
          id: clip.id,
          name: dayData.assignment!.user.name,
          avatar: dayData.assignment!.user.image,
          image: clip.thumbnailUrl,
          recordedAt: clip.recordedAt,
          isMine: clip.userId === currentUserId,
          timeLabel: new Date(clip.recordedAt).toLocaleTimeString("tr-TR", { hour: '2-digit', minute: '2-digit' }),
          date: new Date(clip.recordedAt).toLocaleDateString("tr-TR", { month: 'short', day: 'numeric', weekday: 'long' }),
          videoUrl: clip.videoUrl,
          hlsUrl: clip.hlsUrl,
          transcodeStatus: clip.transcodeStatus,
          thumbnailBlurUrl: clip.thumbnailBlurUrl || clip.thumbnailUrl,
          location: clip.location || activeGroup?.name || "",
          metadata: clip.metadata,
          caption: clip.caption || "",
          photoResponses: clip.photoResponses || [],
          comments: clip.comments || [],
          views: clip.views || [],
          reactions: clip.reactions || []
        });
      }
    });

    return periods.filter(p => p.clips.length > 0);
  }, [vloggedDays, selectedDayIndex, activeGroup]);

  // Handler for launching play on a specific resolved clip
  const handleLaunchPlayback = (targetClip: any, dayIndex: number) => {
    const day = vloggedDays[dayIndex];
    if (day?.assignment?.date) {
      const locked = isArchiveLocked(day.assignment.date, isUserPro, isGroupPro);
      if (locked) {
        lightTap();
        setPaywallOpen(true);
        return;
      }
    }

    if (day?.assignment?.clips) {
      const clipIdx = day.assignment.clips.findIndex((c: any) => c.id === targetClip.id);
      setActivePlaybackDayIndex(dayIndex);
      setActivePlaybackClipIndex(clipIdx !== -1 ? clipIdx : 0);
      archiveGuide.completeAction('albums');
    }
  };

  useEffect(() => {
    if (loading || vloggedDays.length === 0) return;
    const groupId = typeof notificationParams.groupId === 'string' ? notificationParams.groupId : null;
    const clipId = typeof notificationParams.clipId === 'string' ? notificationParams.clipId : null;
    const date = typeof notificationParams.date === 'string' ? notificationParams.date : null;
    if (!groupId || groupStore.activeGroupId !== groupId || (!clipId && !date)) return;

    const notificationKey = [groupId, clipId, date].join(':');
    if (handledNotificationRef.current === notificationKey) return;

    const parsedDate = date ? new Date(date) : null;
    const targetDate = parsedDate && Number.isFinite(parsedDate.getTime())
      ? parsedDate.toISOString().slice(0, 10)
      : null;
    const dayIndex = vloggedDays.findIndex((day) => {
      if (clipId && day.assignment?.clips?.some((clip: any) => clip.id === clipId)) return true;
      return targetDate && new Date(day.assignment?.date || 0).toISOString().slice(0, 10) === targetDate;
    });
    if (dayIndex === -1) return;

    const targetClip = clipId
      ? vloggedDays[dayIndex].assignment?.clips?.find((clip: any) => clip.id === clipId)
      : vloggedDays[dayIndex].assignment?.clips?.[0];
    if (!targetClip) return;

    handledNotificationRef.current = notificationKey;
    setSelectedDayIndex(dayIndex);
    topFlatListRef.current?.scrollToOffset({ offset: dayIndex * DAY_ITEM_INTERVAL, animated: false });
    handleLaunchPlayback(targetClip, dayIndex);
  }, [loading, notificationParams, groupStore.activeGroupId, vloggedDays]);

  // Keep the active state in sync with the card closest to the center.
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const xOffset = event.nativeEvent.contentOffset.x;
    dayScrollOffsetRef.current = xOffset;

    const pendingIndex = pendingDayIndexRef.current;
    if (isProgrammaticScrollRef.current && pendingIndex !== null) {
      const targetOffset = pendingIndex * DAY_ITEM_INTERVAL;
      if (Math.abs(xOffset - targetOffset) <= 1) {
        setSelectedDayIndex(pendingIndex);
        pendingDayIndexRef.current = null;
        isProgrammaticScrollRef.current = false;
      }
      return;
    }

    // During a direct swipe, switch the albums as soon as another card is the
    // closest one. Waiting for momentum to finish makes the lower content feel
    // noticeably behind the day row.
    const closestIndex = Math.round(xOffset / DAY_ITEM_INTERVAL);
    if (closestIndex >= 0 && closestIndex < vloggedDays.length) {
      setSelectedDayIndex((currentIndex) => (
        currentIndex === closestIndex ? currentIndex : closestIndex
      ));
    }
  };

  const handleScrollAnimationEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const xOffset = event.nativeEvent.contentOffset.x;
    dayScrollOffsetRef.current = xOffset;

    const centeredIndex = Math.round(xOffset / DAY_ITEM_INTERVAL);
    if (centeredIndex >= 0 && centeredIndex < vloggedDays.length) {
      setSelectedDayIndex(centeredIndex);
      archiveGuide.completeAction('days');
    }

    pendingDayIndexRef.current = null;
    isProgrammaticScrollRef.current = false;
  };

  const handleScrollBeginDrag = () => {
    // A direct gesture takes ownership from any in-flight card selection.
    pendingDayIndexRef.current = null;
    isProgrammaticScrollRef.current = false;
  };

  const handleSelectDayCard = (index: number) => {
    if (index < 0 || index >= vloggedDays.length) return;

    // The albums belong to the card the user chose, not the card that happens
    // to be centered while the horizontal track is animating. Update this
    // first so the lower section responds to a tap immediately.
    setSelectedDayIndex(index);

    const targetOffset = index * DAY_ITEM_INTERVAL;
    if (Math.abs(dayScrollOffsetRef.current - targetOffset) <= 1) {
      pendingDayIndexRef.current = null;
      isProgrammaticScrollRef.current = false;
      return;
    }

    pendingDayIndexRef.current = index;
    isProgrammaticScrollRef.current = true;
    requestAnimationFrame(() => {
      topFlatListRef.current?.scrollToOffset({
        offset: targetOffset,
        animated: true,
      });
    });
  };

  const hasNoGroups = groupStore.groups.length === 0;
  if (hasNoGroups) {
    return <JoinOrCreateGroupWall />;
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  if (!groupStore.activeGroupId) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[NEUTRAL_PAGE_BG.light, NEUTRAL_PAGE_BG.dark]} style={StyleSheet.absoluteFill} />
        <View style={styles.center}>
          <Text className="text-white/45 text-xs text-center">Görüntülenecek grup verisi bulunamadı.</Text>
        </View>
      </View>
    );
  }

  const activeGroupName = activeGroup?.name || "";
  const archiveViewKey = filterType === 'stats' ? 'stats' : `${filterType}-${viewMode}`;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#101011', '#0B0B0C']} style={StyleSheet.absoluteFill} />

      {/* HEADER HUD */}
      <View
        style={[
          styles.headerContainer,
          {
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: archiveGuide.visible && !playbackGuideVisible ? 150 : 0,
          },
        ]}
      >
        <View style={styles.headerTitleRow}>
          <Text style={[styles.serifTitle, { fontFamily: serifFont }]}>Arşiv</Text>
          
          <View style={styles.actionRow}>
            <MenuView
              actions={[
                { id: 'all', title: 'Tüm Vloglar', state: filterType === 'all' ? 'on' : 'off' },
                { id: 'mine', title: 'Benim Vloglarım', state: filterType === 'mine' ? 'on' : 'off' },
                { id: 'stats', title: 'Liderlik Tablosu', state: filterType === 'stats' ? 'on' : 'off' },
              ]}
              onPressAction={({ nativeEvent }) => {
                selectionTick();
                setFilterType(nativeEvent.event as 'all' | 'mine' | 'stats');
              }}
            >
              <View style={styles.nativeMenuTrigger}>
                <Text weight="medium" style={styles.nativeMenuTriggerText} numberOfLines={1}>
                  {filterType === 'all'
                    ? 'Tüm Vloglar'
                    : filterType === 'mine'
                      ? 'Benim Vloglarım'
                      : 'Liderlik Tablosu'}
                </Text>
                <ChevronDown size={12} color="rgba(255,255,255,0.65)" />
              </View>
            </MenuView>

            {/* Premium Understated View Switcher */}
            {filterType !== 'stats' && (
              <TouchableOpacity 
                onPress={() => { selectionTick(); setViewMode(viewMode === 'grid' ? 'journal' : 'grid'); }}
                style={styles.viewToggleBtn}
                activeOpacity={0.85}
              >
                {viewMode === 'journal' ? (
                  <Grid size={15} color="rgba(255,255,255,0.8)" />
                ) : (
                  <BookOpen size={15} color="rgba(255,255,255,0.8)" />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

      </View>

      {/* DYNAMIC SCREEN ROUTING */}
      <Animated.View
        key={archiveViewKey}
        entering={FadeIn.duration(220)}
        exiting={FadeOut.duration(140)}
        style={styles.contentView}
      >
        {vloggedDays.length === 0 ? (
          <View style={[styles.emptyStateWrapper, { paddingBottom: Math.max(insets.bottom, 100) }]}>
          <View style={styles.emptyStateContent}>
            <Image 
              source={require('../../assets/images/empty_states/streak.png')} 
              style={styles.emptyStateImage}
            />
            <Text style={[styles.emptyStateTitle, { fontFamily: serifFont }]}>
              Henüz bir vlog{'\n'}parçası yok.
            </Text>
            <Text style={styles.emptyStateDesc}>
              Çektiğin vlog parçaları ve arşiv burada toplanır.{'\n'}Her gün bir parça kaydet, zamanla anılar birikir.
            </Text>
            <TouchableOpacity 
              onPress={() => router.push('/(app)/today')}
              activeOpacity={0.85}
              style={styles.emptyStatePrimaryBtn}
            >
              <Text weight="bold" style={styles.emptyStatePrimaryBtnText}>Bugünkü akışı keşfet</Text>
              <ChevronRight size={16} color="#000" />
            </TouchableOpacity>
          </View>
          </View>
        ) : filterType === 'stats' ? (
        <StreaksStatsView
          currentStreak={streaksStore.currentStreak}
          friendsStreaks={streaksStore.friendsStreaks}
          calendarDays={streaksStore.calendarDays}
          monthOffset={monthOffset}
          setMonthOffset={setMonthOffset}
          currentMonthLabel={currentMonthLabel}
          vloggedDays={vloggedDays}
          onPlayClip={handleLaunchPlayback}
          groupName={activeGroupName}
          insetsBottom={insets.bottom}
          isUserPro={isUserPro}
          isGroupPro={isGroupPro}
        />
      ) : viewMode === 'journal' ? (
        <JournalModeView
          vloggedDays={vloggedDays}
          selectedDayIndex={selectedDayIndex}
          groupedPeriodClips={groupedPeriodClips}
          onPlayClip={handleLaunchPlayback}
          topFlatListRef={topFlatListRef}
          handleScroll={handleScroll}
          handleScrollAnimationEnd={handleScrollAnimationEnd}
          handleScrollBeginDrag={handleScrollBeginDrag}
          handleSelectDayCard={handleSelectDayCard}
          insetsBottom={insets.bottom}
          isUserPro={isUserPro}
          isGroupPro={isGroupPro}
        />
      ) : (
        <GridModeView
          vloggedDays={vloggedDays}
          currentUserId={currentUserId}
          onPlayClip={handleLaunchPlayback}
          insetsBottom={insets.bottom}
          isUserPro={isUserPro}
          isGroupPro={isGroupPro}
        />
        )}
      </Animated.View>

      {/* Immersive Video Playback Overlay Modal */}
      <Modal
        visible={activePlaybackDayIndex !== null}
        animationType="none"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={() => setActivePlaybackDayIndex(null)}
      >
        {activePlaybackDayIndex !== null && (
          <StreakClipPlaybackOverlay 
            vloggedDays={vloggedDays}
            dayIndex={activePlaybackDayIndex}
            initialClipIndex={activePlaybackClipIndex}
            onClose={() => setActivePlaybackDayIndex(null)} 
            liveGuide={playbackGuideVisible ? archiveGuide : null}
          />
        )}
      </Modal>

      {/* Custom Paywall Modal Triggered when Intercepting Locked Archives */}
      <PaywallModal 
        isOpen={paywallOpen} 
        onClose={() => setPaywallOpen(false)} 
      />
      {!playbackGuideVisible && !paywallOpen && (
        <LiveGuideCoachmark
          visible={archiveGuide.visible}
          step={archiveGuide.step}
          stepIndex={archiveGuide.stepIndex}
          totalSteps={archiveGuide.totalSteps}
          stepComplete={archiveGuide.stepComplete}
          onBack={archiveGuide.goBack}
          onSkipStep={archiveGuide.skipStep}
          onClose={archiveGuide.skipTour}
          placement="bottom"
          topOffset={56}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0B0B0C' 
  },
  contentView: {
    flex: 1,
  },
  center: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  headerContainer: { 
    paddingHorizontal: 20,
    marginBottom: 8,
    zIndex: 90,
  },
  headerTitleRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    height: 48,
  },
  serifTitle: { 
    fontSize: 32, 
    color: '#FAF9F6', 
    letterSpacing: -0.5,
  },
  actionRow: { 
    flexDirection: 'row', 
    alignItems: 'center',
    gap: 12,
  },
  nativeMenuTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.04)', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.06)', 
    maxWidth: 132,
    height: 30,
    paddingHorizontal: 10,
    justifyContent: 'center',
    borderRadius: 15,
  },
  nativeMenuTriggerText: {
    flexShrink: 1,
    color: '#FFFFFF',
    fontSize: 10,
    letterSpacing: 0.1,
  },
  viewToggleBtn: { 
    width: 34, 
    height: 34, 
    borderRadius: 17, 
    backgroundColor: 'rgba(255,255,255,0.04)', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.06)', 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  emptyStateWrapper: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyStateContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  emptyStateImage: {
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_WIDTH * 0.8,
    resizeMode: 'contain',
  },
  emptyStateTitle: {
    fontSize: 28,
    color: '#FAF9F6',
    textAlign: 'center',
    marginBottom: 4,
  },
  emptyStateDesc: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  emptyStatePrimaryBtn: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 220,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  emptyStatePrimaryBtnText: {
    color: '#000',
    fontSize: 15,
    marginRight: 8,
  },
});

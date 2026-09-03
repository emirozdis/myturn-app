// ./src/components/streaks/StreaksStatsView.tsx
"use client";

import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { 
  Flame, 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  Lock
} from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Text } from '../ui/Text';
import { Avatar } from '../ui/Avatar';
import { GlassView } from '../ui/GlassView';
import { ACCENT } from '../../lib/theme';
import { selectionTick } from '../../lib/haptics';
import { isArchiveLocked } from '../../../app/(app)/streaks';
import { useProfileStore } from '../../store/useProfileStore';

const WEEKDAYS = ["PZT", "SAL", "ÇAR", "PER", "CUM", "CMT", "PAZ"];

interface StreaksStatsViewProps {
  currentStreak: number;
  friendsStreaks: any[];
  calendarDays: any[];
  monthOffset: number;
  setMonthOffset: React.Dispatch<React.SetStateAction<number>>;
  currentMonthLabel: string;
  vloggedDays: any[];
  onPlayClip: (clip: any, dayIdx: number) => void;
  groupName: string;
  insetsBottom: number;
  isUserPro: boolean;
  isGroupPro: boolean;
}

export function StreaksStatsView({
  currentStreak,
  friendsStreaks,
  calendarDays,
  monthOffset,
  setMonthOffset,
  currentMonthLabel,
  vloggedDays,
  onPlayClip,
  groupName,
  insetsBottom,
  isUserPro,
  isGroupPro,
}: StreaksStatsViewProps) {
  const currentUserId = useProfileStore((state) => state.user.id);
  return (
    <ScrollView 
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insetsBottom, 100) }]}
    >
      {/* Streak Overview Bar */}
      <View style={styles.calendarHeaderRow}>
        <View>
          <Text style={styles.serifHeaderSub}>Anıları yeniden yaşa</Text>
          <Text className="text-white/40 text-xs mt-0.5">Grubunun güncel durumu</Text>
        </View>
        <GlassView preset="liquid" style={styles.streakBadge}>
          <Flame size={14} color={ACCENT} />
          <Text weight="bold" className="text-[#e07c30] text-[11px] ml-1.5">{currentStreak} günlük seri</Text>
        </GlassView>
      </View>

      {/* Liderlik Tablosu */}
      <View style={styles.leaderboardContainer}>
        <Text weight="bold" className="text-white/40 text-[10px] uppercase tracking-widest mb-3 pl-1">Liderlik Tablosu</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.leaderboardScroll}>
          {friendsStreaks.map((user, idx) => (
            <View key={user.name + idx} style={styles.leaderboardItem}>
              <View style={[styles.rankBadge, user.rank === 1 && styles.rankBadgeFirst]}>
                <Text weight="bold" className={`text-[9px] ${user.rank === 1 ? 'text-black' : 'text-white'}`}>{user.rank}</Text>
              </View>
              <View style={[styles.leaderboardAvatarRing, user.isMe && styles.leaderboardAvatarRingMe]}>
                <Avatar src={user.img} name={user.name} size={48} />
              </View>
              <Text weight="bold" className="text-white text-[11px] mt-1.5 truncate text-center w-full" numberOfLines={1}>{user.name}</Text>
              <Text weight="bold" className="text-[#e07c30] text-[10px] mt-0.5">{user.streak} gün</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Monthly Memory Calendar */}
      <GlassView preset="deep" style={styles.calendarCard}>
        <View className="flex-row justify-between items-center mb-6">
          <View className="flex-row items-center gap-2">
            <CalendarIcon size={16} color="rgba(255,255,255,0.4)" />
            <Text weight="bold" className="text-white text-sm tracking-wide">{currentMonthLabel}</Text>
          </View>
          <View className="flex-row items-center gap-4">
            <TouchableOpacity onPress={() => { selectionTick(); setMonthOffset(prev => prev - 1); }}><ChevronLeft size={20} color="rgba(255,255,255,0.7)" /></TouchableOpacity>
            <TouchableOpacity onPress={() => { selectionTick(); setMonthOffset(prev => prev + 1); }} disabled={monthOffset >= 0}><ChevronRight size={20} color={monthOffset >= 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.7)"} /></TouchableOpacity>
          </View>
        </View>

        <Animated.View key={monthOffset} entering={FadeIn.duration(200)} style={styles.calendarGrid}>
          {WEEKDAYS.map((day) => <Text key={day} className="text-white/40 text-[9px] font-bold tracking-wider text-center mb-3">{day}</Text>)}
          {calendarDays.map((item, i) => {
            const isVlogged = item.type === "vlogged";
            const isMissed = item.type === "missed";
            const locked = isVlogged && item.assignment?.date ? isArchiveLocked(item.assignment.date, isUserPro, isGroupPro) : false;

            const targetClip = isVlogged ? item.assignment?.clips?.[0] : null;
            const firstClipMapped = targetClip ? {
              ...targetClip,
              id: targetClip.id,
              name: item.assignment.user.name,
              avatar: item.assignment.user.image,
              image: targetClip.thumbnailUrl,
              recordedAt: targetClip.recordedAt,
              isMine: item.assignment.user.id === currentUserId,
              timeAgo: "AKŞAM",
              date: new Date(targetClip.recordedAt).toLocaleDateString("tr-TR", { month: 'short', day: 'numeric' }),
              videoUrl: targetClip.videoUrl,
              hlsUrl: targetClip.hlsUrl,
              transcodeStatus: targetClip.transcodeStatus,
              thumbnailBlurUrl: targetClip.thumbnailBlurUrl || targetClip.thumbnailUrl,
              location: targetClip.location || "",
              metadata: targetClip.metadata,
              caption: targetClip.caption || "",
              photoResponses: targetClip.photoResponses || [],
              comments: targetClip.comments || [],
              views: targetClip.views || [],
              reactions: targetClip.reactions || []
            } : null;

            const handleCalendarDayPress = () => {
              if (!firstClipMapped) return;
              selectionTick();
              const targetVloggedDayIndex = vloggedDays.findIndex(vd => vd.assignment?.id === item.assignment?.id);
              if (targetVloggedDayIndex !== -1) {
                onPlayClip(firstClipMapped, targetVloggedDayIndex);
              }
            };

            return (
              <View key={i} style={styles.dayWrapper}>
                <TouchableOpacity
                  disabled={!isVlogged || !firstClipMapped}
                  onPress={handleCalendarDayPress}
                  style={[
                    styles.dayCircle, 
                    isVlogged && styles.dayVlogged, 
                    isMissed && styles.dayMissed, 
                    item.isToday && styles.dayToday
                  ]}
                  activeOpacity={0.8}
                >
                  {isVlogged && (
                    <View style={StyleSheet.absoluteFill}>
                      <Avatar
                        src={item.assignment?.user?.image}
                        name={item.assignment?.user?.name}
                        size={36}
                      />
                      <View style={styles.calendarAvatarShade} />
                    </View>
                  )}
                  {locked ? (
                    <View style={styles.calendarLockBadge}>
                      <Lock size={10} color="rgba(255,255,255,0.7)" />
                    </View>
                  ) : (
                    <Text weight="bold" className={`text-xs z-10 ${isVlogged ? 'text-white' : 'text-white/30'}`}>{item.d}</Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </Animated.View>
      </GlassView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { 
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  calendarHeaderRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginBottom: 20 
  },
  serifHeaderSub: {
    fontSize: 22,
    color: '#FAF9F6',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  streakBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.1)' 
  },
  leaderboardContainer: { 
    marginBottom: 24, 
    overflow: 'visible' 
  },
  leaderboardScroll: { 
    paddingTop: 8, 
    paddingBottom: 8, 
    paddingLeft: 4, 
    paddingRight: 16 
  },
  leaderboardItem: { 
    alignItems: 'center', 
    position: 'relative', 
    width: 68, 
    marginRight: 12 
  },
  rankBadge: { 
    position: 'absolute', 
    top: -6, 
    left: 2, 
    width: 18, 
    height: 18, 
    borderRadius: 9, 
    backgroundColor: 'rgba(255,255,255,0.15)', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.3)', 
    alignItems: 'center', 
    justifyContent: 'center', 
    zIndex: 10 
  },
  rankBadgeFirst: { 
    backgroundColor: ACCENT, 
    borderColor: '#ffb880' 
  },
  leaderboardAvatarRing: { 
    padding: 3, 
    borderRadius: 999, 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  leaderboardAvatarRingMe: { 
    backgroundColor: ACCENT 
  },
  calendarCard: { 
    borderRadius: 24, 
    padding: 20 
  },
  calendarGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between' 
  },
  dayWrapper: {
    width: '14.28%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    alignItems: 'center', 
    justifyContent: 'center', 
    position: 'relative', 
    overflow: 'hidden' 
  },
  dayVlogged: { 
    backgroundColor: ACCENT 
  },
  dayMissed: { 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.1)', 
    backgroundColor: 'rgba(255,255,255,0.02)' 
  },
  dayToday: { 
    borderWidth: 2, 
    borderColor: '#fff' 
  },
  calendarAvatarShade: {
    ...StyleSheet.absoluteFill,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  calendarLockBadge: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});

// ./src/components/streaks/JournalModeView.tsx
"use client";

import React from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ScrollView,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { Text } from '../ui/Text';
import {
  DAY_CARD_GAP,
  DAY_CARD_WIDTH,
  DAY_ITEM_INTERVAL,
  InteractiveDayCard,
} from './InteractiveDayCard';
import { InteractiveAlbumCard } from './InteractiveAlbumCard';
import { isArchiveLocked } from '../../../app/(app)/streaks';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const serifFont = Platform.OS === 'ios' ? 'Georgia' : 'serif';

interface JournalModeViewProps {
  vloggedDays: any[];
  selectedDayIndex: number;
  groupedPeriodClips: any[];
  onPlayClip: (clip: any, dayIdx: number) => void;
  topFlatListRef: React.RefObject<FlatList<any> | null>;
  handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  handleScrollAnimationEnd: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  handleScrollBeginDrag: () => void;
  handleSelectDayCard: (index: number) => void;
  insetsBottom: number;
  isUserPro: boolean;
  isGroupPro: boolean;
}

// NativeWind's ScrollView interop drops VirtualizedList's imperative ref on
// the current React Native version, which makes FlatList.scrollToOffset a no-op.
function renderNativeScrollComponent(props: React.ComponentProps<typeof ScrollView>) {
  return <ScrollView {...props} cssInterop={false} />;
}

export function JournalModeView({
  vloggedDays,
  selectedDayIndex,
  groupedPeriodClips,
  onPlayClip,
  topFlatListRef,
  handleScroll,
  handleScrollAnimationEnd,
  handleScrollBeginDrag,
  handleSelectDayCard,
  insetsBottom,
  isUserPro,
  isGroupPro,
}: JournalModeViewProps) {
  return (
    <View style={styles.flexContainer}>
      {/* TOP SWIPEABLE TRACK OF DAYS */}
      <View style={styles.topSwiperContainer}>
        <FlatList
          ref={topFlatListRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          data={vloggedDays}
          keyExtractor={(item) => item.assignment!.id}
          initialScrollIndex={selectedDayIndex}
          getItemLayout={(_, index) => ({
            length: DAY_CARD_WIDTH,
            offset: index * DAY_ITEM_INTERVAL,
            index,
          })}
          ItemSeparatorComponent={() => <View style={styles.dayCardSeparator} />}
          renderScrollComponent={renderNativeScrollComponent}
          snapToInterval={DAY_ITEM_INTERVAL}
          snapToAlignment="start"
          decelerationRate="fast"
          contentContainerStyle={styles.topSwiperContent}
          onScroll={handleScroll}
          onScrollBeginDrag={handleScrollBeginDrag}
          onMomentumScrollEnd={handleScrollAnimationEnd}
          scrollEventThrottle={16}
          renderItem={({ item, index }) => {
            const isActive = index === selectedDayIndex;
            const locked = isArchiveLocked(item.assignment!.date, isUserPro, isGroupPro);
            return (
              <InteractiveDayCard 
                item={item} 
                index={index} 
                isActive={isActive} 
                onPress={() => handleSelectDayCard(index)} 
                isLocked={locked}
              />
            );
          }}
        />
      </View>

      {/* BOTTOM SECTION - CIRCIADIAN PERIODS AS ALBUMS */}
      <ScrollView 
        key={selectedDayIndex} 
        style={styles.albumsContainer}
        contentContainerStyle={{ paddingBottom: Math.max(insetsBottom, 100) }}
        showsVerticalScrollIndicator={false}
      >
        <Text weight="bold" className="text-white/35 text-[10px] uppercase tracking-widest pl-5 mb-5 mt-2">
          ALBUMS
        </Text>

        {groupedPeriodClips.length > 0 ? (
          groupedPeriodClips.map((period, idx) => (
            <View key={`${selectedDayIndex}-${period.id}`} style={styles.albumSection}>
              <Animated.View 
                entering={FadeInUp.delay(idx * 80).duration(200)}
                style={styles.albumHeader}
              >
                <Text style={[styles.albumTitle, { fontFamily: serifFont }]}>
                  {period.title}
                </Text>
                <Text className="text-white/35 text-[11px] font-medium">
                  {period.timeRange}
                </Text>
              </Animated.View>

              <View style={styles.albumGridRow}>
                {period.clips.slice(0, 4).map((clip: any, clipIdx: number) => {
                  const locked = isArchiveLocked(clip.recordedAt, isUserPro, isGroupPro);
                  return (
                    <InteractiveAlbumCard 
                      key={clip.id}
                      clip={clip}
                      clipIdx={clipIdx}
                      rowIdx={idx}
                      totalCount={period.clips.length}
                      onPlay={(c) => onPlayClip(c, selectedDayIndex)}
                      isLocked={locked}
                    />
                  );
                })}
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Text className="text-white/30 text-xs">Bu gün için vlog parçası bulunamadı.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flexContainer: { 
    flex: 1 
  },
  topSwiperContainer: {
    marginTop: 12,
    height: 245,
    justifyContent: 'center',
  },
  topSwiperContent: {
    paddingHorizontal: (SCREEN_WIDTH - DAY_CARD_WIDTH) / 2,
    alignItems: 'center',
  },
  dayCardSeparator: {
    width: DAY_CARD_GAP,
  },
  albumsContainer: {
    flex: 1,
    marginTop: 20,
  },
  albumSection: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  albumHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 14,
  },
  albumTitle: {
    fontSize: 22,
    color: '#ffffff',
    letterSpacing: -0.4,
  },
  albumGridRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 160,
  },
});

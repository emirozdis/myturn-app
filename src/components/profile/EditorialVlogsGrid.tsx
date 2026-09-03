// ./src/components/profile/EditorialVlogsGrid.tsx
"use client";

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image, FlatList } from 'react-native';
import { Play, MoreVertical, Heart, MessageCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '../ui/Text';
import { ProfileClip } from '../../store/useProfileStore';
import { parseMediaMetadata } from '../../lib/mediaMetadata';

interface EditorialVlogsGridProps {
  clips: ProfileClip[];
  onPlayClip?: (clip: ProfileClip) => void;
  onDeleteClip?: (clip: ProfileClip) => void;
}

export function EditorialVlogsGrid({ clips, onPlayClip, onDeleteClip }: EditorialVlogsGridProps) {
  
  if (!clips || clips.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text className="text-white/40 text-xs text-center leading-relaxed">
          Henüz vlog paylaşılmadı. Sıra size geldiğinde ilk klibinizi kaydedip burada görüntüleyebilirsiniz!
        </Text>
      </View>
    );
  }

  const renderCard = ({ item }: { item: ProfileClip }) => {
    const dateObj = new Date(item.recordedAt);
    const dateFormatted = dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', weekday: 'short' }).replace(',', '');
    
    let duration: string | null = item.mediaType === 'photo' ? "PHOTO" : null;
    const meta = parseMediaMetadata(item.metadata);
    if (meta) {
      if (meta.mediaType === 'photo') {
        duration = "PHOTO";
      } else {
        const seconds = Number(meta.durationSeconds ?? meta.duration);
        if (Number.isFinite(seconds) && seconds > 0) {
          const roundedSeconds = Math.round(seconds);
          duration = `${Math.floor(roundedSeconds / 60)}:${String(roundedSeconds % 60).padStart(2, '0')}`;
        }
      }
    }

    const likeCount = item._count?.reactions || 0;
    const commentCount = item._count?.comments || 0;

    return (
      <TouchableOpacity 
        onPress={() => onPlayClip?.(item)}
        disabled={!onPlayClip}
        style={styles.cardContainer}
        activeOpacity={0.9}
      >
        {/* Cover Image Block */}
        <View style={styles.imageWrapper}>
          <Image source={{ uri: item.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <LinearGradient 
            colors={['transparent', 'rgba(0,0,0,0.5)']}
            style={StyleSheet.absoluteFill}
          />
          
          {/* Center Play Icon */}
          <View style={styles.centerPlayBadge}>
            <Play size={18} color="#fff" fill="#fff" style={{ marginLeft: 2 }} />
          </View>

          {/* Duration Pill */}
          {duration && (
            <View style={styles.durationPill}>
              <Text weight="bold" className="text-white text-[10px]">{duration}</Text>
            </View>
          )}
        </View>

        {/* Bottom Details Block */}
        <View style={styles.detailsBlock}>
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-2">
              <Text weight="bold" className="text-white text-[13px] leading-tight mb-1">{dateFormatted}</Text>
              <Text className="text-white/50 text-[10px]">{item.location || '—'}</Text>
            </View>
            {onDeleteClip && (
              <TouchableOpacity
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={() => onDeleteClip(item)}
                activeOpacity={0.7}
              >
                <MoreVertical size={14} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            )}
          </View>

          <View className="flex-row items-center gap-3 mt-3">
            <View className="flex-row items-center gap-1.5">
              <Heart size={12} color="rgba(255,255,255,0.4)" fill="rgba(255,255,255,0.4)" />
              <Text weight="bold" className="text-white/60 text-[11px]">{likeCount}</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <MessageCircle size={12} color="rgba(255,255,255,0.4)" />
              <Text weight="bold" className="text-white/60 text-[11px]">{commentCount}</Text>
            </View>
          </View>
        </View>

      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={clips}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      renderItem={renderCard}
    />
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#161618',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 24,
    padding: 20,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  cardContainer: {
    width: 145,
    marginRight: 16,
  },
  imageWrapper: {
    width: '100%',
    height: 195,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1c1c1e',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  centerPlayBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -18 }, { translateY: -18 }],
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationPill: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  detailsBlock: {
    marginTop: 10,
    paddingHorizontal: 4,
  },
});

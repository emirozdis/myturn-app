// ./src/components/streaks/GridModeView.tsx
"use client";

import React from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Image, Dimensions } from 'react-native';
import { Play, Lock } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '../ui/Text';
import { isArchiveLocked } from '../../../app/(app)/streaks';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_ITEM_WIDTH = (SCREEN_WIDTH - 52) / 3;

interface GridModeViewProps {
  vloggedDays: any[];
  currentUserId: string;
  onPlayClip: (clip: any, dayIdx: number) => void;
  insetsBottom: number;
  isUserPro: boolean;
  isGroupPro: boolean;
}

export function GridModeView({
  vloggedDays,
  currentUserId,
  onPlayClip,
  insetsBottom,
  isUserPro,
  isGroupPro,
}: GridModeViewProps) {

  const renderGridItem = ({ item, index }: { item: any; index: number }) => {
    const firstClip = item.assignment?.clips?.[0];
    if (!firstClip) return null;

    const locked = isArchiveLocked(item.assignment.date, isUserPro, isGroupPro);

    const mappedClip = {
      ...firstClip,
      id: firstClip.id,
      name: item.assignment.user.name,
      avatar: item.assignment.user.image,
      image: firstClip.thumbnailUrl,
      recordedAt: firstClip.recordedAt,
      isMine: item.assignment.user.id === currentUserId,
      timeLabel: new Date(firstClip.recordedAt).toLocaleTimeString("tr-TR", { hour: '2-digit', minute: '2-digit' }),
      date: new Date(item.assignment.date).toLocaleDateString("tr-TR", { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      videoUrl: firstClip.videoUrl,
      hlsUrl: firstClip.hlsUrl,
      transcodeStatus: firstClip.transcodeStatus,
      thumbnailBlurUrl: firstClip.thumbnailBlurUrl || firstClip.thumbnailUrl,
      location: firstClip.location || "",
      metadata: firstClip.metadata,
      caption: firstClip.caption || "",
      photoResponses: firstClip.photoResponses || [],
      comments: firstClip.comments || [],
      views: firstClip.views || [],
      reactions: firstClip.reactions || []
    };

    return (
      <TouchableOpacity 
        activeOpacity={0.8}
        onPress={() => onPlayClip(mappedClip, index)}
        style={styles.gridItem}
      >
        <Image 
          source={{ uri: firstClip.thumbnailUrl }} 
          style={StyleSheet.absoluteFill} 
          resizeMode="cover"
          blurRadius={locked ? 15 : 0}
        />
        <LinearGradient 
          colors={['transparent', 'rgba(0,0,0,0.5)']} 
          style={StyleSheet.absoluteFill} 
        />
        
        {locked ? (
          <View style={styles.lockIconOverlay}>
            <View style={styles.lockBadge}>
              <Lock size={12} color="#fff" />
            </View>
          </View>
        ) : (
          <View style={styles.playIconOverlay}>
            <Play size={10} color="#fff" fill="#fff" />
          </View>
        )}

        <View style={styles.dateOverlay}>
          <Text weight="bold" style={styles.dateText}>{mappedClip.date}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={vloggedDays}
      keyExtractor={(item) => item.assignment!.id}
      numColumns={3}
      showsVerticalScrollIndicator={false}
      renderItem={renderGridItem}
      contentContainerStyle={[styles.gridContainer, { paddingBottom: Math.max(insetsBottom, 100) }]}
    />
  );
}

const styles = StyleSheet.create({
  gridContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  gridItem: {
    width: GRID_ITEM_WIDTH,
    height: GRID_ITEM_WIDTH * 1.33,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1c1c1e',
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    position: 'relative',
  },
  playIconOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  lockIconOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  lockBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  dateOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
  },
  dateText: {
    color: '#fff',
    fontSize: 10,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});

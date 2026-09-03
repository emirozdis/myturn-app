// ./src/components/profile/ProfileStats.tsx
"use client";

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';

interface ProfileStatsProps {
  totalVlogs: number | string;
  totalLikes: string | number;
  totalComments: string | number;
  totalPhotos: string | number;
}

export function ProfileStats({ 
  totalVlogs, 
  totalLikes, 
  totalComments, 
  totalPhotos 
}: ProfileStatsProps) {
  return (
    <View style={styles.container}>
      <View style={styles.statsCard}>
        
        <View style={styles.statColumn}>
          <Text weight="bold" style={styles.statNumber}>{totalVlogs}</Text>
          <Text style={styles.statLabel}>Vloglar</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.statColumn}>
          <Text weight="bold" style={styles.statNumber}>{totalLikes}</Text>
          <Text style={styles.statLabel}>Beğeniler</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.statColumn}>
          <Text weight="bold" style={styles.statNumber}>{totalComments}</Text>
          <Text style={styles.statLabel}>Yorumlar</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.statColumn}>
          <Text weight="bold" style={styles.statNumber}>{totalPhotos}</Text>
          <Text style={styles.statLabel}>Fotoğraf Yanıtları</Text>
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    marginTop: 24,
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161618',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 18,
    paddingHorizontal: 8,
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
});
// ./src/components/profile/ProfileHeader.tsx
"use client";

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { MapPin, Calendar, Camera, Crown, Users } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '../ui/Text';
import { Avatar } from '../ui/Avatar';

const serifFont = Platform.OS === 'ios' ? 'Georgia' : 'serif';

interface ProfileHeaderProps {
  user: any;
  friendsCount: number;
  tempAvatarUri: string | null;
  uploadingAvatar: boolean;
  onPickAvatar: () => void;
  isPro?: boolean;
}

export function ProfileHeader({ 
  user, 
  friendsCount,
  tempAvatarUri, 
  uploadingAvatar, 
  onPickAvatar, 
  isPro = false,
}: ProfileHeaderProps) {
  const joinedYear = user.createdAt ? new Date(user.createdAt).getFullYear() : "—";

  return (
    <View style={styles.container}>
      {/* Top Stack: Avatar Left, Info Right */}
      <View style={styles.mainInfoRow}>
        
        <View style={styles.avatarContainer}>
          {isPro ? (
            <LinearGradient
              colors={['#e07c30', '#ff3b30', '#facc15']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.proAvatarRing}
            >
              <View style={styles.avatarInnerContainer}>
                <Avatar 
                  src={tempAvatarUri || user.image} 
                  name={user.name} 
                  size={80} 
                  ring={false} 
                />
              </View>
            </LinearGradient>
          ) : (
            <Avatar 
              src={tempAvatarUri || user.image} 
              name={user.name} 
              size={88} 
              ring={false} 
            />
          )}
          <TouchableOpacity 
            onPress={onPickAvatar}
            style={styles.cameraBadgeTrigger}
            activeOpacity={0.9}
          >
            <Camera size={12} color="#000" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        <View style={styles.infoBlock}>
          <View style={styles.nameRow}>
            <Text style={[styles.nameText, { fontFamily: serifFont }]}>
              {user.name || "Member"}
            </Text>
            {isPro && (
              <LinearGradient
                colors={['#e07c30', '#ff3b30']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.proBadge}
              >
                <Text weight="bold" style={styles.proBadgeText}>PRO</Text>
              </LinearGradient>
            )}
          </View>

          <Text className="text-white/50 text-[13px] mt-0.5 mb-2">
            {user.handle ? `@${user.handle}` : "—"}
          </Text>

          <View style={styles.archetypeBadge}>
            <Crown size={10} color="rgba(255,255,255,0.6)" fill="rgba(255,255,255,0.3)" />
            <Text weight="bold" className="text-white/70 text-[9px] uppercase tracking-widest pl-1.5 leading-none">
              {user.archetype?.toUpperCase() || "—"}
            </Text>
          </View>

          <Text style={styles.bioText} className="text-white/90">
            {user.bio || "No bio yet"}
          </Text>
        </View>
      </View>

      {/* Meta Row: Spans full width below */}
      <View style={styles.metaRow}>
        <View className="flex-row items-center gap-1.5">
          <MapPin size={11} color="rgba(255,255,255,0.4)" />
          <Text className="text-white/50 text-[11px]">{user.location || "—"}</Text>
        </View>
        <Text className="text-white/20 text-[10px] mx-2">•</Text>
        <View className="flex-row items-center gap-1.5">
          <Calendar size={11} color="rgba(255,255,255,0.4)" />
          <Text className="text-white/50 text-[11px]">Katıldı: {joinedYear}</Text>
        </View>
        <Text className="text-white/20 text-[10px] mx-2">•</Text>
        <View className="flex-row items-center gap-1.5">
          <Users size={11} color="rgba(255,255,255,0.4)" />
          <Text className="text-white/50 text-[11px]">{friendsCount || 0} Arkadaş</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    marginTop: 20,
  },
  mainInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 20,
  },
  avatarContainer: {
    position: 'relative',
  },
  proAvatarRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInnerContainer: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#0B0B0C',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cameraBadgeTrigger: {
    position: 'absolute',
    bottom: 2,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0B0B0C',
    zIndex: 10,
  },
  infoBlock: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  nameText: {
    fontSize: 26,
    color: '#ffffff',
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  proBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontFamily: 'Satoshi-Bold',
  },
  archetypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: 10,
    marginTop: 6,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    flexWrap: 'wrap',
  },
});

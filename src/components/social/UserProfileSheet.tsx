// ./src/components/social/UserProfileSheet.tsx
import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MapPin, Calendar, Crown, Sparkles } from 'lucide-react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { GlassView } from '../ui/GlassView';
import { Text } from '../ui/Text';
import { Avatar } from '../ui/Avatar';
import { EditorialVlogsGrid } from '../profile/EditorialVlogsGrid';
import type { ProfileClip } from '../../store/useProfileStore';

interface UserProfileSheetProps {
  isOpen: boolean;
  onClose: () => void;
  profileData: any;
  profileLoading: boolean;
  profileError?: string | null;
  onRetry?: () => void;
  onPlayClip?: (clip: ProfileClip) => void;
}

export function UserProfileSheet({ isOpen, onClose, profileData, profileLoading, profileError, onRetry, onPlayClip }: UserProfileSheetProps) {
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} heightPercent={0.78}>
      <ScrollView style={styles.sheetContent} contentContainerStyle={styles.sheetContentContainer} showsVerticalScrollIndicator={false}>
        {profileLoading ? (
          <View className="flex-col gap-5">
            <View className="flex-row items-center gap-4">
              <View className="w-[72px] h-[72px] rounded-full bg-white/[0.04]" />
              <View className="flex-col flex-1 gap-2">
                <View className="h-5 w-32 rounded-md bg-white/[0.04]" />
                <View className="h-3.5 w-20 rounded-md bg-white/[0.03]" />
              </View>
            </View>
            <View className="flex-col gap-2.5 mt-2">
              <View className="h-4 w-full rounded-md bg-white/[0.03]" />
              <View className="h-4 w-[85%] rounded-md bg-white/[0.03]" />
            </View>
            <View className="bg-neutral-900/60 border border-white/5 rounded-2xl h-24 mt-4" />
          </View>
        ) : profileError || !profileData ? (
          <View className="items-center justify-center px-6 py-16">
            <Text weight="bold" className="text-white text-base mb-2">Profil yüklenemedi</Text>
            <Text className="text-white/50 text-xs text-center mb-5">{profileError || "Lütfen tekrar deneyin."}</Text>
            {onRetry && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onRetry}
                className="rounded-xl bg-white/10 border border-white/10 px-5 py-3"
              >
                <Text weight="bold" className="text-white text-xs">Tekrar Dene</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View className="flex-col gap-5">
            <View className="flex-row items-center gap-4">
              <Avatar src={profileData.image} name={profileData.name} size={72} ring={false} />
              <View className="flex-col min-w-0 flex-1 justify-center">
                <Text weight="bold" className="text-white text-lg tracking-tight truncate leading-tight">{profileData.name}</Text>
                <Text className="text-white/50 text-xs font-medium mt-0.5 mb-2.5">@{profileData.handle}</Text>
                <View className="flex-row gap-2 items-center flex-wrap">
                  <View className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 flex-row items-center gap-1">
                    <Crown size={10} color="rgba(255,255,255,0.6)" fill="rgba(255,255,255,0.3)" />
                    <Text weight="bold" className="text-[8px] text-white/70 uppercase tracking-wider">{profileData.archetype}</Text>
                  </View>
                  <View className="px-2 py-1 rounded-lg bg-white/5 border border-[rgba(255,154,68,0.22)] flex-row items-center gap-1">
                    <Sparkles size={10} color="#ff9a44" />
                    <Text weight="bold" className="text-[8px] text-[#ff9a44] uppercase tracking-wider">{profileData.xp} XP</Text>
                  </View>
                </View>
              </View>
            </View>

            <View className="flex-col gap-2 mt-1">
              <Text className="text-white/80 text-xs leading-relaxed">{profileData.bio || "Biyografi yok."}</Text>
              <View className="flex-row items-center gap-1.5 flex-wrap mt-2">
                <MapPin size={11} color="rgba(255,255,255,0.4)" />
                <Text className="text-white/40 text-[10.5px]">{profileData.location || "—"}</Text>
                <Text className="text-white/20 text-[10px] mx-1">•</Text>
                <Calendar size={11} color="rgba(255,255,255,0.4)" />
                <Text className="text-white/40 text-[10.5px]">Katıldı: {profileData.createdAt ? new Date(profileData.createdAt).getFullYear() : "—"}</Text>
              </View>
            </View>

            <GlassView preset="deep" style={{ borderRadius: 16, paddingVertical: 16, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
              <View className="flex-1 items-center justify-center">
                <Text weight="bold" className="text-white text-sm mb-1">{profileData._count?.clips || 0}</Text>
                <Text weight="bold" className="text-white/40 text-[9px] uppercase tracking-wider">Vloglar</Text>
              </View>
              <View className="w-[1px] h-6 bg-white/10" />
              <View className="flex-1 items-center justify-center">
                <Text weight="bold" className="text-white text-sm mb-1">{profileData._count?.groupMembers || 0}</Text>
                <Text weight="bold" className="text-white/40 text-[9px] uppercase tracking-wider">Gruplar</Text>
              </View>
            </GlassView>

            {profileData.clips !== undefined && (
              <View style={styles.latestClipsSection}>
                <Text weight="bold" className="text-white text-base mb-3">Son Vloglar</Text>
                <EditorialVlogsGrid
                  clips={(profileData.clips || []) as ProfileClip[]}
                  onPlayClip={onPlayClip}
                />
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetContent: { flex: 1 },
  sheetContentContainer: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 28 },
  latestClipsSection: { marginTop: 24, marginHorizontal: -24 },
});

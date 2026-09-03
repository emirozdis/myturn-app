import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Users, Flame, MoreVertical, ScanLine, AlertTriangle } from 'lucide-react-native';
import { GlassView } from '../ui/GlassView';
import { Avatar } from '../ui/Avatar';
import { Text } from '../ui/Text';
import { ACCENT } from '../../lib/theme';

interface GroupsTabProps {
  groups: any[];
  setCreateGroupVisible: (val: boolean) => void;
  setJoinGroupVisible: (val: boolean) => void;
  setSelectedGroupDetails: (group: any) => void;
}

export function GroupsTab({
  groups,
  setCreateGroupVisible,
  setJoinGroupVisible,
  setSelectedGroupDetails
}: GroupsTabProps) {
  return (
    <View className="mt-8">
      <Animated.View entering={FadeInUp.delay(100).duration(400)} className="px-6 flex-row gap-3.5 mb-6">
        <TouchableOpacity onPress={() => setCreateGroupVisible(true)} activeOpacity={0.85} className="flex-1">
          <GlassView preset="liquid" style={styles.widgetCard}>
            <View className="flex-row items-center justify-between mb-3">
              <Text weight="bold" className="text-white text-[15px] tracking-tight">Grup Kur</Text>
              <View style={styles.widgetIconOuter}>
                <Users size={16} color={ACCENT} />
              </View>
            </View>
            <Text className="text-white/50 text-[11px] leading-relaxed mb-4">Yeni bir alan oluştur ve ekibini davet et.</Text>
          </GlassView>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setJoinGroupVisible(true)} activeOpacity={0.85} className="flex-1">
          <GlassView preset="liquid" style={styles.widgetCard}>
            <View className="flex-row items-center justify-between mb-3">
              <Text weight="bold" className="text-white text-[15px] tracking-tight">Gruba Katıl</Text>
              <View style={[styles.widgetIconOuter, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                <ScanLine size={15} color="rgba(255,255,255,0.8)" />
              </View>
            </View>
            <Text className="text-white/50 text-[11px] leading-relaxed mb-4">Kısa kodu gir veya arkadaşının QR kodunu tara.</Text>
          </GlassView>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(200).duration(400)}>
        <View className="flex-row items-center justify-between mb-4 px-6">
          <Text weight="bold" className="text-white text-base tracking-tight">Grupların ({groups.length})</Text>
        </View>
        {groups.length > 0 ? (
          <View className="px-6 flex-col gap-3">
            {groups.map((group: any) => {
              const isProGroup = group.boostCount >= 3;
              const graceEnd = group.boostGracePeriodEndsAt;
              const daysLeft = graceEnd ? Math.ceil((new Date(graceEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

              const cardContent = (
                <GlassView 
                  preset="liquid" 
                  style={[
                    styles.groupPillCard, 
                    isProGroup && { 
                      borderWidth: 0, 
                      backgroundColor: '#141416' 
                    }
                  ]}
                >
                  <View className="flex-row items-center gap-4 flex-1 min-w-0">
                    <View style={styles.groupAvatarBox}>
                      <Avatar src={group.image} name={group.name} size={52} />
                    </View>
                    <View className="flex-1 min-w-0 justify-center">
                      <View className="flex-row items-center gap-2">
                        <Text weight="bold" className="text-white text-[15px] tracking-tight" numberOfLines={1}>{group.name}</Text>
                        {isProGroup && (
                          <LinearGradient
                            colors={[ACCENT, ACCENT]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.proBadge}
                          >
                            <Text weight="bold" style={styles.proBadgeText}>PRO</Text>
                          </LinearGradient>
                        )}
                      </View>
                      
                      <View className="flex-row items-center gap-1.5 mt-1">
                        <Users size={11} color="rgba(255,255,255,0.4)" />
                        <Text className="text-white/50 text-[10px] font-medium">{group.memberCount || group.members} Üye</Text>
                        <Text className="text-white/20 text-[10px] mx-1">•</Text>
                        <Flame size={10} color="#e07c30" />
                        <Text className="text-white/60 text-[10px] font-medium">Kod: <Text weight="bold" className="text-white/80">{group.inviteCode}</Text></Text>
                      </View>

                      <View style={styles.boostRowContainer} className="mt-2.5">
                        <View style={styles.progressTrack} className="bg-white/10 h-1.5 rounded-full overflow-hidden flex-1 max-w-[120px]">
                          <View style={[styles.progressBar, { width: `${Math.min(100, ((group.boostCount || 0) / 3) * 100)}%` }]} />
                        </View>
                        <Text weight="bold" className="text-[#e07c30] text-[9.5px] font-mono ml-2">
                          {group.boostCount || 0}/3 Boost
                        </Text>
                        
                        {group.boostCount > 0 && Array.isArray(group.boosters) && group.boosters.length > 0 && (
                          <View style={styles.boostersOverlay}>
                            {group.boosters.slice(0, 3).map((booster: any, idx: number) => (
                              <View 
                                key={booster.id + idx} 
                                style={[
                                  styles.overlapBoosterAvatar, 
                                  { marginLeft: idx > 0 ? -6 : 0, zIndex: 10 - idx }
                                ]}
                              >
                                <Avatar src={booster.image} name={booster.name} size={15} />
                              </View>
                            ))}
                          </View>
                        )}
                      </View>

                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => setSelectedGroupDetails(group)}
                    style={styles.groupMenuBtn}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    activeOpacity={0.6}
                    accessibilityRole="button"
                    accessibilityLabel={`${group.name} grup seçenekleri`}
                  >
                    <MoreVertical size={20} color="rgba(255,255,255,0.62)" strokeWidth={2.2} />
                  </TouchableOpacity>
                </GlassView>
              );

              return (
                <View key={group.id}>
                  {graceEnd && daysLeft >= 0 && !group.isFrozen && (
                    <View style={styles.graceBanner}>
                      <AlertTriangle size={14} color="#facc15" style={{ marginRight: 6 }} />
                      <Text style={styles.graceBannerText}>Pro Durumu Yakında Bitiyor! 20 üye kapasitesini ve 1080p HD'yi korumak için {daysLeft} gün içinde 1 boost ekleyin.</Text>
                    </View>
                  )}
                  {group.isFrozen && (
                    <View style={styles.frozenBanner}>
                      <AlertTriangle size={14} color="#ef4444" style={{ marginRight: 6 }} />
                      <Text style={styles.frozenBannerText}>Grup Donduruldu. Standart gruplar için 4 üye sınırını aştınız. Devam etmek için boost ekleyin veya üye sayısını azaltın.</Text>
                    </View>
                  )}

                  <TouchableOpacity 
                    onPress={() => setSelectedGroupDetails(group)} 
                    activeOpacity={0.8}
                  >
                    {isProGroup ? (
                      <LinearGradient
                        colors={[ACCENT, ACCENT, ACCENT]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.proBorderGradient}
                      >
                        {cardContent}
                      </LinearGradient>
                    ) : (
                      cardContent
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ) : (
          <View className="px-6 py-4">
            <Text className="text-white/30 text-xs">Henüz bir gruba üye değilsiniz.</Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  widgetCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    justifyContent: 'space-between',
    minHeight: 140,
  },
  widgetIconOuter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(224,124,48,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proBorderGradient: {
    borderRadius: 24,
    padding: 2.2,
    overflow: 'hidden',
  },
  groupPillCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
  },
  groupAvatarBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  proBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proBadgeText: {
    color: '#000',
    fontSize: 8.5,
    fontFamily: 'Satoshi-Bold',
  },
  boostRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressTrack: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: 3,
  },
  boostersOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    paddingRight: 6,
  },
  overlapBoosterAvatar: {
    borderWidth: 1,
    borderColor: '#0B0B0C',
    borderRadius: 8,
    overflow: 'hidden',
  },
  groupMenuBtn: {
    width: 30,
    height: 40,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  graceBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    borderWidth: 1.2,
    borderColor: 'rgba(234, 179, 8, 0.3)',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  graceBannerText: {
    flex: 1,
    color: '#facc15',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Satoshi-Medium',
  },
  frozenBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  frozenBannerText: {
    flex: 1,
    color: '#ef4444',
    fontSize: 11,
    lineHeight: 16,
  },
});

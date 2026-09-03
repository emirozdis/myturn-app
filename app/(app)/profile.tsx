// ./myturn-app/app/(app)/profile.tsx
"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { 
  StyleSheet, 
  View, 
  TouchableOpacity, 
  ScrollView,
  Dimensions,
  Modal,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  Share
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Settings, Award, X, Lock, Check } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import Animated, { 
  FadeInUp, 
} from 'react-native-reanimated';
import { useRouter, useFocusEffect } from 'expo-router';
import crashlytics from '@react-native-firebase/crashlytics';
import analytics from '@react-native-firebase/analytics';
import auth from '@react-native-firebase/auth';
import Purchases from 'react-native-purchases';

import { ACCENT } from '../../src/lib/theme';

import { useProfileStore, ProfileClip } from '../../src/store/useProfileStore';
import { useGroupStore } from '../../src/store/useGroupStore';
import { useLanguageStore } from '../../src/store/useLanguageStore';
import { useTranslation } from '../../src/lib/i18n';
import { useProStore } from '../../src/store/useProStore';
import { useTodayStore } from '../../src/store/useTodayStore';
import { useSocialStore } from '../../src/store/useSocialStore';
import { useStreaksStore } from '../../src/store/useStreaksStore';
import { useRecordStore } from '../../src/store/useRecordStore';
import { useAchievementStore } from '../../src/store/useAchievementStore';
import { useUploadQueueStore } from '../../src/store/useUploadQueueStore';
import { storage } from '../../src/lib/storage';
import { syncWidgetSessionState } from '../../src/lib/widgetSync';
import { apiClient } from '../../src/lib/apiClient';
import { Text } from '../../src/components/ui/Text';
import { GlassView } from '../../src/components/ui/GlassView';
import { lightTap, selectionTick, notifySuccess } from '../../src/lib/haptics';

// Imported Split Component Files
import { ProfileHeader } from '../../src/components/profile/ProfileHeader';
import { ProfileStats } from '../../src/components/profile/ProfileStats';
import { EditorialVlogsGrid } from '../../src/components/profile/EditorialVlogsGrid';
import { SettingsOverlay } from '../../src/components/profile/SettingsOverlay';
import { StreakClipPlaybackOverlay } from '../../src/components/streaks/StreakClipPlaybackOverlay';
import { getLocalizedAchievements, ACHIEVEMENT_ICONS } from '../../src/components/achievements/achievementData';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const serifFont = Platform.OS === 'ios' ? 'Georgia' : 'serif';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { locale } = useLanguageStore();
  const { t } = useTranslation();
  const { isPro } = useProStore();

  const user = useProfileStore((state) => state.user);
  const totalVlogs = useProfileStore((state) => state.totalVlogs);
  const totalLikes = useProfileStore((state) => state.totalLikes);
  const totalComments = useProfileStore((state) => state.totalComments);
  const totalPhotos = useProfileStore((state) => state.totalPhotos);
  const friendsCount = useProfileStore((state) => state.friendsCount);
  const clips = useProfileStore((state) => state.clips);
  const fetchProfileData = useProfileStore((state) => state.fetchProfileData);
  const uploadAvatar = useProfileStore((state) => state.uploadAvatar);
  const deleteClip = useProfileStore((state) => state.deleteClip);

  const [showSettings, setShowSettings] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [tempAvatarUri, setTempAvatarUri] = useState<string | null>(null);
  const [showAchievementsModal, setShowAchievementsModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [activePlaybackDayIndex, setActivePlaybackDayIndex] = useState<number | null>(null);
  const [activePlaybackClipIndex, setActivePlaybackClipIndex] = useState<number>(0);

  const localizedRegistry = useMemo(() => getLocalizedAchievements(locale), [locale]);
  
  const unlockedIds = useMemo(() => {
    return ((user as any).unlockedIds || []) as string[];
  }, [user]);

  const unlockedAchievements = useMemo(() => {
    return Object.keys(localizedRegistry)
      .filter((key) => unlockedIds.includes(key))
      .map((key) => ({
        ...localizedRegistry[key],
        id: key,
      }));
  }, [localizedRegistry, unlockedIds]);

  useFocusEffect(
    useCallback(() => {
      fetchProfileData();
    }, [fetchProfileData])
  );

  const handlePickAvatar = async () => {
    lightTap();
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("İzin Gerekli", "Profil fotoğrafı yüklemek için galeri erişim izni vermelisiniz.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const selectedUri = result.assets[0].uri;
      setTempAvatarUri(selectedUri);
      setUploadingAvatar(true);

      try {
        await uploadAvatar(selectedUri);
      } catch (err) {
        console.warn("[ProfileScreen] Avatar upload exception encountered:", err);
        Alert.alert("Yükleme Hatası", "Fotoğraf sunucuya aktarılamadı.");
      } finally {
        setUploadingAvatar(false);
      }
    }
  };

  const typedClips = useMemo(() => {
    return (clips || []) as ProfileClip[];
  }, [clips]);

  const formatCount = (num: number) => {
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const profileVloggedDays = useMemo(() => {
    if (typedClips.length === 0) return [];
    return [{
      d: 1,
      type: 'vlogged' as const,
      assignment: {
        id: 'profile_playback_day',
        user: user,
        clips: typedClips,
        date: new Date().toISOString()
      }
    }];
  }, [typedClips, user]);

  const handleVlogMenuPress = (clip: ProfileClip) => {
    lightTap();
    Alert.alert(
      "Vlog Seçenekleri",
      "Klip üzerinde uygulamak istediğiniz işlemi seçin.",
      [
        {
          text: "Paylaş",
          onPress: () => {
            lightTap();
            const cleanUrl = clip.videoUrl.startsWith('http') ? clip.videoUrl : `${apiClient.getBaseUrl()}/api/media/vlogs/${clip.videoUrl}`;
            Share.share({
              message: `MyTurn'de paylaştığım güncel vlog klibime göz atın! 🍿\n${cleanUrl}`,
            }).catch(() => {});
          }
        },
        {
          text: "Klibi Sil",
          style: "destructive",
          onPress: () => {
            lightTap();
            Alert.alert(
              "Emin misiniz?",
              "Bu vlog klibini kalıcı olarak silmek istediğinizden emin misiniz?",
              [
                { text: "Vazgeç", style: "cancel" },
                { 
                  text: "Klibi Sil", 
                  style: "destructive", 
                  onPress: async () => {
                    try {
                      await deleteClip(clip.id);
                      notifySuccess();
                      Alert.alert("Başarılı", "Vlog başarıyla silindi.");
                    } catch (err) {
                      Alert.alert("Hata", "Vlog silinirken bir hata oluştu.");
                    }
                  } 
                }
              ]
            );
          }
        },
        { text: "İptal", style: "cancel" }
      ]
    );
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    const uploadQueue = useUploadQueueStore.getState();
    await Promise.allSettled(
      Object.keys(uploadQueue.tasks).map((taskId) => uploadQueue.clearTask(taskId)),
    );

    lightTap();
    
    analytics().logEvent('logout').catch(() => {});
    analytics().setUserId('').catch(() => {});
    
    Purchases.logOut().catch(() => {});

    try {
      await auth().signOut();
    } catch (e) {
      console.warn("Firebase signout failed", e);
    }

    const keys = storage.getAllKeys();
    keys.forEach(key => {
      if (key !== 'pref_haptic_feedback' && key !== 'pref_analytics_enabled' && key !== 'myturn_lang' && key !== 'active_api_base_url') {
        storage.delete(key);
      }
    });

    syncWidgetSessionState(false, false);
    apiClient.clearAllCache();
    
    useGroupStore.getState().clearGroups();
    
    useProfileStore.setState({
      user: { id: '', name: '', handle: '', image: '', bio: '', location: '', xp: 0, archetype: 'Ghost Watcher', createdAt: '' },
      totalVlogs: 0,
      totalLikes: 0,
      totalComments: 0,
      totalPhotos: 0,
      groupsCount: 0,
      friendsCount: 0,
      clips: [],
      calendarDays: [],
      alwaysHighestQuality: false,
    });

    useTodayStore.setState({
      assignment: null,
      clips: [],
      currentClipIndex: 0,
      currentHourIndex: 0,
      actualHourIndex: 0,
      resolvedClipUrls: {},
      resolvedClipBlurThumbnails: {},
      resolvedClipThumbnails: {},
      isPaused: false,
      isVideoExpanded: false,
      isSleepMode: false,
      liked: false,
      likeCount: 0,
      poking: false,
      pokeCooldown: 0,
      hasVolunteeredForTomorrow: false,
      canVolunteer: false,
      volunteerEligibilityReason: '',
      isVolunteering: false,
      volunteerError: '',
      uploadingPhoto: false,
      dailyPrompt: null,
    });

    useSocialStore.setState({
      friends: [],
      pendingRequests: [],
      sentRequests: [],
      groups: [],
      suggestions: [],
      loading: false,
      error: null,
    });

    useStreaksStore.setState({
      currentStreak: 0,
      bestStreak: 0,
      totalVlogs: 0,
      friendsStreaks: [],
      calendarDays: [],
      historicalDays: [],
      loading: false,
      error: null,
    });

    useProStore.setState({ customerInfo: null, isPro: false });
    useRecordStore.setState({ step: 'CAMERA' });
    useAchievementStore.setState({ queue: [], activeTask: null });
    
    crashlytics().setUserId('').catch(() => {});
    
    setShowSettings(false);
    setIsLoggingOut(false);
    
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#101011', '#0B0B0C']}
        style={StyleSheet.absoluteFill}
      />

      {isLoggingOut && (
        <View style={styles.globalLoaderOverlay}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      )}

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: Math.max(insets.top, 16),
          paddingBottom: Math.max(insets.bottom, 16) + 82,
        }}
      >
        <View style={styles.navBar} className="px-6">
          <Text style={[styles.serifTitle, { fontFamily: serifFont }]}>{t('nav.profile')}</Text>
          <TouchableOpacity 
            onPress={() => { lightTap(); setShowSettings(true); }}
            style={styles.settingsIconBtn}
            activeOpacity={0.7}
          >
            <Settings size={20} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        </View>

        <ProfileHeader 
          user={user}
          friendsCount={friendsCount}
          tempAvatarUri={tempAvatarUri}
          uploadingAvatar={uploadingAvatar}
          onPickAvatar={handlePickAvatar}
          isPro={isPro}
        />

        {uploadingAvatar && (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="small" color="#fff" />
            <Text className="text-white/60 text-xs ml-2">{locale === 'tr' ? 'Fotoğraf güncelleniyor...' : 'Updating photo...'}</Text>
          </View>
        )}

        <ProfileStats 
          totalVlogs={totalVlogs}
          totalLikes={formatCount(totalLikes)}
          totalComments={formatCount(totalComments)}
          totalPhotos={formatCount(totalPhotos)}
        />

        <View className="mt-8">
          <View className="px-6 flex-row items-center justify-between mb-4">
            <Text weight="bold" className="text-white text-base tracking-tight">{locale === 'tr' ? 'Vloglarım' : 'My Vlogs'}</Text>
            <TouchableOpacity onPress={() => { lightTap(); router.push('/(app)/streaks'); }} activeOpacity={0.75}>
              <Text className="text-white/60 text-xs font-medium">{locale === 'tr' ? 'Tümünü Gör' : 'See All'}</Text>
            </TouchableOpacity>
          </View>
          
          <EditorialVlogsGrid 
            clips={typedClips} 
            onPlayClip={(clip) => {
              selectionTick();
              const idx = typedClips.findIndex(c => c.id === clip.id);
              setActivePlaybackDayIndex(0);
              setActivePlaybackClipIndex(idx !== -1 ? idx : 0);
            }} 
            onDeleteClip={handleVlogMenuPress}
          />

          <View className="mt-8 mb-6">
            <View className="px-6 flex-row items-center justify-between mb-4">
              <Text weight="bold" className="text-white text-base tracking-tight">{locale === 'tr' ? 'Kazanılan Başarılar' : 'Achievements'}</Text>
              <TouchableOpacity onPress={() => { lightTap(); setShowAchievementsModal(true); }} activeOpacity={0.75}>
                <Text className="text-white/60 text-xs font-medium">{locale === 'tr' ? 'Tümünü Gör' : 'See All'}</Text>
              </TouchableOpacity>
            </View>
            
            {unlockedAchievements.length > 0 ? (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 10 }}
              >
                {unlockedAchievements.map((ach, idx) => {
                  const iconAsset = ACHIEVEMENT_ICONS[ach.image.src] || ACHIEVEMENT_ICONS['trophy'];
                  return (
                    <Animated.View
                      key={ach.id}
                      entering={FadeInUp.delay(150 + (idx * 50)).duration(400)}
                    >
                      <TouchableOpacity 
                        onPress={() => { lightTap(); setShowAchievementsModal(true); }}
                        activeOpacity={0.8}
                        style={styles.achievementCard}
                      >
                        <View style={styles.achIconWrap}>
                          <Image source={iconAsset} style={styles.badgeIconImage} resizeMode="contain" />
                        </View>
                        <Text weight="bold" className="text-white text-[11px] text-center mt-3 leading-tight" numberOfLines={2}>{ach.title}</Text>
                        <Text className="text-white/40 text-[9px] text-center mt-1 uppercase tracking-wider" numberOfLines={1}>{ach.subtitle}</Text>
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={styles.emptyContainerCard} className="mx-6 p-5 rounded-2xl bg-[#161617]/50 border border-white/5">
                <Text className="text-white/45 text-xs text-center leading-relaxed">{locale === 'tr' ? 'Henüz kazanılan başarı yok. Günlük vlog görevlerini tamamlayarak başarıların kilidini açabilirsiniz!' : 'No achievements yet. Complete daily vlog tasks to unlock them!'}</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={activePlaybackDayIndex !== null}
        animationType="none"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={() => setActivePlaybackDayIndex(null)}
      >
        {activePlaybackDayIndex !== null && (
          <StreakClipPlaybackOverlay 
            vloggedDays={profileVloggedDays}
            dayIndex={activePlaybackDayIndex}
            initialClipIndex={activePlaybackClipIndex}
            onClose={() => setActivePlaybackDayIndex(null)} 
          />
        )}
      </Modal>

      <SettingsOverlay 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)}
        onTriggerLogoutSheet={handleLogout}
      />

      <Modal
        visible={showAchievementsModal}
        animationType="slide"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={() => setShowAchievementsModal(false)}
      >
        <View style={styles.achievementsModalBackdrop}>
          <GlassView preset="deep" style={[styles.achievementsModalCard, { maxHeight: SCREEN_WIDTH * 1.5 }]}>
            <View style={styles.achievementsModalHeader}>
              <Award size={18} color={clips.length > 0 ? "#e07c30" : "rgba(255,255,255,0.4)"} />
              <Text weight="bold" className="text-white text-base ml-2">{locale === 'tr' ? 'Başarılar ve Kilometre Taşları' : 'Achievements & Milestones'}</Text>
              <TouchableOpacity onPress={() => setShowAchievementsModal(false)} style={styles.modalCloseCircle} activeOpacity={0.75}>
                <X size={14} color="rgba(255,255,255,0.6)" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.achievementsScrollContent}>
              {Object.keys(localizedRegistry).map((key) => {
                const config = localizedRegistry[key];
                const isUnlocked = unlockedIds.includes(key);
                const iconAsset = ACHIEVEMENT_ICONS[config.image.src] || ACHIEVEMENT_ICONS['trophy'];

                return (
                  <View key={key} style={[styles.achievementListItem, !isUnlocked && { opacity: 0.35 }]}>
                    <View style={styles.listItemIconContainer}>
                      <Image source={iconAsset} style={styles.listItemIcon} resizeMode="contain" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text weight="bold" className="text-white text-xs">{config.title}</Text>
                      <Text className="text-white/40 text-[9.5px] mt-0.5 uppercase tracking-wide font-medium">{config.subtitle}</Text>
                      <Text className="text-white/60 text-[11px] mt-1.5 leading-relaxed">{config.description}</Text>
                    </View>
                    {isUnlocked ? (
                      <View style={styles.rowCheckBadge}>
                        <Check size={10} color="#000" strokeWidth={3} />
                      </View>
                    ) : (
                      <View style={styles.rowLockBadge}>
                        <Lock size={10} color="rgba(255,255,255,0.4)" />
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </GlassView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0C',
  },
  globalLoaderOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 48,
  },
  serifTitle: {
    fontSize: 28,
    color: '#FAF9F6',
    letterSpacing: -0.5,
  },
  settingsIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  achievementCard: {
    width: 100,
    height: 125,
    backgroundColor: '#161618',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  achIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  badgeIconImage: {
    width: 26,
    height: 26,
  },
  emptyContainerCard: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  achievementsModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  achievementsModalCard: {
    width: '100%',
    backgroundColor: '#0B0B0C',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  achievementsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  modalCloseCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginLeft: 'auto',
  },
  achievementsScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 60,
  },
  achievementListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(255,255,255,0.01)',
    marginBottom: 12,
  },
  listItemIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  listItemIcon: {
    width: '100%',
    height: '100%',
  },
  rowCheckBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#e07c30',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  rowLockBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  }
});
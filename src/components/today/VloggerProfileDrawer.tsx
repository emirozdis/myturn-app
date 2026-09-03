// ./src/components/today/VloggerProfileDrawer.tsx
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { 
  View, 
  StyleSheet, 
  Dimensions, 
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  Platform,
  ActivityIndicator
} from 'react-native';
import { 
  Flame, 
  Award, 
  Crown, 
  Zap, 
  UserCheck, 
  MapPin, 
  Calendar,
  X
} from 'lucide-react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  interpolate, 
  runOnJS 
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView } from '../ui/GlassView';
import { Text } from '../ui/Text';
import { Avatar } from '../ui/Avatar';
import { ACCENT } from '../../lib/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const serifFont = Platform.OS === 'ios' ? 'Georgia' : 'serif';
const SPRING_CONFIG = { damping: 24, stiffness: 150, mass: 0.8 };

interface VloggerProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: any;
  poking: boolean;
  pokeCooldown: number;
  onPoke: () => void;
}

export function VloggerProfileDrawer({
  isOpen,
  onClose,
  assignment,
  poking,
  pokeCooldown,
  onPoke,
}: VloggerProfileDrawerProps) {
  const [visible, setVisible] = useState(isOpen);
  
  const profileDrawerProgress = useSharedValue(0);
  const profileDragY = useSharedValue(0);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      profileDrawerProgress.value = withSpring(1, SPRING_CONFIG);
      profileDragY.value = 0;
    } else {
      profileDrawerProgress.value = withSpring(0, SPRING_CONFIG, (finished) => {
        if (finished) {
          runOnJS(setVisible)(false);
        }
      });
    }
  }, [isOpen]);

  const profilePanGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) {
        profileDragY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY > 150 || e.velocityY > 450) {
        runOnJS(onClose)();
      } else {
        profileDragY.value = withSpring(0, { damping: 22, stiffness: 150 });
      }
    });

  const profileDrawerStyle = useAnimatedStyle(() => {
    const baseTranslateY = interpolate(profileDrawerProgress.value, [0, 1], [SCREEN_HEIGHT, 0]);
    return {
      transform: [{ translateY: baseTranslateY + profileDragY.value }],
    };
  });

  const animatedBackdropStyle = useAnimatedStyle(() => {
    const opacity = interpolate(profileDrawerProgress.value, [0, 1], [0, 0.65]);
    return {
      opacity,
    };
  });

  const user = assignment?.user;
  const isVloggerPro = !!user?.isPro; // Check if the vlogger has Pro entitlements
  const memberInfo = assignment?.group?.members?.find((m: any) => m.userId === user?.id);
  const streak = memberInfo?.streak || 0;
  const xp = memberInfo?.xp || 0;
  const bio = user?.bio || "Vlogging our days, making our memories ✨";
  const joinedYear = user?.createdAt ? new Date(user.createdAt).getFullYear() : "—";

  const getVibeArchetype = (val: number): string => {
    if (val <= 100) return "Ghost Watcher";
    if (val <= 400) return "Vibe Checker";
    if (val <= 1000) return "Reality Star";
    if (val <= 2500) return "Chief Vibe";
    return "A-Lister";
  };

  const archetype = getVibeArchetype(xp);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
      animationType="none"
    >
      <View style={[StyleSheet.absoluteFill, styles.profileDrawerRoot]}>
        {/* Backdrop overlay */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.profileBackdrop, animatedBackdropStyle]} />
        </TouchableWithoutFeedback>

        {/* Drawer container body */}
        <GestureDetector gesture={profilePanGesture}>
          <Animated.View style={[styles.profileDrawerContainer, profileDrawerStyle]}>
            {/* Grabber Handle */}
            <View style={styles.grabberContainer}>
              <View style={styles.grabber} />
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.75}>
              <X size={14} color="rgba(255,255,255,0.6)" strokeWidth={2.5} />
            </TouchableOpacity>

            <View style={styles.profileContent}>
              
              {/* Left-Aligned Identity Row matching ProfileHeader */}
              <View style={styles.mainInfoRow}>
                <View style={styles.profileAvatarContainer}>
                  {isVloggerPro ? (
                    <LinearGradient
                      colors={['#e07c30', '#ff3b30', '#facc15']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.proAvatarRing}
                    >
                      <View style={styles.avatarInnerContainer}>
                        <Avatar src={user?.image} name={user?.name} size={68} />
                      </View>
                    </LinearGradient>
                  ) : (
                    <Avatar src={user?.image} name={user?.name} size={74} />
                  )}
                </View>
                
                <View style={styles.identityDetails}>
                  <View style={styles.nameRow}>
                    <Text weight="bold" style={[styles.nameText, { fontFamily: serifFont }]}>
                      {user?.name || "Vlogger"}
                    </Text>
                    {isVloggerPro && (
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
                  <Text className="text-white/50 text-xs mt-0.5 mb-2">
                    @{user?.handle || "user"}
                  </Text>

                  <View style={styles.minimalBadge}>
                    <Crown size={9} color="rgba(255,255,255,0.6)" fill="rgba(255,255,255,0.2)" />
                    <Text weight="bold" className="text-white/70 text-[8px] uppercase tracking-widest pl-1.5 leading-none">
                      {archetype.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Bio Block */}
              <Text className="text-white/80 text-xs leading-relaxed mt-5">
                {bio}
              </Text>

              {/* Spaced Metadata row */}
              <View style={styles.metaRow}>
                <View className="flex-row items-center gap-1.5">
                  <MapPin size={11} color="rgba(255,255,255,0.4)" />
                  <Text className="text-white/50 text-[10.5px]">{user?.location || "—"}</Text>
                </View>
                <Text className="text-white/20 text-[10px] mx-2">•</Text>
                <View className="flex-row items-center gap-1.5">
                  <Calendar size={11} color="rgba(255,255,255,0.4)" />
                  <Text className="text-white/50 text-[10.5px]">Katıldı: {joinedYear}</Text>
                </View>
              </View>

              {/* Cohesive Stats Card matching ProfileStats */}
              <View style={styles.statsCard}>
                <View style={styles.statColumn}>
                  <Flame size={15} color="#e07c30" />
                  <Text weight="bold" style={styles.statNumber} className="mt-1">{streak} Gün</Text>
                  <Text style={styles.statLabel}>Aktif Seri</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.statColumn}>
                  <Award size={15} color="#ffb300" />
                  <Text weight="bold" style={styles.statNumber} className="mt-1">{xp} XP</Text>
                  <Text style={styles.statLabel}>Deneyim</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.statColumn}>
                  <Crown size={15} color="#30D158" />
                  <Text weight="bold" style={styles.statNumber} className="mt-1" numberOfLines={1} adjustsFontSizeToFit>{archetype}</Text>
                  <Text style={styles.statLabel}>Seviye</Text>
                </View>
              </View>

              {/* High Contrast Interaction Buttons */}
              <View style={styles.profileActionsContainer}>
                <TouchableOpacity
                  onPress={onPoke}
                  disabled={poking || pokeCooldown > 0}
                  style={[
                    styles.profileActionBtn, 
                    (poking || pokeCooldown > 0) && { opacity: 0.5 }
                  ]}
                  activeOpacity={0.8}
                >
                  <Zap size={13} color="#000" fill="#000" />
                  <Text weight="bold" className="text-black text-xs">
                    {pokeCooldown > 0 
                      ? `Bekleme Süresi (${Math.floor(pokeCooldown / 60)}dk)` 
                      : poking 
                      ? "Dürtülüyor..." 
                      : "Vlogger'ı Dürt"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onClose}
                  style={styles.profileActionSecondaryBtn}
                  activeOpacity={0.8}
                >
                  <UserCheck size={13} color="#fff" />
                  <Text weight="bold" className="text-white text-xs">Takip Ediliyor</Text>
                </TouchableOpacity>
              </View>

            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  profileDrawerRoot: {
    justifyContent: 'flex-end',
  },
  profileBackdrop: {
    backgroundColor: '#000',
  },
  profileDrawerContainer: {
    width: '100%',
    height: 490,
    backgroundColor: '#0B0B0C',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderBottomWidth: 0,
    overflow: 'hidden',
    paddingBottom: 32,
  },
  grabberContainer: {
    width: '100%',
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  profileContent: {
    flex: 1,
    paddingHorizontal: 24,
  },
  mainInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 12,
  },
  profileAvatarContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proAvatarRing: {
    width: 74,
    height: 74,
    borderRadius: 37,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInnerContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#0B0B0C',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  identityDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  nameText: {
    fontSize: 22,
    color: '#ffffff',
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  proBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontFamily: 'Satoshi-Bold',
  },
  minimalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    flexWrap: 'wrap',
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161618',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginTop: 20,
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  profileActionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  profileActionBtn: {
    flex: 1.2,
    height: 48,
    backgroundColor: ACCENT,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderBottomWidth: 3,
    borderBottomColor: '#9c5218',
  },
  profileActionSecondaryBtn: {
    flex: 1,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
});

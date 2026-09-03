// ./src/components/social/AddFriendSheet.tsx
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { Search, UserPlus } from 'lucide-react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  interpolate,
  interpolateColor
} from 'react-native-reanimated';

import { BottomSheet } from '../ui/BottomSheet';
import { GlassView } from '../ui/GlassView';
import { Text } from '../ui/Text';
import { Avatar } from '../ui/Avatar';

import { ACCENT } from '../../lib/theme';
import { notifySuccess, lightTap } from '../../lib/haptics';
import { ActionProgress } from '../ui/ActionProgress';

interface AddFriendSheetProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: any[];
  onSendRequest: (userIdOrHandle: string, name: string) => Promise<boolean>;
  openUserProfile: (id: string) => void;
}

export function AddFriendSheet({ isOpen, onClose, suggestions, onSendRequest, openUserProfile }: AddFriendSheetProps) {
  const [username, setUsername] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendingSuggestionId, setSendingSuggestionId] = useState<string | null>(null);

  // Morphing Spring Controls
  const isActive = username.trim().length > 0;
  const btnProgress = useSharedValue(0);

  useEffect(() => {
    btnProgress.value = withSpring(isActive ? 1 : 0, {
      damping: 15,
      stiffness: 140,
      mass: 0.7
    });
  }, [isActive]);

  // Morph Container (Concentric Squircle to Capsule-Squircle)
  const animatedContainerStyle = useAnimatedStyle(() => {
    const widthVal = interpolate(btnProgress.value, [0, 1], [36, 88]);
    const backgroundColorVal = interpolateColor(
      btnProgress.value,
      [0, 1],
      ['rgba(255, 255, 255, 0.08)', '#ffffff']
    );

    return {
      width: widthVal,
      backgroundColor: backgroundColorVal,
      borderRadius: 16, // Concentric nesting: outer (22) - padding (6) = perfect inner curve (16)
      height: 36,
      overflow: 'hidden',
    };
  });

  // Inactive Icon (Fades out on activate)
  const animatedInactiveIconStyle = useAnimatedStyle(() => {
    const opacityVal = interpolate(btnProgress.value, [0, 0.3], [1, 0]);
    const scaleVal = interpolate(btnProgress.value, [0, 1], [1, 0.6]);
    return {
      opacity: opacityVal,
      transform: [{ scale: scaleVal }],
      position: 'absolute',
    };
  });

  // Active Text + Icon Group (Icon placed beautifully on the right)
  const animatedActiveRowStyle = useAnimatedStyle(() => {
    const opacityVal = interpolate(btnProgress.value, [0.4, 1], [0, 1]);
    const scaleVal = interpolate(btnProgress.value, [0, 1], [0.75, 1]);
    return {
      opacity: opacityVal,
      transform: [{ scale: scaleVal }],
      position: 'absolute',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      width: 88, // Confined strictly to container bounds
    };
  });

  const handleSend = async () => {
    if (!username.trim()) return;
    setIsSending(true);
    // Strip '@' if the user typed it, to safely map to database search params
    const rawHandle = username.trim().replace(/^@/, '');
    const success = await onSendRequest(rawHandle, `@${rawHandle}`);
    setIsSending(false);
    
    // Smoothly close the sheet and reset input state ONLY upon successful transmission
    if (success) {
      notifySuccess();
      setUsername("");
      onClose();
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} heightPercent={0.7}>
      <View style={styles.sheetContent}>
        <Text weight="bold" className="text-white text-xl mb-1">Arkadaş Ekle</Text>
        <Text className="text-white/50 text-xs mb-6">Kişileri keşfet ve çevreni genişlet.</Text>

        <GlassView preset="deep" style={styles.searchContainer}>
          <Search size={16} color="rgba(255,255,255,0.5)" style={styles.searchIcon} />
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="Kullanıcı adı veya isim..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            style={styles.searchInput}
            autoCapitalize="none"
          />
          
          {/* Morphing Concentric Squircle Button */}
          <Animated.View style={animatedContainerStyle}>
            <TouchableOpacity 
              onPress={handleSend} 
              disabled={isSending || !isActive} 
              style={styles.fullTouchArea}
              activeOpacity={0.8}
            >
              {isSending ? (
                <ActionProgress label="" compact color={isActive ? "#000" : "#fff"} />
              ) : (
                <View style={styles.contentWrap}>
                  {/* State 1: Disabled Icon Only */}
                  <Animated.View style={animatedInactiveIconStyle}>
                    <UserPlus size={14} color="rgba(255, 255, 255, 0.55)" />
                  </Animated.View>

                  {/* State 2: Active Text + Icon (Icon mapped to the right) */}
                  <Animated.View style={animatedActiveRowStyle}>
                    <Text weight="bold" style={styles.sendText}>Gönder</Text>
                    <UserPlus size={13} color="#000000" style={{ marginLeft: 6 }} />
                  </Animated.View>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>
        </GlassView>

        <Text weight="bold" className="text-white/40 text-[10px] uppercase tracking-widest mb-3 pl-1 mt-6">Önerilen Bağlantılar</Text>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <View className="flex-col gap-3">
            {suggestions.map((user) => (
              <TouchableOpacity key={user.id} activeOpacity={0.8} onPress={() => openUserProfile(user.id)}>
                <GlassView preset="liquid" style={styles.premiumCardRow}>
                  <View className="flex-row items-center gap-3">
                    <Avatar src={user.image} name={user.name} size={42} />
                    <View className="flex-col justify-center">
                      <Text weight="bold" className="text-white text-[14px]">{user.name}</Text>
                      <Text className="text-white/40 text-[10px] mt-0.5">{user.mutual} ortak grupta</Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    onPress={async () => {
                      if (sendingSuggestionId) return;
                      lightTap();
                      setSendingSuggestionId(user.id);
                      try { await onSendRequest(user.id, user.name); } finally { setSendingSuggestionId(null); }
                    }}
                    disabled={user.requested || !!sendingSuggestionId}
                    style={[styles.smallActionBtn, user.requested && styles.smallActionBtnDisabled]}
                    activeOpacity={0.8}
                  >
                    {sendingSuggestionId === user.id ? <ActionProgress label="" compact /> : (
                      <Text weight="bold" style={user.requested ? styles.smallBtnTextDisabled : styles.smallBtnText}>
                        {user.requested ? "İletildi" : "Ekle"}
                      </Text>
                    )}
                  </TouchableOpacity>
                </GlassView>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetContent: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingLeft: 16,
    paddingRight: 6, // Concentric alignment padding
    height: 48,
    width: '100%',
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, color: '#fff', fontSize: 14, height: '100%' },
  fullTouchArea: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentWrap: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  sendText: {
    color: '#000000',
    fontSize: 11,
    textAlign: 'center',
  },
  premiumCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
  },
  smallActionBtn: {
    backgroundColor: 'rgba(224,124,48,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(224,124,48,0.3)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  smallActionBtnDisabled: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  smallBtnText: { color: ACCENT, fontSize: 11 },
  smallBtnTextDisabled: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
});

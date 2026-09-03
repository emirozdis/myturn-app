// ./src/components/social/FriendsTab.tsx
import React, { useState } from 'react';
import { View, TouchableOpacity, FlatList, StyleSheet, Image, Dimensions, Platform } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { X, Check, UserPlus } from 'lucide-react-native';
import { Avatar } from '../ui/Avatar';
import { GlassView } from '../ui/GlassView';
import { Text } from '../ui/Text';
import { ActionProgress } from '../ui/ActionProgress';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const serifFont = Platform.OS === 'ios' ? 'Georgia' : 'serif';

interface FriendsTabProps {
  friends: any[];
  pendingRequests: any[];
  sentRequests: any[];
  onAcceptRequest: (id: string, name: string) => Promise<unknown>;
  onDeclineRequest: (id: string, name: string) => Promise<unknown>;
  onCancelRequest: (id: string, name: string) => Promise<unknown>;
  openUserProfile: (id: string) => void;
  onAddFriendPress?: () => void;
  isSearchActive?: boolean;
}

export function FriendsTab({
  friends,
  pendingRequests,
  sentRequests,
  onAcceptRequest,
  onDeclineRequest,
  onCancelRequest,
  openUserProfile,
  onAddFriendPress,
  isSearchActive
}: FriendsTabProps) {
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const runAction = async (key: string, action: () => Promise<unknown>) => {
    if (pendingAction) return;
    setPendingAction(key);
    try { await action(); } finally { setPendingAction(null); }
  };

  const isFullyEmpty = friends.length === 0 && pendingRequests.length === 0 && sentRequests.length === 0 && !isSearchActive;

  if (isFullyEmpty) {
    return (
      <View style={styles.emptyStateWrapper}>
        <View style={styles.emptyStateContent}>
          <Image 
            source={require('../../../assets/images/empty_states/social.png')} 
            style={styles.emptyStateImage}
          />
          <Text style={[styles.emptyStateTitle, { fontFamily: serifFont }]}>
            Henüz bağlantın{'\n'}bulunmuyor.
          </Text>
          <Text style={styles.emptyStateDesc}>
            Arkadaşlarını ekleyerek ağını genişlet{'\n'}ve onların günlerine ortak ol.
          </Text>
          <TouchableOpacity 
            onPress={onAddFriendPress}
            activeOpacity={0.85}
            style={styles.emptyStatePrimaryBtn}
          >
            <Text weight="bold" style={styles.emptyStatePrimaryBtnText}>Arkadaş Ekle</Text>
            <UserPlus size={16} color="#000" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="mt-8">
      {/* Friends Horizontal Scroll */}
      <Animated.View entering={FadeInUp.delay(100).duration(400)}>
        <View className="flex-row items-center justify-between mb-4 px-6">
          <Text weight="bold" className="text-white text-base tracking-tight">Bağlantılarım ({friends.length})</Text>
        </View>
        {friends.length > 0 ? (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={friends}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 24 }}
            renderItem={({ item }) => (
              <TouchableOpacity 
                onPress={() => openUserProfile(item.id)}
                style={styles.friendSliderItem} 
                className="items-center" 
                activeOpacity={0.8}
              >
                <View style={styles.friendAvatarWrapper}>
                  {item.hasStory && <View style={styles.storyActiveRing} />}
                  <Avatar src={item.image} name={item.name} size={60} ring={item.hasStory} />
                </View>
                <Text weight="bold" className="text-white text-[11px] truncate text-center w-full mt-1" numberOfLines={1}>{item.name}</Text>
                <Text className="text-white/40 text-[9px] mt-0.5 font-medium truncate text-center w-full" numberOfLines={1}>
                  {item.handle ? `@${item.handle}` : "Arkadaş"}
                </Text>
              </TouchableOpacity>
            )}
          />
        ) : (
          <View className="px-6 py-2">
            <Text className="text-white/40 text-xs">Bağlantı bulunamadı.</Text>
          </View>
        )}
      </Animated.View>

      {/* Friend Requests Stack (Incoming & Outgoing) */}
      {(pendingRequests.length > 0 || sentRequests.length > 0) && (
        <Animated.View entering={FadeInUp.delay(200).duration(400)} className="px-6 mt-8">
          
          {/* Incoming Requests */}
          {pendingRequests.length > 0 && (
            <View className="mb-6">
              <Text weight="bold" className="text-white text-sm mb-3">Gelen İstekler</Text>
              <View className="flex-col gap-3">
                {pendingRequests.map((req) => (
                  <TouchableOpacity key={req.id} activeOpacity={0.8} onPress={() => openUserProfile(req.user.id)}>
                    <GlassView preset="liquid" style={styles.premiumCardRow}>
                      <View className="flex-row items-center gap-3">
                        <Avatar src={req.user.image} name={req.user.name} size={40} />
                        <View className="flex-col justify-center">
                          <Text weight="bold" className="text-white text-[13px]">{req.user.name}</Text>
                          <Text className="text-white/40 text-[10px] mt-0.5">@{req.user.handle}</Text>
                        </View>
                      </View>
                      <View className="flex-row gap-2">
                        <TouchableOpacity disabled={!!pendingAction} onPress={() => runAction(`decline:${req.id}`, () => onDeclineRequest(req.id, req.user.name))} style={styles.actionIconBtnDanger}>
                          {pendingAction === `decline:${req.id}` ? <ActionProgress label="" compact color="#f87171" /> : <X size={14} color="#f87171" />}
                        </TouchableOpacity>
                        <TouchableOpacity disabled={!!pendingAction} onPress={() => runAction(`accept:${req.id}`, () => onAcceptRequest(req.id, req.user.name))} style={styles.actionIconBtnSuccess}>
                          {pendingAction === `accept:${req.id}` ? <ActionProgress label="" compact color="#000" /> : <Check size={14} color="#000" strokeWidth={3} />}
                        </TouchableOpacity>
                      </View>
                    </GlassView>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Outgoing Requests */}
          {sentRequests.length > 0 && (
            <View>
              <Text weight="bold" className="text-white text-sm mb-3">Gönderilen İstekler</Text>
              <View className="flex-col gap-3">
                {sentRequests.map((req) => (
                  <TouchableOpacity key={req.id} activeOpacity={0.8} onPress={() => openUserProfile(req.user.id)}>
                    <GlassView preset="liquid" style={styles.premiumCardRow}>
                      <View className="flex-row items-center gap-3">
                        <Avatar src={req.user.image} name={req.user.name} size={40} />
                        <View className="flex-col justify-center">
                          <Text weight="bold" className="text-white text-[13px]">{req.user.name}</Text>
                          <Text className="text-white/40 text-[10px] mt-0.5">@{req.user.handle}</Text>
                        </View>
                      </View>
                      <TouchableOpacity disabled={!!pendingAction} onPress={() => runAction(`cancel:${req.id}`, () => onCancelRequest(req.id, req.user.name))} style={styles.secondaryBtnSmall}>
                        {pendingAction === `cancel:${req.id}` ? <ActionProgress label="İptal ediliyor" compact color="#fff" /> : <Text weight="bold" className="text-white/70 text-[10px]">İptal Et</Text>}
                      </TouchableOpacity>
                    </GlassView>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyStateWrapper: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyStateContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  emptyStateImage: {
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_WIDTH * 0.8,
    resizeMode: 'contain',
  },
  emptyStateTitle: {
    fontSize: 28,
    color: '#FAF9F6',
    textAlign: 'center',
    marginBottom: 4,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  emptyStateDesc: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  emptyStatePrimaryBtn: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 220,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  emptyStatePrimaryBtnText: {
    color: '#000',
    fontSize: 15,
    marginRight: 8,
  },
  friendSliderItem: { width: 72, marginRight: 16 },
  friendAvatarWrapper: { position: 'relative', width: 68, height: 68, alignItems: 'center', justifyContent: "center", marginBottom: 4 },
  storyActiveRing: { position: 'absolute', width: 66, height: 66, borderRadius: 33, borderWidth: 2, borderColor: '#e07c30', opacity: 0.9 },
  premiumCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
  },
  secondaryBtnSmall: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconBtnSuccess: {
    backgroundColor: '#e07c30',
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconBtnDanger: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

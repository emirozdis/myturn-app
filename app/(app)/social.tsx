"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  Clipboard,
  Alert,
  TouchableOpacity,
  Platform,
  Modal
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Search, UserPlus, Check } from "lucide-react-native";
import Animated, {
  FadeInUp,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

import { useGroupStore } from "../../src/store/useGroupStore";
import { useProfileStore } from "../../src/store/useProfileStore";
import { ACCENT } from "../../src/lib/theme";
import { useSocialStore } from "../../src/store/useSocialStore";
import { getDeviceUtcOffset } from "../../src/lib/businessTime";
import { apiClient, getApiErrorMessage } from "../../src/lib/apiClient";
import { storage } from "../../src/lib/storage";
import { Text } from "../../src/components/ui/Text";
import { GlassView } from "../../src/components/ui/GlassView";
import { lightTap, selectionTick, notifySuccess, notifyError, mediumTap } from "../../src/lib/haptics";
import { useTranslation } from "../../src/lib/i18n";
import { clearPendingGroupInvite, getPendingGroupInvite } from "../../src/lib/pendingGroupInvite";

// Component splits
import { FriendsTab } from "../../src/components/social/FriendsTab";
import { GroupsTab } from "../../src/components/social/GroupsTab";
import { AddFriendSheet } from "../../src/components/social/AddFriendSheet";
import { CreateGroupSheet } from "../../src/components/social/CreateGroupSheet";
import { JoinGroupSheet } from "../../src/components/social/JoinGroupSheet";
import { GroupDetailsSheet } from "../../src/components/social/GroupDetailsSheet";
import { UserProfileSheet } from "../../src/components/social/UserProfileSheet";
import { StreakClipPlaybackOverlay } from "../../src/components/streaks/StreakClipPlaybackOverlay";
import type { ProfileClip } from "../../src/store/useProfileStore";
import { JoinOrCreateGroupWall } from '../../src/components/group/JoinOrCreateGroupWall';

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const TAB_BAR_WIDTH = Math.min(SCREEN_WIDTH - 48, 360);
const TABS = ["friends", "groups"] as const;
const TAB_WIDTH = (TAB_BAR_WIDTH - 8) / TABS.length;

export default function SocialScreen() {
  const groupStore = useGroupStore();
  const insets = useSafeAreaInsets();
  const store = useSocialStore();
  const { t } = useTranslation();
  const notificationParams = useLocalSearchParams<{ focus?: string; userId?: string; itemId?: string }>();
  const handledNotificationRef = React.useRef<string | null>(null);

  const [activeTab, setActiveTab] = useState<typeof TABS[number]>("friends");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Bottom Sheet States
  const [createGroupVisible, setCreateGroupVisible] = useState(false);
  const [joinGroupVisible, setJoinGroupVisible] = useState(false);
  const [addFriendVisible, setAddFriendVisible] = useState(false);
  const [selectedGroupDetails, setSelectedGroupDetails] = useState<any | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Forms
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupImage, setNewGroupImage] = useState<string | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [generatedInviteCode, setGeneratedInviteCode] = useState<string | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [leavingGroupId, setLeavingGroupId] = useState<string | null>(null);
  const [isBoosting, setIsBoosting] = useState(false);

  // User Profile Sheet State
  const [profileData, setProfileData] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [activeProfileClipIndex, setActiveProfileClipIndex] = useState<number | null>(null);
  const profileRequestIdRef = React.useRef(0);
  const profileSelectionRef = React.useRef<{ uid: string; groupId?: string } | null>(null);
  const pendingInviteCode = getPendingGroupInvite();

  useEffect(() => {
    store.fetchSocialData();
  }, []);

  useEffect(() => {
    if (!pendingInviteCode || !groupStore.hasLoaded || groupStore.groups.length === 0) return;
    setActiveTab('groups');
    setJoinCodeInput(pendingInviteCode);
    setJoinGroupVisible(true);
    clearPendingGroupInvite();
  }, [groupStore.groups.length, groupStore.hasLoaded, pendingInviteCode]);

  const showSearchBar = useMemo(() => {
    if (activeTab === "friends") {
      return (
        store.friends.length > 0 ||
        store.pendingRequests.length > 0 ||
        store.sentRequests.length > 0 ||
        searchQuery.trim().length > 0
      );
    } else {
      return store.groups.length > 0 || searchQuery.trim().length > 0;
    }
  }, [
    activeTab,
    store.friends,
    store.pendingRequests,
    store.sentRequests,
    store.groups,
    searchQuery,
  ]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const activeIndex = TABS.indexOf(activeTab);
  const indicatorTranslateX = useSharedValue(activeIndex * TAB_WIDTH);

  useEffect(() => {
    indicatorTranslateX.value = withSpring(activeIndex * TAB_WIDTH, { stiffness: 380, damping: 24, mass: 0.8 });
  }, [activeIndex]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorTranslateX.value }],
  }));

  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return store.friends;
    return store.friends.filter(
      f => f.name.toLowerCase().includes(searchQuery.toLowerCase()) || f.handle.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [store.friends, searchQuery]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return store.groups;
    return store.groups.filter(
      g => g.name.toLowerCase().includes(searchQuery.toLowerCase()) || g.inviteCode.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [store.groups, searchQuery]);

  // ─── ACTIONS ───

  const handleAcceptRequest = async (reqId: string, name: string) => {
    const res = await store.respondFriendRequest(reqId, true);
    if (res.success) {
      notifySuccess();
      triggerToast(`${name} eklendi! 🎉`);
      return true;
    } else {
      notifyError();
      Alert.alert("Hata", res.error || "İşlem başarısız.");
      return false;
    }
  };

  const handleDeclineRequest = async (reqId: string, name: string) => {
    lightTap();
    const res = await store.respondFriendRequest(reqId, false);
    if (res.success) {
      triggerToast(`${name} isteği reddedildi.`);
      return true;
    }
    return false;
  };

  const handleCancelRequest = async (reqId: string, name: string) => {
    lightTap();
    const res = await store.cancelFriendRequest(reqId);
    if (res.success) {
      triggerToast(`${name} isteği iptal edildi.`);
      return true;
    }
    return false;
  };

  const handleSendFriendRequest = async (userIdOrHandle: string, name: string): Promise<boolean> => {
    const res = await store.sendFriendRequest(userIdOrHandle);
    if (res.success) {
      triggerToast(`${name} kullanıcısına istek gönderildi!`);
      return true;
    } else {
      Alert.alert("İstek Gönderilemedi", res.error || "Kullanıcı bulunamadı.");
      return false;
    }
  };

  const handleCopyCode = (code: string) => {
    lightTap();
    Clipboard.setString(code);
    triggerToast(`Kod kopyalandı: ${code}`);
  };

  const handleJoinWithCode = async (codeOverride?: string) => {
    const inviteCode = (codeOverride || joinCodeInput).trim();
    if (!inviteCode) return;
    lightTap();
    setIsJoining(true);
    const res = await store.joinGroup(inviteCode);
    setIsJoining(false);

    if (res.success) {
      notifySuccess();
      triggerToast(`Gruba başarıyla katıldınız!`);
      setJoinCodeInput("");
      setJoinGroupVisible(false);
      await groupStore.fetchGroups();
    } else {
      notifyError();
      Alert.alert("Hata", res.error || "Grup bulunamadı veya katılım başarısız.");
    }
  };

  const handleCreateGroupAction = async () => {
    if (!newGroupName.trim()) return;
    lightTap();
    setIsCreatingGroup(true);
    const inviteCode = await store.createGroup(newGroupName, getDeviceUtcOffset(), newGroupImage);
    setIsCreatingGroup(false);

    if (inviteCode) {
      notifySuccess();
      setGeneratedInviteCode(inviteCode);
      await groupStore.fetchGroups();
    } else {
      notifyError();
      Alert.alert("Hata", "Grup oluşturulamadı.");
    }
  };

  const handleLeaveGroup = async (gId: string, name: string) => {
    mediumTap();
    setLeavingGroupId(gId);
    const res = await store.leaveGroup(gId);
    setLeavingGroupId(null);

    if (res.success) {
      notifySuccess();
      setSelectedGroupDetails(null);
      triggerToast(`"${name}" grubundan ayrıldınız.`);
      await groupStore.fetchGroups();
    } else {
      notifyError();
      Alert.alert("Hata", res.error || "Gruptan ayrılamadınız.");
    }
  };

  const handleBoostGroup = async (gId: string, action: 'add' | 'remove') => {
    if (isBoosting) return;
    setIsBoosting(true);
    lightTap();
    const res = await groupStore.toggleGroupBoost(gId, action);
    setIsBoosting(false);

    if (res.success) {
      notifySuccess();
      setSelectedGroupDetails((prev: any) => {
        if (!prev) return null;
        const currentUserId = storage.getString('auth_user_id') || "";
        const activeUser = useProfileStore.getState().user;
        
        let updatedBoosters = prev.boosters ? [...prev.boosters] : [];
        if (action === 'add') {
          updatedBoosters.push({
            id: currentUserId,
            name: activeUser.name,
            image: activeUser.image
          });
        } else {
          const boostIndex = updatedBoosters.findIndex((b: any) => b.id === currentUserId);
          if (boostIndex >= 0) updatedBoosters.splice(boostIndex, 1);
        }

        return {
          ...prev,
          hasBoosted: (res.userBoostCount || 0) > 0,
          userBoostCount: res.userBoostCount || 0,
          boostCount: res.boostCount ?? prev.boostCount,
          boosters: updatedBoosters
        };
      });
      await store.fetchSocialData(); 
    } else {
      notifyError();
      Alert.alert("Hata", res.error || "Boost işlemi başarısız.");
    }
  };

  const openUserProfile = async (uid: string, groupId?: string) => {
    const requestId = ++profileRequestIdRef.current;
    profileSelectionRef.current = { uid, groupId };
    lightTap();
    setSelectedUserId(uid);
    setProfileLoading(true);
    setProfileData(null);
    setProfileError(null);
    try {
      const res = await apiClient.request<{ user?: any }>('profile/public', [uid, groupId]);
      if (requestId !== profileRequestIdRef.current) return;
      if (res.success && res.user) {
        setProfileData(res.user);
      } else {
        setProfileError(res.success ? "Profil yüklenemedi." : getApiErrorMessage(res));
      }
    } catch (error) {
      if (requestId === profileRequestIdRef.current) {
        setProfileError(error instanceof Error ? error.message : "Profil yüklenemedi.");
      }
    } finally {
      if (requestId === profileRequestIdRef.current) setProfileLoading(false);
    }
  };

  useEffect(() => {
    const focus = typeof notificationParams.focus === 'string' ? notificationParams.focus : null;
    const userId = typeof notificationParams.userId === 'string' ? notificationParams.userId : null;
    const itemId = typeof notificationParams.itemId === 'string' ? notificationParams.itemId : null;
    if (!focus) return;

    const notificationKey = [focus, userId, itemId].join(':');
    if (handledNotificationRef.current === notificationKey) return;
    handledNotificationRef.current = notificationKey;
    setActiveTab('friends');
    void store.fetchSocialData();

    if (focus === 'profile' && userId) {
      void openUserProfile(userId);
    }
  }, [notificationParams]);

  const openGroupMemberProfile = (uid: string, groupId?: string) => {
    // React Native cannot reliably present a second Modal while the group
    // details Modal is still dismissing. Complete that transition first.
    setSelectedGroupDetails(null);
    setTimeout(() => {
      void openUserProfile(uid, groupId);
    }, 380);
  };

  const hasNoGroups = groupStore.hasLoaded && groupStore.groups.length === 0;
  if (hasNoGroups) {
    return <JoinOrCreateGroupWall initialInviteCode={pendingInviteCode} />;
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#101011', '#050505']} style={StyleSheet.absoluteFill} />

      {/* ─── FIXED HEADER AREA ─── */}
      <View style={[styles.fixedHeader, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.navBar} className="px-6 mb-6">
          <Text style={styles.serifTitle}>Sosyal</Text>
          <TouchableOpacity 
            onPress={() => { lightTap(); setAddFriendVisible(true); }}
            style={styles.headerIconBtn}
            activeOpacity={0.7}
          >
            <UserPlus size={18} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        </View>

        <View className="px-6 items-center z-20">
          <GlassView preset="liquid" style={[styles.glassTabPill, { width: TAB_BAR_WIDTH }]} interactive={false}>
            <Animated.View style={[styles.activeTabBackground, { width: TAB_WIDTH }, indicatorStyle]} />
            
            {TABS.map((tab) => {
              const isActive = activeTab === tab;
              return (
                <TouchableOpacity 
                  key={tab} 
                  onPress={() => { selectionTick(); setActiveTab(tab as any); setSearchQuery(""); }}
                  style={styles.tabButton}
                  activeOpacity={0.7}
                >
                  <Text 
                    weight={isActive ? 'bold' : 'medium'} 
                    style={{ color: isActive ? '#000' : 'rgba(255,255,255,0.6)' }}
                    className="text-[12px] z-10"
                  >
                    {tab === 'friends' ? t('social.friends') : t('social.groups')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </GlassView>

          {showSearchBar && (
            <GlassView preset="deep" style={styles.searchContainer} interactive={true}>
              <Search size={16} color="rgba(255,255,255,0.5)" style={styles.searchIcon} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={activeTab === 'friends' ? `${t('social.friends')}...` : `${t('social.groups')}...`}
                placeholderTextColor="rgba(255,255,255,0.3)"
                style={styles.searchInput}
              />
            </GlassView>
          )}
        </View>
      </View>

      {/* ─── SCROLLABLE CONTENT ─── */}
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom, 16) + 82, paddingTop: 16 }}
      >
        {activeTab === 'friends' ? (
          <FriendsTab 
            friends={filteredFriends}
            pendingRequests={store.pendingRequests}
            sentRequests={store.sentRequests}
            onAcceptRequest={handleAcceptRequest}
            onDeclineRequest={handleDeclineRequest}
            onCancelRequest={handleCancelRequest}
            openUserProfile={openUserProfile}
            onAddFriendPress={() => { lightTap(); setAddFriendVisible(true); }}
            isSearchActive={searchQuery.trim().length > 0}
          />
        ) : (
          <GroupsTab 
            groups={filteredGroups}
            setCreateGroupVisible={setCreateGroupVisible}
            setJoinGroupVisible={setJoinGroupVisible}
            setSelectedGroupDetails={setSelectedGroupDetails}
          />
        )}
      </ScrollView>

      {/* ─── MODULAR SHEETS ─── */}
      <AddFriendSheet 
        isOpen={addFriendVisible}
        onClose={() => setAddFriendVisible(false)}
        suggestions={store.suggestions}
        onSendRequest={handleSendFriendRequest}
        openUserProfile={openUserProfile}
      />

      <CreateGroupSheet 
        isOpen={createGroupVisible}
        onClose={() => { setCreateGroupVisible(false); setGeneratedInviteCode(null); setNewGroupName(""); setNewGroupImage(null); }}
        newGroupName={newGroupName}
        setNewGroupName={setNewGroupName}
        newGroupImage={newGroupImage}
        setNewGroupImage={setNewGroupImage}
        isCreatingGroup={isCreatingGroup}
        generatedInviteCode={generatedInviteCode}
        handleCreateGroupAction={handleCreateGroupAction}
        handleCopyCode={handleCopyCode}
      />

      <JoinGroupSheet 
        isOpen={joinGroupVisible}
        onClose={() => setJoinGroupVisible(false)}
        joinCodeInput={joinCodeInput}
        setJoinCodeInput={setJoinCodeInput}
        isJoining={isJoining}
        handleJoinWithCode={handleJoinWithCode}
      />

      <GroupDetailsSheet 
        isOpen={selectedGroupDetails !== null}
        onClose={() => setSelectedGroupDetails(null)}
        selectedGroupDetails={selectedGroupDetails}
        setSelectedGroupDetails={setSelectedGroupDetails}
        leavingGroupId={leavingGroupId}
        handleCopyCode={handleCopyCode}
        handleLeaveGroup={handleLeaveGroup}
        openUserProfile={openGroupMemberProfile}
        handleBoostGroup={handleBoostGroup}
        isBoosting={isBoosting}
      />

      <UserProfileSheet 
        isOpen={selectedUserId !== null}
        onClose={() => {
          profileRequestIdRef.current += 1;
          setSelectedUserId(null);
          setActiveProfileClipIndex(null);
        }}
        profileData={profileData}
        profileLoading={profileLoading}
        profileError={profileError}
        onRetry={() => {
          const selection = profileSelectionRef.current;
          if (selection) void openUserProfile(selection.uid, selection.groupId);
        }}
        onPlayClip={(clip) => {
          const index = ((profileData?.clips || []) as ProfileClip[]).findIndex((candidate) => candidate.id === clip.id);
          if (index >= 0) setActiveProfileClipIndex(index);
        }}
      />

      <Modal
        visible={activeProfileClipIndex !== null}
        animationType="none"
        transparent
        statusBarTranslucent
        onRequestClose={() => setActiveProfileClipIndex(null)}
      >
        {activeProfileClipIndex !== null && profileData?.clips?.length ? (
          <StreakClipPlaybackOverlay
            vloggedDays={[{
              d: 1,
              type: 'vlogged',
              assignment: {
                id: `profile-${profileData.id}`,
                user: profileData,
                clips: profileData.clips,
                date: new Date().toISOString(),
              },
            }]}
            dayIndex={0}
            initialClipIndex={activeProfileClipIndex}
            onClose={() => setActiveProfileClipIndex(null)}
          />
        ) : null}
      </Modal>

      {/* ─── TOAST ALERTS ─── */}
      {toastMessage && (
        <Animated.View entering={FadeInUp.duration(300)} exiting={FadeOut.duration(300)} style={[styles.toastContainer, { top: Math.max(insets.top + 8, 20) }]}>
          <GlassView preset="specular" style={styles.toastInner}>
            <Check size={14} color="#4ade80" strokeWidth={3} className="mr-2" />
            <Text weight="bold" className="text-white text-xs">{toastMessage}</Text>
          </GlassView>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B0C' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  fixedHeader: { zIndex: 50, paddingBottom: 8 },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 48 },
  serifTitle: { fontSize: 28, color: '#FAF9F6', letterSpacing: -0.5, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
  headerIconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  glassTabPill: { flexDirection: 'row', alignItems: 'center', padding: 4, borderRadius: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', position: 'relative' },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  activeTabBackground: { position: 'absolute', top: 4, bottom: 4, left: 4, backgroundColor: '#ffffff', borderRadius: 28, zIndex: 0 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 16, height: 48, width: '100%', marginTop: 24 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, color: '#fff', fontSize: 14, height: '100%' },
  toastContainer: { position: 'absolute', left: 24, right: 24, alignItems: 'center', zIndex: 100 },
  toastInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(22,22,24,0.95)', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16 },
});

// ./src/components/social/GroupDetailsSheet.tsx
"use client";

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Alert } from 'react-native';
import { Copy, Zap, ChevronRight, Users, Camera, QrCode, RefreshCw, LogOut, Crown, X, UserMinus, Trash2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { BottomSheet } from '../ui/BottomSheet';
import { GlassView } from '../ui/GlassView';
import { Text } from '../ui/Text';
import { Avatar } from '../ui/Avatar';
import { ACCENT } from '../../lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGroupStore } from '../../store/useGroupStore';
import { PaywallModal } from '../paywall/PaywallModal';
import { BoostGroupModal } from './BoostGroupModal';
import { lightTap, mediumTap, notifySuccess } from '../../lib/haptics';
import { GroupInviteQr } from '../group/GroupInviteQr';
import { useTranslation } from '../../lib/i18n';
import { useSocialStore } from '../../store/useSocialStore';
import Animated, { FadeInDown, FadeInUp, FadeOutDown, FadeOutUp } from 'react-native-reanimated';

const serifFont = Platform.OS === 'ios' ? 'Georgia' : 'serif';

interface GroupDetailsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedGroupDetails: any;
  setSelectedGroupDetails: (details: any) => void;
  leavingGroupId: string | null;
  handleCopyCode: (code: string) => void;
  handleLeaveGroup: (id: string, name: string) => void;
  openUserProfile: (id: string, groupId?: string) => void;
  handleBoostGroup: (id: string, action: 'add' | 'remove') => void;
  isBoosting: boolean;
}

export function GroupDetailsSheet({
  isOpen,
  onClose,
  selectedGroupDetails,
  setSelectedGroupDetails,
  leavingGroupId,
  handleCopyCode,
  handleLeaveGroup,
  openUserProfile,
  handleBoostGroup,
  isBoosting
}: GroupDetailsSheetProps) {
  const insets = useSafeAreaInsets();
  const groupStore = useGroupStore();
  const socialStore = useSocialStore();
  const { t } = useTranslation();
  
  const [boostModalOpen, setBoostModalOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [isUpdatingImage, setIsUpdatingImage] = useState(false);
  const [showInviteQr, setShowInviteQr] = useState(false);
  const [isRotatingInvite, setIsRotatingInvite] = useState(false);
  const [pendingLeaderAction, setPendingLeaderAction] = useState<string | null>(null);

  const membersArray = Array.isArray(selectedGroupDetails?.members)
    ? [...selectedGroupDetails.members].sort((a, b) => Number(b.role === 'admin') - Number(a.role === 'admin'))
    : [];
  const isAdmin = selectedGroupDetails?.role === 'admin';
  const boostCount = Math.min(3, Math.max(0, selectedGroupDetails?.boostCount || 0));
  const boostProgress = `${(boostCount / 3) * 100}%` as `${number}%`;

  useEffect(() => {
    setShowInviteQr(false);
    setIsRotatingInvite(false);
    setPendingLeaderAction(null);
  }, [selectedGroupDetails?.id]);

  const rotateInviteCode = () => {
    mediumTap();
    Alert.alert(
      t('groupInvite.refreshTitle'),
      t('groupInvite.refreshBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('groupInvite.refreshConfirm'),
          style: 'destructive',
          onPress: async () => {
            setIsRotatingInvite(true);
            const result = await groupStore.rotateInviteCode(selectedGroupDetails.id);
            setIsRotatingInvite(false);
            if (!result.success || !result.inviteCode) {
              Alert.alert(t('common.error'), result.error || t('social.error'));
              return;
            }
            notifySuccess();
            setSelectedGroupDetails({ ...selectedGroupDetails, inviteCode: result.inviteCode });
            setShowInviteQr(true);
            await socialStore.fetchSocialData();
          },
        },
      ]
    );
  };

  const handleAvatarPress = () => {
    lightTap();
    Alert.alert(
      "Grup Fotoğrafı",
      "Grup fotoğrafını güncellemek veya kaldırmak ister misiniz?",
      [
        { text: "İptal", style: "cancel" },
        { 
          text: "Fotoğrafı Değiştir", 
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });
            if (!result.canceled && result.assets && result.assets[0]) {
              setIsUpdatingImage(true);
              const res = await groupStore.updateGroupImage(selectedGroupDetails.id, result.assets[0].uri);
              setIsUpdatingImage(false);
              if (res.success) {
                notifySuccess();
                setSelectedGroupDetails({ ...selectedGroupDetails, image: res.imageUrl });
              } else {
                Alert.alert("Hata", "Fotoğraf güncellenemedi.");
              }
            }
          }
        },
        { 
          text: "Fotoğrafı Kaldır", 
          style: "destructive",
          onPress: async () => {
            setIsUpdatingImage(true);
            const res = await groupStore.removeGroupImage(selectedGroupDetails.id);
            setIsUpdatingImage(false);
            if (res.success) {
              notifySuccess();
              setSelectedGroupDetails({ ...selectedGroupDetails, image: null });
            } else {
              Alert.alert("Hata", "Fotoğraf kaldırılamadı.");
            }
          }
        },
      ]
    );
  };

  const handleBoostRowPress = () => {
    lightTap();
    setBoostModalOpen(true);
  };

  const confirmLeaveGroup = () => {
    lightTap();
    Alert.alert(
      t('groupDetails.leaveTitle'),
      t(isAdmin ? 'groupDetails.leaveLeaderBody' : 'groupDetails.leaveBody', {
        name: selectedGroupDetails.name,
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('groupDetails.leaveConfirm'),
          style: 'destructive',
          onPress: () => handleLeaveGroup(selectedGroupDetails.id, selectedGroupDetails.name),
        },
      ],
    );
  };

  const confirmTransferLeadership = (member: any) => {
    mediumTap();
    Alert.alert(
      t('groupDetails.transferTitle'),
      t('groupDetails.transferBody', { name: member.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('groupDetails.transferConfirm'),
          style: 'destructive',
          onPress: async () => {
            setPendingLeaderAction(`transfer:${member.id}`);
            const result = await groupStore.transferLeadership(selectedGroupDetails.id, member.id);
            setPendingLeaderAction(null);
            if (!result.success) {
              Alert.alert(t('common.error'), result.error || t('social.error'));
              return;
            }
            notifySuccess();
            setSelectedGroupDetails({
              ...selectedGroupDetails,
              role: 'member',
              members: membersArray.map((groupMember: any) => ({
                ...groupMember,
                role: groupMember.id === member.id ? 'admin' : (groupMember.role === 'admin' ? 'member' : groupMember.role),
              })),
            });
            await socialStore.fetchSocialData();
          },
        },
      ],
    );
  };

  const confirmKickMember = (member: any) => {
    mediumTap();
    Alert.alert(
      t('groupDetails.kickTitle'),
      t('groupDetails.kickBody', { name: member.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('groupDetails.kickConfirm'),
          style: 'destructive',
          onPress: async () => {
            setPendingLeaderAction(`kick:${member.id}`);
            const result = await groupStore.kickMember(selectedGroupDetails.id, member.id);
            setPendingLeaderAction(null);
            if (!result.success) {
              Alert.alert(t('common.error'), result.error || t('social.error'));
              return;
            }
            notifySuccess();
            setSelectedGroupDetails({
              ...selectedGroupDetails,
              memberCount: Math.max(0, membersArray.length - 1),
              members: membersArray.filter((groupMember: any) => groupMember.id !== member.id),
            });
            await socialStore.fetchSocialData();
          },
        },
      ],
    );
  };

  const confirmDeleteGroup = () => {
    mediumTap();
    Alert.alert(
      t('groupDetails.deleteTitle'),
      t('groupDetails.deleteBody', { name: selectedGroupDetails.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('groupDetails.deleteConfirm'),
          style: 'destructive',
          onPress: async () => {
            setPendingLeaderAction('delete');
            const result = await groupStore.deleteGroup(selectedGroupDetails.id);
            setPendingLeaderAction(null);
            if (!result.success) {
              Alert.alert(t('common.error'), result.error || t('social.error'));
              return;
            }
            notifySuccess();
            onClose();
            await socialStore.fetchSocialData();
          },
        },
      ],
    );
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} heightPercent={0.84}>
      {selectedGroupDetails && (
        <View style={[styles.sheetContent, { paddingBottom: Math.max(insets.bottom * 0.6, 10) }]}>
          <View style={styles.modeStage}>
          {showInviteQr ? (
            <Animated.View
              entering={FadeInDown.duration(360).springify().damping(22).stiffness(170).mass(0.75)}
              exiting={FadeOutDown.duration(220)}
              style={styles.qrFocusContent}
            >
              <TouchableOpacity
                onPress={() => { lightTap(); setShowInviteQr(false); }}
                style={styles.qrFocusCloseButton}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
              >
                <X size={18} color="rgba(255,255,255,0.72)" />
              </TouchableOpacity>

              <View style={styles.qrFocusIdentity}>
                <View style={styles.qrFocusAvatar}>
                  <Avatar src={selectedGroupDetails.image} name={selectedGroupDetails.name} size={58} />
                </View>
                <Text weight="bold" style={[styles.qrFocusGroupName, { fontFamily: serifFont }]} numberOfLines={1}>
                  {selectedGroupDetails.name}
                </Text>
                <View style={styles.qrFocusMeta}>
                  <Users size={11} color="rgba(255,255,255,0.48)" />
                  <Text style={styles.qrFocusMetaText}>{t('groupDetails.memberCount', { count: membersArray.length })}</Text>
                </View>
              </View>

              <GlassView preset="deep" style={styles.qrFocusCard} interactive={false}>
                <Text weight="bold" style={styles.qrFocusTitle}>{t('groupInvite.qrTitle')}</Text>
                <Text style={styles.qrFocusBody}>{t('groupInvite.qrBody')}</Text>
                <View style={styles.qrFocusCodeFrame}>
                  <GroupInviteQr inviteCode={selectedGroupDetails.inviteCode} size={176} />
                </View>
                <Text style={styles.qrFocusInviteLabel}>{t('groupInvite.shareCode')}</Text>
                <Text weight="bold" style={styles.qrFocusInviteCode}>{selectedGroupDetails.inviteCode}</Text>

                <TouchableOpacity
                  onPress={() => handleCopyCode(selectedGroupDetails.inviteCode)}
                  style={styles.qrFocusCopyButton}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={t('groupInvite.copy')}
                >
                  <Copy size={15} color="#000" strokeWidth={2.5} />
                  <Text weight="bold" style={styles.qrFocusCopyLabel}>{t('groupInvite.copy')}</Text>
                </TouchableOpacity>

                {isAdmin ? (
                  <TouchableOpacity
                    onPress={rotateInviteCode}
                    disabled={isRotatingInvite}
                    style={styles.qrFocusRefreshButton}
                    activeOpacity={0.8}
                  >
                    {isRotatingInvite
                      ? <ActivityIndicator size="small" color={ACCENT} />
                      : <RefreshCw size={13} color={ACCENT} />}
                    <Text weight="bold" style={styles.refreshLabel}>
                      {t(isRotatingInvite ? 'groupInvite.refreshing' : 'groupInvite.refresh')}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </GlassView>
            </Animated.View>
          ) : (
          <Animated.View
            entering={FadeInUp.duration(340).springify().damping(22).stiffness(170).mass(0.75)}
            exiting={FadeOutUp.duration(210)}
            style={styles.detailsContent}
          >
          {/* Group identity and secondary actions */}
          <View style={styles.headerBlock}>
            <TouchableOpacity 
              disabled={!isAdmin || isUpdatingImage} 
              onPress={handleAvatarPress}
              activeOpacity={0.8}
              style={styles.headerAvatarContainer}
            >
              <Avatar src={selectedGroupDetails.image} name={selectedGroupDetails.name} size={68} />
              {isAdmin && !isUpdatingImage && (
                <View style={styles.editBadge}>
                  <Camera size={12} color="#000" />
                </View>
              )}
              {isUpdatingImage && (
                <View style={styles.avatarLoader}>
                  <ActivityIndicator size="small" color="#fff" />
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.headerTextCol}>
              <Text style={[styles.title, { fontFamily: serifFont }]} numberOfLines={1}>{selectedGroupDetails.name}</Text>
              <View style={styles.groupMetaRow}>
                <View style={styles.metaPill}>
                  <Users size={10} color="rgba(255,255,255,0.55)" />
                  <Text style={styles.metaPillText}>{t('groupDetails.memberCount', { count: membersArray.length })}</Text>
                </View>
                <View style={[styles.metaPill, isAdmin && styles.adminMetaPill]}>
                  {isAdmin ? <Crown size={10} color={ACCENT} fill="rgba(224,124,48,0.2)" /> : null}
                  <Text style={[styles.metaPillText, isAdmin && styles.adminMetaPillText]}>
                    {t(isAdmin ? 'groupDetails.admin' : 'groupDetails.member')}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              onPress={confirmLeaveGroup}
              disabled={leavingGroupId !== null}
              style={[styles.leaveAction, leavingGroupId !== null && styles.leaveActionDisabled]}
              activeOpacity={0.72}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={t('groupDetails.leave')}
            >
              {leavingGroupId === selectedGroupDetails.id ? (
                <ActivityIndicator size="small" color="#f87171" />
              ) : (
                <LogOut size={16} color="#f87171" strokeWidth={2.2} />
              )}
            </TouchableOpacity>
          </View>

          {/* Invite tools */}
          <GlassView preset="specular" style={styles.inviteBox} interactive={false}>
            <View style={styles.inviteCopy}>
              <Text className="text-white/40 text-[9px] uppercase tracking-widest font-bold">{t('groupInvite.shareCode')}</Text>
              <Text weight="bold" className="text-white font-mono text-[24px] tracking-widest mt-1">{selectedGroupDetails.inviteCode}</Text>
              <Text style={styles.inviteHint} numberOfLines={1}>{t('groupDetails.inviteHint')}</Text>
            </View>
            <View style={styles.inviteActions}>
              <TouchableOpacity onPress={() => { lightTap(); setShowInviteQr((value) => !value); }} style={styles.qrToggleBtn} activeOpacity={0.8}>
                <QrCode size={16} color={showInviteQr ? ACCENT : 'rgba(255,255,255,0.78)'} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleCopyCode(selectedGroupDetails.inviteCode)}
                style={styles.sheetCopyBtn}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={t('groupInvite.copy')}
              >
                <Copy size={16} color="#000" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          </GlassView>

          {/* Group boost progress */}
          <TouchableOpacity
            onPress={handleBoostRowPress}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel={t('groupDetails.boostTitle')}
          >
            <GlassView preset="liquid" style={[styles.boostProgressCard, boostCount >= 3 && styles.boostProgressCardComplete]}>
              <View style={styles.boostProgressHeader}>
                <View style={[styles.boostIconWrapper, selectedGroupDetails.hasBoosted && styles.boostIconWrapperActive]}>
                  <Zap
                    size={15}
                    color={selectedGroupDetails.hasBoosted ? '#000' : ACCENT}
                    fill={selectedGroupDetails.hasBoosted ? '#000' : 'transparent'}
                  />
                </View>
                <View style={styles.boostTextContainer}>
                  <View style={styles.boostTitleRow}>
                    <Text weight="bold" style={styles.boostTitle}>{t('groupDetails.boostTitle')}</Text>
                    {selectedGroupDetails.hasBoosted ? (
                      <View style={styles.yourBoostBadge}>
                        <Text weight="bold" style={styles.yourBoostText}>{t('groupDetails.boostActive')}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.boostStatus} numberOfLines={1}>
                    {boostCount >= 3
                      ? t('groupDetails.boostComplete')
                      : t('groupDetails.boostRemaining', { count: 3 - boostCount })}
                  </Text>
                </View>
                <View style={styles.boostCountPill}>
                  <Text weight="bold" style={styles.boostCountValue}>
                    <Text weight="bold" style={styles.boostCountCurrent}>{boostCount}</Text>
                    <Text weight="bold" style={styles.boostCountGoal}> / 3</Text>
                  </Text>
                </View>
              </View>

              <View style={styles.boostTrack}>
                <View style={[styles.boostTrackFill, { width: boostProgress }]} />
                <View style={[styles.boostMilestone, styles.boostMilestoneOne, boostCount >= 1 && styles.boostMilestoneReached]} />
                <View style={[styles.boostMilestone, styles.boostMilestoneTwo, boostCount >= 2 && styles.boostMilestoneReached]} />
              </View>
              <View style={styles.boostProgressLabels}>
                <Text style={styles.boostProgressLabel}>{t('groupDetails.boostStandard')}</Text>
                <Text style={[styles.boostProgressLabel, boostCount >= 3 && styles.boostProgressLabelComplete]}>{t('groupDetails.boostGoal')}</Text>
              </View>
            </GlassView>
          </TouchableOpacity>

          {/* Member directory */}
          <View style={styles.membersWrapper}>
            <View style={styles.membersHeader}>
              <View style={styles.membersHeaderTitle}>
                <Users size={13} color="rgba(255,255,255,0.56)" />
                <Text weight="bold" style={styles.membersTitle}>{t('groupDetails.members')}</Text>
              </View>
              <View style={styles.memberCountBadge}>
                <Text weight="bold" style={styles.memberCountText}>{membersArray.length}</Text>
              </View>
            </View>

            <GlassView preset="liquid" style={styles.membersCapsule}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.membersScroll}>
                {membersArray.length > 0 ? membersArray.map((member: any, index: number) => {
                  const isLeader = member.role === 'admin';
                  return (
                    <View key={member.id || index}>
                      <View style={styles.memberRow}>
                        <TouchableOpacity
                          activeOpacity={0.75}
                          onPress={() => openUserProfile(member.id, selectedGroupDetails.id)}
                          style={styles.memberProfileAction}
                        >
                          <View style={[styles.memberAvatarRing, isLeader && styles.leaderAvatarRing]}>
                            <Avatar src={member.image} name={member.name} size={38} />
                          </View>
                          <View style={styles.memberIdentity}>
                            <View style={styles.memberNameRow}>
                              <Text weight="bold" style={styles.memberName} numberOfLines={1}>{member.name}</Text>
                              {isLeader ? (
                                <View style={styles.leaderBadge}>
                                  <Crown size={9} color={ACCENT} fill="rgba(224,124,48,0.25)" />
                                  <Text weight="bold" style={styles.leaderBadgeText}>{t('groupDetails.leader')}</Text>
                                </View>
                              ) : null}
                            </View>
                            <Text style={styles.memberHandle}>@{member.name?.toLowerCase().replace(/\s+/g, "_")}</Text>
                          </View>
                        </TouchableOpacity>
                        {isAdmin && !isLeader ? (
                          <View style={styles.memberAdminActions}>
                            <TouchableOpacity
                              onPress={() => confirmTransferLeadership(member)}
                              disabled={pendingLeaderAction !== null}
                              style={styles.memberAdminButton}
                              accessibilityRole="button"
                              accessibilityLabel={`${t('groupDetails.transfer')}: ${member.name}`}
                            >
                              {pendingLeaderAction === `transfer:${member.id}`
                                ? <ActivityIndicator size="small" color={ACCENT} />
                                : <Crown size={14} color={ACCENT} />}
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => confirmKickMember(member)}
                              disabled={pendingLeaderAction !== null}
                              style={[styles.memberAdminButton, styles.kickMemberButton]}
                              accessibilityRole="button"
                              accessibilityLabel={`${t('groupDetails.kick')}: ${member.name}`}
                            >
                              {pendingLeaderAction === `kick:${member.id}`
                                ? <ActivityIndicator size="small" color="#f87171" />
                                : <UserMinus size={14} color="#f87171" />}
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <ChevronRight size={14} color="rgba(255,255,255,0.18)" />
                        )}
                      </View>
                      {index < membersArray.length - 1 && <View style={styles.rowDivider} />}
                    </View>
                  );
                }) : (
                  <Text style={styles.emptyMembers}>{t('groupDetails.noMembers')}</Text>
                )}
              </ScrollView>
            </GlassView>

            {isAdmin ? (
              <TouchableOpacity
                onPress={confirmDeleteGroup}
                disabled={pendingLeaderAction !== null}
                style={styles.deleteGroupButton}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={t('groupDetails.delete')}
              >
                {pendingLeaderAction === 'delete'
                  ? <ActivityIndicator size="small" color="#f87171" />
                  : <Trash2 size={14} color="#f87171" />}
                <Text weight="bold" style={styles.deleteGroupLabel}>{t('groupDetails.delete')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          </Animated.View>
          )}
          </View>

          <BoostGroupModal
            isOpen={boostModalOpen}
            onClose={() => setBoostModalOpen(false)}
            groupName={selectedGroupDetails.name}
            hasBoosted={selectedGroupDetails.hasBoosted || false}
            userBoostCount={selectedGroupDetails.userBoostCount || 0}
            boostCount={selectedGroupDetails.boostCount || 0}
            isBoosting={isBoosting}
            onAddBoost={() => handleBoostGroup(selectedGroupDetails.id, 'add')}
            onRemoveBoost={() => handleBoostGroup(selectedGroupDetails.id, 'remove')}
            onPurchaseBoost={() => { setBoostModalOpen(false); setPaywallOpen(true); }}
          />

          <PaywallModal
            isOpen={paywallOpen}
            onClose={() => setPaywallOpen(false)}
          />
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetContent: { 
    flex: 1, 
    paddingHorizontal: 20, 
    paddingTop: 6,
  },
  modeStage: {
    flex: 1,
    position: 'relative',
  },
  detailsContent: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  qrFocusContent: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  qrFocusCloseButton: {
    position: 'absolute',
    top: 2,
    right: 0,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  qrFocusIdentity: {
    alignItems: 'center',
    marginBottom: 18,
  },
  qrFocusAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(224,124,48,0.35)',
    backgroundColor: 'rgba(224,124,48,0.08)',
  },
  qrFocusGroupName: {
    maxWidth: 270,
    color: '#fff',
    fontSize: 23,
    letterSpacing: -0.35,
    marginTop: 10,
  },
  qrFocusMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  qrFocusMetaText: {
    color: 'rgba(255,255,255,0.44)',
    fontSize: 9.5,
  },
  qrFocusCard: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 18,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(255,255,255,0.018)',
  },
  qrFocusTitle: {
    color: '#fff',
    fontSize: 14,
  },
  qrFocusBody: {
    maxWidth: 260,
    color: 'rgba(255,255,255,0.42)',
    fontSize: 9.5,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  qrFocusCodeFrame: {
    marginTop: 16,
    padding: 7,
    borderRadius: 28,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 8,
  },
  qrFocusInviteLabel: {
    color: 'rgba(255,255,255,0.32)',
    fontSize: 7.5,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginTop: 14,
  },
  qrFocusInviteCode: {
    color: '#fff',
    fontSize: 20,
    letterSpacing: 3,
    marginTop: 2,
  },
  qrFocusCopyButton: {
    width: '100%',
    height: 42,
    marginTop: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: ACCENT,
  },
  qrFocusCopyLabel: {
    color: '#000',
    fontSize: 11,
  },
  qrFocusRefreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(224,124,48,0.1)',
  },
  headerBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    paddingHorizontal: 2,
  },
  headerAvatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  editBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#0B0B0C',
  },
  avatarLoader: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  title: {
    fontSize: 25,
    color: '#ffffff',
    letterSpacing: -0.4,
  },
  groupMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 7,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  metaPillText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 8.5,
  },
  adminMetaPill: {
    backgroundColor: 'rgba(224,124,48,0.1)',
    borderColor: 'rgba(224,124,48,0.18)',
  },
  adminMetaPillText: {
    color: ACCENT,
  },
  leaveAction: {
    width: 36,
    height: 36,
    marginLeft: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248,113,113,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.14)',
  },
  leaveActionDisabled: {
    opacity: 0.5,
  },
  inviteBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
  },
  inviteCopy: {
    flex: 1,
    paddingRight: 10,
  },
  inviteHint: {
    color: 'rgba(255,255,255,0.34)',
    fontSize: 9,
    marginTop: 4,
  },
  inviteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qrToggleBtn: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sheetCopyBtn: { 
    width: 38,
    height: 38,
    backgroundColor: ACCENT,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrPanel: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 13,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 8,
  },
  qrPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qrGroupAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  qrGroupIdentity: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
  },
  qrGroupName: {
    color: '#fff',
    fontSize: 13.5,
  },
  qrGroupLabel: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 9,
    marginTop: 2,
  },
  qrCloseButton: {
    width: 31,
    height: 31,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  qrPanelDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.055)',
    marginVertical: 11,
  },
  qrPanelContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  qrCodeFrame: {
    padding: 3,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
  },
  qrPanelCopy: {
    flex: 1,
    minWidth: 0,
  },
  qrPanelBody: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9.5,
    lineHeight: 13.5,
  },
  qrInviteCodePill: {
    alignSelf: 'flex-start',
    marginTop: 9,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  qrInviteCodeLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 6.5,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  qrInviteCode: {
    color: '#fff',
    fontSize: 12,
    letterSpacing: 1.5,
    marginTop: 1,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 9,
    backgroundColor: 'rgba(224,124,48,0.1)',
  },
  refreshLabel: {
    color: ACCENT,
    fontSize: 10,
  },
  boostProgressCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 11,
    backgroundColor: 'rgba(255,255,255,0.01)',
  },
  boostProgressCardComplete: {
    borderColor: 'rgba(224, 124, 48, 0.25)',
    backgroundColor: 'rgba(224, 124, 48, 0.02)',
  },
  boostProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  boostIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(224,124,48,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(224,124,48,0.15)',
  },
  boostIconWrapperActive: {
    backgroundColor: ACCENT,
  },
  boostTextContainer: {
    flex: 1,
    paddingLeft: 12,
    paddingRight: 8,
  },
  boostTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  boostTitle: {
    color: '#fff',
    fontSize: 13.5,
  },
  yourBoostBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(224,124,48,0.11)',
    borderWidth: 1,
    borderColor: 'rgba(224,124,48,0.18)',
  },
  yourBoostText: {
    color: ACCENT,
    fontSize: 7.5,
    letterSpacing: 0.25,
    textTransform: 'uppercase',
  },
  boostStatus: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9.5,
    marginTop: 3,
  },
  boostCountPill: {
    width: 54,
    height: 32,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boostCountValue: {
    lineHeight: 17,
    textAlign: 'center',
  },
  boostCountCurrent: {
    color: ACCENT,
    fontSize: 14,
    lineHeight: 17,
  },
  boostCountGoal: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 10.5,
    lineHeight: 17,
  },
  boostTrack: {
    height: 6,
    borderRadius: 3,
    marginTop: 13,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  boostTrackFill: {
    height: '100%',
    minWidth: 0,
    borderRadius: 3,
    backgroundColor: ACCENT,
  },
  boostMilestone: {
    position: 'absolute',
    top: 1,
    width: 4,
    height: 4,
    marginLeft: -2,
    borderRadius: 2,
    backgroundColor: 'rgba(10,10,10,0.72)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  boostMilestoneOne: {
    left: '33.333%',
  },
  boostMilestoneTwo: {
    left: '66.666%',
  },
  boostMilestoneReached: {
    backgroundColor: '#0a0a0a',
    borderColor: ACCENT,
  },
  boostProgressLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  boostProgressLabel: {
    color: 'rgba(255,255,255,0.28)',
    fontSize: 8,
    letterSpacing: 0.25,
  },
  boostProgressLabelComplete: {
    color: ACCENT,
  },
  membersWrapper: {
    flex: 1,
    marginTop: 17,
  },
  membersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  membersHeaderTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  membersTitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  memberCountBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberCountText: {
    color: 'rgba(255,255,255,0.56)',
    fontSize: 9.5,
  },
  membersCapsule: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.01)',
  },
  membersScroll: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  memberProfileAction: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatarRing: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  leaderAvatarRing: {
    borderColor: 'rgba(224,124,48,0.5)',
    backgroundColor: 'rgba(224,124,48,0.08)',
  },
  memberIdentity: {
    flex: 1,
    justifyContent: 'center',
    marginLeft: 11,
    minWidth: 0,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  memberName: {
    color: '#fff',
    fontSize: 13.5,
    flexShrink: 1,
  },
  memberHandle: {
    color: 'rgba(255,255,255,0.36)',
    fontSize: 9.5,
    marginTop: 2,
  },
  leaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(224,124,48,0.11)',
    borderWidth: 1,
    borderColor: 'rgba(224,124,48,0.2)',
  },
  leaderBadgeText: {
    color: ACCENT,
    fontSize: 8,
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  memberAdminActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginLeft: 8,
  },
  memberAdminButton: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(224,124,48,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(224,124,48,0.18)',
  },
  kickMemberButton: {
    backgroundColor: 'rgba(248,113,113,0.07)',
    borderColor: 'rgba(248,113,113,0.14)',
  },
  deleteGroupButton: {
    height: 40,
    marginTop: 10,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(248,113,113,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.14)',
  },
  deleteGroupLabel: {
    color: '#f87171',
    fontSize: 11,
  },
  rowDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginLeft: 53,
  },
  emptyMembers: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: 24,
  },
});

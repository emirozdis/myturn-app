// ./src/components/group/JoinOrCreateGroupWall.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Alert, StyleSheet, View, TouchableOpacity, Platform, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Users, ScanLine } from 'lucide-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { useGroupStore } from '../../store/useGroupStore';
import { useSocialStore } from '../../store/useSocialStore';
import { getDeviceUtcOffset } from '../../lib/businessTime';
import { NEUTRAL_PAGE_BG, ACCENT } from '../../lib/theme';
import { notifySuccess, selectionTick, lightTap } from '../../lib/haptics';
import { Text } from '../ui/Text';
import { GlassView } from '../ui/GlassView';
import { clearPendingGroupInvite } from '../../lib/pendingGroupInvite';

import { CreateGroupSheet } from '../social/CreateGroupSheet';
import { JoinGroupSheet } from '../social/JoinGroupSheet';

const serifFont = Platform.OS === 'ios' ? 'Georgia' : 'serif';

interface JoinOrCreateGroupWallProps {
  initialInviteCode?: string | null;
}

export function JoinOrCreateGroupWall({ initialInviteCode }: JoinOrCreateGroupWallProps) {
  const insets = useSafeAreaInsets();
  const groupStore = useGroupStore();
  const socialStore = useSocialStore();

  // Sheet states
  const [createGroupVisible, setCreateGroupVisible] = useState(false);
  const [joinGroupVisible, setJoinGroupVisible] = useState(false);

  // Form states
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupImage, setNewGroupImage] = useState<string | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [generatedInviteCode, setGeneratedInviteCode] = useState<string | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    // Refresh groups data when this component mounts
    groupStore.fetchGroups();
  }, []);

  useEffect(() => {
    if (!initialInviteCode) return;
    setJoinCodeInput(initialInviteCode);
    setJoinGroupVisible(true);
    clearPendingGroupInvite();
  }, [initialInviteCode]);

  const handleCopyCode = (code: string) => {
    lightTap();
    notifySuccess();
  };

  const handleCreateGroupAction = async () => {
    if (!newGroupName.trim()) return;
    lightTap();
    setIsCreatingGroup(true);
    const inviteCode = await socialStore.createGroup(newGroupName, getDeviceUtcOffset(), newGroupImage);
    setIsCreatingGroup(false);

    if (inviteCode) {
      notifySuccess();
      setGeneratedInviteCode(inviteCode);
      await groupStore.fetchGroups();
    }
  };

  const handleJoinWithCode = async (codeOverride?: string) => {
    const inviteCode = (codeOverride || joinCodeInput).trim();
    if (!inviteCode) return;
    lightTap();
    setIsJoining(true);
    const res = await socialStore.joinGroup(inviteCode);
    setIsJoining(false);

    if (res.success) {
      notifySuccess();
      setJoinCodeInput('');
      setJoinGroupVisible(false);
      await groupStore.fetchGroups();
    } else {
      Alert.alert('Katılım başarısız', res.error || 'Grup bulunamadı. Kodu kontrol edip tekrar deneyin.');
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[NEUTRAL_PAGE_BG.light, NEUTRAL_PAGE_BG.dark]} style={StyleSheet.absoluteFill} />
      
      <View style={[styles.content, { paddingTop: Math.max(insets.top + 24, 48), paddingBottom: Math.max(insets.bottom + 48, 80) }]}>
        {/* Banner Image */}
        <Animated.View entering={FadeInUp.delay(100).duration(400)} style={styles.bannerContainer}>
          <Image 
            source={require('../../../assets/images/onboarding/auth.png')} 
            style={styles.bannerImage}
            resizeMode="cover"
          />
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(150).duration(400)} style={styles.headerSection}>
          <Text style={[styles.serifHeadline, { fontFamily: serifFont }]}>
            Start vlogging{"\n"}with your friends
          </Text>
          <Text style={styles.descriptionText}>
            Create a new group or join an existing one to begin your daily vlogging journey together.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.actionsContainer}>
          <TouchableOpacity 
            onPress={() => { setGeneratedInviteCode(null); setCreateGroupVisible(true); }} 
            activeOpacity={0.85} 
            style={styles.actionCard}
          >
            <GlassView preset="liquid" style={styles.cardInner}>
              <View style={styles.cardHeader}>
                <View style={styles.widgetIconOuter}>
                  <Users size={16} color={ACCENT} />
                </View>
                <Text weight="bold" style={styles.cardTitle}>Create Group</Text>
              </View>
              <Text style={styles.cardDescription}>
                Create a new space and invite your friends to join your daily vlogging circle.
              </Text>
            </GlassView>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setJoinGroupVisible(true)} 
            activeOpacity={0.85} 
            style={styles.actionCard}
          >
            <GlassView preset="liquid" style={styles.cardInner}>
              <View style={styles.cardHeader}>
                <View style={[styles.widgetIconOuter, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                  <ScanLine size={15} color="rgba(255,255,255,0.8)" />
                </View>
                <Text weight="bold" style={styles.cardTitle}>Join a Group</Text>
              </View>
              <Text style={styles.cardDescription}>
                Enter a short invite code or scan a friend’s QR to join instantly.
              </Text>
            </GlassView>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Sheets */}
      <CreateGroupSheet 
        isOpen={createGroupVisible}
        onClose={() => { setCreateGroupVisible(false); setGeneratedInviteCode(null); setNewGroupName(''); setNewGroupImage(null); }}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  bannerContainer: {
    width: '100%',
    marginBottom: 24,
  },
  bannerImage: {
    width: '100%',
    height: 200,
    borderRadius: 24,
  },
  headerSection: {
    marginBottom: 32,
  },
  serifHeadline: {
    fontSize: 26,
    color: '#fff',
    lineHeight: 32,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  descriptionText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 18,
    maxWidth: '90%',
  },
  actionsContainer: {
    gap: 16,
  },
  actionCard: {
    width: '100%',
  },
  cardInner: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    minHeight: 140,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  widgetIconOuter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(224,124,48,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: '#fff',
    fontSize: 15,
  },
  cardDescription: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
});

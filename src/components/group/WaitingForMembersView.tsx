"use client";

import React, { useState } from 'react';
import { Image, Platform, Share, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { QrCode, Share2, Users } from 'lucide-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ACCENT } from '../../lib/theme';
import { useTranslation } from '../../lib/i18n';
import { lightTap } from '../../lib/haptics';
import { Text } from '../ui/Text';
import { GroupSelectorSheet, GroupSwitcherPill } from './GroupSelectorSheet';
import { BottomSheet } from '../ui/BottomSheet';
import { GroupInviteQr } from './GroupInviteQr';

const serifFont = Platform.OS === 'ios' ? 'Georgia' : 'serif';

type WaitingForMembersViewProps = {
  groupName?: string;
  inviteCode?: string;
  memberCount: number;
  minimumMemberCount: number;
};

export function WaitingForMembersView({
  groupName,
  inviteCode,
  memberCount,
  minimumMemberCount,
}: WaitingForMembersViewProps) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { t } = useTranslation();
  const [isGroupSelectorOpen, setIsGroupSelectorOpen] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);

  const shareInvite = async () => {
    if (!inviteCode) return;
    lightTap();
    try {
      await Share.share({
        message: t('groupWaiting.shareMessage', {
          group: groupName || 'MyTurn',
          code: inviteCode,
        }),
      });
    } catch (error) {
      console.warn('[WaitingForMembersView] Could not open the share sheet:', error);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) + 24 }]}>
      <Animated.View entering={FadeInUp.duration(500).springify().damping(24)} style={styles.content}>
        <View style={[styles.illustrationWrapper, screenHeight < 720 && styles.illustrationWrapperCompact]}>
          <Image
            source={require('../../../assets/images/today/waiting-user.png')}
            style={styles.illustration}
            resizeMode="contain"
          />
        </View>

        <View style={styles.copy}>
          <View style={styles.eyebrow}>
            <Users size={14} color={ACCENT} />
            <Text weight="bold" style={styles.eyebrowText}>
              {t('groupWaiting.memberProgress', { current: memberCount, minimum: minimumMemberCount })}
            </Text>
          </View>
          <Text style={[styles.title, { fontFamily: serifFont }]}>{t('groupWaiting.title')}</Text>
          <Text style={styles.description}>{t('groupWaiting.body')}</Text>

          {inviteCode ? (
            <View style={styles.inviteActions}>
              <TouchableOpacity onPress={shareInvite} activeOpacity={0.85} style={styles.shareButton}>
                <Share2 size={17} color="#000" />
                <Text weight="bold" style={styles.shareButtonText}>{t('groupWaiting.share')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { lightTap(); setIsQrOpen(true); }} activeOpacity={0.8} style={styles.qrButton}>
                <QrCode size={19} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : null}

          <GroupSwitcherPill onPress={() => setIsGroupSelectorOpen(true)} />
        </View>
      </Animated.View>

      <GroupSelectorSheet
        isOpen={isGroupSelectorOpen}
        onClose={() => setIsGroupSelectorOpen(false)}
      />

      <BottomSheet isOpen={isQrOpen} onClose={() => setIsQrOpen(false)} heightPercent={0.56}>
        {inviteCode ? (
          <View style={styles.qrSheet}>
            <Text weight="bold" style={styles.qrTitle}>{t('groupInvite.qrTitle')}</Text>
            <Text style={styles.qrBody}>{t('groupInvite.qrBody')}</Text>
            <View style={styles.qrCodeWrap}>
              <GroupInviteQr inviteCode={inviteCode} size={168} />
            </View>
            <Text weight="bold" style={styles.inviteCode}>{inviteCode}</Text>
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    alignItems: 'center',
  },
  illustrationWrapper: {
    width: '100%',
    height: 330,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationWrapperCompact: {
    height: 260,
  },
  illustration: {
    width: '100%',
    height: '100%',
  },
  copy: {
    width: '100%',
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(224,124,48,0.12)',
  },
  eyebrowText: {
    color: ACCENT,
    fontSize: 11,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    lineHeight: 34,
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 340,
  },
  inviteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 26,
  },
  shareButton: {
    minWidth: 190,
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: ACCENT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  shareButtonText: {
    color: '#000',
    fontSize: 14,
  },
  qrButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  qrSheet: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  qrTitle: {
    color: '#fff',
    fontSize: 21,
  },
  qrBody: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 7,
    maxWidth: 280,
  },
  qrCodeWrap: {
    marginTop: 20,
  },
  inviteCode: {
    color: '#fff',
    fontSize: 22,
    letterSpacing: 4,
    marginTop: 15,
  },
});

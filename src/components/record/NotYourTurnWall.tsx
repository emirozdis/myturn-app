import React, { useState } from 'react';
import { View, TouchableOpacity, Image, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Users, Lock, CloudUpload, MessageSquareText, Sparkles, ChevronRight, HelpCircle, Play } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Text } from '../ui/Text';
import { Avatar } from '../ui/Avatar';
import { ACCENT } from '../../lib/theme';
import { useTranslation } from '../../lib/i18n';
import { GroupSelectorSheet, GroupSwitcherPill } from '../group/GroupSelectorSheet';

interface NotYourTurnWallProps {
  vloggerName: string;
  vloggerHandle: string;
  vloggerImage?: string | null;
  isFrozen?: boolean;
}

const ORANGE_ACCENT = '#E87B35';
const CARD_BG = '#111111';
const BORDER_COLOR = 'rgba(255, 255, 255, 0.06)';

export function NotYourTurnWall({ vloggerName, vloggerImage, isFrozen = false }: NotYourTurnWallProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { t } = useTranslation();
  const [isGroupSelectorOpen, setIsGroupSelectorOpen] = useState(false);

  // Use dynamic sizing to guarantee everything fits perfectly without scrolling on smaller devices
  const isSmallScreen = screenHeight < 700;

  if (isFrozen) {
    return (
      <View style={styles.container}>
        {/* Top Header & Close Button */}
        <View style={styles.header}>
          <View style={styles.dragIndicator} />
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={() => router.back()}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <X size={18} color="rgba(255, 255, 255, 0.7)" />
          </TouchableOpacity>
        </View>

        {/* Large Illustration Container (No side labels) */}
        <View style={[styles.heroContainer, { flex: isSmallScreen ? 1.2 : 1.6 }]}>
          <Image 
            source={require('../../../assets/images/subscription/frozen.png')} 
            style={styles.heroImage} 
            resizeMode="contain" 
          />
        </View>

        {/* Title and Subtitle */}
        <View style={styles.titleContainer}>
          <Text weight="bold" style={[styles.titleText, isSmallScreen && { fontSize: 22 }]}>Group Frozen</Text>
          <Text style={[styles.subtitleText, isSmallScreen && { fontSize: 13, marginBottom: 12 }]}>
            Your boost has ended and this group exceeds the free limit of <Text weight="bold" style={{ color: ORANGE_ACCENT }}>4</Text> members.
          </Text>
        </View>

        {/* What's Limited Card */}
        <View style={[styles.card, isSmallScreen && { padding: 12, marginHorizontal: 12 }]}>
          {/* Compact Lock Banner */}
          <View style={[styles.lockBanner, isSmallScreen && { marginBottom: 12 }]}>
            <View style={styles.lockIconContainer}>
              <Lock size={16} color={ORANGE_ACCENT} />
            </View>
            <View style={styles.lockBannerTextContainer}>
              <Text weight="medium" style={styles.lockBannerTitle}>Some features are paused</Text>
              <Text style={styles.lockBannerSubtitle}>Until the group is within the free limit or a boost is renewed.</Text>
            </View>
          </View>

          <Text weight="bold" style={[styles.sectionHeader, isSmallScreen && { marginBottom: 8 }]}>WHAT'S LIMITED</Text>

          {/* Features List */}
          <FeatureRow 
            icon={<CloudUpload size={16} color="#FFF" />}
            title="New uploads"
            subtitle="Members can't upload new vlogs"
            status="Paused"
            isSmall={isSmallScreen}
          />
          <FeatureRow 
            icon={<MessageSquareText size={16} color="#FFF" />}
            title="Comments & reactions"
            subtitle="Posting and reacting is paused"
            status="Paused"
            isSmall={isSmallScreen}
          />
          <FeatureRow 
            icon={
              <View style={styles.icon4K}>
                <Text weight="bold" style={styles.text4K}>4K</Text>
              </View>
            }
            title="High quality"
            subtitle="Vlogs are stored in standard quality"
            status="Limited"
            isSmall={isSmallScreen}
          />
          <FeatureRow 
            icon={<Users size={16} color="#FFF" />}
            title="AI Highlights"
            subtitle="Highlights won't be generated"
            status="Paused"
            isLast
            isSmall={isSmallScreen}
          />
        </View>

        {/* Members Info Card */}
        <TouchableOpacity 
          activeOpacity={0.7} 
          style={[styles.membersCard, isSmallScreen && { padding: 12, marginHorizontal: 12, marginTop: 8 }]} 
          onPress={() => router.push("/(app)/social")}
        >
          <View style={styles.membersCardIcon}>
            <Users size={18} color="#FFF" />
          </View>
          <View style={styles.membersCardText}>
            <Text weight="medium" style={styles.membersCardTitle}>10 members in this group</Text>
            <Text style={styles.membersCardSubtitle}>To continue using all features, reduce group size or boost.</Text>
          </View>
          <ChevronRight size={18} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>

        {/* Action Buttons & Footer */}
        <View style={[styles.bottomContainer, { paddingBottom: Math.max(16, insets.bottom) }]}>
          <View style={styles.actionsContainer}>
            <TouchableOpacity onPress={() => router.push("/(app)/social")} activeOpacity={0.8} style={styles.primaryButton}>
              <Text weight="bold" style={styles.primaryButtonText}>Manage Group</Text>
              <ChevronRight size={16} color="#000" style={{ marginLeft: 2 }} />
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.8} style={styles.secondaryButton}>
              <Sparkles size={16} color={ORANGE_ACCENT} style={{ marginRight: 6 }} />
              <Text weight="medium" style={styles.secondaryButtonText}>Boost Again</Text>
            </TouchableOpacity>
          </View>

          {/* Footer Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Learn more about group limits</Text>
            <HelpCircle size={12} color="rgba(255,255,255,0.4)" style={{ marginLeft: 4 }} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <>
    <View style={styles.turnContainer}>
      <View style={[styles.turnContent, { paddingTop: insets.top }]}>
        <View style={styles.avatarStage}>
          <Avatar src={vloggerImage} name={vloggerName} size={76} />
        </View>

        <Text weight="bold" style={styles.turnTitle}>{t('record.notYourTurnTitle')}</Text>
        <Text style={styles.turnDescription}>
          {t('record.notYourTurnBody', { name: vloggerName })}
        </Text>
        <TouchableOpacity onPress={() => router.replace('/(app)/today')} activeOpacity={0.86} style={styles.watchButton}>
          <Play size={16} color="#111" fill="#111" />
          <Text weight="bold" style={styles.watchButtonText}>{t('record.watchToday')}</Text>
        </TouchableOpacity>

        <GroupSwitcherPill onPress={() => setIsGroupSelectorOpen(true)} />
      </View>
      <View style={{ height: Math.max(insets.bottom, 16) }} />
    </View>
    <GroupSelectorSheet
      isOpen={isGroupSelectorOpen}
      onClose={() => setIsGroupSelectorOpen(false)}
    />
    </>
  );
}

// Subcomponent for Compact Frozen State Features List

interface FeatureRowProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  status: 'Paused' | 'Limited';
  isLast?: boolean;
  isSmall?: boolean;
}

function FeatureRow({ icon, title, subtitle, status, isLast, isSmall }: FeatureRowProps) {
  const isPaused = status === 'Paused';
  
  return (
    <View style={[
      styles.featureRow, 
      isLast && { marginBottom: 0 },
      isSmall && { marginBottom: 10 }
    ]}>
      <View style={[styles.featureIconBox, isSmall && { width: 32, height: 32, borderRadius: 10, marginRight: 12 }]}>
        {icon}
      </View>
      <View style={styles.featureTextContainer}>
        <Text weight="medium" style={[styles.featureTitle, isSmall && { fontSize: 14 }]}>{title}</Text>
        <Text style={[styles.featureSubtitle, isSmall && { fontSize: 12 }]}>{subtitle}</Text>
      </View>
      <View style={[
        styles.badge, 
        isPaused ? styles.badgePaused : styles.badgeLimited,
        isSmall && { paddingHorizontal: 10, paddingVertical: 4 }
      ]}>
        <Text weight="medium" style={[
          styles.badgeText,
          isPaused ? { color: ORANGE_ACCENT } : { color: '#E5E5E5' },
          isSmall && { fontSize: 11 }
        ]}>
          {status}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  turnContainer: {
    flex: 1,
    backgroundColor: '#101011',
  },
  turnContent: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarStage: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  turnTitle: { color: '#fff', fontSize: 24, letterSpacing: -0.6, textAlign: 'center', marginBottom: 8 },
  turnDescription: { color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 300, marginBottom: 24 },
  watchButton: { width: '100%', height: 48, borderRadius: 16, backgroundColor: ACCENT, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  watchButtonText: { color: '#111', fontSize: 14 },
  container: {
    flex: 1,
    backgroundColor: '#101011',
    justifyContent: 'space-between',
  },
  header: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  dragIndicator: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    marginTop: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  titleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  titleText: {
    color: '#FFF',
    fontSize: 26,
    letterSpacing: -0.5,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitleText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  lockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  lockIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(232, 123, 53, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  lockBannerTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  lockBannerTitle: {
    color: '#FFF',
    fontSize: 14,
    marginBottom: 1,
  },
  lockBannerSubtitle: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 11,
    lineHeight: 14,
  },
  sectionHeader: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 10,
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  featureIconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  icon4K: {
    borderWidth: 1.5,
    borderColor: '#FFF',
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 0.5,
  },
  text4K: {
    color: '#FFF',
    fontSize: 9,
  },
  featureTextContainer: {
    flex: 1,
    paddingRight: 8,
  },
  featureTitle: {
    color: '#FFF',
    fontSize: 14,
    marginBottom: 1,
  },
  featureSubtitle: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgePaused: {
    backgroundColor: 'rgba(232, 123, 53, 0.06)',
    borderColor: 'rgba(232, 123, 53, 0.15)',
  },
  badgeLimited: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  badgeText: {
    fontSize: 11,
  },
  membersCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  membersCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  membersCardText: {
    flex: 1,
    paddingRight: 8,
  },
  membersCardTitle: {
    color: '#FFF',
    fontSize: 14,
    marginBottom: 2,
  },
  membersCardSubtitle: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 11,
    lineHeight: 14,
  },
  bottomContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    marginTop: 12,
  },
  actionsContainer: {
    flexDirection: 'column',
  },
  primaryButton: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 15,
  },
  secondaryButton: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(232, 123, 53, 0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: ORANGE_ACCENT,
    fontSize: 15,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 11,
  },
});

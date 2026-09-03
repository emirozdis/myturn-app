// ./src/components/social/BoostGroupModal.tsx
"use client";

import React from 'react';
import { 
  StyleSheet, 
  View, 
  TouchableOpacity, 
  Modal, 
  Image, 
  Dimensions, 
  Platform, 
  ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Users, Cloud, Sparkles, Zap } from 'lucide-react-native';
import { Text } from '../ui/Text';
import { GlassView } from '../ui/GlassView';
import { ACCENT } from '../../lib/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const serifFont = Platform.OS === 'ios' ? 'Georgia' : 'serif';

interface BoostGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupName: string;
  hasBoosted: boolean;
  userBoostCount: number;
  boostCount: number;
  isBoosting: boolean;
  onAddBoost: () => void;
  onRemoveBoost: () => void;
  onPurchaseBoost: () => void;
}

export function BoostGroupModal({
  isOpen,
  onClose,
  groupName,
  hasBoosted,
  userBoostCount,
  boostCount,
  isBoosting,
  onAddBoost,
  onRemoveBoost,
  onPurchaseBoost,
}: BoostGroupModalProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={isOpen} animationType="slide" transparent={true} statusBarTranslucent>
      <View style={styles.modalBackdrop}>
        {/* Backdrop gradients */}
        <LinearGradient
          colors={['#18181A', '#0B0B0C', '#000000']}
          style={StyleSheet.absoluteFill}
        />

        <View style={[
          styles.container, 
          { 
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: Math.max(insets.bottom, 24) + 8 
          }
        ]}>
          {/* Close trigger anchor safely nested from notches */}
          <TouchableOpacity onPress={onClose} style={[styles.closeButton, { top: Math.max(insets.top, 16) }]}>
            <X size={18} color="#fff" strokeWidth={2.5} />
          </TouchableOpacity>

          {/* 1. HERO HEADER AREA with absolutely layered Orange Crystals */}
          <View style={styles.heroArea}>
            <View style={styles.heroTextContainer}>
              <View style={styles.badgeWrapper}>
                <Sparkles size={10} color={ACCENT} fill={ACCENT} />
                <Text weight="bold" style={styles.badgeText}>PRO FEATURE</Text>
              </View>
              <Text style={[styles.title, { fontFamily: serifFont }]}>Boost Group</Text>
              <Text style={styles.subtitle}>
                Give your group the best of MyTurn.
              </Text>
              <Text style={styles.benefitsOverview}>
                All pro benefits, together.
              </Text>
            </View>

            {/* Enlarged floating crystal artwork */}
            <View style={styles.illustrationContainer} pointerEvents="none">
              <Image 
                source={require('../../../assets/images/subscription/crystal.png')} 
                style={styles.crystalImage}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* Sub-Headline Disclaimer */}
          <View style={styles.introDisclaimerContainer}>
            <Text style={styles.introDisclaimerText}>
              When a group receives <Text weight="bold" style={{ color: '#fff' }}>3 active boosts</Text>, it upgrades to a <Text weight="bold" style={{ color: ACCENT }}>Pro Group</Text>, unlocking premium advantages for all members of that circle (even free users):
            </Text>
          </View>

          {/* 2. UNIFIED LIQUID GLASS ADVANTAGES CARD (Fits screen at once) */}
          <GlassView preset="liquid" style={styles.glassCapsule}>
            <FeatureRow 
              icon={<Users size={16} color={ACCENT} />} 
              title="Expanded Capacity" 
              desc="Member limit increases from 4 to 20 people." 
            />
            <View style={styles.glassDivider} />
            <FeatureRow 
              icon={<Sparkles size={16} color={ACCENT} />} 
              title="Uncapped Quality" 
              desc="Everyone in the group records and streams vlogs in crystal-clear 1080p." 
            />
            <View style={styles.glassDivider} />
            <FeatureRow 
              icon={<Cloud size={16} color={ACCENT} />} 
              title="Extended Archives" 
              desc="All daily vlogs are archived for 6 months (instead of standard 2 weeks)." 
            />
            <View style={styles.glassDivider} />
            <FeatureRow 
              icon={<Zap size={16} color={ACCENT} />} 
              title="Unlimited Posting" 
              desc="The hourly vlog cap is removed, allowing everyone to upload as many parts as they want." 
            />
          </GlassView>

          {/* 3. SOLID FOOTER ACTION BUTTONS */}
          <View style={styles.actionArea}>
            <TouchableOpacity 
              onPress={onAddBoost}
              disabled={isBoosting}
              activeOpacity={0.9}
              style={styles.mainButton}
            >
              {isBoosting ? (
                <ActivityIndicator color="#000" />
              ) : (
                <View style={styles.buttonLabelRow}>
                  <Zap size={15} color="#000" fill="#000" />
                  <Text weight="bold" style={styles.mainButtonText}>
                    {userBoostCount > 0 ? "Add another boost" : "Boost Group"}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {userBoostCount > 0 && (
              <TouchableOpacity onPress={onRemoveBoost} disabled={isBoosting} style={styles.secondaryButton}>
                <Text weight="bold" style={styles.secondaryButtonText}>Remove one boost</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={onPurchaseBoost} disabled={isBoosting} style={styles.purchaseButton}>
              <Text weight="bold" style={styles.purchaseButtonText}>Buy an extra boost</Text>
            </TouchableOpacity>

            <Text style={styles.manageDisclaimer}>
              You can manage your boosted groups in settings.
            </Text>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const FeatureRow = ({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) => (
  <View style={styles.featureRow}>
    <View style={styles.featureIconContainer}>
      {icon}
    </View>
    <View style={styles.featureTextContainer}>
      <Text weight="bold" style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDesc}>{desc}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  heroArea: {
    height: 210,
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 8,
  },
  closeButton: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    right: 0,
  },
  heroTextContainer: {
    maxWidth: '55%',
    zIndex: 5,
  },
  badgeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderColor: 'rgba(224,124,48,0.3)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  badgeText: {
    fontSize: 9,
    fontFamily: 'Satoshi-Bold',
    color: ACCENT,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 34,
    color: '#fff',
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 8,
    lineHeight: 18,
    maxWidth: 220,
  },
  benefitsOverview: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
  },
  illustrationContainer: {
    position: 'absolute',
    top: 5,
    right: -24,
    width: 220,
    height: 240,
    zIndex: 1,
  },
  crystalImage: {
    width: '100%',
    height: '100%',
  },
  glassCapsule: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.01)',
    marginVertical: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  featureIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 13,
    color: '#fff',
  },
  featureDesc: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  glassDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 4,
  },
  introDisclaimerContainer: {
    paddingHorizontal: 4,
    marginVertical: 6,
  },
  introDisclaimerText: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.45)',
    textAlign: 'center',
    fontFamily: 'Satoshi-Medium',
    lineHeight: 18,
  },
  actionArea: {
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  mainButton: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    width: '100%',
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mainButtonText: {
    color: '#000000',
    fontSize: 15,
    fontFamily: 'Satoshi-Bold',
  },
  secondaryButton: {
    marginTop: 10,
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
  },
  purchaseButton: {
    marginTop: 4,
    paddingVertical: 8,
  },
  purchaseButtonText: {
    color: ACCENT,
    fontSize: 13,
  },
  manageDisclaimer: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

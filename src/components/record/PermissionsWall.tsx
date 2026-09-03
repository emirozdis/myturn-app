import React, { useState } from 'react';
import { Linking, ScrollView, View, StyleSheet, TouchableOpacity } from 'react-native';
import { Camera, Check, Mic, Settings, ShieldCheck, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassView } from '../ui/GlassView';
import { Text } from '../ui/Text';
import { ACCENT } from '../../lib/theme';
import { useTranslation } from '../../lib/i18n';

interface PermissionsWallProps {
  cameraGranted: boolean;
  microphoneGranted: boolean;
  canAskAgain: boolean;
  onRequestPermissions: () => Promise<void>;
}

export function PermissionsWall({ cameraGranted, microphoneGranted, canAskAgain, onRequestPermissions }: PermissionsWallProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [isRequesting, setIsRequesting] = useState(false);

  const handlePrimaryAction = async () => {
    if (!canAskAgain) {
      await Linking.openSettings();
      return;
    }

    if (isRequesting) return;
    setIsRequesting(true);
    try {
      await onRequestPermissions();
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1b120d', '#0b0b0b', '#050505']} locations={[0, 0.42, 1]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <View>
          <Text weight="bold" style={styles.eyebrow}>{t('record.setupEyebrow')}</Text>
          <Text weight="bold" style={styles.headerTitle}>{t('record.setupTitle')}</Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={() => router.replace('/(app)/today')}
          style={styles.closeButton}
          hitSlop={10}
        >
          <X size={18} color="rgba(255,255,255,0.72)" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.heroIcon}>
          <View style={styles.heroGlow} />
          <Camera size={42} color="#fff" strokeWidth={1.7} />
          <View style={styles.micBadge}>
            <Mic size={14} color="#111" strokeWidth={2.5} />
          </View>
        </View>

        <Text weight="bold" style={styles.title}>{t('record.permissionTitle')}</Text>
        <Text style={styles.description}>{t('record.permissionBody')}</Text>

        <GlassView preset="deep" style={styles.permissionCard}>
          <PermissionRow
            icon={<Camera size={19} color={cameraGranted ? '#70D89A' : ACCENT} />}
            title={t('record.camera')}
            description={t('record.cameraUse')}
            granted={cameraGranted}
            readyLabel={t('record.ready')}
            neededLabel={t('record.needed')}
          />
          <View style={styles.divider} />
          <PermissionRow
            icon={<Mic size={19} color={microphoneGranted ? '#70D89A' : ACCENT} />}
            title={t('record.microphone')}
            description={t('record.microphoneUse')}
            granted={microphoneGranted}
            readyLabel={t('record.ready')}
            neededLabel={t('record.needed')}
          />
        </GlassView>

        <View style={styles.privacyNote}>
          <ShieldCheck size={16} color="rgba(255,255,255,0.48)" />
          <Text style={styles.privacyText}>{t('record.permissionPrivacy')}</Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
        {!canAskAgain && <Text style={styles.settingsHint}>{t('record.settingsHint')}</Text>}
        <TouchableOpacity
          accessibilityRole="button"
          disabled={isRequesting}
          onPress={handlePrimaryAction}
          activeOpacity={0.86}
          style={[styles.primaryButton, isRequesting && styles.primaryButtonDisabled]}
        >
          {!canAskAgain && <Settings size={17} color="#111" />}
          <Text weight="bold" style={styles.primaryButtonText}>
            {isRequesting
              ? t('record.requesting')
              : canAskAgain
                ? t('record.allowCamera')
                : t('record.openSettings')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/(app)/today')} activeOpacity={0.7} style={styles.secondaryButton}>
          <Text weight="medium" style={styles.secondaryButtonText}>{t('record.notNow')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PermissionRow({ icon, title, description, granted, readyLabel, neededLabel }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  granted: boolean;
  readyLabel: string;
  neededLabel: string;
}) {
  return (
    <View style={styles.permissionRow}>
      <View style={[styles.rowIcon, granted && styles.rowIconGranted]}>{icon}</View>
      <View style={styles.rowCopy}>
        <Text weight="bold" style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <View style={[styles.statusBadge, granted && styles.statusBadgeGranted]}>
        {granted && <Check size={11} color="#70D89A" strokeWidth={3} />}
        <Text weight="bold" style={[styles.statusText, granted && styles.statusTextGranted]}>
          {granted ? readyLabel : neededLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  header: {
    minHeight: 82,
    paddingHorizontal: 22,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  eyebrow: { color: ACCENT, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 4 },
  headerTitle: { color: '#fff', fontSize: 20, letterSpacing: -0.4 },
  closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  scrollArea: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 12 },
  heroIcon: { width: 92, height: 92, borderRadius: 46, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  heroGlow: { position: 'absolute', width: 116, height: 116, borderRadius: 58, backgroundColor: 'rgba(224,124,48,0.08)' },
  micBadge: { position: 'absolute', right: -1, bottom: 3, width: 30, height: 30, borderRadius: 15, backgroundColor: ACCENT, borderWidth: 3, borderColor: '#111', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 25, letterSpacing: -0.6, textAlign: 'center', marginBottom: 9 },
  description: { color: 'rgba(255,255,255,0.58)', fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 330, marginBottom: 24 },
  permissionCard: { width: '100%', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 16 },
  permissionRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center' },
  rowIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(224,124,48,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rowIconGranted: { backgroundColor: 'rgba(112,216,154,0.09)' },
  rowCopy: { flex: 1, paddingRight: 8 },
  rowTitle: { color: '#fff', fontSize: 14, marginBottom: 3 },
  rowDescription: { color: 'rgba(255,255,255,0.42)', fontSize: 11, lineHeight: 15 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.08)', marginLeft: 50 },
  statusBadge: { minHeight: 25, paddingHorizontal: 9, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(224,124,48,0.2)', backgroundColor: 'rgba(224,124,48,0.08)', flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center' },
  statusBadgeGranted: { borderColor: 'rgba(112,216,154,0.18)', backgroundColor: 'rgba(112,216,154,0.07)' },
  statusText: { color: ACCENT, fontSize: 9, letterSpacing: 0.3, textTransform: 'uppercase' },
  statusTextGranted: { color: '#70D89A' },
  privacyNote: { flexDirection: 'row', alignItems: 'center', marginTop: 15, paddingHorizontal: 6, gap: 8 },
  privacyText: { flex: 1, color: 'rgba(255,255,255,0.38)', fontSize: 10.5, lineHeight: 15 },
  footer: { paddingHorizontal: 24, paddingTop: 12 },
  settingsHint: { color: 'rgba(255,255,255,0.48)', fontSize: 11, lineHeight: 16, textAlign: 'center', marginBottom: 10, paddingHorizontal: 10 },
  primaryButton: { height: 52, borderRadius: 18, backgroundColor: ACCENT, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', shadowColor: ACCENT, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 18 },
  primaryButtonDisabled: { opacity: 0.65 },
  primaryButtonText: { color: '#111', fontSize: 14 },
  secondaryButton: { height: 40, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  secondaryButtonText: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
});

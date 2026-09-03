import React, { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Archive, Camera, ChevronLeft, ChevronRight, RotateCcw, Users, Video } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { GUIDE_IDS, requestGuideReplay, resetGuideProgress, type GuideId } from '../../lib/guides';
import { useTranslation } from '../../lib/i18n';
import { lightTap, notifySuccess } from '../../lib/haptics';
import { Text } from '../ui/Text';
import { getGuideDefinition } from './guideContent';
import { GuideTour } from './GuideTour';

type Props = { visible: boolean; onClose: () => void; onLaunchPageGuide?: () => void };

const ICONS = {
  groups: Users,
  today: Video,
  record: Camera,
  archive: Archive,
} as const;

const GUIDE_ROUTES: Partial<Record<GuideId, '/(app)/today' | '/(app)/record' | '/(app)/streaks'>> = {
  today: '/(app)/today',
  record: '/(app)/record',
  archive: '/(app)/streaks',
};

export function GuideCenterModal({ visible, onClose, onLaunchPageGuide }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { locale } = useTranslation();
  const [activeGuide, setActiveGuide] = useState<GuideId | null>(null);
  const isTr = locale === 'tr';

  const close = () => {
    setActiveGuide(null);
    onClose();
  };

  const launchGuide = (id: GuideId) => {
    lightTap();
    if (id === 'groups') {
      setActiveGuide(id);
      return;
    }

    const route = GUIDE_ROUTES[id];
    if (!route) return;
    requestGuideReplay(id);
    setActiveGuide(null);
    onClose();
    onLaunchPageGuide?.();
    setTimeout(() => router.push(route), 280);
  };

  const reset = () => {
    Alert.alert(
      isTr ? 'Rehberleri sıfırla' : 'Reset guides',
      isTr ? 'Rehberler ilgili ekranlarda yeniden gösterilecek.' : 'Guides will appear again on their screens.',
      [
        { text: isTr ? 'Vazgeç' : 'Cancel', style: 'cancel' },
        {
          text: isTr ? 'Sıfırla' : 'Reset',
          onPress: () => {
            resetGuideProgress();
            notifySuccess();
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} statusBarTranslucent>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16), height: Math.max(insets.top, 16) + 58 }]}>
          <TouchableOpacity onPress={close} style={styles.headerButton} accessibilityRole="button">
            <ChevronLeft size={23} color="#fff" />
          </TouchableOpacity>
          <Text weight="bold" style={styles.headerTitle}>{isTr ? 'MyTurn Rehberi' : 'MyTurn Guide'}</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) + 24 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.list}>
            {GUIDE_IDS.map((id) => {
              const definition = getGuideDefinition(id, locale);
              const Icon = ICONS[id];
              return (
                <TouchableOpacity key={id} onPress={() => launchGuide(id)} style={styles.card} activeOpacity={0.78} accessibilityRole="button">
                  <View style={styles.iconCircle}><Icon size={22} color="#fff" /></View>
                  <View style={styles.cardCopy}>
                    <Text weight="bold" style={styles.cardTitle}>{definition.title}</Text>
                    <Text style={styles.cardSummary} numberOfLines={2}>{definition.summary}</Text>
                  </View>
                  <ChevronRight size={18} color="rgba(255,255,255,0.28)" />
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity onPress={reset} style={styles.resetButton} activeOpacity={0.8} accessibilityRole="button">
            <RotateCcw size={15} color="rgba(255,255,255,0.58)" />
            <Text weight="bold" style={styles.resetText}>{isTr ? 'Rehberleri sıfırla' : 'Reset guides'}</Text>
          </TouchableOpacity>

        </ScrollView>

        {activeGuide === 'groups' && <GuideTour guideId="groups" visible replay onClose={() => setActiveGuide(null)} />}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B0C' },
  header: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)' },
  headerButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, textAlign: 'center', paddingBottom: 10 },
  content: { padding: 16 },
  list: { gap: 9 },
  card: { minHeight: 88, borderRadius: 18, backgroundColor: '#141416', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.18, shadowRadius: 11 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#222225', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  cardCopy: { flex: 1 },
  cardTitle: { color: '#fff', fontSize: 14, marginBottom: 3 },
  cardSummary: { color: 'rgba(255,255,255,0.48)', fontSize: 10.5, lineHeight: 14 },
  resetButton: { alignSelf: 'center', marginTop: 16, minHeight: 38, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  resetText: { color: 'rgba(255,255,255,0.62)', fontSize: 10.5 },
});

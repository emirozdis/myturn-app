import React from 'react';
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../ui/Text';
import { ACCENT } from '../../lib/theme';

export interface AgreementDocument {
  slug: string;
  version: string;
  title: string;
  effectiveAt?: string;
  content: string;
  contentHash: string;
  acceptedAt?: string;
}

interface AgreementModalProps {
  visible: boolean;
  agreement: AgreementDocument | null;
  onClose: () => void;
  onAccept?: () => void;
}

export function AgreementModal({ visible, agreement, onClose, onAccept }: AgreementModalProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel={`Close ${agreement?.title || 'legal agreement'}`}
          >
            <ChevronLeft size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text weight="bold" style={styles.title} accessibilityRole="header">{agreement?.title || 'Legal agreement'}</Text>
            {agreement && <Text style={styles.version}>Version {agreement.version}</Text>}
          </View>
          <View style={styles.backButton} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {agreement?.acceptedAt && (
            <View style={styles.acceptanceCard}>
              <Text weight="bold" style={styles.acceptanceTitle}>Accepted</Text>
              <Text style={styles.meta}>{new Date(agreement.acceptedAt).toLocaleString()}</Text>
              <Text style={styles.hash}>Document SHA-256: {agreement.contentHash}</Text>
            </View>
          )}
          {agreement?.effectiveAt && (
            <Text style={styles.meta}>Effective {formatEffectiveDate(agreement.effectiveAt)}</Text>
          )}
          <Text style={styles.legalText}>{agreement?.content || 'The agreement could not be loaded.'}</Text>
        </ScrollView>

        {onAccept && agreement && (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity style={styles.acceptButton} onPress={onAccept} activeOpacity={0.85}>
              <Text weight="bold" style={styles.acceptButtonText}>Okudum ve Kabul Ediyorum</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

function formatEffectiveDate(value: string) {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!dateOnly) return new Date(value).toLocaleDateString();

  const [, year, month, day] = dateOnly;
  return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B0C' },
  header: { minHeight: 72, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  title: { color: '#fff', fontSize: 15, textAlign: 'center' },
  version: { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 },
  content: { padding: 20, paddingBottom: 40 },
  legalText: { color: 'rgba(255,255,255,0.78)', fontSize: 13, lineHeight: 21, marginTop: 12 },
  meta: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 4 },
  acceptanceCard: { backgroundColor: 'rgba(245,130,32,0.1)', borderColor: 'rgba(245,130,32,0.25)', borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 16 },
  acceptanceTitle: { color: ACCENT, fontSize: 13, marginBottom: 4 },
  hash: { color: 'rgba(255,255,255,0.35)', fontSize: 9, marginTop: 5 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', backgroundColor: '#0B0B0C' },
  acceptButton: { height: 52, borderRadius: 16, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  acceptButtonText: { color: '#000', fontSize: 14 },
});

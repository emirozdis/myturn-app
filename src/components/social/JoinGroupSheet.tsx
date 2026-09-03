import React, { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ArrowLeft, Camera, Keyboard, ScanLine } from 'lucide-react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { GlassView } from '../ui/GlassView';
import { Text } from '../ui/Text';
import { ACCENT } from '../../lib/theme';
import { ActionProgress } from '../ui/ActionProgress';
import { extractInviteCodeFromQr, normalizeInviteCodeInput } from '../../lib/groupInvite';
import { useTranslation } from '../../lib/i18n';
import { lightTap, selectionTick } from '../../lib/haptics';

interface JoinGroupSheetProps {
  isOpen: boolean;
  onClose: () => void;
  joinCodeInput: string;
  setJoinCodeInput: (val: string) => void;
  isJoining: boolean;
  handleJoinWithCode: (codeOverride?: string) => void;
}

export function JoinGroupSheet({
  isOpen,
  onClose,
  joinCodeInput,
  setJoinCodeInput,
  isJoining,
  handleJoinWithCode,
}: JoinGroupSheetProps) {
  const { t } = useTranslation();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const scanLocked = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      setScannerOpen(false);
      setScanError(null);
      scanLocked.current = false;
    }
  }, [isOpen]);

  const openScanner = async () => {
    lightTap();
    scanLocked.current = false;
    setScanError(null);
    if (!cameraPermission?.granted && cameraPermission?.canAskAgain !== false) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        setScannerOpen(true);
        return;
      }
    }
    setScannerOpen(true);
  };

  const handleBarcode = ({ data }: { data: string }) => {
    if (scanLocked.current || isJoining) return;
    scanLocked.current = true;
    const code = extractInviteCodeFromQr(data);
    if (!code) {
      setScanError(t('groupInvite.invalidQr'));
      setTimeout(() => {
        scanLocked.current = false;
        setScanError(null);
      }, 1400);
      return;
    }

    selectionTick();
    setJoinCodeInput(code);
    setScannerOpen(false);
    handleJoinWithCode(code);
  };

  const closeScanner = () => {
    lightTap();
    scanLocked.current = false;
    setScanError(null);
    setScannerOpen(false);
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} heightPercent={scannerOpen ? 0.82 : 0.62}>
      <View style={styles.sheetContent}>
        {scannerOpen ? (
          <View style={styles.scannerContent}>
            <View style={styles.scannerHeader}>
              <TouchableOpacity onPress={closeScanner} style={styles.iconButton} activeOpacity={0.75}>
                <ArrowLeft size={18} color="#fff" />
              </TouchableOpacity>
              <View style={styles.scannerHeaderText}>
                <Text weight="bold" style={styles.title}>{t('groupInvite.scan')}</Text>
                <Text style={styles.subtitle}>{t('groupInvite.scanHint')}</Text>
              </View>
            </View>

            {cameraPermission?.granted ? (
              <View style={styles.cameraFrame}>
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={handleBarcode}
                />
                <View pointerEvents="none" style={styles.cameraShade}>
                  <View style={styles.scanTarget}>
                    <View style={[styles.corner, styles.cornerTopLeft]} />
                    <View style={[styles.corner, styles.cornerTopRight]} />
                    <View style={[styles.corner, styles.cornerBottomLeft]} />
                    <View style={[styles.corner, styles.cornerBottomRight]} />
                    <View style={styles.scanLine} />
                  </View>
                </View>
                {scanError ? (
                  <View style={styles.scanErrorPill}>
                    <Text weight="bold" style={styles.scanErrorText}>{scanError}</Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <GlassView preset="deep" style={styles.permissionCard}>
                <View style={styles.permissionIcon}><Camera size={22} color={ACCENT} /></View>
                <Text weight="bold" style={styles.permissionTitle}>{t('groupInvite.cameraTitle')}</Text>
                <Text style={styles.permissionBody}>{t('groupInvite.cameraBody')}</Text>
                <TouchableOpacity
                  onPress={cameraPermission?.canAskAgain === false ? () => Linking.openSettings() : openScanner}
                  style={styles.primaryBtn}
                  activeOpacity={0.85}
                >
                  <Text weight="bold" style={styles.primaryLabel}>
                    {t(cameraPermission?.canAskAgain === false ? 'groupInvite.openSettings' : 'groupInvite.allowCamera')}
                  </Text>
                </TouchableOpacity>
              </GlassView>
            )}

            <TouchableOpacity onPress={closeScanner} style={styles.secondaryBtn} activeOpacity={0.8}>
              <Keyboard size={15} color="rgba(255,255,255,0.75)" />
              <Text weight="bold" style={styles.secondaryLabel}>{t('groupInvite.backToCode')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <View style={styles.titleIcon}>
              <ScanLine size={20} color={ACCENT} />
            </View>
            <Text weight="bold" style={styles.title}>{t('groupInvite.joinTitle')}</Text>
            <Text style={styles.subtitle}>{t('groupInvite.joinBody')}</Text>

            <View style={styles.formGroup}>
              <Text weight="bold" style={styles.fieldLabel}>{t('groupInvite.inviteCode')}</Text>
              <GlassView preset="deep" style={styles.inputGlassContainer} interactive>
                <TextInput
                  value={joinCodeInput}
                  onChangeText={(value) => setJoinCodeInput(normalizeInviteCodeInput(value))}
                  style={styles.textInputRaw}
                  placeholder={t('groupInvite.codePlaceholder')}
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={13}
                  returnKeyType="join"
                  onSubmitEditing={() => handleJoinWithCode()}
                />
              </GlassView>
            </View>

            <TouchableOpacity
              onPress={() => handleJoinWithCode()}
              disabled={isJoining || !joinCodeInput.trim()}
              style={[styles.primaryBtn, (!joinCodeInput.trim() || isJoining) && styles.disabledBtn]}
              activeOpacity={0.85}
            >
              {isJoining ? (
                <ActionProgress label={t('groupInvite.joining')} color="#000" />
              ) : (
                <Text weight="bold" style={styles.primaryLabel}>{t('groupInvite.join')}</Text>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.orLabel}>OR</Text>
              <View style={styles.divider} />
            </View>

            <TouchableOpacity onPress={openScanner} style={styles.scanButton} activeOpacity={0.82}>
              <View style={styles.scanButtonIcon}><ScanLine size={18} color={ACCENT} /></View>
              <View style={styles.scanButtonText}>
                <Text weight="bold" style={styles.scanButtonTitle}>{t('groupInvite.scan')}</Text>
                <Text style={styles.scanButtonHint}>{t('groupInvite.scanHint')}</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetContent: { flex: 1, paddingHorizontal: 24, paddingTop: 10 },
  titleIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(224,124,48,0.12)', marginBottom: 18 },
  title: { color: '#fff', fontSize: 21, letterSpacing: -0.35 },
  subtitle: { color: 'rgba(255,255,255,0.48)', fontSize: 12, lineHeight: 18, marginTop: 6 },
  formGroup: { marginTop: 26, marginBottom: 14 },
  fieldLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.1, marginBottom: 8 },
  inputGlassContainer: { width: '100%', height: 58, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  textInputRaw: { flex: 1, color: '#fff', fontSize: 21, fontWeight: '700', letterSpacing: 4, paddingHorizontal: 18, textAlign: 'center' },
  primaryBtn: { backgroundColor: ACCENT, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  disabledBtn: { opacity: 0.38 },
  primaryLabel: { color: '#000', fontSize: 13 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  divider: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  orLabel: { color: 'rgba(255,255,255,0.25)', fontSize: 9, marginHorizontal: 12, letterSpacing: 1.2 },
  scanButton: { minHeight: 72, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.035)', flexDirection: 'row', alignItems: 'center', padding: 14 },
  scanButtonIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(224,124,48,0.1)' },
  scanButtonText: { flex: 1, marginLeft: 13 },
  scanButtonTitle: { color: '#fff', fontSize: 13 },
  scanButtonHint: { color: 'rgba(255,255,255,0.38)', fontSize: 10, lineHeight: 14, marginTop: 3 },
  scannerContent: { flex: 1 },
  scannerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  scannerHeaderText: { flex: 1, marginLeft: 12 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  cameraFrame: { flex: 1, minHeight: 350, borderRadius: 28, overflow: 'hidden', backgroundColor: '#111' },
  cameraShade: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.18)' },
  scanTarget: { width: 220, height: 220, position: 'relative' },
  corner: { position: 'absolute', width: 38, height: 38, borderColor: ACCENT },
  cornerTopLeft: { left: 0, top: 0, borderLeftWidth: 3, borderTopWidth: 3, borderTopLeftRadius: 16 },
  cornerTopRight: { right: 0, top: 0, borderRightWidth: 3, borderTopWidth: 3, borderTopRightRadius: 16 },
  cornerBottomLeft: { left: 0, bottom: 0, borderLeftWidth: 3, borderBottomWidth: 3, borderBottomLeftRadius: 16 },
  cornerBottomRight: { right: 0, bottom: 0, borderRightWidth: 3, borderBottomWidth: 3, borderBottomRightRadius: 16 },
  scanLine: { position: 'absolute', left: 18, right: 18, top: '50%', height: 1.5, backgroundColor: ACCENT, shadowColor: ACCENT, shadowOpacity: 0.9, shadowRadius: 7 },
  scanErrorPill: { position: 'absolute', left: 18, right: 18, bottom: 18, backgroundColor: 'rgba(15,15,15,0.9)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, alignItems: 'center' },
  scanErrorText: { color: '#fff', fontSize: 11, textAlign: 'center' },
  permissionCard: { flex: 1, minHeight: 350, borderRadius: 28, padding: 24, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  permissionIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(224,124,48,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  permissionTitle: { color: '#fff', fontSize: 17 },
  permissionBody: { color: 'rgba(255,255,255,0.48)', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 8, marginBottom: 22 },
  secondaryBtn: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 },
  secondaryLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
});

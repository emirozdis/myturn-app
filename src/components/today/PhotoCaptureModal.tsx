import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { RefreshCw, Sparkles, X, Zap, ZapOff } from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Text } from '../ui/Text';
import { ACCENT } from '../../lib/theme';
import { GlassView } from '../ui/GlassView';
import { heavyTap, lightTap, notifySuccess } from '../../lib/haptics';

const { width } = Dimensions.get('window');

export function PhotoCaptureModal({
  isOpen,
  onClose,
  onUpload,
  uploading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (uri: string) => Promise<void>;
  uploading: boolean;
}) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const [facingMode, setFacingMode] = useState<'front' | 'back'>('front');
  const [flashActive, setFlashActive] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (!cameraPermission?.granted) requestCameraPermission();
    setPreviewUri(null);
    setIsCapturing(false);
  }, [isOpen]);

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) return;
    heavyTap();
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      setPreviewUri(photo.uri);
    } catch (error) {
      console.error('Photo capture failed:', error);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleSend = async () => {
    if (!previewUri) return;
    lightTap();
    try {
      await onUpload(previewUri);
      notifySuccess();
      onClose();
    } catch {
      Alert.alert('Hata', 'Yanıt gönderilemedi. Lütfen tekrar deneyin.');
    }
  };

  if (!isOpen) return null;

  return (
    <Modal visible={isOpen} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.cameraContainer}>
        {cameraPermission?.granted ? (
          previewUri ? (
            <Image
              source={{ uri: previewUri }}
              style={[StyleSheet.absoluteFill, { transform: [{ scaleX: facingMode === 'front' ? -1 : 1 }] }]}
              resizeMode="cover"
            />
          ) : (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing={facingMode}
              mode="picture"
              enableTorch={flashActive}
            />
          )
        ) : (
          <View style={styles.permissionLoader}>
            <ActivityIndicator color="#fff" />
          </View>
        )}

        <View style={styles.cameraHeader}>
          {!previewUri ? (
            <TouchableOpacity onPress={onClose} style={styles.cameraClose} activeOpacity={0.7}>
              <X size={18} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setPreviewUri(null)} disabled={uploading} style={styles.retakeBtn} activeOpacity={0.7}>
              <Text weight="bold" style={styles.retakeText}>Tekrar Çek</Text>
            </TouchableOpacity>
          )}

          {previewUri && (
            <GlassView style={styles.hdrLabel} preset="specular">
              <Sparkles size={11} color="#e07c30" />
              <Text weight="bold" style={styles.hdrText}>FOTOĞRAF YANITI</Text>
            </GlassView>
          )}

          {!previewUri ? (
            <TouchableOpacity onPress={() => setFlashActive((active) => !active)} style={styles.cameraClose} activeOpacity={0.7}>
              {flashActive
                ? <Zap size={16} color="#fbbf24" fill="#fbbf24" />
                : <ZapOff size={16} color="rgba(255,255,255,0.7)" />}
            </TouchableOpacity>
          ) : (
            <View style={{ width: 36 }} />
          )}
        </View>

        <View style={styles.cameraFooter}>
          {!previewUri ? (
            <View style={styles.dockRow}>
              <TouchableOpacity
                onPress={() => setFacingMode((facing) => facing === 'front' ? 'back' : 'front')}
                style={styles.toolBtn}
                activeOpacity={0.7}
              >
                <RefreshCw size={18} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity onPress={handleCapture} disabled={isCapturing} style={styles.shutterBtn} activeOpacity={0.9}>
                {isCapturing
                  ? <ActivityIndicator color="#000" />
                  : <View style={styles.shutterInner} />}
              </TouchableOpacity>

              <View style={{ width: 44 }} />
            </View>
          ) : (
            <TouchableOpacity onPress={handleSend} disabled={uploading} style={styles.sendBtn} activeOpacity={0.9}>
              {uploading
                ? <ActivityIndicator size="small" color="#000" />
                : <Text weight="bold" style={styles.sendText}>Yanıtı Gönder</Text>}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  permissionLoader: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
  cameraHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', position: 'absolute', top: 54, left: 16, right: 16, zIndex: 30 },
  cameraClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  hdrLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  hdrText: { fontSize: 9, letterSpacing: 1, color: '#fff' },
  retakeBtn: { backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  retakeText: { fontSize: 11, color: '#fff' },
  cameraFooter: { position: 'absolute', bottom: 48, left: 0, right: 0, alignItems: 'center', zIndex: 30 },
  dockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '60%' },
  toolBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  shutterBtn: { width: 76, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },
  sendBtn: { backgroundColor: ACCENT, width: width - 64, paddingVertical: 14, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sendText: { fontSize: 14, color: '#000' },
});

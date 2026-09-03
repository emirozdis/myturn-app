import React from 'react';
import { View, StyleSheet, TextInput, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Plus, Sparkles, Copy, Camera, Users } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { BottomSheet } from '../ui/BottomSheet';
import { GlassView } from '../ui/GlassView';
import { Text } from '../ui/Text';
import { Avatar } from '../ui/Avatar';
import { ACCENT } from '../../lib/theme';
import { notifySuccess, selectionTick, lightTap } from '../../lib/haptics';
import { ActionProgress } from '../ui/ActionProgress';
import { GroupInviteQr } from '../group/GroupInviteQr';
import { useTranslation } from '../../lib/i18n';

interface CreateGroupSheetProps {
  isOpen: boolean;
  onClose: () => void;
  newGroupName: string;
  setNewGroupName: (val: string) => void;
  newGroupImage: string | null;
  setNewGroupImage: (val: string | null) => void;
  isCreatingGroup: boolean;
  generatedInviteCode: string | null;
  handleCreateGroupAction: () => void;
  handleCopyCode: (code: string) => void;
}

export function CreateGroupSheet({
  isOpen,
  onClose,
  newGroupName,
  setNewGroupName,
  newGroupImage,
  setNewGroupImage,
  isCreatingGroup,
  generatedInviteCode,
  handleCreateGroupAction,
  handleCopyCode
}: CreateGroupSheetProps) {
  const { t } = useTranslation();

  const handlePickImage = async () => {
    lightTap();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets[0]) {
      setNewGroupImage(result.assets[0].uri);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} heightPercent={generatedInviteCode ? 0.88 : 0.75}>
      <View style={styles.sheetContent}>
        {generatedInviteCode ? (
          <View className="flex-1 items-center justify-center text-center pb-12">
            <Sparkles size={48} className="text-[#e07c30] mb-6" />
            <Text weight="bold" className="text-white text-2xl mb-2">Grup Oluşturuldu! 🎉</Text>
            <Text className="text-white/50 text-[13px] text-center max-w-[280px] mb-8 leading-relaxed">
              Arkadaşlarınızı davet etmek için bu kodu paylaşın. Katıldıklarında günlük vlog'lamaya başlayabilirsiniz!
            </Text>
            
            <GlassView preset="deep" style={styles.generatedCodeCard}>
              <View style={styles.groupAvatarBoxLarge}>
                <Avatar src={newGroupImage} name={newGroupName} size={72} ring={false} />
              </View>
              <Text className="text-white/50 text-[10px] uppercase tracking-widest font-bold mt-4">Davet Kodu</Text>
              <Text weight="bold" className="text-white text-[28px] tracking-widest font-mono mt-1 mb-4 select-text">{generatedInviteCode}</Text>
              <GroupInviteQr inviteCode={generatedInviteCode} size={118} />
              <Text style={styles.qrHint}>{t('groupInvite.qrBody')}</Text>
              <TouchableOpacity onPress={() => { lightTap(); handleCopyCode(generatedInviteCode); }} style={styles.primaryBtn} className="w-full flex-row gap-2">
                <Copy size={14} color="#000" />
                <Text weight="bold" className="text-black text-[13px]">Kodu Kopyala</Text>
              </TouchableOpacity>
            </GlassView>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
            <Text weight="bold" className="text-white text-xl mb-1">Yeni Grup</Text>
            <Text className="text-white/50 text-xs mb-8">Küçük ve özel çemberini kur.</Text>

            <View style={styles.avatarSection}>
              <TouchableOpacity onPress={handlePickImage} activeOpacity={0.8} style={styles.avatarPickerBox}>
                {newGroupImage ? (
                  <Image source={{ uri: newGroupImage }} style={[StyleSheet.absoluteFill, { borderRadius: 40 }]} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Camera size={24} color="rgba(255,255,255,0.4)" />
                  </View>
                )}
                <View style={styles.cameraBadge}>
                  <Plus size={12} color="#000" strokeWidth={3} />
                </View>
              </TouchableOpacity>
              <Text className="text-white/40 text-[10px] uppercase tracking-widest font-bold mt-3">Grup Fotoğrafı Ekle</Text>
            </View>

            <View style={styles.formGroup}>
              <Text weight="bold" className="text-white/50 text-[10px] uppercase tracking-wider mb-2">Grup Adı</Text>
              <GlassView preset="deep" style={styles.inputGlassContainer} interactive>
                <TextInput 
                  value={newGroupName} 
                  onChangeText={setNewGroupName} 
                  style={styles.textInputRaw} 
                  placeholder="örn. Hafta Sonu Ekibi" 
                  placeholderTextColor="rgba(255,255,255,0.3)" 
                />
              </GlassView>
            </View>

            <TouchableOpacity 
              onPress={handleCreateGroupAction} 
              disabled={isCreatingGroup || !newGroupName.trim()} 
              style={[styles.primaryBtn, { marginTop: 16, height: 48, borderRadius: 16 }]}
              activeOpacity={0.85}
            >
              {isCreatingGroup ? (
                <ActionProgress label="Grup kuruluyor" color="#000" />
              ) : (
                <>
                  <Plus size={18} color="#000" strokeWidth={2.5} />
                  <Text weight="bold" className="text-black text-[14px] ml-1.5">Grubu Oluştur</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetContent: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarPickerBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#111',
  },
  formGroup: { marginBottom: 24 },
  inputGlassContainer: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  textInputRaw: { 
    flex: 1,
    color: '#fff', 
    fontSize: 14, 
    paddingHorizontal: 16 
  },
  primaryBtn: {
    backgroundColor: ACCENT,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  generatedCodeCard: { 
    borderRadius: 28, 
    padding: 28, 
    width: '100%',
    maxWidth: 300,
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.08)',
  },
  groupAvatarBoxLarge: { 
    width: 72, 
    height: 72, 
    borderRadius: 36, 
    backgroundColor: 'rgba(255,255,255,0.08)', 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 1.5, 
    borderColor: 'rgba(255,255,255,0.2)' 
  },
  qrHint: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
});

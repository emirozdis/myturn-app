"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AtSign, Camera, Check, MapPin, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

import { ACCENT } from '../../lib/theme';
import { apiClient } from '../../lib/apiClient';
import { lightTap, notifySuccess } from '../../lib/haptics';
import { useProfileStore } from '../../store/useProfileStore';
import { ActionProgress } from '../ui/ActionProgress';
import { Text } from '../ui/Text';

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const BIO_LIMIT = 140;
type UsernameAvailability = 'idle' | 'checking' | 'available' | 'taken' | 'error';

type ProfileSetupFormProps = {
  initialName: string;
  onProfileSaved: () => void;
  onComplete: () => void;
};

const sanitizeUsername = (value: string) =>
  value.toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9_]/g, '').slice(0, 20);

const generateSuggestedUsername = (name: string) => {
  const transliteratedName = name
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

  if (!transliteratedName) return 'myturn_user';

  const trimmedSuggestion = transliteratedName.slice(0, 20).replace(/_+$/g, '');
  if (trimmedSuggestion.length >= 3) return trimmedSuggestion;

  return `${trimmedSuggestion}_myturn`.slice(0, 20);
};

const getInitials = (name: string) => {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return initials || 'M';
};

export function ProfileSetupForm({ initialName, onProfileSaved, onComplete }: ProfileSetupFormProps) {
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState(() => generateSuggestedUsername(initialName));
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [usernameAvailability, setUsernameAvailability] = useState<UsernameAvailability>('idle');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usernameIsValid = USERNAME_PATTERN.test(username);
  const usernameIsAvailable = usernameAvailability === 'available';
  const initials = useMemo(() => getInitials(initialName), [initialName]);

  useEffect(() => {
    if (!usernameIsValid) {
      setUsernameAvailability('idle');
      return;
    }

    let active = true;
    setUsernameAvailability('checking');
    const timeout = setTimeout(async () => {
      const result = await apiClient.request<{ available?: boolean }>(
        'profile/username-availability',
        [username],
      );
      if (!active) return;

      if (!result.success) {
        setUsernameAvailability('error');
      } else {
        setUsernameAvailability(result.available ? 'available' : 'taken');
      }
    }, 800);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [username, usernameIsValid]);

  const pickAvatar = async () => {
    lightTap();
    setError(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Galeri izni gerekli',
        'Profil fotoğrafı seçmek için fotoğraf arşivine erişim izni vermelisin.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const submitProfile = async () => {
    setUsernameTouched(true);
    setError(null);

    if (!usernameIsValid || !usernameIsAvailable || saving) return;

    setSaving(true);
    const profileResult: any = await apiClient.request<any>('profile/update', [{
      name: initialName.trim(),
      handle: username,
      bio: bio.trim(),
      location: location.trim(),
    }]);

    if (!profileResult.success || !profileResult.user) {
      const usernameTaken = profileResult.error?.toLowerCase().includes('already taken');
      setError(
        usernameTaken
          ? 'Bu kullanıcı adı alınmış. Sana ait başka bir tane deneyebilirsin.'
          : profileResult.error || 'Profilin kaydedilemedi. Lütfen tekrar dene.'
      );
      setSaving(false);
      return;
    }

    useProfileStore.setState((state) => ({
      user: { ...state.user, ...profileResult.user },
    }));

    // The mandatory part is now durable on the server. Clear the local gate
    // before the optional upload so an interruption cannot ask for a second username.
    onProfileSaved();

    if (avatarUri) {
      try {
        await useProfileStore.getState().uploadAvatar(avatarUri);
      } catch {
        setSaving(false);
        Alert.alert(
          'Profilin hazır',
          'Bilgilerin kaydedildi, ancak fotoğrafın yüklenemedi. Profilinden daha sonra tekrar deneyebilirsin.',
          [{ text: 'Devam et', onPress: onComplete }]
        );
        return;
      }
    }

    notifySuccess();
    onComplete();
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, 20) + 24,
            paddingBottom: Math.max(insets.bottom, 20) + 24,
          },
        ]}
      >
        <View style={styles.eyebrowRow}>
          <View style={styles.stepBadge}>
            <Check size={12} color="#000" strokeWidth={3} />
          </View>
          <Text style={styles.eyebrowText}>HESABIN HAZIR · SON BİR ADIM</Text>
        </View>

        <Text style={styles.title}>Seni biraz tanıyalım</Text>
        <Text style={styles.subtitle}>
          Kullanıcı adın gruplarda ve arkadaş aramalarında görünür. Diğer bilgileri şimdi ekleyebilir veya daha sonra tamamlayabilirsin.
        </Text>

        <View style={styles.avatarSection}>
          <TouchableOpacity
            onPress={pickAvatar}
            activeOpacity={0.85}
            style={styles.avatarButton}
            accessibilityRole="button"
            accessibilityLabel="Profil fotoğrafı seç"
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            <View style={styles.cameraBadge}>
              <Camera size={16} color="#000" strokeWidth={2.5} />
            </View>
            {saving && avatarUri && (
              <View style={styles.avatarLoadingOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.avatarCopy}>
            <Text style={styles.avatarTitle}>Profil fotoğrafı</Text>
            <Text style={styles.optionalText}>İsteğe bağlı · önerilir</Text>
            <View style={styles.avatarActions}>
              <TouchableOpacity onPress={pickAvatar} activeOpacity={0.7}>
                <Text style={styles.avatarActionText}>{avatarUri ? 'Değiştir' : 'Fotoğraf ekle'}</Text>
              </TouchableOpacity>
              {avatarUri && (
                <TouchableOpacity
                  onPress={() => { lightTap(); setAvatarUri(null); }}
                  activeOpacity={0.7}
                  style={styles.removeAvatarButton}
                  accessibilityLabel="Seçilen fotoğrafı kaldır"
                >
                  <X size={14} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.fieldHeader}>
          <Text style={styles.fieldLabel}>Kullanıcı adı</Text>
          <Text style={styles.requiredLabel}>ZORUNLU</Text>
        </View>
        <View style={[
          styles.inputContainer,
          usernameTouched && !usernameIsValid && styles.inputContainerError,
        ]}>
          <AtSign size={18} color={username ? ACCENT : 'rgba(255,255,255,0.35)'} />
          <TextInput
            value={username}
            onChangeText={(value) => {
              const sanitizedUsername = sanitizeUsername(value);
              setUsername(sanitizedUsername);
              setUsernameAvailability(USERNAME_PATTERN.test(sanitizedUsername) ? 'checking' : 'idle');
              setError(null);
            }}
            onBlur={() => setUsernameTouched(true)}
            placeholder="kullaniciadi"
            placeholderTextColor="rgba(255,255,255,0.28)"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            returnKeyType="next"
            style={styles.input}
            accessibilityLabel="Kullanıcı adı"
          />
          {usernameAvailability === 'checking' && <ActivityIndicator size="small" color={ACCENT} />}
          {usernameIsAvailable && <Check size={17} color={ACCENT} strokeWidth={2.5} />}
        </View>
        <Text style={[
          styles.fieldHint,
          ((usernameTouched && !usernameIsValid) || usernameAvailability === 'taken' || usernameAvailability === 'error') && styles.fieldHintError,
        ]}>
          {usernameAvailability === 'taken'
            ? 'Bu kullanıcı adı alınmış. Başka bir tane deneyebilirsin.'
            : usernameAvailability === 'checking'
              ? 'Kullanıcı adı kontrol ediliyor...'
              : usernameAvailability === 'available'
                ? 'Bu kullanıcı adı kullanılabilir.'
                : usernameAvailability === 'error'
                  ? 'Kullanıcı adı kontrol edilemedi. Tekrar denemek için adı değiştir.'
                  : usernameTouched && !usernameIsValid
            ? '3–20 karakter kullan: küçük harf, rakam veya alt çizgi.'
            : 'Benzersiz olmalı. Küçük harf, rakam ve alt çizgi kullanabilirsin.'}
        </Text>

        <View style={[styles.fieldHeader, styles.spacedFieldHeader]}>
          <Text style={styles.fieldLabel}>Biyografi</Text>
          <Text style={styles.optionalLabel}>İSTEĞE BAĞLI</Text>
        </View>
        <View style={[styles.inputContainer, styles.bioInputContainer]}>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Seni sen yapan küçük bir şey paylaş..."
            placeholderTextColor="rgba(255,255,255,0.28)"
            multiline
            maxLength={BIO_LIMIT}
            textAlignVertical="top"
            style={[styles.input, styles.bioInput]}
            accessibilityLabel="Biyografi"
          />
        </View>
        <Text style={styles.characterCount}>{bio.length}/{BIO_LIMIT}</Text>

        <View style={[styles.fieldHeader, styles.spacedFieldHeader]}>
          <Text style={styles.fieldLabel}>Konum</Text>
          <Text style={styles.optionalLabel}>İSTEĞE BAĞLI</Text>
        </View>
        <View style={styles.inputContainer}>
          <MapPin size={18} color="rgba(255,255,255,0.35)" />
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="Şehir veya bölge"
            placeholderTextColor="rgba(255,255,255,0.28)"
            maxLength={40}
            returnKeyType="done"
            style={styles.input}
            accessibilityLabel="Konum"
          />
        </View>

        <TouchableOpacity
          onPress={submitProfile}
          disabled={!usernameIsValid || !usernameIsAvailable || saving}
          activeOpacity={0.85}
          style={[styles.submitButton, (!usernameIsValid || !usernameIsAvailable || saving) && styles.submitButtonDisabled]}
          accessibilityRole="button"
        >
          {saving ? (
            <ActionProgress label="Profilin hazırlanıyor" color="#000" />
          ) : (
            <Text style={styles.submitButtonText}>MyTurn'a devam et</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 28,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  eyebrowText: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 11,
    letterSpacing: 1.1,
    fontFamily: 'Satoshi-Bold',
  },
  title: {
    color: '#fff',
    fontSize: 34,
    lineHeight: 39,
    letterSpacing: -0.8,
    fontFamily: 'Satoshi-Bold',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Satoshi-Medium',
    marginTop: 10,
    marginBottom: 28,
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    marginBottom: 26,
  },
  avatarButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    position: 'relative',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#252526',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 42,
  },
  avatarInitials: {
    color: '#fff',
    fontSize: 25,
    fontFamily: 'Satoshi-Bold',
  },
  cameraBadge: {
    position: 'absolute',
    right: -1,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#171718',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: 42,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  avatarCopy: {
    flex: 1,
    marginLeft: 18,
  },
  avatarTitle: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Satoshi-Bold',
  },
  optionalText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontFamily: 'Satoshi-Medium',
    marginTop: 3,
  },
  avatarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 9,
  },
  avatarActionText: {
    color: ACCENT,
    fontSize: 13,
    fontFamily: 'Satoshi-Bold',
  },
  removeAvatarButton: {
    marginLeft: 12,
    padding: 3,
  },
  errorBanner: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.24)',
    marginBottom: 18,
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Satoshi-Bold',
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  spacedFieldHeader: {
    marginTop: 22,
  },
  fieldLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontFamily: 'Satoshi-Bold',
  },
  requiredLabel: {
    color: ACCENT,
    fontSize: 9,
    letterSpacing: 0.9,
    fontFamily: 'Satoshi-Bold',
  },
  optionalLabel: {
    color: 'rgba(255,255,255,0.32)',
    fontSize: 9,
    letterSpacing: 0.8,
    fontFamily: 'Satoshi-Bold',
  },
  inputContainer: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 17,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputContainerError: {
    borderColor: 'rgba(239,68,68,0.6)',
  },
  input: {
    flex: 1,
    minHeight: 56,
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Satoshi-Medium',
  },
  fieldHint: {
    color: 'rgba(255,255,255,0.34)',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Satoshi-Medium',
    marginTop: 7,
    paddingHorizontal: 3,
  },
  fieldHintError: {
    color: '#f87171',
  },
  bioInputContainer: {
    minHeight: 104,
    alignItems: 'flex-start',
    paddingTop: 17,
  },
  bioInput: {
    minHeight: 82,
    lineHeight: 21,
    paddingTop: 0,
  },
  characterCount: {
    alignSelf: 'flex-end',
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    fontFamily: 'Satoshi-Medium',
    marginTop: 5,
    marginRight: 3,
  },
  submitButton: {
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  submitButtonDisabled: {
    opacity: 0.38,
  },
  submitButtonText: {
    color: '#000',
    fontSize: 16,
    fontFamily: 'Satoshi-Bold',
  },
});

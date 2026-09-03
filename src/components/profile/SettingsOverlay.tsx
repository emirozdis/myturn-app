// ./src/components/profile/SettingsOverlay.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  TouchableOpacity, 
  TextInput, 
  ScrollView, 
  Switch, 
  Alert,
  Platform,
  Dimensions,
  Modal,
  Linking
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  ChevronLeft, 
  ChevronRight, 
  UserCircle, 
  Lock, 
  Shield, 
  Bell, 
  Sliders, 
  Gift, 
  Award, 
  HelpCircle, 
  FileText, 
  Info, 
  LogOut, 
  Trash2,
  Check,
  Eye,
  EyeOff,
  MessageCircleMore,
  BookOpen,
  ClipboardList,
  Clock3,
  CheckCircle2,
  LockKeyhole,
  ChevronDown
} from 'lucide-react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  useAnimatedKeyboard,
  FadeIn,
  withSpring 
} from 'react-native-reanimated';
import crashlytics from '@react-native-firebase/crashlytics';
import auth from '@react-native-firebase/auth';
import RevenueCatUI from 'react-native-purchases-ui';
import Purchases from 'react-native-purchases';
import Constants from 'expo-constants';
import { ActionProgress } from '../ui/ActionProgress';

import { ACCENT } from '../../lib/theme';
import { useProfileStore } from '../../store/useProfileStore';
import { useLanguageStore } from '../../store/useLanguageStore';
import { useProStore } from '../../store/useProStore';
import { useUploadQueueStore } from '../../store/useUploadQueueStore';
import { useTodayStore } from '../../store/useTodayStore';
import { useTranslation } from '../../lib/i18n';
import { Text } from '../ui/Text';
import { GlassView } from '../ui/GlassView';

import { isHapticEnabled, setHapticEnabled, selectionTick, notifySuccess, lightTap } from '../../lib/haptics';
import {
  PUSH_NOTIFICATIONS_ENABLED_KEY,
  requestFCMPermissionAndRegister,
  subscribeToPushNotificationStateChanges,
  unregisterFCMToken,
} from '../../lib/fcm';
import { storage } from '../../lib/storage';
import { apiClient } from '../../lib/apiClient';
import { cacheStore } from '../../lib/MediaCache/cacheStore';
import { PaywallModal } from '../paywall/PaywallModal';
import { AgreementModal, AgreementDocument } from '../legal/AgreementModal';
import { CURRENT_PRIVACY_POLICY } from '../../lib/privacy-policy';
import { IS_DEVELOPMENT } from '../../lib/environment';
import { useGlobalFeedback } from '../feedback/GlobalFeedback';
import {
  isAnalyticsEnabled,
  setAnalyticsEnabled,
} from '../../lib/analyticsPrivacy';
import { GuideCenterModal } from '../guides/GuideCenterModal';
import {
  getSurveyPreferences,
  getSurveyLibrary,
  getSurveySnoozedUntil,
  openSurveyManually,
  setOptionalSurveysEnabled,
  SURVEY_OPTIONAL_PREFERENCE_KEY,
  type PendingSurvey,
  type SurveyLibrary,
} from '../../lib/surveys';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const serifFont = Platform.OS === 'ios' ? 'Georgia' : 'serif';
const SMOOTH_SPRING = { damping: 28, stiffness: 220, mass: 0.8 };
const APP_VERSION = Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? 'unknown';
const APP_BUILD_VERSION = Constants.nativeBuildVersion ?? (
  Platform.OS === 'ios'
    ? Constants.expoConfig?.ios?.buildNumber
    : Constants.expoConfig?.android?.versionCode
) ?? 'unknown';
// Require both signals so developer controls are unavailable in preview and
// production release bundles, even if an environment value is misconfigured.
const SHOW_DEVELOPER_SETTINGS = __DEV__ && IS_DEVELOPMENT;

type NotificationPreferenceKey = 'notifyTurns' | 'notifyReminders' | 'notifyPosts' | 'notifyInteractions' | 'notifySocial' | 'notifyRecaps';
type NotificationPreferences = Record<NotificationPreferenceKey, boolean>;
const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  notifyTurns: true,
  notifyReminders: true,
  notifyPosts: true,
  notifyInteractions: true,
  notifySocial: true,
  notifyRecaps: true,
};

interface SettingsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerLogoutSheet: () => void | Promise<void>;
}

export function SettingsOverlay({ 
  isOpen, 
  onClose, 
  onTriggerLogoutSheet
}: SettingsOverlayProps) {
  const insets = useSafeAreaInsets();
  const store = useProfileStore();
  const { isPro } = useProStore();
  const { locale, t } = useTranslation();
  const setLocale = useLanguageStore((state) => state.setLocale);
  const { openFeedback } = useGlobalFeedback();

  const [activePanel, setActivePanel] = useState<'edit' | 'security' | 'notifications' | 'advanced' | 'agreements' | 'surveys' | 'none'>('none');
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [agreementHistory, setAgreementHistory] = useState<AgreementDocument[]>([]);
  const [agreementsLoading, setAgreementsLoading] = useState(false);
  const [selectedAgreement, setSelectedAgreement] = useState<AgreementDocument | null>(null);
  const [privacyPolicyOpen, setPrivacyPolicyOpen] = useState(false);
  const [privacyPolicyDocument, setPrivacyPolicyDocument] = useState<AgreementDocument>(CURRENT_PRIVACY_POLICY);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [guideCenterOpen, setGuideCenterOpen] = useState(false);
  const [surveyLibrary, setSurveyLibrary] = useState<SurveyLibrary | null>(null);
  const [surveyLibraryLoading, setSurveyLibraryLoading] = useState(false);
  const [surveyLibraryError, setSurveyLibraryError] = useState('');
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null);
  const [deleteAcknowledged, setDeleteAcknowledged] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  
  // Edit Profile States
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password & Security States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Preference Toggles States
  const [pushEnabled, setPushEnabled] = useState(
    () => storage.getBoolean(PUSH_NOTIFICATIONS_ENABLED_KEY) ?? false
  );
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [notificationPreferencesLoading, setNotificationPreferencesLoading] = useState(false);
  const [autoplayVideo, setAutoplayVideo] = useState(true);
  const [downloadQualityHigh, setDownloadQualityHigh] = useState(true);
  const [hapticFeedbackActive, setHapticFeedbackActive] = useState(isHapticEnabled());
  const [analyticsEnabled, setAnalyticsEnabledState] = useState(isAnalyticsEnabled());
  const [analyticsPreferenceSaving, setAnalyticsPreferenceSaving] = useState(false);
  const [optionalSurveysEnabled, setOptionalSurveysEnabledState] = useState(
    () => storage.getBoolean(SURVEY_OPTIONAL_PREFERENCE_KEY) ?? true
  );
  const [surveyPreferenceSaving, setSurveyPreferenceSaving] = useState(false);
  const [mediaCacheSizeBytes, setMediaCacheSizeBytes] = useState(0);

  useEffect(() => {
    const syncPushToggle = () => {
      setPushEnabled(storage.getBoolean(PUSH_NOTIFICATIONS_ENABLED_KEY) === true);
    };

    syncPushToggle();
    return subscribeToPushNotificationStateChanges(syncPushToggle);
  }, []);

  useEffect(() => {
    setName(store.user.name);
    setHandle(store.user.handle);
    setBio(store.user.bio);
    setLocation(store.user.location);
  }, [store.user]);

  useEffect(() => {
    if (isOpen) {
      if (SHOW_DEVELOPER_SETTINGS) {
        setMediaCacheSizeBytes(cacheStore.getTotalSize());
      }
      setNotificationPreferencesLoading(true);
      void apiClient.request('notification-preferences/update', [{ locale }]);
      apiClient.request<{ preferences: NotificationPreferences }>('notification-preferences/get')
        .then((result: any) => {
          if (result.success && result.preferences) {
            setNotificationPreferences((current) => ({ ...current, ...result.preferences }));
          }
        })
        .finally(() => setNotificationPreferencesLoading(false));
      void getSurveyPreferences().then((result) => {
        if (result.success) {
          setOptionalSurveysEnabledState(result.preferences.allowOptionalSurveys);
          storage.set(SURVEY_OPTIONAL_PREFERENCE_KEY, result.preferences.allowOptionalSurveys);
        }
      });
    }
  }, [isOpen, locale]);

  // Developer crash-test controls need collection enabled in local dev only.
  useEffect(() => {
    if (SHOW_DEVELOPER_SETTINGS) {
      void crashlytics().setCrashlyticsCollectionEnabled(true);
    }
  }, []);

  const overlayTranslateX = useSharedValue(SCREEN_WIDTH);

  useEffect(() => {
    if (activePanel !== 'none') {
      overlayTranslateX.value = withSpring(0, SMOOTH_SPRING);
    } else {
      overlayTranslateX.value = withSpring(SCREEN_WIDTH, SMOOTH_SPRING);
    }
  }, [activePanel]);

  const panelAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: overlayTranslateX.value }],
  }));

  const handleLogoutPress = () => {
    Alert.alert(
      t('settings.logout'),
      t('settings.logoutConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.logoutYes'),
          style: 'destructive',
          onPress: async () => {
            await unregisterFCMToken();
            onTriggerLogoutSheet();
          },
        },
      ]
    );
  };

  const handleOpenFeedback = () => {
    lightTap();
    onClose();
    setTimeout(openFeedback, 350);
  };

  const handleAnalyticsToggle = async (enabled: boolean) => {
    const previous = analyticsEnabled;
    setAnalyticsEnabledState(enabled);
    setAnalyticsPreferenceSaving(true);
    try {
      await setAnalyticsEnabled(enabled);
    } catch {
      setAnalyticsEnabledState(previous);
      Alert.alert(t('common.error'), t('settings.analyticsPreferenceError'));
    } finally {
      setAnalyticsPreferenceSaving(false);
    }
  };

  const handleOptionalSurveysToggle = async (enabled: boolean) => {
    const previous = optionalSurveysEnabled;
    setOptionalSurveysEnabledState(enabled);
    setSurveyPreferenceSaving(true);
    const result = await setOptionalSurveysEnabled(enabled);
    if (!result.success) {
      setOptionalSurveysEnabledState(previous);
      Alert.alert(t('common.error'), t('settings.surveyPreferenceError'));
    }
    setSurveyPreferenceSaving(false);
  };

  const openSurveyCenter = async () => {
    lightTap();
    setActivePanel('surveys');
    setSurveyLibraryLoading(true);
    setSurveyLibraryError('');
    const result = await getSurveyLibrary();
    setSurveyLibraryLoading(false);
    if (!result.success) {
      setSurveyLibraryError(result.error);
      return;
    }
    setSurveyLibrary(result);
  };

  const handleOpenAvailableSurvey = (survey: PendingSurvey) => {
    lightTap();
    setActivePanel('none');
    onClose();
    setTimeout(() => openSurveyManually(survey), 380);
  };

  const openDeleteAccountModal = () => {
    lightTap();
    setDeleteAcknowledged(false);
    setDeletingAccount(false);
    setDeleteModalOpen(true);
  };

  const closeDeleteAccountModal = () => {
    if (deletingAccount) return;
    setDeleteModalOpen(false);
    setDeleteAcknowledged(false);
  };

  const openSubscriptionManagementForDeletion = async () => {
    const url = Platform.OS === 'ios'
      ? 'https://apps.apple.com/account/subscriptions'
      : 'https://play.google.com/store/account/subscriptions';
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(t('common.error'), t('settings.subscriptionUnavailable'));
    }
  };

  const handleDeleteAccount = async () => {
    if (!deleteAcknowledged || deletingAccount) return;

    setDeletingAccount(true);
    let result: { success: boolean; error?: string };
    try {
      result = await apiClient.request('profile/delete-account', [{ confirmation: 'DELETE' }]);
    } catch {
      setDeletingAccount(false);
      Alert.alert(t('common.error'), t('settings.deleteFailed'));
      return;
    }

    if (!result.success) {
      setDeletingAccount(false);
      Alert.alert(t('common.error'), result.error || t('settings.deleteFailed'));
      return;
    }

    // The server has aborted remote multipart sessions. Cancel their native
    // counterparts as well so no background task can retain local user media.
    const uploadQueue = useUploadQueueStore.getState();
    await Promise.allSettled(
      Object.keys(uploadQueue.tasks).map((taskId) => uploadQueue.clearTask(taskId)),
    );

    notifySuccess();
    setDeleteModalOpen(false);
    try {
      await onTriggerLogoutSheet();
    } catch (error) {
      // The account is already gone at this point. Keep the destructive modal
      // closed and surface the local cleanup issue to diagnostics.
      console.warn('[Settings] Account deleted, but local logout cleanup failed:', error);
    }
    Alert.alert(t('settings.deleteCompleteTitle'), t('settings.deleteCompleteBody'));
  };

  const handleSaveProfile = async () => {
    if (!name.trim() || !handle.trim()) {
      Alert.alert(t('common.error'), t('settings.required'));
      return;
    }
    setSavingProfile(true);
    await store.updateProfile({
      name: name.trim(),
      handle: handle.toLowerCase().replace(/[^a-z0-9_]/g, ""),
      bio: bio.trim(),
      location: location.trim(),
    });
    setSavingProfile(false);
    notifySuccess();
    setActivePanel('none');
  };

  const closeSecurityPanel = (force = false) => {
    if (changingPassword && !force) return;
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswords(false);
    setActivePanel('none');
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert(t('common.error'), t('settings.passwordRequired'));
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert(t('common.error'), t('settings.passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('common.error'), t('settings.passwordMismatch'));
      return;
    }
    if (currentPassword === newPassword) {
      Alert.alert(t('common.error'), t('settings.passwordUnchanged'));
      return;
    }

    setChangingPassword(true);
    const currentUser = auth().currentUser;
    if (!currentUser?.email) {
      setChangingPassword(false);
      Alert.alert(t('common.error'), t('settings.passwordLoginUnavailable'));
      return;
    }

    try {
      const credential = auth.EmailAuthProvider.credential(
        currentUser.email,
        currentPassword,
      );
      await currentUser.reauthenticateWithCredential(credential);
      await currentUser.getIdToken(true);
    } catch (error: unknown) {
      setChangingPassword(false);
      const code = typeof error === 'object' && error && 'code' in error
        ? String(error.code)
        : '';
      const message = code.includes('wrong-password') || code.includes('invalid-credential')
        ? t('settings.currentPasswordIncorrect')
        : code.includes('too-many-requests')
          ? t('settings.passwordTooManyAttempts')
          : t('settings.passwordLoginUnavailable');
      Alert.alert(t('common.error'), message);
      return;
    }

    const result = await apiClient.request('auth/change-password', [{ newPassword }]);
    setChangingPassword(false);

    if (!result.success) {
      const message = result.error === 'CURRENT_PASSWORD_INCORRECT'
        ? t('settings.currentPasswordIncorrect')
        : result.error === 'PASSWORD_LOGIN_UNAVAILABLE'
          ? t('settings.passwordLoginUnavailable')
          : result.error === 'TOO_MANY_ATTEMPTS'
            ? t('settings.passwordTooManyAttempts')
            : t('settings.passwordChangeFailed');
      Alert.alert(t('common.error'), message);
      return;
    }

    notifySuccess();
    closeSecurityPanel(true);
    Alert.alert(t('common.success'), t('settings.passwordChanged'), [{
      text: t('common.done'),
      onPress: async () => {
        // Password changes revoke every JWT session. Complete local cleanup so
        // this device returns to sign-in instead of remaining in a stale shell.
        await unregisterFCMToken();
        await onTriggerLogoutSheet();
      },
    }]);
  };

  const handlePushToggle = async (val: boolean) => {
    setPushEnabled(val);
    selectionTick();
    if (val) {
      const success = await requestFCMPermissionAndRegister();
      if (success) {
        notifySuccess();
      } else {
        setPushEnabled(false);
        Alert.alert(t('common.error'), t('settings.pushError'));
      }
    } else {
      await unregisterFCMToken();
      notifySuccess();
    }
  };

  const handleNotificationPreferenceToggle = async (key: NotificationPreferenceKey, value: boolean) => {
    const previous = notificationPreferences[key];
    setNotificationPreferences((current) => ({ ...current, [key]: value }));
    selectionTick();
    const result = await apiClient.request('notification-preferences/update', [{ [key]: value, locale }]);
    if (!result.success) {
      setNotificationPreferences((current) => ({ ...current, [key]: previous }));
      Alert.alert(t('common.error'), t('settings.notificationPreferencesError'));
    }
  };

  const handleLanguageChange = (option: 'en' | 'tr') => {
    if (option === locale) return;
    selectionTick();
    setLocale(option);

    // Persist the preference for notifications and refresh prompt copy that is
    // already in memory. API requests also carry the locale header, so the
    // refresh does not have to wait for the profile update to finish.
    void apiClient.request('notification-preferences/update', [{ locale: option }]);
    const groupId = useTodayStore.getState().loadedGroupId || storage.getString('active_group_id');
    if (groupId) {
      void useTodayStore.getState().fetchTodayVlogs(groupId);
    }
  };

  const handleSubscription = async () => {
    lightTap();
    if (isPro) {
      try {
        await RevenueCatUI.presentCustomerCenter();
      } catch (e) {
        Alert.alert(t('common.info'), t('settings.subscriptionUnavailable'));
      }
    } else {
      // Open our custom crafted PaywallModal instead of the RevenueCat default
      setPaywallOpen(true);
    }
  };

  const handleRestore = async () => {
    lightTap();
    try {
      const restoredInfo = await Purchases.restorePurchases();
      useProStore.getState().updateCustomerInfo(restoredInfo);
      if (restoredInfo.entitlements.active['MyTurn Pro']) {
        Alert.alert(t('common.success'), t('settings.restored'));
      } else {
        Alert.alert(t('common.info'), t('settings.noActiveSubscription'));
      }
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message || t('settings.restoreFailed'));
    }
  };

  const handleClearCaches = async () => {
    Alert.alert(
      'Önbellekleri Temizle',
      'İstek önbellekleri ve medya parçaları temizlensin mi?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Temizle',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.clearAllCache();
              setMediaCacheSizeBytes(0);
              notifySuccess();
              Alert.alert('Başarılı', 'Tüm önbellekler temizlendi.');
            } catch (e: any) {
              Alert.alert('Hata', e.message || 'Önbellek temizleme başarısız oldu.');
            }
          },
        },
      ]
    );
  };

  const openAgreementHistory = async () => {
    lightTap();
    setActivePanel('agreements');
    setAgreementsLoading(true);
    const result: any = await apiClient.request('legal/accepted');
    setAgreementsLoading(false);

    if (!result.success) {
      Alert.alert(t('common.error'), result.error || t('settings.agreementsLoadError'));
      return;
    }

    setAgreementHistory((result.acceptances || []).map((acceptance: any) => ({
      slug: acceptance.agreementSlug,
      version: acceptance.agreementVersion,
      effectiveAt: acceptance.agreementEffectiveAt,
      title: acceptance.titleSnapshot,
      content: acceptance.contentSnapshot,
      contentHash: acceptance.contentHash,
      acceptedAt: acceptance.acceptedAt,
    })));
  };

  const openPrivacyPolicy = async () => {
    lightTap();
    setPrivacyPolicyDocument(CURRENT_PRIVACY_POLICY);
    setPrivacyPolicyOpen(true);

    // The bundled copy keeps the policy available offline. When connected,
    // prefer the current version published by the Next.js backend.
    try {
      const result: any = await apiClient.request('legal/privacy');
      if (result.success && result.policy) {
        setPrivacyPolicyDocument(result.policy);
      }
    } catch {
      // App Check, connectivity, or backend errors must never prevent access
      // to the complete policy bundled with the app.
    }
  };

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      transparent={false}
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View
          style={[
            styles.header,
            {
              paddingTop: Math.max(insets.top, 16),
              height: Math.max(insets.top, 16) + 52,
            },
          ]}
        >
          <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.7}>
            <ChevronLeft size={24} color="rgba(255,255,255,0.75)" />
          </TouchableOpacity>
          <Text style={[styles.title, { fontFamily: serifFont }]}>{t('settings.title')}</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) + 40 }]}
        >
          {/* Account Section */}
          <Text style={[styles.sectionTitle, { fontFamily: serifFont }]}>{t('settings.account')}</Text>
          <View style={styles.cardGroup}>
            <SettingsItemRow icon={UserCircle} label={t('settings.editProfile')} sub={t('settings.editProfileSub')} onPress={() => setActivePanel('edit')} />
            <SettingsItemRow icon={Lock} label={t('settings.security')} sub={t('settings.securitySub')} onPress={() => setActivePanel('security')} />
            <SettingsItemRow icon={Shield} label={t('settings.privacy')} sub={t('settings.privacySub')} onPress={openPrivacyPolicy} isLast={true} />
          </View>

          {/* Language */}
          <Text style={[styles.sectionTitle, { fontFamily: serifFont }]}>{t('settings.language')}</Text>
          <View style={styles.cardGroup}>
            <View style={styles.languageRow}>
              <View className="flex-1 pr-3">
                <Text weight="bold" className="text-white text-sm">{t('settings.language')}</Text>
                <Text className="text-white/40 text-[10px] mt-0.5">{t('settings.languageSub')}</Text>
              </View>
              <View style={styles.languageOptions}>
                {(['en', 'tr'] as const).map((option) => (
                  <TouchableOpacity
                    key={option}
                    onPress={() => handleLanguageChange(option)}
                    style={[styles.languageOption, locale === option && styles.languageOptionActive]}
                    activeOpacity={0.8}
                  >
                    <Text weight="bold" style={locale === option ? styles.languageOptionTextActive : styles.languageOptionText}>
                      {option === 'en' ? t('language.english') : t('language.turkish')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Notifications Section */}
          <Text style={[styles.sectionTitle, { fontFamily: serifFont }]}>{t('settings.notifications')}</Text>
          <View style={styles.cardGroup}>
            <SettingsItemRow icon={Bell} label={t('settings.notificationSettings')} sub={t('settings.notificationSub')} onPress={() => setActivePanel('notifications')} />
            <View style={styles.inlineToggleRow}>
              <View className="flex-1 pr-4">
                <Text weight="bold" className="text-white text-sm">{t('settings.allNotifications')}</Text>
                <Text className="text-white/40 text-[10px] mt-0.5">{t('settings.allNotificationsSub')}</Text>
              </View>
              <Switch value={pushEnabled} onValueChange={handlePushToggle} trackColor={{ false: '#333', true: ACCENT }} />
            </View>
          </View>

          {/* Preferences Section */}
          <Text style={[styles.sectionTitle, { fontFamily: serifFont }]}>{t('settings.preferences')}</Text>
          <View style={styles.cardGroup}>
            <SettingsItemRow
              icon={ClipboardList}
              label={t('settings.surveyCenter')}
              sub={t('settings.surveyCenterSub')}
              onPress={() => void openSurveyCenter()}
            />
            {SHOW_DEVELOPER_SETTINGS && (
              <SettingsItemRow icon={Sliders} label={t('settings.advanced')} sub={t('settings.advancedSub')} onPress={() => setActivePanel('advanced')} />
            )}
            <View style={styles.inlineToggleRow}>
              <View className="flex-1 pr-4">
                <Text weight="bold" className="text-white text-sm">{t('settings.analytics')}</Text>
                <Text className="text-white/40 text-[10px] mt-0.5">{t('settings.analyticsSub')}</Text>
              </View>
              <Switch
                value={analyticsEnabled}
                onValueChange={handleAnalyticsToggle}
                disabled={analyticsPreferenceSaving}
                trackColor={{ false: '#333', true: ACCENT }}
              />
            </View>
            <View style={styles.inlineToggleRow}>
              <View className="flex-1 pr-4">
                <Text weight="bold" className="text-white text-sm">{t('settings.optionalSurveys')}</Text>
                <Text className="text-white/40 text-[10px] mt-0.5">{t('settings.optionalSurveysSub')}</Text>
              </View>
              <Switch
                value={optionalSurveysEnabled}
                onValueChange={handleOptionalSurveysToggle}
                disabled={surveyPreferenceSaving}
                trackColor={{ false: '#333', true: ACCENT }}
              />
            </View>
            <View style={styles.inlineToggleRow}>
              <View className="flex-1 pr-4">
                <Text weight="bold" className="text-white text-sm">{t('settings.autoplay')}</Text>
                <Text className="text-white/40 text-[10px] mt-0.5">{t('settings.autoplaySub')}</Text>
              </View>
              <Switch value={autoplayVideo} onValueChange={setAutoplayVideo} trackColor={{ false: '#333', true: ACCENT }} />
            </View>
            <View style={styles.inlineToggleRow}>
              <View className="flex-1 pr-4">
                <Text weight="bold" className="text-white text-sm">{t('settings.downloadQuality')}</Text>
                <Text className="text-white/40 text-[10px] mt-0.5">{t('settings.downloadQualitySub')}</Text>
              </View>
              <Switch value={downloadQualityHigh} onValueChange={setDownloadQualityHigh} trackColor={{ false: '#333', true: ACCENT }} />
            </View>
            <View style={[styles.inlineToggleRow, { borderBottomWidth: 0 }]}>
              <View className="flex-1 pr-4">
                <Text weight="bold" className="text-white text-sm">{t('settings.haptics')}</Text>
                <Text className="text-white/40 text-[10px] mt-0.5">{t('settings.hapticsSub')}</Text>
              </View>
              <Switch value={hapticFeedbackActive} onValueChange={(v) => { setHapticFeedbackActive(v); setHapticEnabled(v); if (v) selectionTick(); }} trackColor={{ false: '#333', true: ACCENT }} />
            </View>
          </View>

          {/* Premium Section */}
          <Text style={[styles.sectionTitle, { fontFamily: serifFont }]}>{t('settings.premium')}</Text>
          <View style={styles.cardGroup}>
            <SettingsItemRow icon={Gift} label={isPro ? t('settings.manageSubscription') : t('settings.upgrade')} sub={t('settings.premiumSub')} onPress={handleSubscription} />
            <SettingsItemRow icon={Award} label={t('settings.restore')} sub={t('settings.restoreSub')} onPress={handleRestore} isLast={true} />
          </View>

          {/* Help & Info Section */}
          <Text style={[styles.sectionTitle, { fontFamily: serifFont }]}>{t('settings.support')}</Text>
          <View style={styles.cardGroup}>
            <SettingsItemRow icon={BookOpen} label={t('settings.appGuide')} sub={t('settings.appGuideSub')} onPress={() => setGuideCenterOpen(true)} />
            <SettingsItemRow icon={HelpCircle} label={t('settings.help')} sub={t('settings.helpSub')} onPress={() => Linking.openURL('https://myturn.emirozdis.tr/support')} />
            <SettingsItemRow icon={FileText} label={t('settings.terms')} sub={t('settings.termsSub')} onPress={openAgreementHistory} />
            <SettingsItemRow icon={Info} label={t('settings.about')} sub={`v${APP_VERSION} (Build ${APP_BUILD_VERSION})`} onPress={() => Alert.alert(t('settings.about'), 'MyTurn © 2026')} isLast={true} />
          </View>

          {/* Danger Zone */}
          <Text style={[styles.sectionTitle, { fontFamily: serifFont, color: '#f87171' }]}>{t('settings.danger')}</Text>
          <View style={[styles.cardGroup, { borderColor: 'rgba(239,68,68,0.15)' }]}>
            <SettingsItemRow 
              icon={LogOut} 
              label={t('settings.logout')}
              sub={t('settings.logoutSub')}
              onPress={handleLogoutPress}
              dangerStyle={true}
            />
            <SettingsItemRow 
              icon={Trash2} 
              label={t('settings.delete')}
              sub={t('settings.deleteSub')}
              onPress={openDeleteAccountModal}
              isLast={true}
              dangerStyle={true}
            />
          </View>

          <TouchableOpacity
            style={styles.feedbackButton}
            onPress={handleOpenFeedback}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('settings.sendFeedback')}
            accessibilityHint={t('settings.sendFeedbackSub')}
          >
            <View style={styles.feedbackButtonIcon}>
              <MessageCircleMore size={19} color="rgba(255,255,255,0.58)" />
            </View>
            <View style={styles.feedbackButtonCopy}>
              <Text weight="bold" style={styles.feedbackButtonTitle}>{t('settings.sendFeedback')}</Text>
              <Text style={styles.feedbackButtonSubtitle}>{t('settings.sendFeedbackSub')}</Text>
            </View>
            <ChevronRight size={15} color="rgba(255,255,255,0.22)" />
          </TouchableOpacity>
        </ScrollView>

        <Animated.View 
          style={[
            StyleSheet.absoluteFill, 
            styles.slidePanel, 
            panelAnimatedStyle, 
            { 
              position: 'absolute', 
              width: SCREEN_WIDTH, 
              height: SCREEN_HEIGHT, 
              backgroundColor: '#0B0B0C',
              top: 0,
              left: 0
            }
          ]}
          pointerEvents={activePanel === 'none' ? 'none' : 'auto'}
        >
          {activePanel === 'edit' && (
            <SlidePanel title={t('settings.editProfile')} onBack={() => setActivePanel('none')}>
              <ScrollView contentContainerStyle={styles.panelScrollContent}>
                <View style={styles.formGroup}>
                  <Text weight="bold" className="text-white/45 text-[10px] uppercase tracking-wider mb-2">{t('settings.editName')}</Text>
                  <TextInput 
                    value={name} 
                    onChangeText={setName} 
                    style={styles.textInput} 
                    placeholder="Ad Soyad"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                  />
                </View>
                
                <View style={styles.formGroup}>
                  <Text weight="bold" className="text-white/45 text-[10px] uppercase tracking-wider mb-2">{t('settings.editHandle')}</Text>
                  <View className="relative">
                    <Text style={styles.handleSign} className="absolute left-4 top-1/2 -translate-y-1/2">@</Text>
                    <TextInput 
                      value={handle} 
                      onChangeText={setHandle} 
                      style={[styles.textInput, { paddingLeft: 28 }]} 
                      placeholder="kullanici_adi"
                      autoCapitalize="none"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text weight="bold" className="text-white/45 text-[10px] uppercase tracking-wider mb-2">{t('settings.editBio')}</Text>
                  <TextInput 
                    value={bio} 
                    onChangeText={setBio} 
                    style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]} 
                    placeholder="Biyografi ekle..."
                    multiline
                    numberOfLines={3}
                    placeholderTextColor="rgba(255,255,255,0.3)"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text weight="bold" className="text-white/45 text-[10px] uppercase tracking-wider mb-2">{t('settings.editLocation')}</Text>
                  <TextInput 
                    value={location} 
                    onChangeText={setLocation} 
                    style={styles.textInput} 
                    placeholder="Konum"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                  />
                </View>

                <TouchableOpacity 
                  onPress={handleSaveProfile}
                  disabled={savingProfile}
                  style={styles.saveBtn}
                  className="w-full h-12 rounded-2xl items-center justify-center flex-row gap-2 mt-4"
                  activeOpacity={0.8}
                >
                  {savingProfile ? (
                    <ActionProgress label={t('settings.saving')} color="#000" />
                  ) : (
                    <>
                      <Check size={16} color="#000" strokeWidth={3} />
                      <Text weight="bold" className="text-black text-sm">{t('settings.saveProfile')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </SlidePanel>
          )}

          {activePanel === 'security' && (
            <SlidePanel title={t('settings.security')} onBack={() => closeSecurityPanel()}>
              <ScrollView
                contentContainerStyle={styles.panelScrollContent}
                keyboardShouldPersistTaps="handled"
              >
                <GlassView preset="liquid" style={styles.panelPromptCard}>
                  <Lock size={24} color={ACCENT} />
                  <Text weight="bold" className="text-white text-base mt-4 mb-1.5 text-center">{t('settings.changePassword')}</Text>
                  <Text className="text-white/50 text-[11px] leading-relaxed text-center px-4">
                    {t('settings.changePasswordSub')}
                  </Text>
                </GlassView>

                <View style={{ marginTop: 20 }}>
                  {([
                    ['current', t('settings.currentPassword'), currentPassword, setCurrentPassword],
                    ['new', t('settings.newPassword'), newPassword, setNewPassword],
                    ['confirm', t('settings.confirmPassword'), confirmPassword, setConfirmPassword],
                  ] as const).map(([key, label, value, setter]) => (
                    <View style={styles.formGroup} key={key}>
                      <Text weight="bold" className="text-white/45 text-[10px] uppercase tracking-wider mb-2">{label}</Text>
                      <View style={styles.passwordInputWrap}>
                        <TextInput
                          value={value}
                          onChangeText={setter}
                          style={[styles.textInput, styles.passwordInput]}
                          placeholder={label}
                          placeholderTextColor="rgba(255,255,255,0.3)"
                          secureTextEntry={!showPasswords}
                          autoCapitalize="none"
                          autoCorrect={false}
                          textContentType={key === 'current' ? 'password' : 'newPassword'}
                          editable={!changingPassword}
                        />
                        <TouchableOpacity
                          onPress={() => setShowPasswords((visible) => !visible)}
                          style={styles.passwordVisibilityButton}
                          accessibilityRole="button"
                          accessibilityLabel={showPasswords ? t('settings.hidePasswords') : t('settings.showPasswords')}
                        >
                          {showPasswords
                            ? <EyeOff size={18} color="rgba(255,255,255,0.5)" />
                            : <Eye size={18} color="rgba(255,255,255,0.5)" />}
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  onPress={handleChangePassword}
                  disabled={changingPassword}
                  style={[styles.saveBtn, changingPassword && { opacity: 0.65 }]}
                  className="w-full h-12 rounded-2xl items-center justify-center flex-row gap-2 mt-1"
                  activeOpacity={0.8}
                >
                  {changingPassword ? (
                    <ActionProgress label={t('settings.changingPassword')} color="#000" />
                  ) : (
                    <>
                      <Check size={16} color="#000" strokeWidth={3} />
                      <Text weight="bold" className="text-black text-sm">{t('settings.updatePassword')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </SlidePanel>
          )}

          {activePanel === 'notifications' && (
            <SlidePanel title={t('settings.notifications')} onBack={() => setActivePanel('none')}>
              <ScrollView contentContainerStyle={styles.panelScrollContent}>
                <GlassView preset="liquid" style={styles.panelPromptCard}>
                  <Bell size={24} color={ACCENT} />
                  <Text weight="bold" className="text-white text-base mt-4 mb-1.5 text-center">{t('settings.preventDelays')}</Text>
                  <Text className="text-white/50 text-[11px] leading-relaxed text-center px-4">
                    {t('settings.preventDelaysBody')}
                  </Text>
                </GlassView>
                <View style={[styles.glassSettingCard, { marginTop: 16 }]} className="bg-white/[0.02] border border-white/5 rounded-2xl px-4">
                  {([
                    ['notifyTurns', 'settings.notifyTurns', 'settings.notifyTurnsSub'],
                    ['notifyReminders', 'settings.notifyReminders', 'settings.notifyRemindersSub'],
                    ['notifyPosts', 'settings.notifyPosts', 'settings.notifyPostsSub'],
                    ['notifyInteractions', 'settings.notifyInteractions', 'settings.notifyInteractionsSub'],
                    ['notifySocial', 'settings.notifySocial', 'settings.notifySocialSub'],
                    ['notifyRecaps', 'settings.notifyRecaps', 'settings.notifyRecapsSub'],
                  ] as const).map(([key, label, sub], index, items) => (
                    <View key={key} style={[styles.inlineToggleRow, index === items.length - 1 && { borderBottomWidth: 0 }]}>
                      <View className="flex-1 pr-4">
                        <Text weight="bold" className="text-white text-sm">{t(label)}</Text>
                        <Text className="text-white/45 text-[10px] leading-relaxed mt-1">{t(sub)}</Text>
                      </View>
                      <Switch
                        value={notificationPreferences[key]}
                        onValueChange={(value) => handleNotificationPreferenceToggle(key, value)}
                        disabled={notificationPreferencesLoading}
                        trackColor={{ false: '#333', true: ACCENT }}
                      />
                    </View>
                  ))}
                </View>
              </ScrollView>
            </SlidePanel>
          )}

          {SHOW_DEVELOPER_SETTINGS && activePanel === 'advanced' && (
            <SlidePanel title={t('settings.advanced')} onBack={() => setActivePanel('none')}>
              <ScrollView contentContainerStyle={styles.panelScrollContent}>
                <View style={styles.glassSettingCard} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                  <View className="flex-row justify-between items-center">
                    <View className="flex-1 pr-4">
                      <Text weight="bold" className="text-white text-sm">{t('settings.abr')}</Text>
                      <Text className="text-white/45 text-[10px] leading-relaxed mt-1">
                        {t('settings.abrSub')}
                      </Text>
                    </View>
                    <Switch value={store.alwaysHighestQuality} onValueChange={store.setAlwaysHighestQuality} trackColor={{ false: '#333', true: ACCENT }} />
                  </View>
                </View>

                <View style={[styles.glassSettingCard, { marginTop: 12 }]} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                  <View className="flex-row justify-between items-center">
                    <View className="flex-1 pr-4">
                      <Text weight="bold" className="text-white text-sm">{t('settings.cache')}</Text>
                      <Text className="text-white/45 text-[10px] leading-relaxed mt-1">
                        {t('settings.cacheSub', { size: formatBytes(mediaCacheSizeBytes) })}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={handleClearCaches}
                      style={{ backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
                      activeOpacity={0.8}
                    >
                      <Text weight="bold" className="text-white text-xs">Temizle</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={[styles.glassSettingCard, { marginTop: 12 }]} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                  <View className="flex-row justify-between items-center">
                    <View className="flex-1 pr-4">
                      <Text weight="bold" className="text-white text-sm">{t('settings.resetDiscovery')}</Text>
                      <Text className="text-white/45 text-[10px] leading-relaxed mt-1">
                        {t('settings.resetDiscoverySub')}
                      </Text>
                    </View>
                    <TouchableOpacity 
                      onPress={() => {
                        storage.delete('revealed_assignments');

                        const keys = storage.getAllKeys();
                        keys.forEach(k => {
                          if (k.startsWith('vlogger_revealed_')) {
                            storage.delete(k);
                          }
                        });
                        
                        notifySuccess();
                        Alert.alert("Başarılı", "Görülme durumları sıfırlandı. Ana sayfaya döndüğünüzde tanıtım modalı tekrar açılacaktır.");
                      }}
                      style={{ backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
                      activeOpacity={0.8}
                    >
                      <Text weight="bold" className="text-white text-xs">Sıfırla</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Crashlytics Test Controller block with dual triggers */}
                <View style={[styles.glassSettingCard, { marginTop: 12 }]} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                  <View className="flex-row justify-between items-center">
                    <View className="flex-1 pr-4">
                      <Text weight="bold" className="text-white text-sm">Crashlytics Entegrasyon Testi</Text>
                      <Text className="text-white/45 text-[10px] leading-relaxed mt-1">
                        JS hataları anında raporlanır. Native çökme raporu için test öncesi hata ayıklayıcı (Metro/Xcode) kapalı olmalıdır.
                      </Text>
                    </View>
                    <View className="flex-col gap-2">
                      <TouchableOpacity 
                        onPress={() => {
                          lightTap();
                          // Instantly throws a standard JavaScript exception monitored by global handler
                          throw new Error("Crashlytics JS Test Exception - Verification Successful");
                        }}
                        style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)', alignItems: 'center' }}
                        activeOpacity={0.8}
                      >
                        <Text weight="bold" className="text-white text-xs">JS Hata Fırlat</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        onPress={() => {
                          lightTap();
                          Alert.alert(
                            "Crash Testi",
                            "Uygulama şimdi native olarak çöktürülecektir. Çökme raporunun sunucuya iletilmesi için çöktükten sonra uygulamayı mutlaka manuel olarak tekrar açmalısınız.",
                            [
                              { text: "İptal", style: "cancel" },
                              { text: "Çökert", style: "destructive", onPress: () => crashlytics().crash() }
                            ]
                          );
                        }}
                        style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.25)', alignItems: 'center' }}
                        activeOpacity={0.8}
                      >
                        <Text weight="bold" className="text-red-400 text-xs">Native Çökert</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </ScrollView>
            </SlidePanel>
          )}
          {activePanel === 'agreements' && (
            <SlidePanel title={t('settings.agreements')} onBack={() => setActivePanel('none')}>
              <ScrollView contentContainerStyle={styles.panelScrollContent}>
                <Text style={styles.agreementIntro}>{t('settings.agreementsSub')}</Text>
                {agreementsLoading ? (
                  <ActionProgress label={t('settings.agreementsLoading')} color={ACCENT} />
                ) : agreementHistory.length === 0 ? (
                  <View style={styles.emptyAgreementCard}>
                    <Text style={styles.agreementIntro}>{t('settings.noAgreements')}</Text>
                  </View>
                ) : agreementHistory.map((agreement) => (
                  <TouchableOpacity
                    key={`${agreement.slug}-${agreement.version}-${agreement.acceptedAt}`}
                    style={styles.agreementCard}
                    onPress={() => setSelectedAgreement(agreement)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text weight="bold" style={styles.agreementTitle}>{agreement.title}</Text>
                      <Text style={styles.agreementMeta}>
                        {t('settings.version')} {agreement.version} · {agreement.acceptedAt ? new Date(agreement.acceptedAt).toLocaleString(locale) : ''}
                      </Text>
                    </View>
                    <ChevronRight size={16} color="rgba(255,255,255,0.3)" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </SlidePanel>
          )}
          {activePanel === 'surveys' && (
            <SlidePanel title={t('settings.surveyCenter')} onBack={() => setActivePanel('none')}>
              <ScrollView
                contentContainerStyle={[styles.panelScrollContent, { paddingBottom: 28 }]}
                showsVerticalScrollIndicator={false}
              >
                {surveyLibraryLoading ? (
                  <View style={styles.surveyCenterLoading}>
                    <ActionProgress label={t('settings.surveysLoading')} color={ACCENT} />
                  </View>
                ) : surveyLibraryError ? (
                  <View style={styles.surveyEmptyCard}>
                    <Text style={styles.surveyEmptyText}>{surveyLibraryError}</Text>
                    <TouchableOpacity onPress={() => void openSurveyCenter()} style={styles.surveyRetryButton}>
                      <Text weight="bold" style={styles.surveyRetryText}>{t('common.retry')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <Text style={[styles.surveySectionLabel, { fontFamily: serifFont }]}>
                      {t('settings.availableSurveys')}
                    </Text>
                    <Text style={styles.surveySectionDescription}>{t('settings.availableSurveysSub')}</Text>
                    {!surveyLibrary || surveyLibrary.available.length === 0 ? (
                      <View style={styles.surveyEmptyCard}>
                        <CheckCircle2 size={22} color="rgba(255,255,255,0.3)" />
                        <Text style={styles.surveyEmptyText}>{t('settings.noAvailableSurveys')}</Text>
                      </View>
                    ) : surveyLibrary.available.map((survey) => {
                      const snoozedUntil = getSurveySnoozedUntil(survey);
                      return (
                        <View key={`${survey.id}-${survey.revision}`} style={styles.availableSurveyCard}>
                          <View style={styles.surveyCardTopRow}>
                            <View style={[
                              styles.surveyStatusIcon,
                              survey.isMandatory && { backgroundColor: 'rgba(217,255,102,0.1)' },
                            ]}>
                              {survey.isMandatory
                                ? <LockKeyhole size={16} color={ACCENT} />
                                : <ClipboardList size={16} color="rgba(255,255,255,0.55)" />}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text weight="bold" style={styles.surveyCardTitle}>{survey.title}</Text>
                              <Text style={styles.surveyCardMeta}>
                                {survey.isMandatory
                                  ? t('settings.mandatorySurvey')
                                  : snoozedUntil
                                    ? t('settings.surveyDeferredUntil', {
                                        date: new Date(snoozedUntil).toLocaleString(locale),
                                      })
                                    : t('settings.optionalSurvey')}
                              </Text>
                            </View>
                          </View>
                          {survey.description ? (
                            <Text style={styles.surveyCardDescription}>{survey.description}</Text>
                          ) : null}
                          <View style={styles.surveyCardFooter}>
                            <View style={styles.surveyExpiryRow}>
                              <Clock3 size={12} color="rgba(255,255,255,0.3)" />
                              <Text style={styles.surveyExpiryText}>
                                {survey.endsAt
                                  ? t('settings.surveyExpires', {
                                      date: new Date(survey.endsAt).toLocaleString(locale),
                                    })
                                  : t('settings.surveyNoExpiration')}
                              </Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => handleOpenAvailableSurvey(survey)}
                              style={styles.surveyStartButton}
                              activeOpacity={0.8}
                            >
                              <Text weight="bold" style={styles.surveyStartButtonText}>
                                {snoozedUntil ? t('settings.continueSurvey') : t('settings.startSurvey')}
                              </Text>
                              <ChevronRight size={14} color="#090A08" strokeWidth={2.8} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}

                    <Text style={[styles.surveySectionLabel, styles.surveyHistoryLabel, { fontFamily: serifFont }]}>
                      {t('settings.surveyHistory')}
                    </Text>
                    <Text style={styles.surveySectionDescription}>{t('settings.surveyHistorySub')}</Text>
                    {!surveyLibrary || surveyLibrary.submissions.length === 0 ? (
                      <View style={styles.surveyEmptyCard}>
                        <Text style={styles.surveyEmptyText}>{t('settings.noSurveyHistory')}</Text>
                      </View>
                    ) : surveyLibrary.submissions.map((submission) => {
                      const expanded = expandedSubmissionId === submission.id;
                      return (
                        <TouchableOpacity
                          key={submission.id}
                          style={styles.surveyHistoryCard}
                          onPress={() => setExpandedSubmissionId(expanded ? null : submission.id)}
                          activeOpacity={0.82}
                        >
                          <View style={styles.surveyHistoryHeader}>
                            <View style={styles.surveyCompletedIcon}>
                              <Check size={14} color={ACCENT} strokeWidth={3} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text weight="bold" style={styles.surveyCardTitle}>{submission.title}</Text>
                              <Text style={styles.surveyCardMeta}>
                                {new Date(submission.submittedAt).toLocaleString(locale)}
                                {' · '}
                                {t('settings.surveyAnswerCount', { count: submission.answers.length })}
                              </Text>
                            </View>
                            <ChevronDown
                              size={16}
                              color="rgba(255,255,255,0.3)"
                              style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
                            />
                          </View>
                          {expanded ? (
                            <Animated.View entering={FadeIn.duration(180)} style={styles.surveyAnswerList}>
                              {submission.answers.map((answer) => (
                                <View key={answer.id} style={styles.surveyAnswerRow}>
                                  <Text weight="bold" style={styles.surveyAnswerPrompt}>{answer.prompt}</Text>
                                  <Text style={styles.surveyAnswerValue}>
                                    {Array.isArray(answer.displayValue)
                                      ? answer.displayValue.join(', ')
                                      : answer.displayValue}
                                  </Text>
                                </View>
                              ))}
                              <Text style={styles.surveyBuildMeta}>
                                {submission.platform} · v{submission.appVersion}
                                {submission.buildNumber !== null ? ` (${submission.buildNumber})` : ''}
                              </Text>
                            </Animated.View>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )}
              </ScrollView>
            </SlidePanel>
          )}
        </Animated.View>

        {/* Our Custom High-Fidelity Paywall Modal */}
        <PaywallModal 
          isOpen={paywallOpen} 
          onClose={() => setPaywallOpen(false)} 
        />
        <AgreementModal
          visible={Boolean(selectedAgreement)}
          agreement={selectedAgreement}
          onClose={() => setSelectedAgreement(null)}
        />
        <AgreementModal
          visible={privacyPolicyOpen}
          agreement={privacyPolicyDocument}
          onClose={() => setPrivacyPolicyOpen(false)}
        />
        <GuideCenterModal
          visible={guideCenterOpen}
          onClose={() => setGuideCenterOpen(false)}
          onLaunchPageGuide={() => {
            setGuideCenterOpen(false);
            onClose();
          }}
        />
        <Modal
          visible={deleteModalOpen}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={closeDeleteAccountModal}
        >
          <View style={styles.deleteModalBackdrop}>
            <View style={styles.deleteModalCard}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={styles.deleteModalContent}
              >
                <View style={styles.deleteIconCircle}>
                  <Trash2 size={24} color="#ef4444" />
                </View>
                <Text style={[styles.deleteModalTitle, { fontFamily: serifFont }]}>{t('settings.deleteTitle')}</Text>
                <Text style={styles.deleteWarning}>{t('settings.deleteWarning')}</Text>

                <View style={styles.deleteConsequences}>
                  {[
                    t('settings.deleteMedia'),
                    t('settings.deleteGroups'),
                    t('settings.deleteActivity'),
                    t('settings.deleteRetention'),
                  ].map((item) => (
                    <View key={item} style={styles.deleteConsequenceRow}>
                      <View style={styles.deleteBullet} />
                      <Text style={styles.deleteConsequenceText}>{item}</Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.deleteSubscriptionNotice}>{t('settings.deleteSubscription')}</Text>
                <TouchableOpacity
                  onPress={openSubscriptionManagementForDeletion}
                  style={styles.deleteSubscriptionButton}
                  activeOpacity={0.8}
                >
                  <Text weight="bold" style={styles.deleteSubscriptionButtonText}>
                    {t('settings.manageSubscriptionsBeforeDelete')}
                  </Text>
                  <ChevronRight size={15} color="#fca5a5" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    selectionTick();
                    setDeleteAcknowledged((current) => !current);
                  }}
                  style={styles.deleteAcknowledgement}
                  activeOpacity={0.8}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: deleteAcknowledged }}
                >
                  <View style={[styles.deleteCheckbox, deleteAcknowledged && styles.deleteCheckboxChecked]}>
                    {deleteAcknowledged && <Check size={13} color="#fff" strokeWidth={3} />}
                  </View>
                  <Text style={styles.deleteAcknowledgementText}>{t('settings.deleteAcknowledge')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleDeleteAccount}
                  disabled={!deleteAcknowledged || deletingAccount}
                  style={[
                    styles.deleteConfirmButton,
                    (!deleteAcknowledged || deletingAccount) && styles.deleteConfirmButtonDisabled,
                  ]}
                  activeOpacity={0.85}
                >
                  {deletingAccount ? (
                    <ActionProgress label={t('settings.deleteDeleting')} color="#fff" />
                  ) : (
                    <Text weight="bold" style={styles.deleteConfirmButtonText}>{t('settings.deleteConfirm')}</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={closeDeleteAccountModal}
                  disabled={deletingAccount}
                  style={styles.deleteCancelButton}
                  activeOpacity={0.8}
                >
                  <Text weight="bold" style={styles.deleteCancelButtonText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

      </View>
    </Modal>
  );
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const precision = size >= 10 || unitIndex === 0 ? 0 : 1;
  return `${size.toFixed(precision)} ${units[unitIndex]}`;
}

function SettingsItemRow({ icon: Icon, label, sub, onPress, isLast = false, dangerStyle = false }: { icon: any; label: string; sub: string; onPress: () => void; isLast?: boolean; dangerStyle?: boolean }) {
  return (
    <TouchableOpacity 
      onPress={onPress}
      style={[styles.settingsRow, !isLast && { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }]}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={sub}
    >
      <View style={[styles.settingIconOuter, dangerStyle && { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' }]}>
        <Icon size={15} color={dangerStyle ? '#ef4444' : 'rgba(255,255,255,0.6)'} />
      </View>
      <View className="flex-1 min-w-0 pr-2">
        <Text weight="bold" style={[styles.rowLabel, dangerStyle && { color: '#ef4444' }]}>{label}</Text>
        <Text className="text-white/40 text-[10px] mt-0.5" style={dangerStyle && { color: 'rgba(239,68,68,0.5)' }}>{sub}</Text>
      </View>
      <ChevronRight size={14} color="rgba(255,255,255,0.2)" />
    </TouchableOpacity>
  );
}

function SlidePanel({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();

  // Spring-animated padding that tracks keyboard height for smooth transitions
  const animatedContentStyle = useAnimatedStyle(() => {
    const keyboardOffset = Math.max(keyboard.height.value - insets.bottom, 0);
    return {
      paddingBottom: withSpring(
        keyboardOffset > 0 ? keyboardOffset + 8 : Math.max(insets.bottom, 16),
        // Overdamped spring: rapid but zero bounce
        { damping: 50, stiffness: 400, mass: 0.8 }
      ),
    };
  });

  return (
    <View style={styles.slidePanelInner}>
      <View 
        style={[styles.panelHeader, { paddingTop: Math.max(insets.top, 16) }]}
        className="flex-row items-center gap-3 px-4 pb-3 border-b border-white/5"
      >
        <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={styles.backBtn}>
          <ChevronLeft size={24} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
        <Text weight="bold" className="text-white text-base">{title}</Text>
      </View>
      <Animated.View style={[{ flex: 1, marginTop: 8 }, animatedContentStyle]}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0B0B0C',
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    flexShrink: 0,
    backgroundColor: '#0B0B0C',
    zIndex: 2,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    color: '#FAF9F6',
    letterSpacing: -0.4,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 22,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  cardGroup: {
    backgroundColor: '#161617',
    borderRadius: 28,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  feedbackButton: {
    minHeight: 68,
    marginTop: 16,
    borderRadius: 18,
    backgroundColor: '#161617',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  feedbackButtonIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  feedbackButtonCopy: {
    flex: 1,
    paddingRight: 10,
  },
  feedbackButtonTitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
  },
  feedbackButtonSubtitle: {
    color: 'rgba(255,255,255,0.36)',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 3,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  settingIconOuter: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowLabel: {
    color: '#FAF9F6',
    fontSize: 13,
  },
  inlineToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  languageOptions: {
    flexDirection: 'row',
    gap: 6,
  },
  languageOption: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  languageOptionActive: {
    backgroundColor: ACCENT,
  },
  languageOptionText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
  },
  languageOptionTextActive: {
    color: '#000',
    fontSize: 11,
  },
  slidePanel: {
    zIndex: 90,
  },
  slidePanelInner: {
    flex: 1,
  },
  panelHeader: {
    height: 64,
  },
  panelScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  formGroup: {
    marginBottom: 16,
  },
  textInput: {
    width: '100%',
    height: 46,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    color: '#fff',
    fontSize: 13,
    paddingHorizontal: 16,
  },
  passwordInputWrap: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 48,
  },
  passwordVisibilityButton: {
    position: 'absolute',
    right: 2,
    top: 0,
    width: 44,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleSign: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
    zIndex: 10,
  },
  saveBtn: {
    backgroundColor: ACCENT,
  },
  panelPromptCard: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  glassSettingCard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  agreementIntro: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  agreementCard: {
    minHeight: 72,
    borderRadius: 18,
    backgroundColor: '#161617',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyAgreementCard: {
    borderRadius: 18,
    backgroundColor: '#161617',
    padding: 18,
  },
  agreementTitle: { color: '#fff', fontSize: 13 },
  agreementMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 5 },
  surveyCenterLoading: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  surveySectionLabel: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 18,
    marginTop: 4,
  },
  surveyHistoryLabel: {
    marginTop: 28,
  },
  surveySectionDescription: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
    marginBottom: 12,
  },
  surveyEmptyCard: {
    minHeight: 92,
    borderRadius: 20,
    backgroundColor: '#161617',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.055)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    gap: 10,
  },
  surveyEmptyText: {
    color: 'rgba(255,255,255,0.43)',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
  surveyRetryButton: {
    minHeight: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  surveyRetryText: {
    color: '#fff',
    fontSize: 11,
  },
  availableSurveyCard: {
    borderRadius: 22,
    backgroundColor: '#161617',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.065)',
    padding: 16,
    marginBottom: 10,
  },
  surveyCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  surveyStatusIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.045)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  surveyCardTitle: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 18,
  },
  surveyCardMeta: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 3,
  },
  surveyCardDescription: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 13,
  },
  surveyCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 14,
  },
  surveyExpiryRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  surveyExpiryText: {
    flex: 1,
    color: 'rgba(255,255,255,0.3)',
    fontSize: 9,
    lineHeight: 13,
  },
  surveyStartButton: {
    minHeight: 38,
    borderRadius: 13,
    backgroundColor: ACCENT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
  },
  surveyStartButtonText: {
    color: '#090A08',
    fontSize: 10,
  },
  surveyHistoryCard: {
    borderRadius: 20,
    backgroundColor: '#161617',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.055)',
    padding: 15,
    marginBottom: 9,
  },
  surveyHistoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  surveyCompletedIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(217,255,102,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  surveyAnswerList: {
    marginTop: 14,
    paddingTop: 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.055)',
  },
  surveyAnswerRow: {
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.045)',
  },
  surveyAnswerPrompt: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 10,
    lineHeight: 15,
  },
  surveyAnswerValue: {
    color: '#fff',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  surveyBuildMeta: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 9,
    marginTop: 11,
    textTransform: 'capitalize',
  },
  iconCircleOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(239,68,68,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerActionBtn: {
    backgroundColor: '#ef4444',
  },
  cancelBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  deleteModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  deleteModalCard: {
    width: '100%',
    maxWidth: 430,
    maxHeight: '92%',
    backgroundColor: '#161617',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.24)',
    overflow: 'hidden',
  },
  deleteModalContent: {
    padding: 22,
  },
  deleteIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 14,
  },
  deleteModalTitle: {
    color: '#fff',
    fontSize: 22,
    textAlign: 'center',
    marginBottom: 8,
  },
  deleteWarning: {
    color: '#fca5a5',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 16,
  },
  deleteConsequences: {
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderRadius: 18,
    padding: 14,
    gap: 11,
  },
  deleteConsequenceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  deleteBullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#ef4444',
    marginTop: 6,
    marginRight: 10,
  },
  deleteConsequenceText: {
    flex: 1,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    lineHeight: 17,
  },
  deleteSubscriptionNotice: {
    color: 'rgba(255,255,255,0.46)',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 12,
  },
  deleteSubscriptionButton: {
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    backgroundColor: 'rgba(239,68,68,0.08)',
    paddingHorizontal: 14,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deleteSubscriptionButtonText: {
    color: '#fca5a5',
    fontSize: 11,
  },
  deleteAcknowledgement: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
  },
  deleteCheckbox: {
    width: 21,
    height: 21,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  deleteCheckboxChecked: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  deleteAcknowledgementText: {
    flex: 1,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    lineHeight: 17,
  },
  deleteConfirmButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  deleteConfirmButtonDisabled: {
    opacity: 0.38,
  },
  deleteConfirmButtonText: {
    color: '#fff',
    fontSize: 13,
    textAlign: 'center',
  },
  deleteCancelButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  deleteCancelButtonText: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 12,
  },
});

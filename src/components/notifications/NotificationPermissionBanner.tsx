"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import auth from '@react-native-firebase/auth';
import { BellOff, ChevronRight, X } from 'lucide-react-native';
import Animated, { Easing, FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  requestFCMPermissionAndRegister,
  PUSH_NOTIFICATIONS_ENABLED_KEY,
  subscribeToPushNotificationStateChanges,
} from '../../lib/fcm';
import { lightTap, notifySuccess } from '../../lib/haptics';
import { storage } from '../../lib/storage';
import { ACCENT } from '../../lib/theme';
import { useTranslation } from '../../lib/i18n';
import { Text } from '../ui/Text';

type PromptState = 'hidden' | 'requestable' | 'blocked' | 'retryable';

const PENDING_PROFILE_SETUP_KEY = 'pending_profile_setup_user_id';

function hasSystemPermission(permission: Notifications.NotificationPermissionsStatus) {
  if (permission.granted || permission.status === Notifications.PermissionStatus.GRANTED) return true;

  return permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL;
}

export function NotificationPermissionBanner() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [promptState, setPromptState] = useState<PromptState>('hidden');
  const [dismissed, setDismissed] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const attemptedAndroidStartupRequest = useRef(false);

  const refreshPermission = useCallback(async () => {
    try {
      const isLoggedIn = Boolean(auth().currentUser);
      const isProfileSetupPending = Boolean(storage.getString(PENDING_PROFILE_SETUP_KEY));

      if (!isLoggedIn || isProfileSetupPending) {
        setPromptState('hidden');
        return;
      }

      const permission = await Notifications.getPermissionsAsync();
      const systemEnabled = hasSystemPermission(permission);
      const registered = storage.getBoolean(PUSH_NOTIFICATIONS_ENABLED_KEY) === true;

      if (systemEnabled && registered) {
        setPromptState('hidden');
      } else if (!systemEnabled) {
        setPromptState(permission.canAskAgain ? 'requestable' : 'blocked');
      } else {
        setPromptState('retryable');
      }
    } catch (error) {
      console.warn('[Notifications] Could not read notification permission:', error);
    }
  }, []);

  useEffect(() => {
    void refreshPermission();
    const unsubscribePushState = subscribeToPushNotificationStateChanges(() => {
      void refreshPermission();
    });
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setDismissed(false);
        void refreshPermission();
      }
    });
    return () => {
      unsubscribePushState();
      subscription.remove();
    };
  }, [refreshPermission]);

  useEffect(() => {
    if (
      Platform.OS !== 'android' ||
      promptState !== 'requestable' ||
      attemptedAndroidStartupRequest.current
    ) {
      return;
    }

    // The banner only mounts in the authenticated app, which gives Android a
    // valid foreground Activity and lets us register the token immediately.
    attemptedAndroidStartupRequest.current = true;
    setIsWorking(true);
    void requestFCMPermissionAndRegister()
      .then((enabled) => {
        if (enabled) {
          notifySuccess();
          setPromptState('hidden');
        } else {
          void refreshPermission();
        }
      })
      .finally(() => setIsWorking(false));
  }, [promptState, refreshPermission]);

  const handleEnable = async () => {
    lightTap();

    if (promptState === 'blocked') {
      await Linking.openSettings();
      return;
    }

    setIsWorking(true);
    const enabled = await requestFCMPermissionAndRegister();
    setIsWorking(false);

    if (enabled) {
      notifySuccess();
      setPromptState('hidden');
      return;
    }

    await refreshPermission();
  };

  if (promptState === 'hidden' || dismissed) return null;

  const actionLabel = promptState === 'blocked'
    ? t('notificationPrompt.openSettings')
    : promptState === 'retryable'
      ? t('notificationPrompt.retry')
      : t('notificationPrompt.enable');

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { top: Math.max(insets.top, 10) + 8 }]}
    >
      <Animated.View
        entering={FadeInDown.duration(360).easing(Easing.out(Easing.cubic))}
        exiting={FadeOutUp.duration(240).easing(Easing.inOut(Easing.cubic))}
      >
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <BellOff size={20} color={ACCENT} strokeWidth={2.25} />
            </View>

            <View style={styles.copy}>
              <Text weight="bold" style={styles.title}>{t('notificationPrompt.title')}</Text>
              <Text style={styles.body} numberOfLines={2}>{t('notificationPrompt.body')}</Text>
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              activeOpacity={0.65}
              hitSlop={10}
              onPress={() => {
                lightTap();
                setDismissed(true);
              }}
              style={styles.close}
            >
              <X size={16} color="rgba(255,255,255,0.58)" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.68}
            disabled={isWorking}
            onPress={handleEnable}
            style={[styles.action, isWorking && styles.actionWorking]}
          >
            <Text weight="bold" style={styles.actionText}>
              {isWorking ? t('notificationPrompt.enabling') : actionLabel}
            </Text>
            {!isWorking && <ChevronRight size={14} color={ACCENT} strokeWidth={2.6} />}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 90,
    elevation: 18,
  },
  card: {
    minHeight: 100,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: '#1C1C1F',
    borderWidth: 1,
    borderColor: '#2B2B2F',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#30231A',
    marginRight: 12,
  },
  copy: { flex: 1, paddingRight: 6 },
  title: { color: '#F7F7F8', fontSize: 14.5, lineHeight: 19, letterSpacing: -0.15 },
  body: { color: '#A6A6AD', fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  action: {
    minHeight: 24,
    marginTop: 7,
    marginLeft: 50,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  actionWorking: { opacity: 0.68 },
  actionText: { color: ACCENT, fontSize: 11.5, lineHeight: 16, letterSpacing: 0, marginRight: 2 },
  close: {
    width: 28,
    height: 28,
    marginTop: -3,
    marginRight: -4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#28282C',
  },
});

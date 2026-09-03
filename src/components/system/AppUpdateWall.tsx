import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../ui/Text';
import { useTranslation } from '../../lib/i18n';
import {
  currentAppVersionContext,
  type AppVersionRequirement,
} from '../../lib/appVersion';

export type AppUpdateGateState =
  | { status: 'checking' }
  | { status: 'error' }
  | { status: 'required'; requirement: AppVersionRequirement }
  | { status: 'satisfied' };

type Props = {
  state: AppUpdateGateState;
  onRetry: () => void;
  onStoreError: () => void;
};

export function AppUpdateWall({ state, onRetry, onStoreError }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [openingStore, setOpeningStore] = useState(false);
  const [moreInfoVisible, setMoreInfoVisible] = useState(false);
  const openedStoreRef = useRef(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && openedStoreRef.current) {
        openedStoreRef.current = false;
        setOpeningStore(false);
        onRetry();
      }
    });
    return () => subscription.remove();
  }, [onRetry]);

  const openStore = useCallback(async () => {
    if (state.status !== 'required' || openingStore) return;
    setOpeningStore(true);
    try {
      openedStoreRef.current = true;
      await Linking.openURL(state.requirement.updateUrl);
    } catch {
      openedStoreRef.current = false;
      setOpeningStore(false);
      onStoreError();
    }
  }, [onStoreError, openingStore, state]);

  const isChecking = state.status === 'checking';
  const isError = state.status === 'error';
  const context = currentAppVersionContext();

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 28) + 16,
          paddingBottom: Math.max(insets.bottom, 20) + 8,
        },
      ]}
    >
      <View style={styles.content}>
        <Image
          source={require('../../../assets/logo.png')}
          resizeMode="contain"
          style={styles.logo}
          accessibilityIgnoresInvertColors
        />

        <Text weight="bold" style={styles.title}>
          {isChecking
            ? t('appUpdate.checkingTitle')
            : isError
              ? t('appUpdate.errorTitle')
              : t('appUpdate.requiredTitle')}
        </Text>
        {!isChecking ? (
          <Text style={styles.body}>
            {isError ? t('appUpdate.errorBody') : t('appUpdate.requiredBody')}
          </Text>
        ) : null}

        {state.status === 'required' ? (
          <View style={styles.versionSummary}>
            <View style={styles.versionColumn}>
              <Text style={styles.versionLabel}>{t('appUpdate.currentVersion')}</Text>
              <Text weight="medium" style={styles.versionValue}>
                {context.appVersion}
              </Text>
              <Text style={styles.buildValue}>
                {t('appUpdate.build', { build: context.buildNumber ?? '—' })}
              </Text>
            </View>
            <View style={styles.versionSeparator} />
            <View style={styles.versionColumn}>
              <Text style={styles.versionLabel}>{t('appUpdate.minimumVersion')}</Text>
              <Text weight="medium" style={styles.versionValue}>
                {state.requirement.minimumVersion}
              </Text>
              <Text style={styles.buildValue}>
                {t('appUpdate.build', { build: state.requirement.minimumBuildNumber })}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        {state.status === 'required' ? (
          <>
            <TouchableOpacity
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel={t('appUpdate.updateNow')}
              disabled={openingStore}
              onPress={openStore}
              style={styles.primaryButton}
            >
              {openingStore ? (
                <ActivityIndicator color="#090704" />
              ) : (
                <Text weight="bold" style={styles.primaryButtonText}>
                  {t('appUpdate.updateNow')}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={t('appUpdate.moreInfo')}
              onPress={() => setMoreInfoVisible(true)}
              style={styles.secondaryButton}
            >
              <Text weight="medium" style={styles.secondaryButtonText}>
                {t('appUpdate.moreInfo')}
              </Text>
            </TouchableOpacity>
          </>
        ) : isError ? (
          <TouchableOpacity
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={t('common.retry')}
            onPress={onRetry}
            style={styles.primaryButton}
          >
            <Text weight="bold" style={styles.primaryButtonText}>
              {t('common.retry')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Modal
        visible={moreInfoVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setMoreInfoVisible(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            onPress={() => setMoreInfoVisible(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              styles.infoSheet,
              { paddingBottom: Math.max(insets.bottom, 20) + 4 },
            ]}
          >
            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.infoContent}
            >
              <Text weight="bold" style={styles.infoTitle}>
                {t('appUpdate.moreInfoTitle')}
              </Text>
              <Text style={styles.infoIntro}>
                {t('appUpdate.moreInfoIntro')}
              </Text>

              <Text weight="bold" style={styles.infoStepTitle}>
                {t('appUpdate.afterUpdateTitle')}
              </Text>
              <Text style={styles.infoStepBody}>
                {t('appUpdate.afterUpdateBody')}
              </Text>

              <Text weight="bold" style={styles.infoStepTitle}>
                {t('appUpdate.reinstallTitle')}
              </Text>
              <Text style={styles.infoStepBody}>
                {t('appUpdate.reinstallBody')}
              </Text>

              <Text style={styles.infoWarning}>
                {t('appUpdate.reinstallWarning')}
              </Text>
            </ScrollView>
            <TouchableOpacity
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              onPress={() => setMoreInfoVisible(false)}
              style={styles.closeButton}
            >
              <Text weight="bold" style={styles.closeButtonText}>
                {t('common.close')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  logo: {
    width: 136,
    height: 136,
    marginBottom: 36,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.7,
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
    maxWidth: 340,
  },
  versionSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 30,
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  versionColumn: {
    minWidth: 104,
    alignItems: 'center',
  },
  versionSeparator: {
    width: StyleSheet.hairlineWidth,
    height: 48,
    marginHorizontal: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  versionLabel: {
    color: 'rgba(255,255,255,0.44)',
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 5,
  },
  versionValue: {
    color: '#fff',
    fontSize: 17,
    lineHeight: 22,
  },
  buildValue: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  footer: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: '#F7B84B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primaryButtonText: {
    color: '#090704',
    fontSize: 16,
  },
  secondaryButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  secondaryButtonText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 15,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  infoSheet: {
    maxHeight: '82%',
    paddingTop: 8,
    paddingHorizontal: 24,
    backgroundColor: '#111111',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  infoContent: {
    paddingTop: 24,
    paddingBottom: 20,
  },
  infoTitle: {
    color: '#fff',
    fontSize: 25,
    lineHeight: 31,
    letterSpacing: -0.4,
  },
  infoIntro: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 24,
  },
  infoStepTitle: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 5,
  },
  infoStepBody: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 22,
  },
  infoWarning: {
    color: 'rgba(255,255,255,0.46)',
    fontSize: 13,
    lineHeight: 19,
  },
  closeButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#F7B84B',
  },
  closeButtonText: {
    color: '#090704',
    fontSize: 16,
  },
});

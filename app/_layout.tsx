import 'react-native-gesture-handler'; // MUST be at the absolute top of the root entry file!
import '../global.css'; 
import '../widgets';
import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Platform, AppState, InteractionManager, Keyboard } from 'react-native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { NavigationBar } from 'expo-navigation-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import messaging from '@react-native-firebase/messaging';
import crashlytics from '@react-native-firebase/crashlytics';
import analytics from '@react-native-firebase/analytics';
import auth from '@react-native-firebase/auth';
import * as Notifications from 'expo-notifications';

import { useStreaksStore } from '../src/store/useStreaksStore';
import { useTodayStore } from '../src/store/useTodayStore';
import { storage } from '../src/lib/storage';
import { syncWidgetSessionState } from '../src/lib/widgetSync';
import { GlobalFeedback } from '../src/components/feedback/GlobalFeedback';
import { createNotificationDeepLink, getNotificationText } from '../src/lib/notification-texts';
import { useGroupStore } from '../src/store/useGroupStore';
import {
  addDiagnosticBreadcrumb,
  flushDiagnosticQueue,
  initializeDiagnostics,
  reportHttpFailure,
} from '../src/lib/diagnostics';
import {
  AppUpdateWall,
  type AppUpdateGateState,
} from '../src/components/system/AppUpdateWall';
import { checkAppVersion } from '../src/lib/appVersion';

const DeferredGlobalUploadBanner = React.lazy(async () => {
  const module = await import('../src/components/record/GlobalUploadBanner');
  return { default: module.GlobalUploadBanner };
});

const DeferredGlobalSurveyHost = React.lazy(async () => {
  const module = await import('../src/components/surveys/GlobalSurveyHost');
  return { default: module.GlobalSurveyHost };
});

const APP_CONTENT_PATHS = new Set(['/today', '/record', '/social', '/streaks', '/profile']);

function useDeferredReady(enabled: boolean, delayMs: number) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled || ready) return;
    let interactionTask: ReturnType<typeof InteractionManager.runAfterInteractions> | null = null;
    const timer = setTimeout(() => {
      interactionTask = InteractionManager.runAfterInteractions(() => setReady(true));
    }, delayMs);
    return () => {
      clearTimeout(timer);
      interactionTask?.cancel();
    };
  }, [delayMs, enabled, ready]);
  return ready;
}

const PUSH_ROUTES: Record<string, string> = {
  '/today': '/(app)/today',
  '/record': '/(app)/record',
  '/social': '/(app)/social',
  '/streaks': '/(app)/streaks',
  '/profile': '/(app)/profile',
};

const ALLOWED_NOTIFICATION_PARAMS = new Set([
  'groupId', 'clipId', 'assignmentId', 'date', 'focus', 'itemId', 'userId',
]);

function parseNotificationDestination(value: unknown) {
  if (typeof value !== 'string' || value.length > 2048) return null;

  try {
    const parsed = new URL(value, 'https://myturn.local');
    const pathname = PUSH_ROUTES[parsed.pathname];
    if (!pathname) return null;

    const params: Record<string, string> = {};
    parsed.searchParams.forEach((paramValue, key) => {
      if (ALLOWED_NOTIFICATION_PARAMS.has(key) && paramValue.length <= 256) {
        params[key] = paramValue;
      }
    });

    return { pathname, params };
  } catch {
    return null;
  }
}

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Configure local push notifications delivery presentation settings with strict typing attributes
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Catch unhandled JS exceptions globally and report to Crashlytics
const globalAny = globalThis as any;
if (globalAny.ErrorUtils) {
  const defaultErrorHandler = globalAny.ErrorUtils.getGlobalHandler();
  globalAny.ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    crashlytics().recordError(error);
    reportHttpFailure({
      route: 'app/runtime',
      method: 'RUNTIME',
      status: 0,
      code: isFatal ? 'FATAL_JS_ERROR' : 'UNHANDLED_JS_ERROR',
      errorType: error?.name || 'Error',
      errorMessage: error?.message,
      context: { fatal: Boolean(isFatal) },
    });
    void flushDiagnosticQueue({ forceFinalize: true });
    if (defaultErrorHandler) {
      defaultErrorHandler(error, isFatal);
    }
  });
}

// Global Error Boundary to catch React rendering exceptions
class GlobalErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    crashlytics().recordError(error);
    crashlytics().log(`React Component Stack: ${info.componentStack}`);
    reportHttpFailure({
      route: 'app/react',
      method: 'RENDER',
      status: 0,
      code: 'REACT_RENDER_ERROR',
      errorType: error.name,
      errorMessage: error.message,
      context: { hasComponentStack: Boolean(info.componentStack) },
    });
    void flushDiagnosticQueue({ forceFinalize: true });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ color: '#fff', fontSize: 16, textAlign: 'center', fontFamily: 'Satoshi-Bold' }}>
            Beklenmeyen bir hata oluştu.
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center', marginTop: 8, fontFamily: 'Satoshi-Medium' }}>
            Hata raporu geliştirici ekibine iletildi. Uygulamayı yeniden başlatmayı deneyebilirsiniz.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// Catch and handle background messages outside of the React lifecycle
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('[FCM] Background message received:', remoteMessage.messageId || 'unknown');
  const groupId = storage.getString('active_group_id');
  if (groupId) {
    // A data/content-available push can wake the app briefly. Use that window
    // to refresh the shared WidgetKit timeline with the newest server state.
    await Promise.allSettled([
      useTodayStore.getState().fetchTodayVlogs(groupId),
      useStreaksStore.getState().fetchStreaksData(groupId),
    ]);
  }
});

export default function RootLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const [fontsLoaded, error] = useFonts({
    'Satoshi-Regular': require('../assets/fonts/Satoshi-Regular.ttf'),
    'Satoshi-Medium': require('../assets/fonts/Satoshi-Medium.ttf'),
    'Satoshi-Bold': require('../assets/fonts/Satoshi-Bold.ttf'),
  });
  const [versionGate, setVersionGate] = useState<AppUpdateGateState>({ status: 'checking' });
  const versionCheckInFlight = useRef(false);
  const versionSatisfied = versionGate.status === 'satisfied';
  const visibleRouteReady = versionSatisfied && Boolean(pathname);
  const appContentRouteReady = versionSatisfied && APP_CONTENT_PATHS.has(pathname);
  const uploadUiReady = useDeferredReady(appContentRouteReady, 2_000);
  const surveyReady = useDeferredReady(appContentRouteReady, 5_000);
  const secondaryServicesReady = useDeferredReady(visibleRouteReady, 8_000);
  const maintenanceReady = useDeferredReady(visibleRouteReady, 12_000);

  const runVersionCheck = useCallback(async (forceRefresh = false) => {
    if (versionCheckInFlight.current) return;
    versionCheckInFlight.current = true;
    setVersionGate({ status: 'checking' });
    try {
      const result = await checkAppVersion({ forceRefresh });
      if (!result.success) {
        setVersionGate({ status: 'error' });
      } else if (result.updateRequired) {
        setVersionGate({ status: 'required', requirement: result.requirement });
      } else {
        setVersionGate({ status: 'satisfied' });
      }
    } catch {
      setVersionGate({ status: 'error' });
    } finally {
      versionCheckInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (!maintenanceReady) return;
    initializeDiagnostics();
  }, [maintenanceReady]);

  useEffect(() => {
    // Start the mandatory network decision on the first React commit, while
    // fonts and native startup work are still loading. This avoids serializing
    // font loading -> version request -> content navigation.
    void runVersionCheck(false);
  }, [runVersionCheck]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    NavigationBar.setHidden(true);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') NavigationBar.setHidden(true);
    });
    const keyboardSubscription = Keyboard.addListener('keyboardDidHide', () => {
      NavigationBar.setHidden(true);
    });

    return () => {
      appStateSubscription.remove();
      keyboardSubscription.remove();
    };
  }, []);

  // Native configuration keeps Analytics off before JavaScript starts. Apply
  // the user's persisted opt-in here before any app-owned events are logged.
  useEffect(() => {
    if (!secondaryServicesReady) return;
    const task = InteractionManager.runAfterInteractions(() => {
      void import('../src/lib/analyticsPrivacy').then(({ applyAnalyticsPreference }) => (
        applyAnalyticsPreference()
      )).catch((preferenceError) => {
        console.warn('[Analytics] Could not apply collection preference', preferenceError);
      });
    });
    return () => task.cancel();
  }, [secondaryServicesReady]);

  // Run HLS Media Cache Garbage Collection quietly on mount
  useEffect(() => {
    if (!maintenanceReady) return;
    if (!auth().currentUser) {
      syncWidgetSessionState(false, false);
    }
    const task = InteractionManager.runAfterInteractions(() => {
      void import('../src/lib/MediaCache').then(({ runGarbageCollection }) => (
        runGarbageCollection()
      ));
    });
    return () => task.cancel();
  }, [maintenanceReady]);

  // Keep the device-token mapping fresh and route notification taps from
  // foreground, background, and cold-start states through a strict allowlist.
  useEffect(() => {
    let mounted = true;
    const navigateFromNotification = (value: unknown) => {
      if (!mounted || !auth().currentUser) return;
      const destination = parseNotificationDestination(value);
      if (!destination) return;

      if (destination.params.groupId) {
        useGroupStore.getState().setActiveGroupId(destination.params.groupId);
      }
      router.push(destination as never);
    };

    const deferredTask = InteractionManager.runAfterInteractions(() => {
      void messaging().getInitialNotification().then((message) => {
        if (message) navigateFromNotification(message.data?.url);
      }).catch((error) => {
        console.warn('[FCM] Initial notification lookup failed:', error);
      });
    });
    const unsubscribeOpened = messaging().onNotificationOpenedApp((message) => {
      navigateFromNotification(message.data?.url);
    });
    const unsubscribeForeground = messaging().onMessage(async (message) => {
      if (message.data?.url === '/today' || message.data?.url === '/record') {
        const groupId = storage.getString('active_group_id');
        if (groupId) {
          await useTodayStore.getState().fetchTodayVlogs(groupId);
        }
      }
      if (!message.notification?.title && !message.notification?.body) return;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: message.notification?.title || 'MyTurn',
          body: message.notification?.body || '',
          data: { url: message.data?.url || '' },
        },
        trigger: null,
      });
    });
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateFromNotification(response.notification.request.content.data?.url);
    });

    return () => {
      mounted = false;
      deferredTask.cancel();
      unsubscribeOpened();
      unsubscribeForeground();
      responseSubscription.remove();
    };
  }, [router]);

  useEffect(() => {
    if (!secondaryServicesReady) return;
    let mounted = true;
    let unsubscribeTokenRefresh = () => {};
    const task = InteractionManager.runAfterInteractions(() => {
      void import('../src/lib/fcm').then((fcm) => {
        if (!mounted) return;
        void fcm.syncFCMTokenIfEnabled();
        unsubscribeTokenRefresh = fcm.subscribeToFCMTokenRefresh();
      });
    });
    return () => {
      mounted = false;
      task.cancel();
      unsubscribeTokenRefresh();
    };
  }, [secondaryServicesReady]);

  // Analytics: Automatically log screen views when the pathname changes
  useEffect(() => {
    if (secondaryServicesReady && pathname) {
      addDiagnosticBreadcrumb({
        category: 'navigation',
        name: 'screen_view',
        outcome: 'success',
        context: { screen: pathname },
      });
      analytics().logScreenView({
        screen_name: pathname,
        screen_class: pathname,
      }).catch(err => console.warn('[Analytics] Screen tracking error', err));
    }
  }, [pathname, secondaryServicesReady]);

  // RevenueCat Defensive Initialization
  useEffect(() => {
    if (!secondaryServicesReady) return;
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
    const task = InteractionManager.runAfterInteractions(() => {
      void import('../src/lib/revenueCat').then(({ syncRevenueCat }) => {
        const userId = storage.getString('auth_user_id') || auth().currentUser?.uid;
        void syncRevenueCat(userId || undefined).catch(console.warn);
      });
    });
    return () => task.cancel();
  }, [secondaryServicesReady]);

  // Sync background upload queues on launch
  useEffect(() => {
    if (!uploadUiReady) return;
    const task = InteractionManager.runAfterInteractions(() => {
      void import('../src/store/useUploadQueueStore').then(({ useUploadQueueStore }) => {
        if (Object.keys(useUploadQueueStore.getState().tasks).length > 0) {
          void useUploadQueueStore.getState().reconcileActiveUploadsOnStart();
        }
      });
    });
    return () => task.cancel();
  }, [uploadUiReady]);

  // Monitor AppState to dispatch background status notifications
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      addDiagnosticBreadcrumb({
        category: 'app',
        name: 'app_state_changed',
        outcome: 'success',
        context: { state: nextAppState },
      });
      if (nextAppState === 'background') {
        void flushDiagnosticQueue({ forceFinalize: true });
        const { useUploadQueueStore } = await import('../src/store/useUploadQueueStore');
        const tasks = useUploadQueueStore.getState().tasks;
        const activeTask = Object.values(tasks)[0];

        // Trigger local notification if the app process gets suspended mid-upload
        if (activeTask && (activeTask.status === 'uploading' || activeTask.status === 'slicing')) {
          const progress = Math.min(100, Math.round(
            (activeTask.chunks.reduce((sum, chunk) => sum + chunk.bytesSent, 0) / activeTask.totalSize) * 100
          ));

          // Generate an elegant, textual progress bar to render directly in standard iOS & Android notifications tray
          const totalBlocks = 10;
          const completedBlocks = Math.round((progress / 100) * totalBlocks);
          const remainingBlocks = totalBlocks - completedBlocks;
          const progressTrackSymbol = '■'.repeat(completedBlocks) + '□'.repeat(remainingBlocks);
          const notification = getNotificationText(
            storage.getString('myturn_lang'),
            'uploadProgress',
            { progress, progressBar: progressTrackSymbol },
            'tr',
          );

          Notifications.scheduleNotificationAsync({
            identifier: 'vlog_upload_progress',
            content: {
              ...notification,
              data: {
                url: createNotificationDeepLink({
                  screen: 'record',
                  groupId: activeTask.groupId,
                  focus: 'upload',
                  itemId: activeTask.id,
                }),
              },
            },
            trigger: null, // deliver immediately
          }).catch(() => {});
        }
      } else if (nextAppState === 'active') {
        void flushDiagnosticQueue();
        // Uploads and transcoding continue independently of the UI. Reconcile
        // immediately when the user returns instead of waiting for the banner poll.
        const { useUploadQueueStore } = await import('../src/store/useUploadQueueStore');
        if (Object.keys(useUploadQueueStore.getState().tasks).length > 0) {
          void useUploadQueueStore.getState().reconcileActiveUploadsOnStart();
        }
        Notifications.dismissNotificationAsync('vlog_upload_progress').catch(() => {});
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (error) {
      crashlytics().recordError(error);
      throw error;
    }
    if (fontsLoaded && versionGate.status !== 'checking') {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, error, versionGate.status]);

  if (!fontsLoaded || versionGate.status === 'checking') {
    return null;
  }

  return (
    <GlobalErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
        <StatusBar style="light" />
        {Platform.OS === 'android' ? <NavigationBar hidden style="dark" /> : null}
        {versionSatisfied ? (
          <GlobalFeedback enabled={maintenanceReady}>
            <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(app)" />
              <Stack.Screen name="group/join" />
            </Stack>
            {surveyReady ? (
              <Suspense fallback={null}>
                <DeferredGlobalSurveyHost />
              </Suspense>
            ) : null}

            {/* Sleek, Non-Blocking Expandable Progress Overlay Panel */}
            {uploadUiReady ? (
              <Suspense fallback={null}>
                <DeferredGlobalUploadBanner />
              </Suspense>
            ) : null}
          </GlobalFeedback>
        ) : (
          <AppUpdateWall
            state={versionGate}
            onRetry={() => void runVersionCheck(true)}
            onStoreError={() => setVersionGate({ status: 'error' })}
          />
        )}
      </GestureHandlerRootView>
    </GlobalErrorBoundary>
  );
}

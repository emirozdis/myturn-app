// app/(app)/_layout.tsx

import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, AppState, PanResponder, Platform, StyleSheet, View } from "react-native";
import { DarkTheme, ThemeProvider } from "expo-router/react-navigation";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Tabs, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  FileText,
  BookOpen,
  Camera,
  Search,
  Settings,
} from "lucide-react-native";

import { ACCENT } from "../../src/lib/theme";
import { useGroupStore } from "../../src/store/useGroupStore";
import { useStreaksStore } from "../../src/store/useStreaksStore";
import { useTodayStore } from "../../src/store/useTodayStore";
import { syncWidgetSessionState } from "../../src/lib/widgetSync";

import { AchievementOverlay } from "../../src/components/achievements/AchievementOverlay";
import { NotificationPermissionBanner } from "../../src/components/notifications/NotificationPermissionBanner";
import { useTranslation } from "../../src/lib/i18n";
import { getPendingGroupInvite } from "../../src/lib/pendingGroupInvite";
import { GuideTour } from "../../src/components/guides/GuideTour";
import { clearInitialGuideRequest, shouldShowInitialGuide } from "../../src/lib/guides";
import { useRefreshAllData } from "../../src/hooks/useRefreshAllData";
import { mediumTap } from "../../src/lib/haptics";
import { useHasBlockingOverlay } from "../../src/lib/blockingOverlay";

const PULL_TO_REFRESH_DISTANCE = 72;

function PullToRefreshSurface({ children, topInset }: { children: React.ReactNode; topInset: number }) {
  const { refreshing, refreshAllData } = useRefreshAllData();
  const hasBlockingOverlay = useHasBlockingOverlay();
  const refreshStartLimit = Math.max(88, topInset + 56);
  const panResponder = useMemo(() => {
    const completeRefresh = () => {
      void refreshAllData()
        .then((didRefresh) => {
          if (didRefresh) mediumTap();
        })
        .catch(() => {});
    };

    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gestureState) => (
        !refreshing
        && !hasBlockingOverlay
        && gestureState.y0 <= refreshStartLimit
        && gestureState.dy > 22
        && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.8
      ),
      onPanResponderRelease: (_, gestureState) => {
        if (
          !hasBlockingOverlay
          && gestureState.y0 <= refreshStartLimit
          && gestureState.dy >= PULL_TO_REFRESH_DISTANCE
        ) {
          completeRefresh();
        }
      },
      onPanResponderTerminate: (_, gestureState) => {
        if (
          !hasBlockingOverlay
          && gestureState.y0 <= refreshStartLimit
          && gestureState.dy >= PULL_TO_REFRESH_DISTANCE
        ) {
          completeRefresh();
        }
      },
    });
  }, [hasBlockingOverlay, refreshAllData, refreshStartLimit, refreshing]);

  return (
    <View style={styles.refreshSurface} {...panResponder.panHandlers}>
      {children}
      {refreshing ? (
        <View
          pointerEvents="none"
          style={[styles.refreshIndicator, { top: Math.max(topInset, 8) + 8 }]}
        >
          <ActivityIndicator size="small" color="#fff" />
        </View>
      ) : null}
    </View>
  );
}

export default function AppLayout() {
  const groupStore = useGroupStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [showInitialGuide, setShowInitialGuide] = useState(shouldShowInitialGuide);

  useEffect(() => {
    if (getPendingGroupInvite()) {
      router.replace('/(app)/social');
    }
  }, [router]);

  useEffect(() => {
    // Fetch groups on initial load
    groupStore.fetchGroups();
  }, []);

  useEffect(() => {
    const groupId = groupStore.activeGroupId;
    if (!groupStore.hasLoaded) return;
    if (!groupId) {
      syncWidgetSessionState(true, false);
      return;
    }

    // Clear the previous group's private snapshot before loading a newly
    // selected circle. The API responses below replace this loading state.
    syncWidgetSessionState(true, true);

    const refreshWidgetSources = () => {
      // These API refreshes also write their latest real values into the
      // shared WidgetKit timeline through syncWidgetData.
      Promise.allSettled([
        useTodayStore.getState().fetchTodayVlogs(groupId),
        useStreaksStore.getState().fetchStreaksData(groupId),
      ]).catch(() => {});
    };

    refreshWidgetSources();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshWidgetSources();
    });
    return () => subscription.remove();
  }, [groupStore.hasLoaded, groupStore.activeGroupId]);

  if (Platform.OS !== 'ios') {
    return (
      <PullToRefreshSurface topInset={insets.top}>
        <ThemeProvider value={DarkTheme}>
          <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: ACCENT,
            tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.45)',
            tabBarStyle: {
              backgroundColor: '#121214',
              borderTopColor: 'rgba(255, 255, 255, 0.08)',
              borderTopWidth: 1,
              // Android draws edge-to-edge, so the tab bar must own the
              // navigation/gesture inset instead of rendering behind it.
              height: 64 + insets.bottom,
              paddingBottom: Math.max(insets.bottom, 8),
              paddingTop: 8,
              elevation: 8,
              display: showInitialGuide ? 'none' : 'flex',
            },
            tabBarLabelStyle: {
              fontSize: 10,
              fontFamily: 'Satoshi-Bold',
              marginTop: 2,
            },
          }}
        >
          <Tabs.Screen
            name="today"
            options={{
              title: t('nav.today'),
              tabBarIcon: ({ color }) => <FileText size={20} color={color} />,
            }}
          />

          <Tabs.Screen
            name="streaks"
            options={{
              title: t('nav.archive'),
              tabBarIcon: ({ color }) => <BookOpen size={20} color={color} />,
            }}
          />

          <Tabs.Screen
            name="record"
            options={{
              title: t('nav.record'),
              tabBarIcon: ({ color }) => <Camera size={20} color={color} />,
            }}
          />

          <Tabs.Screen
            name="social"
            options={{
              title: t('nav.social'),
              tabBarIcon: ({ color }) => <Search size={20} color={color} />,
            }}
          />

          <Tabs.Screen
            name="profile"
            options={{
              title: t('nav.profile'),
              tabBarIcon: ({ color }) => <Settings size={20} color={color} />,
            }}
          />
          </Tabs>

          <AchievementOverlay />
          <NotificationPermissionBanner />
          <GuideTour
            guideId="groups"
            visible={showInitialGuide}
            onClose={() => {
              clearInitialGuideRequest();
              setShowInitialGuide(false);
            }}
          />
        </ThemeProvider>
      </PullToRefreshSurface>
    );
  }

  return (
    <PullToRefreshSurface topInset={insets.top}>
      <ThemeProvider value={DarkTheme}>
        <NativeTabs
        hidden={showInitialGuide}
        tintColor={ACCENT}
        labelStyle={{
          color: ACCENT,
        }}
      >
        <NativeTabs.Trigger name="today">
          <NativeTabs.Trigger.Label>{t('nav.today')}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{
              default: "doc.text.image",
              selected: "doc.text.image.fill",
            }}
          />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="streaks">
          <NativeTabs.Trigger.Label>{t('nav.archive')}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{
              default: "book",
              selected: "book.fill",
            }}
          />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="record">
          <NativeTabs.Trigger.Label>{t('nav.record')}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{
              default: "camera",
              selected: "camera.fill",
            }}
          />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="social">
          <NativeTabs.Trigger.Label>{t('nav.social')}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{
              default: "magnifyingglass",
              selected: "magnifyingglass",
            }}
          />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Label>{t('nav.profile')}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{
              default: "gear",
              selected: "gear",
            }}
          />
        </NativeTabs.Trigger>
        </NativeTabs>

        <AchievementOverlay />
        <NotificationPermissionBanner />
        <GuideTour
          guideId="groups"
          visible={showInitialGuide}
          onClose={() => {
            clearInitialGuideRequest();
            setShowInitialGuide(false);
          }}
        />
      </ThemeProvider>
    </PullToRefreshSurface>
  );
}

const styles = StyleSheet.create({
  refreshSurface: {
    flex: 1,
  },
  refreshIndicator: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 1000,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,20,22,0.88)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
  },
});

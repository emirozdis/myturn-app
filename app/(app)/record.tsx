"use client";

import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Modal, Alert, ActivityIndicator } from 'react-native';
import { useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useIsFocused } from "expo-router/react-navigation";
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useTodayStore } from '../../src/store/useTodayStore';
import { useRecordStore } from '../../src/store/useRecordStore';
import { useGroupStore } from '../../src/store/useGroupStore';
import { JoinOrCreateGroupWall } from '../../src/components/group/JoinOrCreateGroupWall';
import { WaitingForMembersView } from '../../src/components/group/WaitingForMembersView';
import { SleepModeView } from '../../src/components/today/SleepModeView';
import { storage } from '../../src/lib/storage';
import { useTranslation } from '../../src/lib/i18n';
import { isGuideReplayRequested } from '../../src/lib/guides';

import { PermissionsWall } from '../../src/components/record/PermissionsWall';
import { NotYourTurnWall } from '../../src/components/record/NotYourTurnWall';
import { CameraStep } from '../../src/components/record/CameraStep';
import { PreviewPublishStep } from '../../src/components/record/PreviewPublishStep';
import { RecordingSegment } from '../../src/components/record/types';

export default function RecordScreen() {
  const groupStore = useGroupStore();
  const router = useRouter();
  const isFocused = useIsFocused();
  const { t } = useTranslation();
  
  const todayStore = useTodayStore();
  const { step, setStep } = useRecordStore();

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  
  // Shared Recording Results State
  const [recordedSegments, setRecordedSegments] = useState<RecordingSegment[]>([]);
  const [acceptedPrompt, setAcceptedPrompt] = useState<string | null>(null);
  const [recorderResetToken, setRecorderResetToken] = useState(0);
  const [hasCameraDraft, setHasCameraDraft] = useState(false);
  const [captureModalVisible, setCaptureModalVisible] = useState(isFocused);
  const [hasValidatedCurrentTurn, setHasValidatedCurrentTurn] = useState(false);
  const pendingDestinationRef = useRef<'/(app)/today' | '/(app)/profile' | null>(null);
  const dismissalFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Capture Mode: Photo, Snippet (4s), or Vlog (120s)
  const [captureMode, setCaptureMode] = useState<'photo'|'snippet'|'vlog'>('vlog');

  const currentUserId = storage.getString('auth_user_id') || "";
  const isPassedButUnclaimed = todayStore.assignment?.isPassed && !todayStore.assignment?.isClaimed;
  const isCurrentUserVlogger = todayStore.assignment?.userId === currentUserId && !isPassedButUnclaimed;
  const [recordGuideReplay] = useState(() => isGuideReplayRequested('record'));
  const tutorialRecordMode = recordGuideReplay && !isCurrentUserVlogger;

  const needsPermissions = !cameraPermission?.granted || !microphonePermission?.granted;

  // Cleanly handle state resetting
  useEffect(() => {
    if (isFocused) {
      pendingDestinationRef.current = null;
      setCaptureModalVisible(true);
      setStep("CAMERA");
      setRecordedSegments([]);
      setAcceptedPrompt(null);
      setHasCameraDraft(false);
      setRecorderResetToken((token) => token + 1);
    } else {
      setCaptureModalVisible(false);
    }
  }, [isFocused, setStep]);

  useEffect(() => {
    const groupId = groupStore.activeGroupId;
    if (!isFocused || !groupId || recordGuideReplay) {
      setHasValidatedCurrentTurn(recordGuideReplay);
      return;
    }

    let active = true;
    setHasValidatedCurrentTurn(false);

    const refreshTurn = async () => {
      try {
        const store = useTodayStore.getState();
        if (store.loadedGroupId !== groupId) {
          await store.fetchTodayVlogs(groupId);
        } else {
          await store.refreshTodayTurnState(groupId);
        }
      } catch (error) {
        console.warn('[RecordScreen] Could not refresh current camera owner:', error);
      } finally {
        if (active) setHasValidatedCurrentTurn(true);
      }
    };

    void refreshTurn();
    const interval = setInterval(() => void refreshTurn(), 4_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [groupStore.activeGroupId, isFocused, recordGuideReplay]);

  useEffect(() => () => {
    if (dismissalFallbackRef.current) {
      clearTimeout(dismissalFallbackRef.current);
    }
  }, []);

  const finishPendingNavigation = () => {
    const destination = pendingDestinationRef.current;
    if (!destination) return;
    pendingDestinationRef.current = null;
    if (dismissalFallbackRef.current) {
      clearTimeout(dismissalFallbackRef.current);
      dismissalFallbackRef.current = null;
    }
    router.replace(destination);
  };

  const dismissRecorderAndNavigate = (destination: '/(app)/today' | '/(app)/profile') => {
    if (pendingDestinationRef.current) return;
    setHasCameraDraft(false);
    setRecordedSegments([]);
    setStep("CAMERA");
    pendingDestinationRef.current = destination;
    setCaptureModalVisible(false);

    // onDismiss is the authoritative iOS signal. The fallback also covers
    // Android and defensive cases where a native dismissal callback is lost.
    dismissalFallbackRef.current = setTimeout(finishPendingNavigation, 300);
  };

  const leaveRecordScreen = () => dismissRecorderAndNavigate('/(app)/today');

  const confirmDiscard = (body: string, onDiscard: () => void) => {
    Alert.alert(
      t('record.discardTitle'),
      body,
      [
        { text: t('record.keepRecording'), style: 'cancel' },
        { text: t('record.discard'), style: 'destructive', onPress: onDiscard },
      ],
    );
  };

  const handleClose = () => {
    if (!hasCameraDraft && recordedSegments.length === 0) {
      leaveRecordScreen();
      return;
    }

    confirmDiscard(t('record.leaveDiscardBody'), leaveRecordScreen);
  };

  const handleRetake = () => {
    confirmDiscard(t('record.retakeDiscardBody'), () => {
      setRecordedSegments([]);
      setAcceptedPrompt(null);
      setHasCameraDraft(false);
      setRecorderResetToken((token) => token + 1);
      setStep("CAMERA");
    });
  };

  const hasNoGroups = groupStore.groups.length === 0;

  // Detect and resolve frozen block constraint
  const activeGroup = groupStore.groups.find(g => g.id === groupStore.activeGroupId);
  const isFrozen = activeGroup?.isFrozen || todayStore.assignment?.group?.isFrozen || false;

  // Safely unmount the camera and UI to prevent blank screens and save battery
  if (!isFocused) {
    return <View style={styles.container} />;
  }

  if (hasNoGroups) {
    return <JoinOrCreateGroupWall />;
  }

  // Never decide camera eligibility from a previous group/day snapshot while
  // the authoritative ownership check for this tab focus is still in flight.
  if (
    (!hasValidatedCurrentTurn || todayStore.loadedGroupId !== groupStore.activeGroupId)
    && !recordGuideReplay
  ) {
    return (
      <View style={[styles.container, styles.validating]}>
        <ActivityIndicator color="#E97D2D" />
      </View>
    );
  }

  if (todayStore.assignmentAvailability?.status === 'waiting_for_members' && !recordGuideReplay) {
    return (
      <WaitingForMembersView
        groupName={activeGroup?.name}
        inviteCode={activeGroup?.inviteCode}
        memberCount={todayStore.assignmentAvailability.memberCount}
        minimumMemberCount={todayStore.assignmentAvailability.minimumMemberCount}
      />
    );
  }

  if (!todayStore.assignment && todayStore.assignmentAvailability?.status === 'sleep_mode' && !recordGuideReplay) {
    return (
      <View style={styles.container}>
        <SleepModeView
          hasVolunteeredForTomorrow={todayStore.hasVolunteeredForTomorrow}
          canVolunteer={todayStore.canVolunteer}
          volunteerEligibilityReason={todayStore.volunteerEligibilityReason}
          isVolunteering={todayStore.isVolunteering}
          volunteerError={todayStore.volunteerError}
          onToggleVolunteer={todayStore.toggleVolunteer}
          onWatchLastVlog={() => router.push('/(app)/streaks')}
        />
      </View>
    );
  }

  // --- Frozen State UI blocking (Bypasses permission and Turn validations) ---
  if (isFrozen && !recordGuideReplay) {
    return (
      <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(300)} style={styles.container}>
        <NotYourTurnWall
          vloggerName={todayStore.assignment?.user?.name || "Vlogger"}
          vloggerHandle={todayStore.assignment?.user?.handle || "vlogger"}
          isFrozen={true}
        />
      </Animated.View>
    );
  }

  // Eligibility comes before device permissions. People who are only here to
  // watch should never be asked for camera or microphone access.
  if (!isCurrentUserVlogger && !recordGuideReplay) {
    return (
      <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(300)} style={styles.container}>
        <NotYourTurnWall
          vloggerName={todayStore.assignment?.user?.name || "Vlogger"}
          vloggerHandle={todayStore.assignment?.user?.handle || "vlogger"}
          vloggerImage={todayStore.assignment?.user?.image}
          isFrozen={false}
        />
      </Animated.View>
    );
  }

  if (needsPermissions) {
    return (
      <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(300)} style={styles.container}>
        <PermissionsWall
          cameraGranted={Boolean(cameraPermission?.granted)}
          microphoneGranted={Boolean(microphonePermission?.granted)}
          canAskAgain={
            (cameraPermission?.granted || cameraPermission?.canAskAgain !== false)
            && (microphonePermission?.granted || microphonePermission?.canAskAgain !== false)
          }
          onRequestPermissions={async () => {
            try {
              if (!cameraPermission?.granted) await requestCameraPermission();
            } catch (error) {
              console.warn('[RecordScreen] Camera permission request failed:', error);
            }
            try {
              if (!microphonePermission?.granted) await requestMicrophonePermission();
            } catch (error) {
              console.warn('[RecordScreen] Microphone permission request failed:', error);
            }
          }}
        />
      </Animated.View>
    );
  }

  // --- Active Viewfinder Overlay (Temporarily covers tab bar only while filming/editing) ---
  return (
    <Modal
      visible={isFocused && captureModalVisible}
      animationType="none"
      transparent={true}
      statusBarTranslucent
      onRequestClose={handleClose}
      onDismiss={finishPendingNavigation}
    >
      <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(300)} style={styles.container}>
        <LinearGradient colors={['#171717', '#0a0a0a']} style={StyleSheet.absoluteFill} />

        {/*
          Keep CameraStep constantly mounted in the background to prevent
          native unmount race condition errors during asynchronous video finalization.
        */}
        <View style={StyleSheet.absoluteFill}>
          <CameraStep 
            captureMode={captureMode}
            setCaptureMode={setCaptureMode}
            onClose={handleClose}
            onDraftChange={setHasCameraDraft}
            onTransitionToPreview={() => {
              setStep("PREVIEW");
            }}
            onRecordingComplete={(segments, prompt) => {
              setRecordedSegments(segments);
              setAcceptedPrompt(prompt);
            }}
            resetToken={recorderResetToken}
          />
        </View>

        {/* Preview step overlays absolutely on top of the camera viewfinder */}
        {step === "PREVIEW" && recordedSegments.length > 0 && (
          <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(200)} style={StyleSheet.absoluteFill}>
            <PreviewPublishStep
              recordedSegments={recordedSegments}
              acceptedPrompt={acceptedPrompt}
              captureMode={captureMode}
              onRetake={handleRetake}
              tutorialMode={tutorialRecordMode}
              onPublishQueued={() => dismissRecorderAndNavigate('/(app)/today')}
              onFinishTutorial={() => {
                dismissRecorderAndNavigate('/(app)/profile');
              }}
            />
          </Animated.View>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  validating: { alignItems: 'center', justifyContent: 'center' },
});

"use client";

import React, { useState } from "react";
import { View, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Alert, Dimensions, Platform, useWindowDimensions } from "react-native";
import { Camera } from "lucide-react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../ui/Text";
import { Avatar } from "../ui/Avatar";
import { ActionProgress } from "../ui/ActionProgress";
import { useTranslation } from "../../lib/i18n";

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const serifFont = Platform.OS === 'ios' ? 'Georgia' : 'serif';

type NoClipViewProps = {
  isCurrentUserVlogger: boolean;
  vloggerName: string;
  vloggerImage?: string | null;
  poking: boolean;
  pokeCooldown: number;
  hasPostedInCurrentSlot: boolean;
  isPassedButUnclaimed: boolean;
  isAutoPassed: boolean;
  canPass: boolean;
  onPoke: () => void;
  onRecord: () => void;
  onPassTurn: () => Promise<void>;
  onClaimTurn: () => Promise<void>;
  isFrozen?: boolean;
  selectedPeriodState: 'past' | 'current';
};

export function NoClipView({
  isCurrentUserVlogger,
  vloggerName,
  vloggerImage,
  poking,
  pokeCooldown,
  hasPostedInCurrentSlot,
  isPassedButUnclaimed,
  isAutoPassed,
  canPass,
  onPoke,
  onRecord,
  onPassTurn,
  onClaimTurn,
  isFrozen = false,
  selectedPeriodState,
}: NoClipViewProps) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { t } = useTranslation();
  const [pendingTurnAction, setPendingTurnAction] = useState<'pass' | 'claim' | null>(null);

  const runTurnAction = async (action: 'pass' | 'claim') => {
    if (pendingTurnAction) return;

    setPendingTurnAction(action);
    try {
      await (action === 'pass' ? onPassTurn() : onClaimTurn());
    } finally {
      setPendingTurnAction(null);
    }
  };

  const confirmTurnAction = (action: 'pass' | 'claim') => {
    if (pendingTurnAction) return;

    Alert.alert(
      t(`todayActions.${action}ConfirmTitle`),
      t(`todayActions.${action}ConfirmBody`),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t(`todayActions.${action}ConfirmButton`),
          style: action === 'pass' ? 'destructive' : 'default',
          onPress: () => void runTurnAction(action),
        },
      ],
    );
  };

  const formatCooldown = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const illustrationHeight = Math.min(400, Math.max(250, screenHeight * 0.45));
  const dynamicMarginBottom = screenHeight < 700 ? 16 : 24;

  let illustration = require("../../../assets/images/today/waiting-user.png");
  let title = "";
  let desc = "";
  let primaryAction: any = null;
  let secondaryAction: any = null;
  let showVloggerAvatar = false;

  if (isFrozen) {
    illustration = require("../../../assets/images/subscription/frozen.png");
    title = "Grup Donduruldu";
    desc = "Standart gruplar için 4 üye sınırını aştınız. Devam etmek için boost ekleyin veya üye sayısını azaltın.";
  } else if (selectedPeriodState === 'past') {
    title = "Bu Zaman Aralığı Sona Erdi";
    desc = isCurrentUserVlogger
      ? "Bu zaman aralığında bir paylaşım yapmadın. Günün mevcut zaman aralığından devam edebilirsin."
      : `${vloggerName} bu zaman aralığında bir paylaşım yapmadı.`;
  } else if (isPassedButUnclaimed) {
    if (isCurrentUserVlogger) {
      if (isAutoPassed) {
        title = "Pencere Kaçırıldı";
        desc = "Zorunlu paylaşım pencerenizi kaçırdınız. Kamera, grup serisini kurtarmak isteyen herkesin kullanımına açıldı!";
      } else {
        title = "Kamera Açık";
        desc = "Sıranızı pas geçtiniz. Kamera şu an herkese açık. Yarının zorunlu vlogger'ı olarak kilitlendiniz!";
      }
    } else {
      illustration = require("../../../assets/images/today/cam-up-for-grabs.png");
      title = "Kamera Alınmayı Bekliyor";
      desc = "Bugünün vlogger'ı devam edemedi. Bugünün hikayesini yakalayan kişi sen ol.";
      primaryAction = { label: "Kamerayı Al", onPress: () => confirmTurnAction('claim'), turnAction: 'claim' };
    }
  } else if (isCurrentUserVlogger) {
    illustration = require("../../../assets/images/today/cam-up-for-grabs.png");
    title = "Bugün Sıra Sende";
    desc = "Arkadaşların güncellemelerini bekliyor. Grup serisini canlı tutmak için günün ilk klibini paylaş!";
    primaryAction = { label: "Şimdi Kaydet", onPress: onRecord, icon: <Camera size={18} color="#000" style={{ marginRight: 8 }} /> };
    if (canPass) {
      secondaryAction = { label: "Sırayı Pas Geç", onPress: () => confirmTurnAction('pass'), turnAction: 'pass' };
    }
  } else {
    showVloggerAvatar = true;
    title = `${vloggerName} henüz hiçbir şey paylaşmadı.`;
    desc = "İlk klip her zaman en zorudur. Ona küçük bir dürtü gönder.";
    
    let btnLabel = "Vlogger'ı Dürt";
    if (pokeCooldown > 0) btnLabel = `Dürtü Bekleme (${formatCooldown(pokeCooldown)})`;
    else if (hasPostedInCurrentSlot) btnLabel = "Vlogger zaten paylaştı";
    else if (poking) btnLabel = "Dürtülüyor...";

    primaryAction = {
      label: btnLabel,
      onPress: onPoke,
      disabled: poking || pokeCooldown > 0 || hasPostedInCurrentSlot,
      loading: poking
    };
  }

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) + 24 }]}>
      <Animated.View entering={FadeInUp.duration(600).springify().damping(24)} style={styles.content}>
        
        <View style={[styles.illustrationWrapper, { height: illustrationHeight, marginBottom: dynamicMarginBottom }]}>
          {showVloggerAvatar ? (
            <View style={styles.vloggerAvatarRing}>
              <Avatar src={vloggerImage} name={vloggerName} size={148} />
            </View>
          ) : (
            <Image
              source={illustration}
              style={styles.illustration}
              resizeMode="contain"
            />
          )}
        </View>

        <View style={styles.textAndActionContainer}>
          <Text style={[styles.title, { fontFamily: serifFont }]}>{title}</Text>
          <Text style={styles.description}>{desc}</Text>

          <View style={styles.actionContainer}>
            {primaryAction && (
              <TouchableOpacity
                onPress={primaryAction.onPress}
                disabled={primaryAction.disabled || pendingTurnAction !== null}
                activeOpacity={0.85}
                accessibilityState={{ disabled: primaryAction.disabled || pendingTurnAction !== null, busy: pendingTurnAction === primaryAction.turnAction }}
                style={[styles.primaryButton, (primaryAction.disabled || pendingTurnAction !== null) && { opacity: 0.6 }]}
              >
                {pendingTurnAction === primaryAction.turnAction ? (
                  <ActionProgress label={t('todayActions.receivedProcessing')} color="#000" />
                ) : primaryAction.loading ? (
                  <ActivityIndicator size="small" color="#000" style={{ marginRight: 8 }} />
                ) : primaryAction.icon ? (
                  primaryAction.icon
                ) : null}
                {pendingTurnAction !== primaryAction.turnAction && (
                  <Text weight="bold" style={styles.primaryButtonText}>{primaryAction.label}</Text>
                )}
              </TouchableOpacity>
            )}

            {secondaryAction && (
              <TouchableOpacity
                onPress={secondaryAction.onPress}
                disabled={pendingTurnAction !== null}
                activeOpacity={0.85}
                accessibilityState={{ disabled: pendingTurnAction !== null, busy: pendingTurnAction === secondaryAction.turnAction }}
                style={[styles.secondaryButton, pendingTurnAction !== null && { opacity: 0.6 }]}
              >
                {pendingTurnAction === secondaryAction.turnAction ? (
                  <ActionProgress label={t('todayActions.receivedProcessing')} color="#fff" />
                ) : (
                  <Text weight="bold" style={styles.secondaryButtonText}>{secondaryAction.label}</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    alignItems: 'center',
  },
  illustrationWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustration: {
    width: '100%',
    height: '100%',
  },
  vloggerAvatarRing: {
    padding: 5,
    borderRadius: 84,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  textAndActionContainer: {
    width: '100%',
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    color: '#FAF9F6',
    textAlign: 'center',
    lineHeight: 34,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
    fontFamily: 'Satoshi-Medium',
  },
  actionContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 15,
    fontFamily: 'Satoshi-Bold',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: 28,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'Satoshi-Bold',
  }
});

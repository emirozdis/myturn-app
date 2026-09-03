import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native";
import Constants from "expo-constants";
import { Bug, Lightbulb, MessageCircleMore, Send, X } from "lucide-react-native";
import { usePathname } from "expo-router";
import auth from "@react-native-firebase/auth";

import { Text } from "../ui/Text";
import { apiClient } from "../../lib/apiClient";
import { getRecentFeedbackLogs } from "../../lib/feedbackLogs";
import { storage } from "../../lib/storage";
import { mediumTap, notifySuccess } from "../../lib/haptics";
import { useLanguageStore } from "../../store/useLanguageStore";
import { ACCENT } from "../../lib/theme";

type Category = "bug" | "idea" | "other";

const PREF_SCREENSHOT = "feedback_include_screenshot";
const PREF_LOGS = "feedback_include_logs";
const PREF_DEVICE = "feedback_include_device";

const GlobalFeedbackContext = createContext<{ openFeedback: () => void } | null>(null);

async function captureFeedbackTarget(target: React.RefObject<View | null>) {
  const { captureRef } = await import("react-native-view-shot");
  return captureRef(target, {
    format: "jpg",
    quality: 0.6,
    result: "base64",
  });
}

export function useGlobalFeedback() {
  const context = useContext(GlobalFeedbackContext);
  if (!context) throw new Error("useGlobalFeedback must be used within GlobalFeedback");
  return context;
}

function readPreference(key: string, fallback: boolean) {
  return storage.contains(key) ? storage.getBoolean(key) === true : fallback;
}

function PreferenceRow({
  label,
  detail,
  value,
  onValueChange,
}: {
  label: string;
  detail: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.preferenceRow}>
      <View style={styles.preferenceCopy}>
        <Text weight="bold" style={styles.preferenceLabel}>{label}</Text>
        <Text style={styles.preferenceDetail}>{detail}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "#333", true: "rgba(224,124,48,0.42)" }}
        thumbColor={value ? ACCENT : "#aaa"}
      />
    </View>
  );
}

export function GlobalFeedback({
  children,
  enabled = true,
}: {
  children: React.ReactNode;
  enabled?: boolean;
}) {
  const pathname = usePathname();
  const locale = useLanguageStore((state) => state.locale);
  const copy = locale === "tr" ? {
    title: "Geri bildirim gönder",
    subtitle: "Fark ettiğin şeyi bizimle paylaş.",
    close: "Geri bildirimi kapat",
    problem: "Sorun",
    idea: "Fikir",
    other: "Diğer",
    placeholder: "Ne oldu? Ne olmasını bekliyordun?",
    diagnostics: "Tanılama bilgilerini ekle",
    diagnosticsNote: "Yalnızca seçtiğin öğeler eklenir. Seçimlerin bu cihazda hatırlanır.",
    screenshot: "Ekran görüntüsü",
    screenshotDetail: "Mevcut ekranın sıkıştırılmış bir görüntüsü",
    logs: "Son uygulama kayıtları",
    logsDetail: "En fazla 200 adet hassas verileri gizlenmiş kayıt",
    device: "Cihaz ve uygulama bilgisi",
    deviceDetail: "İşletim sistemi, uygulama sürümü, dil ve ekran boyutu",
    required: "Lütfen ne olduğunu veya neyin değişmesini istediğini açıkla.",
    success: "Teşekkürler — geri bildirimin gönderildi.",
    failed: "Geri bildirim gönderilemedi. Lütfen tekrar dene.",
    sending: "Gönderiliyor…",
    send: "Geri bildirim gönder",
  } : {
    title: "Send feedback",
    subtitle: "Tell us what you noticed.",
    close: "Close feedback",
    problem: "Problem",
    idea: "Idea",
    other: "Other",
    placeholder: "What happened? What did you expect?",
    diagnostics: "Attach diagnostics",
    diagnosticsNote: "Only the items you select are included. Your choices are remembered on this device.",
    screenshot: "Screenshot",
    screenshotDetail: "A compressed image of the current screen",
    logs: "Recent app logs",
    logsDetail: "Up to 200 redacted console entries",
    device: "Device & app info",
    deviceDetail: "OS, app version, locale, and screen size",
    required: "Please describe what happened or what you would like to change.",
    success: "Thanks — your feedback was sent.",
    failed: "Feedback could not be sent. Please try again.",
    sending: "Sending…",
    send: "Send feedback",
  };
  const captureTarget = useRef<View>(null);
  const pendingScreenshot = useRef<string | undefined>(undefined);
  const opening = useRef(false);
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<Category>("bug");
  const [includeScreenshot, setIncludeScreenshot] = useState(() => readPreference(PREF_SCREENSHOT, true));
  const [includeLogs, setIncludeLogs] = useState(() => readPreference(PREF_LOGS, false));
  const [includeDeviceInfo, setIncludeDeviceInfo] = useState(() => readPreference(PREF_DEVICE, true));
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const openFeedback = useCallback(async () => {
    if (!auth().currentUser || opening.current) return;
    opening.current = true;
    setResult(null);
    mediumTap();
    pendingScreenshot.current = undefined;

    if (includeScreenshot && captureTarget.current) {
      try {
        pendingScreenshot.current = await captureFeedbackTarget(captureTarget);
      } catch (error) {
        console.warn("[Feedback] Could not capture the screen at shake time:", error);
      }
    }

    setVisible(true);
    opening.current = false;
  }, [includeScreenshot]);

  useEffect(() => {
    if (!enabled || Platform.OS === "web") return;

    let cancelled = false;
    let subscription: { remove: () => void } | undefined;
    let shakeCount = 0;
    let firstShakeAt = 0;
    let lastTriggerAt = 0;
    const timer = setTimeout(() => {
      void import("expo-sensors").then(({ Accelerometer }) => {
        if (cancelled) return;
        Accelerometer.setUpdateInterval(120);
        subscription = Accelerometer.addListener(({ x, y, z }) => {
          const now = Date.now();
          const force = Math.abs(Math.sqrt(x * x + y * y + z * z) - 1);
          if (force < 1.35 || now - lastTriggerAt < 2_500 || visible) return;

          if (!firstShakeAt || now - firstShakeAt > 900) {
            firstShakeAt = now;
            shakeCount = 1;
            return;
          }

          shakeCount += 1;
          if (shakeCount >= 2) {
            lastTriggerAt = now;
            firstShakeAt = 0;
            shakeCount = 0;
            void openFeedback();
          }
        });
      });
    }, 1_500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      subscription?.remove();
    };
  }, [enabled, openFeedback, visible]);

  const persistPreference = (key: string, setter: (value: boolean) => void) => (value: boolean) => {
    storage.set(key, value);
    setter(value);
  };

  const submit = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || submitting) {
      setResult({ type: "error", text: copy.required });
      return;
    }

    setSubmitting(true);
    setResult(null);
    try {
      let screenshot: string | undefined;
      if (includeScreenshot) {
        screenshot = pendingScreenshot.current;
        if (!screenshot && captureTarget.current) {
          try {
            screenshot = await captureFeedbackTarget(captureTarget);
          } catch (error) {
            console.warn("[Feedback] Screenshot unavailable; submitting without it:", error);
          }
        }
      }
      const attachingScreenshot = typeof screenshot === "string" && screenshot.length > 0;

      const window = Dimensions.get("window");
      const deviceInfo = includeDeviceInfo ? JSON.stringify({
        platform: Platform.OS,
        platformVersion: Platform.Version,
        reactNativeVersion: `${Platform.constants.reactNativeVersion.major}.${Platform.constants.reactNativeVersion.minor}.${Platform.constants.reactNativeVersion.patch}`,
        appVersion: Constants.expoConfig?.version ?? null,
        buildVersion: Platform.OS === "ios"
          ? Constants.expoConfig?.ios?.buildNumber ?? null
          : Constants.expoConfig?.android?.versionCode ?? null,
        locale: Intl.DateTimeFormat().resolvedOptions().locale,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        window: { width: Math.round(window.width), height: Math.round(window.height), scale: window.scale },
      }) : undefined;

      const response = await apiClient.request<{ report: { id: string } }>("feedback/submit", [{
        category,
        message: trimmedMessage,
        screen: pathname,
        appVersion: Constants.expoConfig?.version,
        includeScreenshot: attachingScreenshot,
        includeLogs,
        includeDeviceInfo,
        screenshot,
        logs: includeLogs ? JSON.stringify(getRecentFeedbackLogs()) : undefined,
        deviceInfo,
      }]);

      if (!response.success) throw new Error(response.error || "Feedback could not be sent");

      setMessage("");
      pendingScreenshot.current = undefined;
      setResult({ type: "success", text: copy.success });
      notifySuccess();
      setTimeout(() => setVisible(false), 900);
    } catch (error) {
      setResult({
        type: "error",
        text: error instanceof Error ? error.message : copy.failed,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GlobalFeedbackContext.Provider value={{ openFeedback: () => void openFeedback() }}>
      <View style={styles.root}>
        <View ref={captureTarget} collapsable={false} style={styles.captureTarget}>
          {children}
        </View>

        <Modal
          visible={visible}
          transparent
          animationType="slide"
          statusBarTranslucent
          onRequestClose={() => !submitting && setVisible(false)}
        >
          <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <Pressable style={styles.backdrop} onPress={() => !submitting && setVisible(false)} />
            <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <View>
                <Text weight="bold" style={styles.title}>{copy.title}</Text>
                <Text style={styles.subtitle}>{copy.subtitle}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={copy.close} style={styles.closeButton} onPress={() => setVisible(false)} disabled={submitting}>
                <X color="#fff" size={20} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.categories}>
                {([
                  ["bug", copy.problem, Bug],
                  ["idea", copy.idea, Lightbulb],
                  ["other", copy.other, MessageCircleMore],
                ] as const).map(([value, label, Icon]) => (
                  <Pressable key={value} style={[styles.category, category === value && styles.categorySelected]} onPress={() => setCategory(value)}>
                    <Icon size={17} color={category === value ? "#000" : "#bbb"} />
                    <Text weight="bold" style={[styles.categoryText, category === value && styles.categoryTextSelected]}>{label}</Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder={copy.placeholder}
                placeholderTextColor="rgba(255,255,255,0.35)"
                multiline
                maxLength={4_000}
                editable={!submitting}
                style={styles.input}
                textAlignVertical="top"
              />

              <Text weight="bold" style={styles.diagnosticsTitle}>{copy.diagnostics}</Text>
              <Text style={styles.diagnosticsNote}>{copy.diagnosticsNote}</Text>
              <View style={styles.preferences}>
                <PreferenceRow
                  label={copy.screenshot}
                  detail={copy.screenshotDetail}
                  value={includeScreenshot}
                  onValueChange={persistPreference(PREF_SCREENSHOT, setIncludeScreenshot)}
                />
                <PreferenceRow
                  label={copy.logs}
                  detail={copy.logsDetail}
                  value={includeLogs}
                  onValueChange={persistPreference(PREF_LOGS, setIncludeLogs)}
                />
                <PreferenceRow
                  label={copy.device}
                  detail={copy.deviceDetail}
                  value={includeDeviceInfo}
                  onValueChange={persistPreference(PREF_DEVICE, setIncludeDeviceInfo)}
                />
              </View>

              {result && (
                <Text style={[styles.result, result.type === "success" ? styles.success : styles.error]}>{result.text}</Text>
              )}

              <Pressable style={[styles.submitButton, (submitting || !message.trim()) && styles.submitDisabled]} onPress={submit} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#000" /> : <Send color="#000" size={18} />}
                <Text weight="bold" style={styles.submitText}>{submitting ? copy.sending : copy.send}</Text>
              </Pressable>
            </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </GlobalFeedbackContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  captureTarget: { flex: 1, backgroundColor: "#000" },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.7)" },
  sheet: {
    maxHeight: "90%",
    backgroundColor: "#111",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 22,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#444", alignSelf: "center", marginTop: 10, marginBottom: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  title: { color: "#fff", fontSize: 24 },
  subtitle: { color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 3 },
  closeButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#242424", alignItems: "center", justifyContent: "center" },
  categories: { flexDirection: "row", gap: 8, marginBottom: 14 },
  category: { flex: 1, height: 42, borderRadius: 13, backgroundColor: "#202020", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  categorySelected: { backgroundColor: ACCENT },
  categoryText: { color: "#bbb", fontSize: 12 },
  categoryTextSelected: { color: "#000" },
  input: { minHeight: 112, borderRadius: 16, padding: 15, backgroundColor: "#1b1b1b", color: "#fff", fontSize: 15, fontFamily: "Satoshi-Regular", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  diagnosticsTitle: { color: "#fff", fontSize: 14, marginTop: 20 },
  diagnosticsNote: { color: "rgba(255,255,255,0.45)", fontSize: 11, lineHeight: 16, marginTop: 4, marginBottom: 10 },
  preferences: { borderRadius: 16, overflow: "hidden", backgroundColor: "#1a1a1a" },
  preferenceRow: { minHeight: 67, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.08)" },
  preferenceCopy: { flex: 1, paddingRight: 12 },
  preferenceLabel: { color: "#fff", fontSize: 13 },
  preferenceDetail: { color: "rgba(255,255,255,0.42)", fontSize: 10, marginTop: 2 },
  result: { fontSize: 12, textAlign: "center", marginTop: 14 },
  success: { color: ACCENT },
  error: { color: "#ff7272" },
  submitButton: { height: 52, borderRadius: 16, backgroundColor: ACCENT, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 16 },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: "#000", fontSize: 14 },
});

"use client";

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  AccessibilityInfo,
  Image,
  Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  Heart,
  ArrowRight,
  RefreshCw
} from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeOut,
  Easing,
  runOnJS,
  useReducedMotion,
} from 'react-native-reanimated';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import crashlytics from '@react-native-firebase/crashlytics';
import analytics from '@react-native-firebase/analytics';
import auth from '@react-native-firebase/auth';

import { NEUTRAL_PAGE_BG, ACCENT } from '../src/lib/theme';
import { apiClient } from '../src/lib/apiClient';
import { storage } from '../src/lib/storage';
import { ActionProgress } from '../src/components/ui/ActionProgress';
import { lightTap, mediumTap, selectionTick } from '../src/lib/haptics';
import { Text } from '../src/components/ui/Text';
import { GlassView } from '../src/components/ui/GlassView';
import { syncWidgetSessionState } from '../src/lib/widgetSync';
import { AgreementModal, AgreementDocument } from '../src/components/legal/AgreementModal';
import { ProfileSetupForm } from '../src/components/onboarding/ProfileSetupForm';
import {
  enablePushNotificationsIfPermitted,
  requestFCMPermissionAndRegister,
} from '../src/lib/fcm';
import { queueInitialGuide } from '../src/lib/guides';
import { useGroupStore } from '../src/store/useGroupStore';
import { useTodayStore } from '../src/store/useTodayStore';
import { useStreaksStore } from '../src/store/useStreaksStore';
import { useProfileStore } from '../src/store/useProfileStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type Step = 'intro1' | 'intro2' | 'intro3' | 'auth_home' | 'login' | 'register' | 'verify' | 'profile_setup' | 'forgot' | 'reset';

const PENDING_PROFILE_USER_KEY = 'pending_profile_setup_user_id';
const PENDING_PROFILE_NAME_KEY = 'pending_profile_setup_name';
const PROFILE_SETUP_CONFIRMED_PREFIX = 'profile_setup_confirmed_v1:';

function profileSetupConfirmedKey(firebaseUid: string) {
  return `${PROFILE_SETUP_CONFIRMED_PREFIX}${firebaseUid}`;
}

WebBrowser.maybeCompleteAuthSession();

// --- LOCAL ASSETS ---
const MOCK_AVATARS = [
  require('../assets/images/onboarding/avatar1.png'),
  require('../assets/images/onboarding/avatar2.png'),
  require('../assets/images/onboarding/avatar3.png'),
  require('../assets/images/onboarding/avatar4.png'),
  require('../assets/images/onboarding/avatar5.png'),
];

// --- BACKGROUND GRADIENT ---
const SlideGradient = () => (
  <LinearGradient
    colors={['#000000', 'rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,0.95)']}
    locations={[0, 0.35, 0.6, 1]}
    style={StyleSheet.absoluteFill}
    pointerEvents="none"
  />
);

const LiquidGlossOverlay = () => (
  <LinearGradient
    colors={['rgba(255,255,255,0.25)', 'transparent', 'rgba(255,255,255,0.05)']}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={StyleSheet.absoluteFill}
    pointerEvents="none"
  />
);

// --- SLIDE COMPONENTS ---

const Slide1 = () => (
  <View style={styles.slideFull}>
    <Image source={require('../assets/images/onboarding/slide1.png')} style={StyleSheet.absoluteFill} resizeMode="cover" />
    <SlideGradient />

    <View style={styles.slideContentContainer}>
      <View style={styles.slideTopText}>
        <Text style={styles.slideTitle}>
          Her gün{"\n"}<Text style={{ color: ACCENT, fontFamily: 'Satoshi-Bold' }}>yeni bir vlogger.</Text>
        </Text>
        <Text style={styles.slideDesc}>
          Grubunuzdan biri her gün seçilir{"\n"}ve tüm gününü vlog'lar.
        </Text>
      </View>

      <View style={styles.slide1Bottom}>
        <View style={styles.avatarsRow}>
          {MOCK_AVATARS.slice(0, 4).map((src, i) => (
            <Image key={i} source={src} style={[styles.mockAvatar, { marginLeft: i > 0 ? -16 : 0, zIndex: 10 - i }]} />
          ))}
          <View style={[styles.mockAvatar, styles.avatarPlusBadge, { marginLeft: -16, zIndex: 0 }]}>
            <Text style={styles.avatarPlusText}>+3</Text>
          </View>
        </View>
        <Text style={styles.quoteText}>Kim bilir, belki de yarınki vlogger sensin.</Text>
      </View>
    </View>
  </View>
);

const Slide2 = () => (
  <View style={styles.slideFull}>
    <Image source={require('../assets/images/onboarding/slide2.png')} style={StyleSheet.absoluteFill} resizeMode="cover" />
    <SlideGradient />

    <View style={styles.slideContentContainer}>
      <View style={styles.slideTopText}>
        <Text style={styles.slideTitle}>
          Seçildiğinde,{"\n"}gününü <Text style={{ color: ACCENT, fontFamily: 'Satoshi-Bold' }}>paylaş.</Text>
        </Text>
        <Text style={styles.slideDesc}>
          Fotoğraf çek, 5 saniyelik snippet'ler{"\n"}veya vlog modu ile anlarını kaydet.
        </Text>
      </View>

      <View style={styles.slide2Bottom}>
        <View style={styles.iosCameraContainer}>
          <GlassView intensity={50} style={styles.iosRecordBadgeGlass}>
            <LiquidGlossOverlay />
            <View style={styles.iosRecordDot} />
            <Text style={styles.iosRecordTime}>00:00:05</Text>
          </GlassView>

          <View style={styles.iosCameraModes}>
            <Text style={styles.iosCameraModeInactive}>FOTOĞRAF</Text>
            <Text style={styles.iosCameraModeActive}>SNIPPET</Text>
            <Text style={styles.iosCameraModeInactive}>VLOG</Text>
          </View>

          <View style={styles.iosCameraControls}>
            <View style={styles.iosCameraThumbnail}>
              <Image source={MOCK_AVATARS[0]} style={styles.iosCameraThumbnailImg} />
            </View>
            <View style={styles.iosCameraShutterRing}>
              <View style={styles.iosCameraShutterSquare} />
            </View>
            <GlassView intensity={50} style={styles.iosCameraSwitchGlass}>
              <LiquidGlossOverlay />
              <RefreshCw size={22} color="#fff" />
            </GlassView>
          </View>
        </View>
      </View>
    </View>
  </View>
);

const Slide3 = () => (
  <View style={styles.slideFull}>
    <Image source={require('../assets/images/onboarding/slide3.png')} style={StyleSheet.absoluteFill} resizeMode="cover" />
    <SlideGradient />

    <View style={styles.slideContentContainer}>
      <View style={styles.slideTopText}>
        <Text style={styles.slideTitle}>
          Arkadaşların{"\n"}anında <Text style={{ color: ACCENT, fontFamily: 'Satoshi-Bold' }}>etkileşir.</Text>
        </Text>
        <Text style={styles.slideDesc}>
          Yorum yap, beğen, fotoğrafla yanıt ver.{"\n"}Günün birlikte yaşanır.
        </Text>
      </View>

      <View style={styles.slide3Bottom}>
        <View style={styles.commentsStack}>
          <GlassView intensity={50} style={[styles.commentCard, { zIndex: 3 }]}>
            <LiquidGlossOverlay />
            <View style={styles.commentHeader}>
              <Image source={MOCK_AVATARS[0]} style={styles.commentAvatar} />
              <View style={styles.commentTextContent}>
                <Text style={styles.commentName}>Zeynep A.</Text>
                <Text style={styles.commentText}>Harika bir gün olmuş!</Text>
                <Text style={styles.commentTime}>5 dk önce</Text>
              </View>
              <View style={styles.commentHeartWrapper}>
                <Heart size={14} color="#fff" fill="#fff" />
              </View>
            </View>
          </GlassView>

          <GlassView intensity={50} style={[styles.commentCard, { zIndex: 2, marginTop: -16, transform: [{ scale: 0.95 }], opacity: 0.9 }]}>
            <LiquidGlossOverlay />
            <View style={styles.commentHeader}>
              <Image source={MOCK_AVATARS[1]} style={styles.commentAvatar} />
              <View style={styles.commentTextContent}>
                <Text style={styles.commentName}>Berkay</Text>
                <Text style={styles.commentText}>O manzaraya bayıldım ya</Text>
                <Text style={styles.commentTime}>7 dk önce</Text>
              </View>
            </View>
          </GlassView>

          <GlassView intensity={50} style={[styles.commentCard, { zIndex: 1, marginTop: -16, transform: [{ scale: 0.9 }], opacity: 0.75 }]}>
            <LiquidGlossOverlay />
            <View style={styles.commentHeader}>
              <Image source={MOCK_AVATARS[2]} style={styles.commentAvatar} />
              <View style={styles.commentTextContent}>
                <Text style={styles.commentName}>Selin</Text>
                <Text style={styles.commentText}>Şu kahkahalar!{"\n"}Efsane ekip ya</Text>
                <Text style={styles.commentTime}>12 dk önce</Text>
              </View>
            </View>
          </GlassView>

          <View style={[styles.avatarsRow, { marginTop: 12, alignSelf: 'flex-start', marginLeft: 8 }]}>
            {MOCK_AVATARS.slice(1, 4).map((src, i) => (
              <Image key={i} source={src} style={[styles.mockAvatarTiny, { marginLeft: i > 0 ? -8 : 0, zIndex: 5 - i }]} />
            ))}
            <View style={[styles.mockAvatarTiny, styles.avatarPlusBadgeTiny, { marginLeft: -8, zIndex: 0 }]}>
              <Text style={styles.avatarPlusTextTiny}>+8</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  </View>
);

const AuthHome = ({
  onGoogleLogin,
  onEmailContinue,
  onLoginClick,
  loading,
  errorMsg,
  agreementAccepted,
  agreementReady,
  onToggleAgreement,
  onOpenAgreement,
}: any) => (
  <View style={styles.slideFull}>
    <Image source={require('../assets/images/onboarding/auth.png')} style={StyleSheet.absoluteFill} resizeMode="cover" />
    <LinearGradient colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.8)', '#000']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />

    <View style={styles.authContentContainer}>
      <View style={styles.authLogoArea}>
        <Image source={require('../assets/logo.png')} style={styles.authLogoImg} />
        <Text style={styles.authSub}>Arkadaşlarınla her gün yeni bir hikaye paylaşmaya hazır mısın?</Text>
      </View>

      <View style={styles.authActionsArea}>
        <Text style={styles.authSectionTitle}>Kayıt Ol</Text>

        {errorMsg && (
          <View style={styles.authErrorBanner}>
            <AlertCircle size={16} color="#ef4444" />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.authBtnGoogle,
            (loading || !agreementReady) && styles.submitBtnDisabled,
          ]}
          activeOpacity={0.85}
          onPress={onGoogleLogin}
          disabled={loading || !agreementReady}
        >
          {loading ? (
            <ActionProgress label="Google'a bağlanılıyor" color="#fff" />
          ) : (
            <>
              <Image source={require('../assets/icons/google.png')} style={styles.socialIcon} />
              <Text style={styles.authBtnTextOutlined}>Google ile devam et</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.authBtnEmail} activeOpacity={0.85} onPress={onEmailContinue}>
          <Mail size={18} color="#fff" />
          <Text style={styles.authBtnTextOutlined}>E-posta ile devam et</Text>
        </TouchableOpacity>

        <View style={styles.authAgreementRow}>
          <TouchableOpacity
            onPress={onToggleAgreement}
            disabled={!agreementReady || loading}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={[
              styles.checkbox,
              agreementAccepted && styles.checkboxChecked,
              (!agreementReady || loading) && styles.submitBtnDisabled,
            ]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreementAccepted, disabled: !agreementReady || loading }}
          >
            {agreementAccepted && <Text weight="bold" style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
          <Text style={styles.agreementText}>
            <Text onPress={onOpenAgreement} style={styles.agreementLink}>Kullanım Koşulları</Text>'nı kabul ediyor ve Gizlilik Bildirimi hakkında bilgilendirildiğimi onaylıyorum.
          </Text>
        </View>

        <View style={styles.authDividerRow}>
          <View style={styles.authDividerLine} />
          <Text style={styles.authDividerText}>veya</Text>
          <View style={styles.authDividerLine} />
        </View>

        <View style={styles.authLoginRow}>
          <Text style={styles.authLoginText}>Zaten hesabın var mı? </Text>
          <TouchableOpacity onPress={onLoginClick} activeOpacity={0.7}>
            <Text style={styles.authLoginLink}>Giriş yap</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </View>
);

// --- AUTH FORM COMPONENTS ---

const SignInForm = ({
  email, setEmail,
  password, setPassword,
  showPassword, setShowPassword,
  loading, errorMsg,
  onSubmit, onForgot
}: any) => (
  <View style={styles.formContainer}>
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.formScrollContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <Text style={styles.formTitle}>Tekrar Hoş Geldin</Text>
      <Text style={styles.formSub}>Hesabına giriş yap ve anı paylaşmaya devam et.</Text>

      {errorMsg && (
        <View style={styles.errorBanner}>
          <AlertCircle size={16} color="#ef4444" style={{ zIndex: 1 }} />
          <Text style={[styles.errorText, { zIndex: 1 }]}>{errorMsg}</Text>
        </View>
      )}

      <View style={styles.inputContainer}>
        <Mail size={18} color="rgba(255,255,255,0.4)" style={styles.inputIcon} />
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="E-posta"
          placeholderTextColor="rgba(255,255,255,0.3)"
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.inputContainer}>
        <Lock size={18} color="rgba(255,255,255,0.4)" style={styles.inputIcon} />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Şifre"
          placeholderTextColor="rgba(255,255,255,0.3)"
          style={styles.input}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
        />
        <TouchableOpacity onPress={() => { lightTap(); setShowPassword(!showPassword); }} style={styles.eyeBtn}>
          {showPassword ? <EyeOff size={18} color="rgba(255,255,255,0.4)" /> : <Eye size={18} color="rgba(255,255,255,0.4)" />}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.forgotPasswordBtn} activeOpacity={0.7} onPress={onForgot}>
        <Text style={styles.forgotPasswordText}>Şifremi Unuttum</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.submitBtn} onPress={onSubmit} disabled={loading} activeOpacity={0.85}>
        {loading ? <ActionProgress label="Giriş yapılıyor" color="#000" /> : <Text style={styles.submitBtnText}>Giriş Yap</Text>}
      </TouchableOpacity>
    </ScrollView>
  </View>
);

const SignUpForm = ({
  name, setName,
  email, setEmail,
  password, setPassword,
  showPassword, setShowPassword,
  loading, errorMsg, agreementAccepted, agreementReady,
  onToggleAgreement, onOpenAgreement, onSubmit
}: any) => (
  <View style={styles.formContainer}>
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.formScrollContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <Text style={styles.formTitle}>Hesap Oluştur</Text>
      <Text style={styles.formSub}>Aramıza katıl ve ilk grubunu hemen kur.</Text>

      {errorMsg && (
        <View style={styles.errorBanner}>
          <AlertCircle size={16} color="#ef4444" style={{ zIndex: 1 }} />
          <Text style={[styles.errorText, { zIndex: 1 }]}>{errorMsg}</Text>
        </View>
      )}

      <View style={styles.inputContainer}>
        <User size={18} color="rgba(255,255,255,0.4)" style={styles.inputIcon} />
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Ad Soyad"
          placeholderTextColor="rgba(255,255,255,0.3)"
          style={styles.input}
          autoCapitalize="words"
        />
      </View>

      <View style={styles.inputContainer}>
        <Mail size={18} color="rgba(255,255,255,0.4)" style={styles.inputIcon} />
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="E-posta"
          placeholderTextColor="rgba(255,255,255,0.3)"
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.inputContainer}>
        <Lock size={18} color="rgba(255,255,255,0.4)" style={styles.inputIcon} />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Şifre Oluştur"
          placeholderTextColor="rgba(255,255,255,0.3)"
          style={styles.input}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
        />
        <TouchableOpacity onPress={() => { lightTap(); setShowPassword(!showPassword); }} style={styles.eyeBtn}>
          {showPassword ? <EyeOff size={18} color="rgba(255,255,255,0.4)" /> : <Eye size={18} color="rgba(255,255,255,0.4)" />}
        </TouchableOpacity>
      </View>

      <View style={styles.agreementRow}>
        <TouchableOpacity
          onPress={onToggleAgreement}
          disabled={!agreementReady || loading}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={[
            styles.checkbox,
            agreementAccepted && styles.checkboxChecked,
            (!agreementReady || loading) && styles.submitBtnDisabled,
          ]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreementAccepted, disabled: !agreementReady || loading }}
        >
          {agreementAccepted && <Text weight="bold" style={styles.checkmark}>✓</Text>}
        </TouchableOpacity>
        <Text style={styles.agreementText}>
          <Text onPress={onOpenAgreement} style={styles.agreementLink}>Kullanım Koşulları</Text>'nı kabul ediyor ve Gizlilik Bildirimi'nde verilerimin nasıl toplandığı, saklandığı ve kullanıldığı hakkında bilgilendirildiğimi onaylıyorum.
        </Text>
      </View>

      <TouchableOpacity style={[styles.submitBtn, (!agreementAccepted || !agreementReady) && styles.submitBtnDisabled]} onPress={onSubmit} disabled={loading || !agreementAccepted || !agreementReady} activeOpacity={0.85}>
        {loading ? <ActionProgress label="Hesap hazırlanıyor" color="#000" /> : <Text style={styles.submitBtnText}>Kayıt Ol</Text>}
      </TouchableOpacity>
    </ScrollView>
  </View>
);

const ForgotPasswordForm = ({ email, setEmail, loading, errorMsg, onSubmit }: any) => (
  <View style={styles.formContainer}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScrollContent} keyboardShouldPersistTaps="handled">
      <Text style={styles.formTitle}>Şifreni Sıfırla</Text>
      <Text style={styles.formSub}>E-posta adresine 6 haneli bir sıfırlama kodu göndereceğiz.</Text>
      {errorMsg && <View style={styles.errorBanner}><AlertCircle size={16} color="#ef4444" /><Text style={styles.errorText}>{errorMsg}</Text></View>}
      <View style={styles.inputContainer}><Mail size={18} color="rgba(255,255,255,0.4)" style={styles.inputIcon} /><TextInput value={email} onChangeText={setEmail} placeholder="E-posta" placeholderTextColor="rgba(255,255,255,0.3)" style={styles.input} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} /></View>
      <TouchableOpacity style={styles.submitBtn} onPress={onSubmit} disabled={loading} activeOpacity={0.85}>{loading ? <ActionProgress label="Gönderiliyor" color="#000" /> : <Text style={styles.submitBtnText}>Bağlantı Gönder</Text>}</TouchableOpacity>
    </ScrollView>
  </View>
);

const VerifyEmailForm = ({ email, code, setCode, loading, errorMsg, onSubmit, onResend }: any) => (
  <View style={styles.formContainer}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScrollContent} keyboardShouldPersistTaps="handled">
      <Text style={styles.formTitle}>E-postanı doğrula</Text><Text style={styles.formSub}>{errorMsg || `6 haneli kodu ${email} adresine gönderdik.`}</Text>
      <View style={styles.inputContainer}><Mail size={18} color="rgba(255,255,255,0.4)" style={styles.inputIcon} /><TextInput value={code} onChangeText={setCode} placeholder="6 haneli kod" placeholderTextColor="rgba(255,255,255,0.3)" style={styles.input} keyboardType="number-pad" maxLength={6} autoCapitalize="none" /></View>
      <TouchableOpacity style={styles.submitBtn} onPress={onSubmit} disabled={loading} activeOpacity={0.85}>{loading ? <ActionProgress label="Kontrol ediliyor" color="#000" /> : <Text style={styles.submitBtnText}>E-postayı Doğrula</Text>}</TouchableOpacity>
      <TouchableOpacity style={styles.forgotPasswordBtn} onPress={onResend}><Text style={styles.forgotPasswordText}>Kodu tekrar gönder</Text></TouchableOpacity>
    </ScrollView>
  </View>
);

const ResetPasswordForm = ({ email, code, setCode, password, setPassword, loading, errorMsg, onSubmit }: any) => (
  <View style={styles.formContainer}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScrollContent} keyboardShouldPersistTaps="handled">
      <Text style={styles.formTitle}>Yeni Şifre</Text><Text style={styles.formSub}>E-postandaki 6 haneli kodu ve yeni şifreni gir.</Text>
      {errorMsg && <View style={styles.errorBanner}><AlertCircle size={16} color="#ef4444" /><Text style={styles.errorText}>{errorMsg}</Text></View>}
      <View style={styles.inputContainer}><Mail size={18} color="rgba(255,255,255,0.4)" style={styles.inputIcon} /><TextInput value={email} editable={false} style={[styles.input, { opacity: 0.65 }]} /></View>
      <View style={styles.inputContainer}><Mail size={18} color="rgba(255,255,255,0.4)" style={styles.inputIcon} /><TextInput value={code} onChangeText={setCode} placeholder="6 haneli kod" placeholderTextColor="rgba(255,255,255,0.3)" style={styles.input} keyboardType="number-pad" maxLength={6} /></View>
      <View style={styles.inputContainer}><Lock size={18} color="rgba(255,255,255,0.4)" style={styles.inputIcon} /><TextInput value={password} onChangeText={setPassword} placeholder="Yeni şifre" placeholderTextColor="rgba(255,255,255,0.3)" style={styles.input} secureTextEntry autoCapitalize="none" /></View>
      <TouchableOpacity style={styles.submitBtn} onPress={onSubmit} disabled={loading} activeOpacity={0.85}>{loading ? <ActionProgress label="Güncelleniyor" color="#000" /> : <Text style={styles.submitBtnText}>Şifreyi Güncelle</Text>}</TouchableOpacity>
    </ScrollView>
  </View>
);

// --- MAIN SCREEN ---

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotionAtLaunch = useReducedMotion();
  const [reduceMotion, setReduceMotion] = useState(reduceMotionAtLaunch);

  const [step, setStep] = useState<Step>('intro1');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [currentAgreement, setCurrentAgreement] = useState<AgreementDocument | null>(null);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [agreementModalOpen, setAgreementModalOpen] = useState(false);

  useEffect(() => {
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if ((step !== 'register' && step !== 'auth_home') || currentAgreement) return;
    apiClient.request<{ agreement: AgreementDocument }>('legal/current')
      .then((result: any) => {
        if (result.success && result.agreement) setCurrentAgreement(result.agreement);
        else setErrorMsg(result.error || 'Hukuki metin yüklenemedi. Lütfen tekrar deneyin.');
      });
  }, [step, currentAgreement]);

  // Use Firebase Auth native listener to automatically control authentication state
  useEffect(() => {
    let unsubscribe: () => void;

    const initAuth = async () => {
      unsubscribe = auth().onAuthStateChanged(async (user) => {
        if (!user) {
          storage.delete('auth_firebase_uid');
          syncWidgetSessionState(false, false);
          setCheckingSession(false);
          return;
        }

        storage.set('auth_firebase_uid', user.uid);

        // Firebase emits the newly-created email/password user before signup
        // provisioning has stored the local onboarding marker. Never let that
        // unverified identity race into protected app routes.
        if (!user.emailVerified) {
          setEmail(user.email || '');
          setName(user.displayName || storage.getString(PENDING_PROFILE_NAME_KEY) || '');
          setStep('verify');
          setCheckingSession(false);
          return;
        }

        useProfileStore.getState().hydrateForUser(user.uid);
        const cachedProfileUserId = useProfileStore.getState().user.id || user.uid;
        storage.set('auth_user_id', cachedProfileUserId);
        crashlytics().setUserId(cachedProfileUserId);
        analytics().setUserId(cachedProfileUserId);
        useGroupStore.getState().hydrateForUser(user.uid);
        const cachedGroupId = useGroupStore.getState().activeGroupId;
        if (cachedGroupId) {
          useTodayStore.getState().hydrateForUser(user.uid, cachedGroupId);
          useStreaksStore.getState().hydrateForUser(user.uid, cachedGroupId);
        }

        const pendingProfileUserId = storage.getString(PENDING_PROFILE_USER_KEY);
        if (pendingProfileUserId === user.uid) {
          const cachedName = useProfileStore.getState().user.name;
          setName(cachedName || storage.getString(PENDING_PROFILE_NAME_KEY) || '');
          setStep('profile_setup');
          setCheckingSession(false);
          return;
        }

        // Profile completion is durable once confirmed. Only the first launch
        // for an account needs this network gate; later launches use the
        // account-scoped marker and refresh ordinary profile data in background.
        if (!storage.getBoolean(profileSetupConfirmedKey(user.uid))) {
          const onboardingStatus = await apiClient.request<{
            profileComplete?: boolean;
            name?: string;
          }>('profile/onboarding-status', [], { cachePolicy: 'network-only' });
          if (onboardingStatus.success && !onboardingStatus.profileComplete) {
            const profileName = onboardingStatus.name || user.displayName || '';
            storage.set(PENDING_PROFILE_USER_KEY, user.uid);
            storage.set(PENDING_PROFILE_NAME_KEY, profileName);
            setName(profileName);
            setStep('profile_setup');
            setCheckingSession(false);
            return;
          }
          if (!onboardingStatus.success && onboardingStatus.status === 401) {
            setCheckingSession(false);
            return;
          }
          if (onboardingStatus.success && onboardingStatus.profileComplete) {
            storage.set(profileSetupConfirmedKey(user.uid), true);
          }
        }

        syncWidgetSessionState(true, true);
        router.replace('/(app)/today');

        // The authenticated shell is usable now. Refresh identity-dependent
        // services without extending the launch gate.
        void Promise.allSettled([
          useProfileStore.getState().fetchProfileData(),
          import('../src/lib/revenueCat').then(({ loginRevenueCat }) => loginRevenueCat(user.uid)),
          enablePushNotificationsIfPermitted(),
        ]).then(() => {
          const profileUserId = useProfileStore.getState().user.id || user.uid;
          storage.set('auth_user_id', profileUserId);
          crashlytics().setUserId(profileUserId);
          analytics().setUserId(profileUserId);
          if (profileUserId !== user.uid) {
            void import('../src/lib/revenueCat')
              .then(({ loginRevenueCat }) => loginRevenueCat(profileUserId))
              .catch(console.warn);
          }
        }).catch((err) => {
          console.warn('[Auth] Background session refresh error:', err);
        });
      });
    };

    void initAuth();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [router]);

  if (checkingSession) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <Image source={require('../assets/logo.png')} style={{ width: 112, height: 112 }} resizeMode="contain" />
      </View>
    );
  }

  const navigateTo = (nextStep: Step) => {
    setStep(nextStep);
  };

  const handleNextIntro = () => {
    lightTap();
    if (step === 'intro1') navigateTo('intro2');
    else if (step === 'intro2') navigateTo('intro3');
    else if (step === 'intro3') navigateTo('auth_home');
  };

  const handlePrevIntro = () => {
    lightTap();
    if (step === 'intro2') navigateTo('intro1');
    else if (step === 'intro3') navigateTo('intro2');
  };

  const handleSkip = () => {
    lightTap();
    navigateTo('auth_home');
  };

  const handleBackFromAuth = () => {
    lightTap();
    if (step === 'auth_home') navigateTo('intro3');
    else navigateTo('auth_home');
  };

  const handleGoogleLogin = async () => {
    if (googleLoading) return;
    if (!currentAgreement) {
      setErrorMsg('Hukuki metin yüklenemedi. Lütfen tekrar deneyin.');
      return;
    }
    if (!agreementAccepted) {
      setErrorMsg(null);
      setAgreementModalOpen(true);
      return;
    }

    mediumTap();
    setGoogleLoading(true);
    setErrorMsg(null);

    try {
      const verifier = `${Crypto.randomUUID()}${Crypto.randomUUID()}`;
      const challenge = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        verifier,
      );
      const startUrl = new URL(`${apiClient.getBaseUrl()}/api/auth/mobile/google/start`);
      startUrl.searchParams.set('code_challenge', challenge);
      startUrl.searchParams.set('agreement_accepted', 'true');
      startUrl.searchParams.set('agreement_slug', currentAgreement.slug);
      startUrl.searchParams.set('agreement_version', currentAgreement.version);
      startUrl.searchParams.set('agreement_hash', currentAgreement.contentHash);

      const browserResult = await WebBrowser.openAuthSessionAsync(
        startUrl.toString(),
        'myturn://auth/google',
      );
      if (browserResult.type !== 'success') return;

      const callbackUrl = new URL(browserResult.url);
      const callbackError = callbackUrl.searchParams.get('error');
      if (callbackError) {
        const messages: Record<string, string> = {
          google_cancelled: 'Google girişi iptal edildi.',
          registration_disabled: 'Yeni hesap kaydı şu anda kapalı.',
          too_many_attempts: 'Çok fazla giriş denemesi yapıldı. Lütfen biraz sonra tekrar dene.',
          unverified_email: 'Google hesabındaki e-posta adresi doğrulanmamış.',
        };
        setErrorMsg(messages[callbackError] || 'Google ile giriş tamamlanamadı. Lütfen tekrar dene.');
        return;
      }

      const code = callbackUrl.searchParams.get('code');
      if (!code) throw new Error('Google sign-in did not return a handoff code.');

      const result = await apiClient.request<any>('auth/mobile/google/session', [{ code, verifier }]);
      if (!result.success || !result?.user?.id || !result.customToken) {
        setErrorMsg(result?.error || 'Google oturumu başlatılamadı.');
        return;
      }

      if (result.isNewUser) {
        storage.set(PENDING_PROFILE_USER_KEY, result.user.id);
        storage.set(PENDING_PROFILE_NAME_KEY, result.user.name || '');
      }
      await auth().signInWithCustomToken(result.customToken);
      await auth().currentUser?.getIdToken(true);
      storage.set('auth_user_id', result.user.id);
      crashlytics().setUserId(result.user.id);
      analytics().setUserId(result.user.id);
      await import('../src/lib/revenueCat')
        .then(({ loginRevenueCat }) => loginRevenueCat(result.user.id))
        .catch(console.warn);
      syncWidgetSessionState(true, true);
      void enablePushNotificationsIfPermitted();

      if (result.isNewUser) {
        const googleName = result.user.name || '';
        storage.set(PENDING_PROFILE_USER_KEY, result.user.id);
        storage.set(PENDING_PROFILE_NAME_KEY, googleName);
        setName(googleName);
        analytics().logSignUp({ method: 'google' });
        setStep('profile_setup');
        return;
      }

      analytics().logLogin({ method: 'google' });
      router.replace('/(app)/today');
    } catch (error: any) {
      crashlytics().recordError(error);
      setErrorMsg('Google ile giriş sırasında bir bağlantı hatası oluştu.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const checkEmailVerification = async () => {
    if (!/^\d{6}$/.test(verificationCode)) {
      setErrorMsg('6 haneli doğrulama kodunu gir.');
      return;
    }
    setLoading(true);
    const result = await apiClient.request<any>('auth/verify-email', [{ email: email.toLowerCase().trim(), code: verificationCode }]);
    if (result.success) {
      setErrorMsg(null);
      await handleAuthSubmit();
    } else {
      setLoading(false);
      setErrorMsg(result.error || 'Kod geçersiz veya süresi dolmuş.');
    }
  };

  const resendVerification = async () => {
    setLoading(true);
    const result = await apiClient.request<any>('auth/resend-verification', [{ email: email.toLowerCase().trim() }]);
    setLoading(false);
    if (result.success) Alert.alert('E-posta gönderildi', 'Yeni doğrulama bağlantısını kontrol et.');
    else setErrorMsg(result.error || 'E-posta gönderilemedi.');
  };

  const handleAuthSubmit = async () => {
    setErrorMsg(null);
    const wasRegistering = step === 'register' || step === 'verify';
    if (step === 'forgot') {
      if (!email.trim()) { setErrorMsg("E-posta alanı zorunludur."); return; }
      setLoading(true);
      const result = await apiClient.request<any>('auth/request-password-reset', [{ email: email.toLowerCase().trim() }]);
      setLoading(false);
      if (!result.success) setErrorMsg(result.error || 'İstek gönderilemedi.');
      else { setResetCode(''); setStep('reset'); }
      return;
    }
    if (step === 'reset') {
      if (!/^\d{6}$/.test(resetCode) || password.length < 8) { setErrorMsg("6 haneli kodu gir ve en az 8 karakterlik bir şifre belirle."); return; }
      setLoading(true);
      const result = await apiClient.request<any>('auth/reset-password', [{ email: email.toLowerCase().trim(), code: resetCode, password }]);
      setLoading(false);
      if (!result.success) setErrorMsg(result.error || 'Şifre güncellenemedi.');
      else { setPassword(''); setResetCode(''); setStep('login'); }
      return;
    }
    if (!email.trim() || !password.trim()) {
      setErrorMsg("E-posta ve şifre alanları zorunludur.");
      return;
    }
    if (step === 'register' && password.length < 8) {
      setErrorMsg("Şifre en az 8 karakter olmalıdır.");
      return;
    }

    setLoading(true);

    if (step === 'register') {
      if (!name.trim()) {
        setErrorMsg("İsim alanı zorunludur.");
        setLoading(false);
        return;
      }
      if (!agreementAccepted || !currentAgreement) {
        setErrorMsg("Kayıt olmak için Kullanım Koşulları ve Gizlilik Bildirimi'ni kabul etmelisin.");
        setLoading(false);
        return;
      }

      const cleanEmail = email.toLowerCase().trim();
      let firebaseRegistrationUser = auth().currentUser;
      try {
        if (firebaseRegistrationUser?.email?.toLowerCase() !== cleanEmail) {
          if (firebaseRegistrationUser) await auth().signOut();
          const credential = await auth().createUserWithEmailAndPassword(cleanEmail, password);
          firebaseRegistrationUser = credential.user;
        }
        storage.set(PENDING_PROFILE_USER_KEY, firebaseRegistrationUser.uid);
        storage.set(PENDING_PROFILE_NAME_KEY, name.trim());
        await firebaseRegistrationUser.updateProfile({ displayName: name.trim() });
      } catch (firebaseError: any) {
        const code = typeof firebaseError?.code === 'string' ? firebaseError.code : '';
        setErrorMsg(code.includes('email-already-in-use')
          ? "Bu e-posta adresi zaten kullanımda."
          : code.includes('weak-password')
            ? "Şifre en az 8 karakter olmalıdır."
            : "Firebase hesabı oluşturulamadı.");
        setLoading(false);
        return;
      }

      const registrationIdToken = await firebaseRegistrationUser.getIdToken(true);
      const signupRes: any = await apiClient.request<any>('auth/sign-up', [{
        name: name.trim(),
        idToken: registrationIdToken,
        agreement: {
          accepted: true,
          slug: currentAgreement.slug,
          version: currentAgreement.version,
          contentHash: currentAgreement.contentHash,
        }
      }]);

      if (!signupRes.success) {
        if (signupRes.status === 403) {
          storage.delete(PENDING_PROFILE_USER_KEY);
          storage.delete(PENDING_PROFILE_NAME_KEY);
          await firebaseRegistrationUser.delete().catch(() => {});
          await auth().signOut().catch(() => {});
        }
        setErrorMsg(signupRes.error || "Kayıt işlemi başarısız.");
        setLoading(false);
        return;
      }

      if (signupRes.userId) {
        storage.set(PENDING_PROFILE_USER_KEY, signupRes.userId);
        storage.set(PENDING_PROFILE_NAME_KEY, name.trim());
      }
      setStep('verify');
      setLoading(false);
      return;
    }

    try {
      const cleanEmail = email.toLowerCase().trim();
      let idToken = '';

      try {
        const userCredential = await auth().signInWithEmailAndPassword(cleanEmail, password);
        if (!userCredential.user.emailVerified) {
          setStep('verify');
          setErrorMsg('Devam etmek için e-posta adresini doğrula.');
          setLoading(false);
          return;
        }
        idToken = await userCredential.user.getIdToken();
      } catch (fbAuthErr: any) {
        console.log('[Firebase Auth] Client sign-in error:', fbAuthErr?.message);
        setErrorMsg("Giriş başarısız. E-posta veya şifrenizi kontrol edin.");
        setLoading(false);
        return;
      }

      const data = await apiClient.request<any>('auth/mobile/credentials/session', [{ idToken }]);

      if (data && data.success && data.user) {
        storage.set('auth_user_id', data.user.id);
        crashlytics().setUserId(data.user.id);
        analytics().setUserId(data.user.id);

        await import('../src/lib/revenueCat')
          .then(({ loginRevenueCat }) => loginRevenueCat(data.user.id))
          .catch(console.warn);

        syncWidgetSessionState(true, true);
        void enablePushNotificationsIfPermitted();

        if (wasRegistering) {
          analytics().logSignUp({ method: 'email' });
        } else {
          analytics().logLogin({ method: 'email' });
        }

        const pendingProfileUserId = storage.getString(PENDING_PROFILE_USER_KEY);
        if (wasRegistering || pendingProfileUserId === data.user.id) {
          storage.set(PENDING_PROFILE_USER_KEY, data.user.id);
          storage.set(
            PENDING_PROFILE_NAME_KEY,
            name.trim() || data.user.name || storage.getString(PENDING_PROFILE_NAME_KEY) || ''
          );
          setName(name.trim() || data.user.name || storage.getString(PENDING_PROFILE_NAME_KEY) || '');
          setErrorMsg(null);
          setStep('profile_setup');
          setLoading(false);
          return;
        }

        router.replace('/(app)/today');
        return;
      } else {
        setErrorMsg(data.error || "Giriş bilgileri doğrulanamadı.");
      }
    } catch (err: any) {
      crashlytics().recordError(err);
      setErrorMsg(err?.message || "Bağlantı hatası oluştu. Sunucu tünelinizin açık olduğundan emin olun.");
    } finally {
      setLoading(false);
    }
  };

  const isIntro = step.startsWith('intro');

  const swipeGesture = Gesture.Pan()
    .enabled(isIntro)
    .onEnd((e) => {
      if (e.translationX < -50) {
        runOnJS(handleNextIntro)();
      } else if (e.translationX > 50) {
        runOnJS(handlePrevIntro)();
      }
    });

  const enteringTransition = reduceMotion
    ? undefined
    : FadeIn.duration(250).easing(Easing.bezier(0.25, 1, 0.5, 1));
  const exitingTransition = reduceMotion
    ? undefined
    : FadeOut.duration(200).easing(Easing.bezier(0.25, 1, 0.5, 1));

  const markProfileSetupSaved = () => {
    const firebaseUid = auth().currentUser?.uid;
    if (firebaseUid) storage.set(profileSetupConfirmedKey(firebaseUid), true);
    storage.delete(PENDING_PROFILE_USER_KEY);
    storage.delete(PENDING_PROFILE_NAME_KEY);
  };

  const completeProfileSetup = async () => {
    markProfileSetupSaved();
    queueInitialGuide();
    analytics().logEvent('profile_setup_completed');
    syncWidgetSessionState(true, true);
    await requestFCMPermissionAndRegister();
    router.replace('/(app)/today');
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <LinearGradient
          colors={[NEUTRAL_PAGE_BG.dark, '#000']}
          style={StyleSheet.absoluteFill}
        />

        {/* --- Top Navigation Bar --- */}
        <View style={[styles.navigationHeaderRow, { paddingTop: Math.max(insets.top, 16) }]} pointerEvents="box-none">
          {!isIntro && step !== 'profile_setup' && (
            <TouchableOpacity onPress={handleBackFromAuth} style={styles.backBtn} activeOpacity={0.7} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
              <ChevronLeft size={28} color="#fff" />
            </TouchableOpacity>
          )}

          <View style={{ flex: 1 }} pointerEvents="none" />

          {isIntro && (
            <TouchableOpacity onPress={handleSkip} style={styles.skipBtn} activeOpacity={0.7} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
              <Text style={styles.skipBtnText}>Atla</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* --- Main Content Area --- */}
        <GestureDetector gesture={swipeGesture}>
          <View style={styles.slidesContainer}>
            {step === 'intro1' && (
              <Animated.View key="intro1" entering={enteringTransition} exiting={exitingTransition} style={styles.slideFull}>
                <Slide1 />
              </Animated.View>
            )}
            {step === 'intro2' && (
              <Animated.View key="intro2" entering={enteringTransition} exiting={exitingTransition} style={styles.slideFull}>
                <Slide2 />
              </Animated.View>
            )}
            {step === 'intro3' && (
              <Animated.View key="intro3" entering={enteringTransition} exiting={exitingTransition} style={styles.slideFull}>
                <Slide3 />
              </Animated.View>
            )}
            {step === 'auth_home' && (
              <Animated.View key="auth_home" entering={enteringTransition} exiting={exitingTransition} style={styles.slideFull}>
                <AuthHome
                  onGoogleLogin={handleGoogleLogin}
                  onEmailContinue={() => { lightTap(); navigateTo('register'); }}
                  onLoginClick={() => { lightTap(); navigateTo('login'); }}
                  loading={googleLoading}
                  errorMsg={errorMsg}
                  agreementAccepted={agreementAccepted}
                  agreementReady={Boolean(currentAgreement)}
                  onToggleAgreement={() => {
                    if (!currentAgreement) return;
                    selectionTick();
                    if (agreementAccepted) setAgreementAccepted(false);
                    else setAgreementModalOpen(true);
                  }}
                  onOpenAgreement={() => { if (currentAgreement) setAgreementModalOpen(true); }}
                />
              </Animated.View>
            )}
            {step === 'login' && (
              <Animated.View key="login" entering={enteringTransition} exiting={exitingTransition} style={styles.slideFull}>
                <SignInForm
                  email={email} setEmail={setEmail}
                  password={password} setPassword={setPassword}
                  showPassword={showPassword} setShowPassword={setShowPassword}
                  loading={loading} errorMsg={errorMsg}
                  onForgot={() => { setErrorMsg(null); navigateTo('forgot'); }}
                  onSubmit={handleAuthSubmit}
                />
              </Animated.View>
            )}
            {step === 'forgot' && <Animated.View key="forgot" entering={enteringTransition} exiting={exitingTransition} style={styles.slideFull}><ForgotPasswordForm email={email} setEmail={setEmail} loading={loading} errorMsg={errorMsg} onSubmit={handleAuthSubmit} /></Animated.View>}
            {step === 'verify' && <Animated.View key="verify" entering={enteringTransition} exiting={exitingTransition} style={styles.slideFull}><VerifyEmailForm email={email} code={verificationCode} setCode={setVerificationCode} loading={loading} errorMsg={errorMsg} onSubmit={checkEmailVerification} onResend={resendVerification} /></Animated.View>}
            {step === 'profile_setup' && (
              <Animated.View key="profile_setup" entering={enteringTransition} exiting={exitingTransition} style={styles.slideFull}>
                <ProfileSetupForm
                  initialName={name || storage.getString(PENDING_PROFILE_NAME_KEY) || 'MyTurn Üyesi'}
                  onProfileSaved={markProfileSetupSaved}
                  onComplete={completeProfileSetup}
                />
              </Animated.View>
            )}
            {step === 'reset' && <Animated.View key="reset" entering={enteringTransition} exiting={exitingTransition} style={styles.slideFull}><ResetPasswordForm email={email} code={resetCode} setCode={setResetCode} password={password} setPassword={setPassword} loading={loading} errorMsg={errorMsg} onSubmit={handleAuthSubmit} /></Animated.View>}
            {step === 'register' && (
              <Animated.View key="register" entering={enteringTransition} exiting={exitingTransition} style={styles.slideFull}>
                <SignUpForm
                  name={name} setName={setName}
                  email={email} setEmail={setEmail}
                  password={password} setPassword={setPassword}
                  showPassword={showPassword} setShowPassword={setShowPassword}
                  loading={loading} errorMsg={errorMsg}
                  agreementAccepted={agreementAccepted}
                  agreementReady={Boolean(currentAgreement)}
                  onToggleAgreement={() => {
                    if (!currentAgreement) return;
                    selectionTick();
                    if (agreementAccepted) setAgreementAccepted(false);
                    else setAgreementModalOpen(true);
                  }}
                  onOpenAgreement={() => { if (currentAgreement) setAgreementModalOpen(true); }}
                  onSubmit={handleAuthSubmit}
                />
              </Animated.View>
            )}
          </View>
        </GestureDetector>

        {/* --- Pagination Dots & Next Button (Only for Intro) --- */}
        {isIntro && (
          <View style={[styles.footerContainer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.footerRow}>
              <View style={styles.dotsRow}>
                {['intro1', 'intro2', 'intro3'].map((s) => (
                  <View key={s} style={[styles.dot, step === s ? styles.dotActive : null]} />
                ))}
              </View>
              <TouchableOpacity onPress={handleNextIntro} style={styles.nextBtn} activeOpacity={0.85}>
                {step === 'intro3' ? (
                  <Text style={styles.nextBtnText}>Başla</Text>
                ) : (
                  <ArrowRight size={20} color="#000" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
      <AgreementModal
        visible={agreementModalOpen}
        agreement={currentAgreement}
        onClose={() => setAgreementModalOpen(false)}
        onAccept={() => { setAgreementAccepted(true); setAgreementModalOpen(false); }}
      />
    </GestureHandlerRootView>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  agreementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 16,
  },
  authAgreementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: ACCENT, borderColor: ACCENT },
  checkmark: { color: '#000', fontSize: 14 },
  agreementText: { flex: 1, color: 'rgba(255,255,255,0.55)', fontSize: 11, lineHeight: 17 },
  agreementLink: { color: ACCENT, textDecorationLine: 'underline' },
  submitBtnDisabled: { opacity: 0.45 },
  navigationHeaderRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 99,
  },
  backBtn: {
    padding: 4,
    marginLeft: -8,
  },
  skipBtn: {
    padding: 4,
  },
  skipBtnText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontFamily: 'Satoshi-Medium',
  },
  slidesContainer: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },
  slideFull: {
    ...StyleSheet.absoluteFill,
  },
  slideContentContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 32,
  },
  slideTopText: {
    marginTop: SCREEN_HEIGHT * 0.10,
  },
  slideTitle: {
    fontSize: 34,
    color: '#fff',
    letterSpacing: -0.5,
    lineHeight: 40,
    marginBottom: 16,
    fontFamily: 'Satoshi-Bold',
  },
  slideDesc: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 24,
    fontFamily: 'Satoshi-Medium',
  },

  // Slide 1 specifics
  slide1Bottom: {
    marginBottom: SCREEN_HEIGHT * 0.15,
  },
  avatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  mockAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#171717',
    backgroundColor: '#1a1a1a',
  },
  avatarPlusBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
  },
  avatarPlusText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Satoshi-Bold',
  },
  quoteText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    fontFamily: 'Satoshi-Medium',
  },

  // Slide 2 specifics (iOS Camera UI)
  slide2Bottom: {
    marginBottom: SCREEN_HEIGHT * 0.12,
  },
  iosCameraContainer: {
    alignItems: 'center',
  },
  iosRecordBadgeGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderTopColor: 'rgba(255,255,255,0.3)',
    borderLeftColor: 'rgba(255,255,255,0.2)',
  },
  iosRecordDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff3b30',
    marginRight: 8,
  },
  iosRecordTime: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Satoshi-Bold',
    fontVariant: ['tabular-nums'],
  },
  iosCameraModes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 24,
  },
  iosCameraModeInactive: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontFamily: 'Satoshi-Medium',
    letterSpacing: 1,
  },
  iosCameraModeActive: {
    color: ACCENT,
    fontSize: 11,
    fontFamily: 'Satoshi-Bold',
    letterSpacing: 1,
  },
  iosCameraControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 12,
  },
  iosCameraThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  iosCameraThumbnailImg: {
    width: '100%',
    height: '100%',
  },
  iosCameraShutterRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iosCameraShutterSquare: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: '#ff3b30',
  },
  iosCameraSwitchGlass: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderTopColor: 'rgba(255,255,255,0.4)',
    borderLeftColor: 'rgba(255,255,255,0.3)',
  },

  // Slide 3 specifics
  slide3Bottom: {
    marginBottom: SCREEN_HEIGHT * 0.13,
  },
  commentsStack: {
    width: '100%',
  },
  commentCard: {
    width: '100%',
    borderRadius: 20,
    padding: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    borderTopColor: 'rgba(255,255,255,0.4)',
    borderLeftColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  commentTextContent: {
    flex: 1,
  },
  commentName: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
    fontFamily: 'Satoshi-Bold',
  },
  commentText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Satoshi-Medium',
    marginBottom: 6,
  },
  commentTime: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontFamily: 'Satoshi-Regular',
  },
  commentHeartWrapper: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  mockAvatarTiny: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#171717',
    backgroundColor: '#1a1a1a',
  },
  avatarPlusBadgeTiny: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'transparent',
  },
  avatarPlusTextTiny: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'Satoshi-Bold',
  },

  // Auth Home specifics
  authContentContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingTop: SCREEN_HEIGHT * 0.18,
    paddingBottom: SCREEN_HEIGHT * 0.06,
  },
  authLogoArea: {
    alignItems: 'center',
    gap: 25,
  },
  authLogoImg: {
    width: SCREEN_WIDTH * 0.82,
    height: 200,
    resizeMode: 'contain',
  },
  authSub: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: 'Satoshi-Medium',
    paddingHorizontal: 12,
  },
  authActionsArea: {
    width: '100%',
    gap: 12,
  },
  authSectionTitle: {
    fontSize: 26,
    color: '#fff',
    fontFamily: 'Satoshi-Bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  authErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  authBtnGoogle: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  authBtnEmail: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  authBtnTextOutlined: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Satoshi-Medium',
  },
  socialIcon: {
    width: 26,
    height: 26,
    resizeMode: 'contain',
  },
  authDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  authDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  authDividerText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    fontFamily: 'Satoshi-Medium',
    marginHorizontal: 16,
  },
  authLoginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  authLoginText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontFamily: 'Satoshi-Medium',
  },
  authLoginLink: {
    color: ACCENT,
    fontSize: 14,
    fontFamily: 'Satoshi-Bold',
  },

  // Auth Forms specifics
  formContainer: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: SCREEN_HEIGHT * 0.15,
  },
  formScrollContent: {
    flexGrow: 1,
  },
  formTitle: {
    fontSize: 32,
    color: '#fff',
    marginBottom: 8,
    letterSpacing: -0.5,
    fontFamily: 'Satoshi-Bold',
  },
  formSub: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 40,
    fontFamily: 'Satoshi-Medium',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    marginBottom: 20,
    gap: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    flex: 1,
    fontFamily: 'Satoshi-Bold',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    height: 60,
    marginBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputIcon: {
    marginRight: 14,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Satoshi-Medium',
    height: '100%',
  },
  eyeBtn: {
    padding: 8,
    marginRight: -8,
  },
  forgotPasswordBtn: {
    alignSelf: 'flex-end',
    marginBottom: 32,
    marginTop: 4,
  },
  forgotPasswordText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontFamily: 'Satoshi-Medium',
  },
  submitBtn: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    color: '#000',
    fontSize: 16,
    fontFamily: 'Satoshi-Bold',
  },

  // Footer / Dots / Next Button
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 32,
    zIndex: 90,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotActive: {
    backgroundColor: ACCENT,
  },
  nextBtn: {
    height: 48,
    minWidth: 48,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnText: {
    color: '#000',
    fontSize: 15,
    fontFamily: 'Satoshi-Bold',
  },
});

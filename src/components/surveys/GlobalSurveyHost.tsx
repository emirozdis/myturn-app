import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname } from 'expo-router';
import auth from '@react-native-firebase/auth';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  LockKeyhole,
  X,
} from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  FadeOut,
  FadeOutLeft,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../ui/Text';
import { lightTap, notifySuccess, selectionTick } from '../../lib/haptics';
import { useTranslation } from '../../lib/i18n';
import {
  getPendingSurvey,
  isSurveyCompletedLocally,
  isSurveySnoozed,
  markSurveyCompleted,
  snoozeSurvey,
  subscribeToManualSurveyOpen,
  submitSurvey,
  type PendingSurvey,
  type SurveyAnswers,
  type SurveyQuestion,
} from '../../lib/surveys';

const APP_PATHS = new Set(['/today', '/record', '/social', '/streaks', '/profile']);
const DEFAULT_ACCENT = '#D9FF66';
const MAX_DELAY_MS = 15_000;

function safeAccent(value: unknown): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : DEFAULT_ACCENT;
}

function answerIsValid(question: SurveyQuestion, value: string | string[] | undefined): boolean {
  if (question.type === 'FREE_TEXT') {
    const length = typeof value === 'string' ? value.trim().length : 0;
    const minimum = question.minLength ?? (question.isRequired ? 1 : 0);
    return length >= minimum && (question.maxLength === null || length <= question.maxLength);
  }
  if (question.type === 'SINGLE_SELECT') {
    return !question.isRequired || (typeof value === 'string' && value.length > 0);
  }
  const count = Array.isArray(value) ? value.length : 0;
  const minimum = question.minSelected ?? (question.isRequired ? 1 : 0);
  return count >= minimum && (question.maxSelected === null || count <= question.maxSelected);
}

function SelectionQuestion({
  question,
  value,
  accent,
  onChange,
}: {
  question: SurveyQuestion;
  value: string | string[] | undefined;
  accent: string;
  onChange: (value: string | string[]) => void;
}) {
  const selectedValues = Array.isArray(value) ? value : [];
  return (
    <View style={styles.options}>
      {question.options.map((option, index) => {
        const selected = question.type === 'SINGLE_SELECT'
          ? value === option.id
          : selectedValues.includes(option.id);
        return (
          <Animated.View key={option.id} entering={FadeInDown.delay(index * 45).duration(260)}>
            <TouchableOpacity
              style={[
                styles.option,
                selected && { borderColor: accent, backgroundColor: `${accent}12` },
              ]}
              activeOpacity={0.78}
              onPress={() => {
                selectionTick();
                if (question.type === 'SINGLE_SELECT') {
                  onChange(option.id);
                  return;
                }
                const maximum = question.maxSelected ?? question.options.length;
                if (selected) {
                  onChange(selectedValues.filter((id) => id !== option.id));
                } else if (selectedValues.length < maximum) {
                  onChange([...selectedValues, option.id]);
                }
              }}
              accessibilityRole={question.type === 'SINGLE_SELECT' ? 'radio' : 'checkbox'}
              accessibilityState={{ checked: selected }}
            >
              <View style={[
                question.type === 'SINGLE_SELECT' ? styles.radio : styles.checkbox,
                selected && { backgroundColor: accent, borderColor: accent },
              ]}>
                {selected ? <Check size={13} color="#090A08" strokeWidth={3.5} /> : null}
              </View>
              <Text weight="medium" style={[styles.optionLabel, selected && { color: '#fff' }]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </View>
  );
}

export function GlobalSurveyHost() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { t } = useTranslation();
  const [authenticated, setAuthenticated] = useState(Boolean(auth().currentUser));
  const [survey, setSurvey] = useState<PendingSurvey | null>(null);
  const [visible, setVisible] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [validationVisible, setValidationVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [manualLaunch, setManualLaunch] = useState(false);
  const checkedForSession = useRef(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetTranslateY = useSharedValue(screenHeight);
  const backdropOpacity = useSharedValue(0);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));
  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const finishSheetClose = useCallback(() => {
    setVisible(false);
    setSurvey(null);
  }, []);

  const closeSheet = useCallback(() => {
    backdropOpacity.value = withTiming(0, {
      duration: 210,
      easing: Easing.out(Easing.quad),
    });
    sheetTranslateY.value = withTiming(screenHeight, {
      duration: 290,
      easing: Easing.in(Easing.cubic),
    }, (finished) => {
      if (finished) runOnJS(finishSheetClose)();
    });
  }, [backdropOpacity, finishSheetClose, screenHeight, sheetTranslateY]);

  useEffect(() => {
    if (!visible) return;
    sheetTranslateY.value = screenHeight;
    backdropOpacity.value = 0;
    backdropOpacity.value = withTiming(1, {
      duration: 240,
      easing: Easing.out(Easing.quad),
    });
    sheetTranslateY.value = withTiming(0, {
      duration: 390,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
  }, [backdropOpacity, screenHeight, sheetTranslateY, visible]);

  useEffect(() => auth().onAuthStateChanged((user) => {
    setAuthenticated(Boolean(user));
    if (!user) {
      checkedForSession.current = false;
      setSurvey(null);
      setVisible(false);
    }
  }), []);

  const checkForSurvey = useCallback(async () => {
    if (!authenticated || !APP_PATHS.has(pathname) || checkedForSession.current) return;
    checkedForSession.current = true;
    const result = await getPendingSurvey();
    if (!result.success || !result.survey) return;
    if (
      isSurveyCompletedLocally(result.survey)
      || (!result.survey.isMandatory && isSurveySnoozed(result.survey))
    ) return;

    const nextSurvey = result.survey;
    setManualLaunch(false);
    setSurvey(nextSurvey);
    setQuestionIndex(0);
    setAnswers({});
    setValidationVisible(false);
    setSubmitError('');
    setSubmitted(false);
    const configuredDelay = nextSurvey.presentation?.delayMs;
    const delay = typeof configuredDelay === 'number'
      ? Math.max(250, Math.min(configuredDelay, MAX_DELAY_MS))
      : 900;
    showTimer.current = setTimeout(() => setVisible(true), delay);
  }, [authenticated, pathname]);

  useEffect(() => {
    void checkForSurvey();
    return () => {
      if (showTimer.current) clearTimeout(showTimer.current);
    };
  }, [checkForSurvey]);

  useEffect(() => subscribeToManualSurveyOpen((nextSurvey) => {
    if (showTimer.current) clearTimeout(showTimer.current);
    setSurvey(nextSurvey);
    setQuestionIndex(0);
    setAnswers({});
    setValidationVisible(false);
    setSubmitError('');
    setSubmitted(false);
    setManualLaunch(true);
    setVisible(true);
  }), []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !visible && !survey) {
        checkedForSession.current = false;
        void checkForSurvey();
      }
    });
    return () => subscription.remove();
  }, [checkForSurvey, survey, visible]);

  const question = survey?.questions[questionIndex];
  const accent = useMemo(() => safeAccent(survey?.presentation?.accentColor), [survey]);
  const currentValid = question ? answerIsValid(question, answers[question.id]) : false;
  const progress = survey ? (questionIndex + 1) / survey.questions.length : 0;

  const closeOptional = () => {
    if (!survey || survey.isMandatory || submitting) return;
    lightTap();
    snoozeSurvey(survey);
    closeSheet();
  };

  const goBack = () => {
    if (questionIndex === 0 || submitting) return;
    lightTap();
    setValidationVisible(false);
    setQuestionIndex((current) => current - 1);
  };

  const advance = async () => {
    if (!survey || !question || submitting) return;
    if (!currentValid) {
      setValidationVisible(true);
      selectionTick();
      return;
    }
    setValidationVisible(false);
    setSubmitError('');
    if (questionIndex < survey.questions.length - 1) {
      lightTap();
      setQuestionIndex((current) => current + 1);
      return;
    }

    setSubmitting(true);
    const result = await submitSurvey(survey, answers, { manual: manualLaunch });
    setSubmitting(false);
    if (!result.success) {
      setSubmitError(result.error);
      return;
    }
    markSurveyCompleted(survey);
    notifySuccess();
    setSubmitted(true);
    setTimeout(() => {
      closeSheet();
    }, 1500);
  };

  if (!survey || !question) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {
        if (!survey.isMandatory) closeOptional();
      }}
    >
      <View style={styles.modalRoot}>
        <Animated.View style={[StyleSheet.absoluteFill, backdropAnimatedStyle]}>
          <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={survey.isMandatory ? undefined : closeOptional}
            accessibilityElementsHidden
          />
        </Animated.View>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Animated.View
            style={[
              styles.sheet,
              sheetAnimatedStyle,
              {
                paddingBottom: Math.max(insets.bottom, 16),
                height: screenHeight * 0.94,
              },
            ]}
          >
            <LinearGradient
              colors={[`${accent}1F`, 'rgba(255,255,255,0.025)', 'rgba(255,255,255,0.01)']}
              locations={[0, 0.28, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            {submitted ? (
              <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut} style={styles.success}>
                <Animated.View entering={ZoomIn.springify().damping(13)} style={[styles.successIcon, { backgroundColor: `${accent}18` }]}>
                  <CheckCircle2 size={44} color={accent} strokeWidth={1.8} />
                </Animated.View>
                <Text weight="bold" style={styles.successTitle}>
                  {survey.presentation?.successTitle || t('survey.thankYou')}
                </Text>
                <Text style={styles.successBody}>
                  {survey.presentation?.successBody || t('survey.saved')}
                </Text>
              </Animated.View>
            ) : (
              <>
                <View style={styles.header}>
                  <View style={styles.headerCopy}>
                    <View style={styles.eyebrowRow}>
                      {survey.isMandatory ? <LockKeyhole size={11} color={accent} /> : null}
                      <Text weight="bold" style={[styles.eyebrow, { color: accent }]}>
                        {survey.isMandatory ? t('survey.required') : t('survey.quickSurvey')}
                      </Text>
                    </View>
                    <Text weight="bold" style={styles.title} numberOfLines={2}>{survey.title}</Text>
                    {survey.description ? (
                      <Text style={styles.description} numberOfLines={3}>{survey.description}</Text>
                    ) : null}
                  </View>
                  {!survey.isMandatory ? (
                    <TouchableOpacity
                      onPress={closeOptional}
                      style={styles.closeButton}
                      accessibilityRole="button"
                      accessibilityLabel={t('survey.maybeLater')}
                    >
                      <X size={18} color="rgba(255,255,255,0.54)" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                <View style={styles.progressTrack}>
                  <Animated.View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: accent }]} />
                </View>

                <ScrollView
                  style={styles.questionScroll}
                  contentContainerStyle={styles.questionContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                >
                  <Animated.View
                    key={question.id}
                    entering={FadeInRight.duration(280)}
                    exiting={FadeOutLeft.duration(180)}
                  >
                    <Text weight="bold" style={styles.counter}>
                      {t('survey.questionCount', { current: questionIndex + 1, total: survey.questions.length })}
                    </Text>
                    <Text weight="bold" style={styles.prompt}>{question.prompt}</Text>
                    {question.description ? <Text style={styles.questionDescription}>{question.description}</Text> : null}

                    {question.type === 'FREE_TEXT' ? (
                      <View style={[
                        styles.inputWrap,
                        validationVisible && !currentValid && styles.invalidBorder,
                      ]}>
                        <TextInput
                          value={typeof answers[question.id] === 'string' ? answers[question.id] as string : ''}
                          onChangeText={(value) => {
                            setAnswers((current) => ({ ...current, [question.id]: value }));
                            if (validationVisible) setValidationVisible(false);
                          }}
                          placeholder={t('survey.responsePlaceholder')}
                          placeholderTextColor="rgba(255,255,255,0.24)"
                          style={styles.input}
                          multiline
                          autoFocus={false}
                          maxLength={question.maxLength ?? 10_000}
                          textAlignVertical="top"
                        />
                        {question.maxLength ? (
                          <Text style={styles.characterCount}>
                            {(typeof answers[question.id] === 'string' ? answers[question.id].length : 0)}/{question.maxLength}
                          </Text>
                        ) : null}
                      </View>
                    ) : (
                      <SelectionQuestion
                        question={question}
                        value={answers[question.id]}
                        accent={accent}
                        onChange={(value) => {
                          setAnswers((current) => ({ ...current, [question.id]: value }));
                          setValidationVisible(false);
                        }}
                      />
                    )}

                    {validationVisible && !currentValid ? (
                      <Animated.View entering={FadeIn.duration(150)}>
                        <Text style={styles.validationText}>{t('survey.answerRequired')}</Text>
                      </Animated.View>
                    ) : null}
                    {submitError ? <Text style={styles.validationText}>{submitError}</Text> : null}
                  </Animated.View>
                </ScrollView>

                <View style={styles.footer}>
                  {questionIndex > 0 ? (
                    <TouchableOpacity onPress={goBack} style={styles.backButton} activeOpacity={0.75}>
                      <ArrowLeft size={18} color="rgba(255,255,255,0.72)" />
                    </TouchableOpacity>
                  ) : !survey.isMandatory ? (
                    <TouchableOpacity onPress={closeOptional} style={styles.laterButton} activeOpacity={0.75}>
                      <Text weight="bold" style={styles.laterText}>{t('survey.maybeLater')}</Text>
                    </TouchableOpacity>
                  ) : <View style={styles.footerSpacer} />}
                  <TouchableOpacity
                    onPress={() => void advance()}
                    disabled={submitting}
                    style={[styles.nextButton, { backgroundColor: accent }, submitting && { opacity: 0.72 }]}
                    activeOpacity={0.82}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#090A08" />
                    ) : (
                      <>
                        <Text weight="bold" style={styles.nextText}>
                          {questionIndex === survey.questions.length - 1
                            ? survey.presentation?.submitLabel || t('survey.submit')
                            : t('survey.next')}
                        </Text>
                        {questionIndex === survey.questions.length - 1
                          ? <Check size={17} color="#090A08" strokeWidth={3} />
                          : <ArrowRight size={17} color="#090A08" strokeWidth={2.8} />}
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.54)',
  },
  keyboardView: { width: '100%', justifyContent: 'flex-end' },
  sheet: {
    overflow: 'hidden',
    width: '100%',
    minHeight: 470,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#111214',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -10 },
    elevation: 24,
  },
  header: { flexDirection: 'row', paddingHorizontal: 22, paddingTop: 22, paddingBottom: 17 },
  headerCopy: { flex: 1, paddingRight: 10 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 7 },
  eyebrow: { fontSize: 10, letterSpacing: 1.15, textTransform: 'uppercase' },
  title: { color: '#fff', fontSize: 23, lineHeight: 28, letterSpacing: -0.5 },
  description: { color: 'rgba(255,255,255,0.48)', fontSize: 12, lineHeight: 18, marginTop: 6 },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.055)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: { height: 2, marginHorizontal: 22, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 2 },
  progressFill: { height: 2, borderRadius: 2 },
  questionScroll: { flex: 1 },
  questionContent: { paddingHorizontal: 22, paddingTop: 23, paddingBottom: 16 },
  counter: { color: 'rgba(255,255,255,0.32)', fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 9 },
  prompt: { color: '#fff', fontSize: 20, lineHeight: 27, letterSpacing: -0.25 },
  questionDescription: { color: 'rgba(255,255,255,0.44)', fontSize: 12, lineHeight: 18, marginTop: 7 },
  options: { gap: 9, marginTop: 18 },
  option: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.075)',
    backgroundColor: 'rgba(255,255,255,0.025)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  optionLabel: { flex: 1, color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 19 },
  radio: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 21,
    height: 21,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrap: {
    minHeight: 144,
    marginTop: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.18)',
    overflow: 'hidden',
  },
  invalidBorder: { borderColor: 'rgba(248,113,113,0.7)' },
  input: {
    minHeight: 120,
    color: '#fff',
    fontFamily: 'Satoshi-Regular',
    fontSize: 14,
    lineHeight: 21,
    padding: 15,
  },
  characterCount: { color: 'rgba(255,255,255,0.25)', fontSize: 10, textAlign: 'right', paddingHorizontal: 13, paddingBottom: 9 },
  validationText: { color: '#fca5a5', fontSize: 11, lineHeight: 16, marginTop: 9 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.055)',
  },
  backButton: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.055)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterButton: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 5 },
  laterText: { color: 'rgba(255,255,255,0.42)', fontSize: 12 },
  footerSpacer: { width: 46 },
  nextButton: {
    minWidth: 128,
    height: 46,
    borderRadius: 15,
    paddingHorizontal: 18,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: { color: '#090A08', fontSize: 13 },
  success: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  successTitle: { color: '#fff', fontSize: 23, textAlign: 'center' },
  successBody: { color: 'rgba(255,255,255,0.46)', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 7 },
});

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { apiClient, type RequestResult } from './apiClient';
import { APP_ENVIRONMENT } from './environment';
import { storage } from './storage';

export type SurveyQuestionType = 'FREE_TEXT' | 'SINGLE_SELECT' | 'MULTI_SELECT';

export type SurveyOption = {
  id: string;
  label: string;
};

export type SurveyQuestion = {
  id: string;
  key: string;
  type: SurveyQuestionType;
  prompt: string;
  description: string;
  options: SurveyOption[];
  isRequired: boolean;
  minLength: number | null;
  maxLength: number | null;
  minSelected: number | null;
  maxSelected: number | null;
};

export type SurveyPresentation = {
  accentColor?: string;
  delayMs?: number;
  snoozeHours?: number;
  submitLabel?: string;
  successTitle?: string;
  successBody?: string;
};

export type PendingSurvey = {
  id: string;
  key: string;
  revision: number;
  title: string;
  description: string;
  isMandatory: boolean;
  endsAt: string | null;
  presentation: SurveyPresentation | null;
  questions: SurveyQuestion[];
};

export type SurveySubmissionAnswer = {
  id: string;
  questionKey: string;
  prompt: string;
  value: unknown;
  displayValue: string | string[];
};

export type SurveySubmission = {
  id: string;
  surveyKey: string;
  surveyRevision: number;
  title: string;
  isMandatory: boolean;
  submittedAt: string;
  platform: string;
  appVersion: string;
  buildNumber: number | null;
  answers: SurveySubmissionAnswer[];
};

export type SurveyLibrary = {
  available: PendingSurvey[];
  submissions: SurveySubmission[];
  preferences: { allowOptionalSurveys: boolean };
};

export type SurveyAnswerValue = string | string[];
export type SurveyAnswers = Record<string, SurveyAnswerValue>;

export const SURVEY_OPTIONAL_PREFERENCE_KEY = 'survey.allow_optional';

function buildNumber(): number | null {
  const raw = Constants.nativeBuildVersion ?? (
    Platform.OS === 'ios'
      ? Constants.expoConfig?.ios?.buildNumber
      : Constants.expoConfig?.android?.versionCode
  );
  if (typeof raw === 'number' && Number.isSafeInteger(raw)) return raw;
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw);
  return null;
}

export function currentSurveyClientContext() {
  return {
    platform: Platform.OS,
    appVersion: Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? '0.0.0',
    buildNumber: buildNumber(),
    releaseChannel: APP_ENVIRONMENT,
  };
}

export async function getPendingSurvey(): Promise<RequestResult<{
  survey: PendingSurvey | null;
  preferences: { allowOptionalSurveys: boolean };
}>> {
  return apiClient.request('surveys/pending', [currentSurveyClientContext()]);
}

export async function getSurveyLibrary(): Promise<RequestResult<SurveyLibrary>> {
  return apiClient.request('surveys/library', [currentSurveyClientContext()]);
}

export async function submitSurvey(
  survey: PendingSurvey,
  answers: SurveyAnswers,
  options: { manual?: boolean } = {},
): Promise<RequestResult<{
  response?: { id: string; submittedAt: string };
  alreadySubmitted?: boolean;
}>> {
  return apiClient.request('surveys/submit', [{
    action: 'submit',
    surveyId: survey.id,
    revision: survey.revision,
    answers,
    manual: options.manual === true,
    ...currentSurveyClientContext(),
  }]);
}

export async function getSurveyPreferences(): Promise<RequestResult<{
  preferences: { allowOptionalSurveys: boolean };
}>> {
  return apiClient.request('surveys/preferences');
}

export async function setOptionalSurveysEnabled(enabled: boolean): Promise<RequestResult<{
  preferences: { allowOptionalSurveys: boolean };
}>> {
  const result = await apiClient.request<{
    preferences: { allowOptionalSurveys: boolean };
  }>('surveys/preferences/update', [{
    action: 'preferences',
    allowOptionalSurveys: enabled,
  }]);
  if (result.success) storage.set(SURVEY_OPTIONAL_PREFERENCE_KEY, enabled);
  return result;
}

function surveyStateKey(kind: 'snoozed' | 'completed', survey: PendingSurvey): string {
  const userScope = storage.getString('auth_firebase_uid') || 'anonymous';
  return `survey.${kind}:${userScope}:${survey.id}:${survey.revision}`;
}

export function snoozeSurvey(survey: PendingSurvey) {
  const configuredHours = survey.presentation?.snoozeHours;
  const hours = typeof configuredHours === 'number' && configuredHours >= 1
    ? Math.min(configuredHours, 24 * 30)
    : 24;
  storage.set(surveyStateKey('snoozed', survey), Date.now() + hours * 60 * 60 * 1000);
}

export function isSurveySnoozed(survey: PendingSurvey): boolean {
  const key = surveyStateKey('snoozed', survey);
  const until = storage.getNumber(key);
  if (!until) return false;
  if (until <= Date.now()) {
    storage.delete(key);
    return false;
  }
  return true;
}

export function getSurveySnoozedUntil(survey: PendingSurvey): number | null {
  const key = surveyStateKey('snoozed', survey);
  const until = storage.getNumber(key);
  if (!until) return null;
  if (until <= Date.now()) {
    storage.delete(key);
    return null;
  }
  return until;
}

export function markSurveyCompleted(survey: PendingSurvey) {
  storage.set(surveyStateKey('completed', survey), true);
  storage.delete(surveyStateKey('snoozed', survey));
}

export function isSurveyCompletedLocally(survey: PendingSurvey): boolean {
  return storage.getBoolean(surveyStateKey('completed', survey)) === true;
}

type ManualSurveyListener = (survey: PendingSurvey) => void;
const manualSurveyListeners = new Set<ManualSurveyListener>();

export function openSurveyManually(survey: PendingSurvey) {
  manualSurveyListeners.forEach((listener) => listener(survey));
}

export function subscribeToManualSurveyOpen(listener: ManualSurveyListener) {
  manualSurveyListeners.add(listener);
  return () => {
    manualSurveyListeners.delete(listener);
  };
}

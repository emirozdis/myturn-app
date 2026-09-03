export type NotificationLocale = 'en' | 'tr';

export type LocalNotificationKey =
  | 'uploadPausedNetwork'
  | 'uploadPausedServer'
  | 'uploadProgress';

export type NotificationDeepLink = {
  screen: 'today' | 'record' | 'streaks' | 'social';
  groupId?: string;
  clipId?: string;
  assignmentId?: string;
  date?: string;
  focus?: 'comments' | 'responses' | 'reactions' | 'friendRequests' | 'profile' | 'upload';
  itemId?: string;
  userId?: string;
};

type NotificationText = { title: string; body: string };
type NotificationVariables = Record<string, string | number | null | undefined>;

// Device-local notifications live in the mobile project so EAS always bundles
// their copy. Server push copy is maintained in the backend's matching file.
export const notificationTexts: Record<NotificationLocale, Record<LocalNotificationKey, NotificationText>> = {
  en: {
    uploadPausedNetwork: {
      title: 'Upload paused ⚠️',
      body: 'Check your internet connection, then tap to continue the upload.',
    },
    uploadPausedServer: {
      title: 'Upload could not finish ⚠️',
      body: 'We could not reach the server. Tap to try the upload again.',
    },
    uploadProgress: {
      title: 'Uploading your vlog 📤',
      body: '{progressBar} {progress}% complete. Your vlog is uploading in the background.',
    },
  },
  tr: {
    uploadPausedNetwork: {
      title: 'Yükleme duraklatıldı ⚠️',
      body: 'İnternet bağlantını kontrol et, ardından yüklemeye devam etmek için dokun.',
    },
    uploadPausedServer: {
      title: 'Yükleme tamamlanamadı ⚠️',
      body: 'Sunucuya ulaşılamadı. Yüklemeyi yeniden denemek için dokun.',
    },
    uploadProgress: {
      title: 'Vlogun yükleniyor 📤',
      body: '{progressBar} %{progress} tamamlandı. Vlogun arka planda yükleniyor.',
    },
  },
};

const fallbackVariables: Record<string, string> = { progress: '0', progressBar: '' };

export function getNotificationText(
  localeValue: unknown,
  key: LocalNotificationKey,
  variables: NotificationVariables = {},
  fallbackLocale: NotificationLocale = 'en',
): NotificationText {
  const locale = localeValue === 'en' || localeValue === 'tr' ? localeValue : fallbackLocale;
  const values = { ...fallbackVariables, ...variables };
  const interpolate = (text: string) => text.replace(
    /\{(\w+)\}/g,
    (_, name: string) => String(values[name] ?? ''),
  );
  const template = notificationTexts[locale][key];
  return { title: interpolate(template.title), body: interpolate(template.body) };
}

export function createNotificationDeepLink(deepLink: NotificationDeepLink): string {
  const query = Object.entries(deepLink)
    .filter(([key, value]) => key !== 'screen' && typeof value === 'string' && value.length > 0)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');

  return `/${deepLink.screen}${query ? `?${query}` : ''}`;
}

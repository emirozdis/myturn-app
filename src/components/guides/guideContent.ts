import type { GuideId } from '../../lib/guides';

export type GuideMotion =
  | 'groups'
  | 'passTurn'
  | 'mandatoryTurn'
  | 'claimTurn'
  | 'edges'
  | 'doubleTap'
  | 'hold'
  | 'photoResponse'
  | 'responseOpen'
  | 'responseBrowse'
  | 'responseDismiss'
  | 'timeline'
  | 'modes'
  | 'record'
  | 'tools'
  | 'publish'
  | 'days'
  | 'albums'
  | 'dismiss';

export type GuideStep = {
  eyebrow: string;
  title: string;
  body: string;
  motion: GuideMotion;
  practicePrompt?: string;
};

export type GuideDefinition = {
  title: string;
  summary: string;
  steps: GuideStep[];
};

type Locale = 'en' | 'tr';

const EN: Record<GuideId, GuideDefinition> = {
  groups: {
    title: 'Groups and daily turns',
    summary: 'Create a group and understand the daily camera turn.',
    steps: [
      {
        eyebrow: 'START TOGETHER',
        title: 'Create or join a group',
        body: 'Use an invite code or QR to join. Today, Record, and Archive follow the active group; turns begin when enough members join.',
        motion: 'groups',
      },
      {
        eyebrow: 'DAILY CAMERA',
        title: 'One person records each day',
        body: 'MyTurn selects one daily vlogger. On your turn, Record becomes your camera for the day.',
        motion: 'record',
      },
      {
        eyebrow: 'WHEN YOU CANNOT RECORD',
        title: 'Pass before 13:30',
        body: 'On a regular turn, you can pass only before posting and while no upload is active. The camera then opens to the group.',
        motion: 'passTurn',
      },
      {
        eyebrow: 'YOUR NEXT TURN',
        title: 'Tomorrow becomes mandatory',
        body: 'If you pass, tomorrow’s turn returns to you and cannot be passed again.',
        motion: 'mandatoryTurn',
      },
      {
        eyebrow: 'OPEN CAMERA',
        title: 'The first claim takes the turn',
        body: 'The first member to select Take Camera becomes today’s vlogger. With no morning post, MyTurn opens it at 13:30.',
        motion: 'claimTurn',
      },
    ],
  },
  today: {
    title: 'Watching Today',
    summary: 'Learn playback and response gestures.',
    steps: [
      {
        eyebrow: 'MOVE BETWEEN MOMENTS',
        title: 'Tap the screen edges',
        body: 'Tap the left edge for the previous moment or the right edge for the next one.',
        motion: 'edges',
        practicePrompt: 'Tap either edge of the video',
      },
      {
        eyebrow: 'REACT',
        title: 'Double-tap to like',
        body: 'Double-tap the video to like the moment.',
        motion: 'doubleTap',
        practicePrompt: 'Double-tap the video',
      },
      {
        eyebrow: 'PLAYBACK',
        title: 'Hold to pause and move',
        body: 'Hold to pause; keep holding and slide sideways to scrub.',
        motion: 'hold',
        practicePrompt: 'Press and hold the video',
      },
      {
        eyebrow: 'THE WHOLE DAY',
        title: 'Jump to another time',
        body: 'Use the bottom timeline to revisit another part of the day.',
        motion: 'timeline',
        practicePrompt: 'Tap a point on the timeline',
      },
      {
        eyebrow: 'PHOTO RESPONSES',
        title: 'Tap the camera to open responses',
        body: 'When responses exist, tap the camera button on the right.',
        motion: 'responseOpen',
        practicePrompt: 'Tap the real camera button',
      },
      {
        eyebrow: 'VIEW RESPONSES',
        title: 'Swipe through your friends’ responses',
        body: 'Swipe the response card left or right to browse.',
        motion: 'responseBrowse',
        practicePrompt: 'Swipe the response card left or right',
      },
      {
        eyebrow: 'CLOSE RESPONSES',
        title: 'Pull the response down to return',
        body: 'Pull the response card down to return to the story.',
        motion: 'responseDismiss',
        practicePrompt: 'Pull the response card downward',
      },
      {
        eyebrow: 'ADD YOUR RESPONSE',
        title: 'Hold the camera button to respond',
        body: 'Hold the camera button on the right—not the video—until the response camera opens.',
        motion: 'photoResponse',
        practicePrompt: 'Hold the camera button on the right',
      },
    ],
  },
  record: {
    title: 'Recording your turn',
    summary: 'Choose a format, record, and review.',
    steps: [
      {
        eyebrow: 'CHOOSE A FORMAT',
        title: 'Photo, Snippet, or Vlog',
        body: 'Photo captures one frame, Snippet a short clip, and Vlog a longer story.',
        motion: 'modes',
        practicePrompt: 'Tap Vlog to continue with a real recording',
      },
      {
        eyebrow: 'CAPTURE',
        title: 'Tap to record, tap to pause',
        body: 'Choose Vlog, record for at least five seconds, then tap the shutter again to pause.',
        motion: 'record',
        practicePrompt: 'Record at least 5 seconds, then tap to pause',
      },
      {
        eyebrow: 'OPTIONAL TOOLS',
        title: 'Adjust the shot',
        body: 'Try speed, flip, flash, zoom, or Prompt.',
        motion: 'tools',
        practicePrompt: 'Tap one of the camera tools',
      },
      {
        eyebrow: 'REVIEW',
        title: 'Finish and review your capture',
        body: 'Tap Done to review. Caption and location are optional before publishing.',
        motion: 'publish',
        practicePrompt: 'Tap Done to open the real preview',
      },
    ],
  },
  archive: {
    title: 'Using Archive',
    summary: 'Browse past days and control playback.',
    steps: [
      {
        eyebrow: 'CHANGE THE DAY',
        title: 'Swipe through day cards',
        body: 'Swipe the top row left or right to select another day.',
        motion: 'days',
        practicePrompt: 'Swipe the day cards left or right',
      },
      {
        eyebrow: 'OPEN A MEMORY',
        title: 'Tap an album or clip',
        body: 'Tap a moment to open full-screen playback.',
        motion: 'albums',
        practicePrompt: 'Tap an album to open it',
      },
      {
        eyebrow: 'MOVE BETWEEN MOMENTS',
        title: 'Tap the playback edges',
        body: 'Tap the left edge for the previous moment or the right edge for the next one.',
        motion: 'edges',
        practicePrompt: 'Tap either edge of the playback',
      },
      {
        eyebrow: 'PAUSE PLAYBACK',
        title: 'Press and hold the memory',
        body: 'Hold the video to pause; release to resume.',
        motion: 'hold',
        practicePrompt: 'Press and hold the video',
      },
      {
        eyebrow: 'CLOSE PLAYBACK',
        title: 'Pull down to return',
        body: 'Drag the playback view down to return to Archive.',
        motion: 'dismiss',
        practicePrompt: 'Pull the playback card downward',
      },
    ],
  },
};

const TR: Record<GuideId, GuideDefinition> = {
  groups: {
    title: 'Gruplar ve vlog sırası',
    summary: 'Grubunu kur ve günlük kamera sırasını öğren.',
    steps: [
      { eyebrow: 'GRUBUN', title: 'Grup kur veya katıl', body: 'Davet kodu ya da QR ile katılabilirsin. Bugün, Kaydet ve Arşiv seçili gruba göre değişir; yeterli üye olunca sıralar başlar.', motion: 'groups' },
      { eyebrow: 'GÜNÜN VLOGGER’I', title: 'Kamera her gün bir kişide', body: 'MyTurn günün vlogger’ını seçer. Sıra sana geldiğinde Kaydet sekmesi gün boyunca senin olur.', motion: 'record' },
      { eyebrow: 'PAS GEÇ', title: '13.30’dan önce pas geçebilirsin', body: 'Normal sıranı yalnızca paylaşım yapmadan ve aktif yüklemen yokken pas geçebilirsin. Kamera gruba açılır.', motion: 'passTurn' },
      { eyebrow: 'ERTESİ GÜN', title: 'Yarınki sıran zorunlu olur', body: 'Pas geçersen kamera ertesi gün sana döner ve o sırayı yeniden pas geçemezsin.', motion: 'mandatoryTurn' },
      { eyebrow: 'BOŞTAKİ KAMERA', title: 'İlk alan sırayı devralır', body: 'Kamerayı Al’a ilk dokunan günün vlogger’ı olur. Sabah paylaşım yapılmazsa MyTurn kamerayı 13.30’da açar.', motion: 'claimTurn' },
    ],
  },
  today: {
    title: 'Bugün akışını kullanma',
    summary: 'Oynatma ve fotoğraf yanıtı hareketlerini öğren.',
    steps: [
      { eyebrow: 'GEÇİŞ', title: 'Ekranın kenarlarına dokun', body: 'Önceki an için sol, sonraki an için sağ kenara dokun.', motion: 'edges', practicePrompt: 'Videonun sağ ya da sol kenarına dokun' },
      { eyebrow: 'BEĞEN', title: 'Videoya çift dokun', body: 'Anı beğenmek için videoya çift dokun.', motion: 'doubleTap', practicePrompt: 'Videoya çift dokun' },
      { eyebrow: 'OYNATMA', title: 'Basılı tutarak duraklat', body: 'Basılı tut; parmağını kaldırmadan yana kaydırarak geri veya ileri sar.', motion: 'hold', practicePrompt: 'Videoya basılı tut' },
      { eyebrow: 'ZAMAN ÇİZELGESİ', title: 'Günün başka bir saatine geç', body: 'Alttaki zaman çizelgesinden başka bir bölüme dokun.', motion: 'timeline', practicePrompt: 'Zaman çizelgesindeki bir noktaya dokun' },
      { eyebrow: 'FOTOĞRAF YANITLARI', title: 'Yanıtları aç', body: 'Yanıt varsa sağdaki kamera simgesine dokun.', motion: 'responseOpen', practicePrompt: 'Sağdaki kamera simgesine dokun' },
      { eyebrow: 'YANITLAR', title: 'Yanıtlar arasında kaydır', body: 'Yanıt kartını sağa ya da sola kaydır.', motion: 'responseBrowse', practicePrompt: 'Yanıt kartını sağa ya da sola kaydır' },
      { eyebrow: 'KAPAT', title: 'Yanıtı aşağı çek', body: 'Hikâyeye dönmek için yanıt kartını aşağı çek.', motion: 'responseDismiss', practicePrompt: 'Yanıt kartını aşağı doğru çek' },
      { eyebrow: 'YANIT EKLE', title: 'Kamera simgesine basılı tut', body: 'Videoya değil, sağdaki kamera simgesine yanıt kamerası açılana kadar basılı tut.', motion: 'photoResponse', practicePrompt: 'Sağdaki kamera simgesine basılı tut' },
    ],
  },
  record: {
    title: 'Vlog sıranı kaydetme',
    summary: 'Çekim türünü seç, kaydet ve gözden geçir.',
    steps: [
      { eyebrow: 'ÇEKİM TÜRÜ', title: 'Fotoğraf, Snippet veya Vlog', body: 'Fotoğraf tek kare, Snippet kısa klip, Vlog ise daha uzun bir hikâye çeker.', motion: 'modes', practicePrompt: 'Vlog’a dokun' },
      { eyebrow: 'KAYIT', title: 'Kaydet, sonra duraklat', body: 'Vlog’u seç, en az beş saniye kaydet ve deklanşöre yeniden dokun.', motion: 'record', practicePrompt: '5 saniye kaydet ve duraklat' },
      { eyebrow: 'ARAÇLAR', title: 'Çekimini ayarla', body: 'Hız, kamera çevirme, flaş, yakınlaştırma veya Konu’yu dene.', motion: 'tools', practicePrompt: 'Bir kamera aracına dokun' },
      { eyebrow: 'ÖN İZLEME', title: 'Kaydı gözden geçir', body: 'Onay işaretine dokun. Açıklama ve konum eklemek isteğe bağlıdır.', motion: 'publish', practicePrompt: 'Onay işaretine dokun' },
    ],
  },
  archive: {
    title: 'Arşivde gezinme',
    summary: 'Geçmiş günlere göz at ve oynatmayı kontrol et.',
    steps: [
      { eyebrow: 'GÜNLER', title: 'Gün kartlarını kaydır', body: 'Başka bir gün için üstteki kartları sağa veya sola kaydır.', motion: 'days', practicePrompt: 'Gün kartlarını sağa ya da sola kaydır' },
      { eyebrow: 'ANIYI AÇ', title: 'Bir albüme dokun', body: 'Tam ekran oynatmak için bir an seç.', motion: 'albums', practicePrompt: 'Bir albüme dokun' },
      { eyebrow: 'GEÇİŞ', title: 'Oynatıcının kenarlarına dokun', body: 'Önceki an için sol, sonraki an için sağ kenara dokun.', motion: 'edges', practicePrompt: 'Oynatıcının sağ ya da sol kenarına dokun' },
      { eyebrow: 'DURAKLAT', title: 'Videoya basılı tut', body: 'Basılı tutarak duraklat; bıraktığında oynatma sürer.', motion: 'hold', practicePrompt: 'Videoya basılı tut' },
      { eyebrow: 'ARŞİVE DÖN', title: 'Oynatıcıyı aşağı çek', body: 'Arşive dönmek için oynatma görünümünü aşağı sürükle.', motion: 'dismiss', practicePrompt: 'Oynatma kartını aşağı doğru çek' },
    ],
  },
};

export function getGuideDefinition(id: GuideId, locale: string): GuideDefinition {
  return (locale === 'tr' ? TR : EN)[id];
}

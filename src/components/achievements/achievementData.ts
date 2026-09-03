// ./src/components/achievements/achievementData.ts
import { Locale } from '../../store/useLanguageStore';

// Static asset mapping to ensure bundle-time resolution on mobile devices.
// Defensively falling back to verified assets (sun.png / fire.png) for keys 
// whose assets are missing on the local disk to prevent Metro compilation crashes.
export const ACHIEVEMENT_ICONS: Record<string, any> = {
  heart: require('../../../assets/icons/heart.png'),
  shield: require('../../../assets/icons/shield.png'),
  rocket: require('../../../assets/icons/rocket.png'),
  fire: require('../../../assets/icons/fire.png'),
  sun: require('../../../assets/icons/sun.png'),
  crown: require('../../../assets/icons/crown.png'),
  trophy: require('../../../assets/icons/trophy.png'),
  
  // NOTE: If gem.png and medal.png are copied to your assets/icons/ folder,
  // change these fallbacks back to:
  // gem: require('../../../assets/icons/gem.png'),
  // medal: require('../../../assets/icons/medal.png'),
  moon: require('../../../assets/icons/moon.png'),
  gem: require('../../../assets/icons/sun.png'),    // Safe compile-time fallback
  medal: require('../../../assets/icons/fire.png'),  // Safe compile-time fallback
};

export interface AchievementConfig {
  id: string;
  particles: 'confetti' | 'sparks' | 'none';
  image: {
    src: string; // Resolves to keys in ACHIEVEMENT_ICONS
    value: string;
  };
  title: string;
  highlight: string;
  subtitle: string;
  description: string;
  primaryAction: string;
  secondaryAction: string;
}

export const getLocalizedAchievements = (locale: Locale): Record<string, AchievementConfig> => {
  const isTr = locale === 'tr';
  return {
    'the-tribute': {
      id: 'the-tribute',
      particles: 'sparks',
      image: { src: 'heart', value: '1st' },
      title: isTr ? 'Gönüllü' : 'The Tribute',
      highlight: isTr ? 'Gönüllü' : 'Tribute',
      subtitle: isTr ? 'İlk Kez Gönüllü' : 'First Time Volunteer',
      description: isTr 
        ? 'Öne çıktın ve günün vlogger\'ı olmak için gönüllü oldun! 1.5 kat XP artışının tadını çıkar.' 
        : 'You stepped up and volunteered to be the vlogger for the day! Enjoy your 1.5x XP boost.',
      primaryAction: isTr ? 'Harika!' : 'Awesome!',
      secondaryAction: isTr ? 'Paylaş' : 'Share',
    },
    'the-altruist': {
      id: 'the-altruist',
      particles: 'confetti',
      image: { src: 'heart', value: '5x' },
      title: isTr ? 'Fedakar' : 'The Altruist',
      highlight: isTr ? 'Fedakar' : 'Altruist',
      subtitle: isTr ? '5 Kez Gönüllü' : '5x Volunteered',
      description: isTr 
        ? 'Takım için her zaman kendini feda etmeye hazır! Gönüllü olduğun 5 görevi tamamladın.' 
        : 'Always ready to take one for the team! You have completed 5 volunteered assignments.',
      primaryAction: isTr ? 'Efsanevi!' : 'Legendary!',
      secondaryAction: isTr ? 'Paylaş' : 'Share',
    },
    'the-savior': {
      id: 'the-savior',
      particles: 'confetti',
      image: { src: 'shield', value: 'SAV' },
      title: isTr ? 'Kurtarıcı' : 'The Savior',
      highlight: isTr ? 'Kurtarıcı' : 'Savior',
      subtitle: isTr ? 'Grup Serisini Kurtardı' : 'Saved Group Streak',
      description: isTr 
        ? 'Geri sayımın son 30 dakikasında paylaşım yaparak 10 günden fazla süren grup serisini kurtardın!' 
        : 'You posted within the final 30 minutes of the countdown, saving a group streak of 10+ days!',
      primaryAction: isTr ? 'Harika!' : 'Awesome!',
      secondaryAction: isTr ? 'Paylaş' : 'Share',
    },
    'zero-hour': {
      id: 'zero-hour',
      particles: 'sparks',
      image: { src: 'rocket', value: 'FAST' },
      title: isTr ? 'Sıfır Noktası' : 'Zero Hour',
      highlight: isTr ? 'Sıfır' : 'Zero',
      subtitle: isTr ? 'Hızlı Tepki Tetikleyici' : 'Quick Reaction Trigger',
      description: isTr 
        ? 'Bugünkü sıra seçiminden sonraki 30 dakika içinde vlog\'unu yükledin!' 
        : 'You uploaded your vlog within 30 minutes of today\'s turn selection!',
      primaryAction: isTr ? 'Harika!' : 'Awesome!',
      secondaryAction: isTr ? 'Paylaş' : 'Share',
    },
    'on-duty': {
      id: 'on-duty',
      particles: 'sparks',
      image: { src: 'fire', value: '5x' },
      title: isTr ? 'Görev Başında' : 'On Duty',
      highlight: isTr ? 'Görev' : 'Duty',
      subtitle: isTr ? '5 Kez Tamamlama Serisi' : '5x Completion Streak',
      description: isTr 
        ? 'Zinciri kırmadan arka arkaya 5 kez atanan sıranı tamamladın!' 
        : 'You completed 5 assigned turns in a row without breaking the chain!',
      primaryAction: isTr ? 'Güzel!' : 'Nice!',
      secondaryAction: isTr ? 'Paylaş' : 'Share',
    },
    'the-guardian': {
      id: 'the-guardian',
      particles: 'confetti',
      image: { src: 'shield', value: '15x' },
      title: isTr ? 'Muhafız' : 'The Guardian',
      highlight: isTr ? 'Muhafız' : 'Guardian',
      subtitle: isTr ? '15 Kez Tamamlama Kilometre Taşı' : '15x Completion Milestone',
      description: isTr 
        ? 'Mutlak güvenilirlik! Arka arkaya 15 kez atanan sıranı tamamladın.' 
        : 'Absolute reliability! You have completed 15 assigned turns consecutively.',
      primaryAction: isTr ? 'Harika!' : 'Awesome!',
      secondaryAction: isTr ? 'Paylaş' : 'Share',
    },
    'first-responder': {
      id: 'first-responder',
      particles: 'sparks',
      image: { src: 'sun', value: '1st' },
      title: isTr ? 'İlk Müdahaleci' : 'First Responder',
      highlight: isTr ? 'İlk' : 'First',
      subtitle: isTr ? 'Erken İzleyici' : 'Early Spectator',
      description: isTr 
        ? 'Bugünün vlogger\'ını ilk izleyen ve tepki veren kişi unvanını 10 kez kazandın!' 
        : 'You were the first person to view and react to today\'s vlogger 10 times!',
      primaryAction: isTr ? 'Güzel!' : 'Nice!',
      secondaryAction: isTr ? 'Paylaş' : 'Share',
    },
    'directors-commentary': {
      id: 'directors-commentary',
      particles: 'sparks',
      image: { src: 'medal', value: '50c' },
      title: isTr ? 'Yönetmen Yorumu' : "Director's Commentary",
      highlight: isTr ? 'Yorum' : 'Commentary',
      subtitle: isTr ? '50 Yorum Paylaşıldı' : '50 Comments Posted',
      description: isTr 
        ? 'Aktif konuşmacı! Arkadaşlarından gelen günlük güncellemelere 50 düşünce ve geri bildirim bıraktın.' 
        : 'Active conversationalist! You left 50 thoughts and feedback on your friends\' daily updates.',
      primaryAction: isTr ? 'Hadi Başlayalım!' : "Let's Go!",
      secondaryAction: isTr ? 'Paylaş' : 'Share',
    },
    'deep-cut': {
      id: 'deep-cut',
      particles: 'sparks',
      image: { src: 'gem', value: '7d' },
      title: isTr ? 'Derin Takip' : 'Deep Cut',
      highlight: isTr ? 'Takip' : 'Cut',
      subtitle: isTr ? 'İzleme Serisi Tamamlandı' : 'Watch Streak Complete',
      description: isTr 
        ? 'Arka arkaya 7 gün boyunca grubunda paylaşılan her bir klibi izledin!' 
        : 'You watched every single clip posted in your group for a continuous 7-day period!',
      primaryAction: isTr ? 'Harika!' : 'Awesome!',
      secondaryAction: isTr ? 'Paylaş' : 'Share',
    },
    'hype-man': {
      id: 'hype-man',
      particles: 'confetti',
      image: { src: 'trophy', value: '100' },
      title: isTr ? 'Destekçi' : 'Hype Man',
      highlight: isTr ? 'Destek' : 'Hype',
      subtitle: isTr ? '100 Tepki Paylaşıldı' : '100 Reactions Posted',
      description: isTr 
        ? 'Sevgini paylaşmayı seviyorsun! Arkadaşlarından gelen motivasyonu yüksek tutmak için gönderdiğin 100 olumlu tepki için teşekkürler.' 
        : 'You love sharing the love! Thanks for sending 100 positive reactions to keep your friends motivated.',
      primaryAction: isTr ? 'Aynen Devam!' : 'Keep it up!',
      secondaryAction: isTr ? 'Paylaş' : 'Share',
    },
    'night-owl': {
      id: 'night-owl',
      particles: 'sparks',
      image: { src: 'moon', value: '' },
      title: isTr ? 'Gece Kuşu' : 'Night Owl',
      highlight: isTr ? 'Kuşu' : 'Owl',
      subtitle: isTr ? 'Gece Yarısı Güncellemesi' : 'Late Night Update',
      description: isTr 
        ? 'Şşşt... Yerel saatle 01:00 ile 05:00 arasında arkadaşlarınla sessiz bir anı paylaştın.' 
        : 'Shhh... you shared a quiet moment with your friends between 1:00 AM and 5:00 AM local time.',
      primaryAction: isTr ? 'Harika!' : 'Awesome!',
      secondaryAction: isTr ? 'Paylaş' : 'Share',
    },
    'globetrotter': {
      id: 'globetrotter',
      particles: 'sparks',
      image: { src: 'rocket', value: '✈️' },
      title: isTr ? 'Gezgin' : 'Gezgin',
      highlight: isTr ? 'Gezgin' : 'Gezgin',
      subtitle: isTr ? 'Evden Uzakta' : 'Far From Home',
      description: isTr 
        ? 'Grubunun merkez üssünden 160 kilometreden (100 mil) daha uzakta bir konumdan bir güncelleme paylaştın!' 
        : 'You shared an update from a location more than 100 miles away from your group\'s home base!',
      primaryAction: isTr ? 'Hadi Başlayalım!' : "Let's Go!",
      secondaryAction: isTr ? 'Paylaş' : 'Share',
    },
    'the-collector': {
      id: 'the-collector',
      particles: 'sparks',
      image: { src: 'gem', value: 'ALL' },
      title: isTr ? 'Koleksiyoncu' : 'The Collector',
      highlight: isTr ? 'Koleksiyoncu' : 'Collector',
      subtitle: isTr ? 'Tüm İpuçlarını Tamamlama' : 'All Prompt Completion',
      description: isTr 
        ? 'Kusursuz kapsama! Her bir kategori ipucunu en az bir kez tamamladın.' 
        : 'Perfect coverage! You have completed every single category prompt at least once.',
      primaryAction: isTr ? 'Harika!' : 'Awesome!',
      secondaryAction: isTr ? 'Paylaş' : 'Share',
    },
    'a-day-in-the-life': {
      id: 'a-day-in-the-life',
      particles: 'sparks',
      image: { src: 'medal', value: '60s' },
      title: isTr ? 'Hayattan Bir Gün' : 'A Day in the Life',
      highlight: isTr ? 'Gün' : 'Day',
      subtitle: isTr ? 'Maksimum Video Süresi' : 'Maximum Footage Duration',
      description: isTr 
        ? 'Gününün 4\'ten fazla bölümünü yakalayan 60 saniyelik tam uzunlukta bir vlog güncellemesi paylaştın!' 
        : 'You posted a full-length 60-second vlog update capturing 4+ segments of your day!',
      primaryAction: isTr ? 'Güzel!' : 'Nice!',
      secondaryAction: isTr ? 'Paylaş' : 'Share',
    },
    'silver-screen': {
      id: 'silver-screen',
      particles: 'sparks',
      image: { src: 'trophy', value: '50' },
      title: isTr ? 'Gümüş Ekran' : 'Silver Screen',
      highlight: isTr ? 'Ekran' : 'Screen',
      subtitle: isTr ? '50 Vlog Kilometre Taşı' : '50 Vlogs Milestone',
      description: isTr 
        ? 'Büyük bir kilometre taşı! Yakın arkadaşlarınla başarıyla 50 samimi güncelleme paylaştın.' 
        : 'A huge milestone! You have successfully shared 50 raw updates with your close friends.',
      primaryAction: isTr ? 'Harika!' : 'Awesome!',
      secondaryAction: isTr ? 'Paylaş' : 'Share',
    },
    'gold-standard': {
      id: 'gold-standard',
      particles: 'confetti',
      image: { src: 'crown', value: '150' },
      title: isTr ? 'Altın Standart' : 'Gold Standard',
      highlight: isTr ? 'Altın' : 'Gold',
      subtitle: isTr ? '150 Vlog Efsanesi' : '150 Vlogs Legend',
      description: isTr 
        ? 'Efsanevi statü! MyTurn\'de başarıyla 150 günlük güncelleme paylaştın.' 
        : 'Legendary status! You have successfully posted 150 daily updates on MyTurn.',
      primaryAction: isTr ? 'Efsanevi!' : 'Legendary!',
      secondaryAction: isTr ? 'Paylaş' : 'Share',
    },
    'half-a-century': {
      id: 'half-a-century',
      particles: 'confetti',
      image: { src: 'fire', value: '50d' },
      title: isTr ? 'Yarım Asır' : 'Half a Century',
      highlight: isTr ? 'Asır' : 'Century',
      subtitle: isTr ? '50 Günlük Grup Serisi' : '50-Day Group Streak',
      description: isTr 
        ? 'Ortak zafer! Yakın arkadaşlar grubunu 50 günlük devasa bir seriye ulaştırmaya yardımcı oldun.' 
        : 'Shared glory! You helped carry your close friends group to a massive 50-day streak.',
      primaryAction: isTr ? 'Ödülleri Al' : 'Claim Rewards',
      secondaryAction: isTr ? 'Paylaş' : 'Share',
    },
    'the-circle-of-life': {
      id: 'the-circle-of-life',
      particles: 'confetti',
      image: { src: 'crown', value: '365' },
      title: isTr ? 'Hayat Çemberi' : 'The Circle of Life',
      highlight: isTr ? 'Hayat' : 'Life',
      subtitle: isTr ? '1. Yıl Dönümü' : '1 Year Anniversary',
      description: isTr 
        ? 'Yakın arkadaşlarla paylaşılan 365 günlük anılar. Bu çevrenin mutlak bir direğisin.' 
        : '365 days of close-friends memories shared. You are an absolute pillar of this circle.',
      primaryAction: isTr ? 'Güzel!' : 'Nice!',
      secondaryAction: isTr ? 'Paylaş' : 'Share',
    },
  };
};
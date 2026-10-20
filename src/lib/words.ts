/**
 * The Kurdish word of the day, shown with Hevalo (WordOfTheDay.astro): an
 * everyday Kurmanji word, the same word in Sorani, and what it means in each
 * of the site's other languages. One a day, in this order, the same for every
 * visitor on the same date; the list starts again after its last word.
 *
 * Kept to common, unambiguous words. A native speaker should look over any
 * word added here (TODO.md, "Native speakers").
 */
import type { Locale } from '../i18n/locales';

type Meanings = Record<Exclude<Locale, 'ku' | 'ckb'>, string>;

export interface Word {
  /** Kurmanji, in the Latin alphabet. */
  ku: string;
  /** Sorani, in the Arabic-based alphabet. */
  ckb: string;
  meaning: Meanings;
}

const w = (ku: string, ckb: string, en: string, nl: string, de: string, es: string, fr: string, tr: string, ar: string, fa: string): Word => ({
  ku,
  ckb,
  meaning: { en, nl, de, es, fr, tr, ar, fa },
});

export const words: Word[] = [
  w('heval', 'هاوڕێ', 'friend', 'vriend', 'Freund', 'amigo', 'ami', 'arkadaş', 'صديق', 'دوست'),
  w('av', 'ئاو', 'water', 'water', 'Wasser', 'agua', 'eau', 'su', 'ماء', 'آب'),
  w('nan', 'نان', 'bread', 'brood', 'Brot', 'pan', 'pain', 'ekmek', 'خبز', 'نان'),
  w('çiya', 'چیا', 'mountain', 'berg', 'Berg', 'montaña', 'montagne', 'dağ', 'جبل', 'کوه'),
  w('dil', 'دڵ', 'heart', 'hart', 'Herz', 'corazón', 'cœur', 'kalp', 'قلب', 'دل'),
  w('roj', 'ڕۆژ', 'day', 'dag', 'Tag', 'día', 'jour', 'gün', 'يوم', 'روز'),
  w('mal', 'ماڵ', 'house', 'huis', 'Haus', 'casa', 'maison', 'ev', 'بيت', 'خانه'),
  w('dar', 'دار', 'tree', 'boom', 'Baum', 'árbol', 'arbre', 'ağaç', 'شجرة', 'درخت'),
  w('gul', 'گوڵ', 'rose', 'roos', 'Rose', 'rosa', 'rose', 'gül', 'وردة', 'گل'),
  w('ba', 'با', 'wind', 'wind', 'Wind', 'viento', 'vent', 'rüzgâr', 'ريح', 'باد'),
  w('baran', 'باران', 'rain', 'regen', 'Regen', 'lluvia', 'pluie', 'yağmur', 'مطر', 'باران'),
  w('befr', 'بەفر', 'snow', 'sneeuw', 'Schnee', 'nieve', 'neige', 'kar', 'ثلج', 'برف'),
  w('stêrk', 'ئەستێرە', 'star', 'ster', 'Stern', 'estrella', 'étoile', 'yıldız', 'نجمة', 'ستاره'),
  w('heyv', 'مانگ', 'moon', 'maan', 'Mond', 'luna', 'lune', 'ay', 'قمر', 'ماه'),
  w('ziman', 'زمان', 'language', 'taal', 'Sprache', 'idioma', 'langue', 'dil', 'لغة', 'زبان'),
  w('jiyan', 'ژیان', 'life', 'leven', 'Leben', 'vida', 'vie', 'hayat', 'حياة', 'زندگی'),
  w('aşitî', 'ئاشتی', 'peace', 'vrede', 'Frieden', 'paz', 'paix', 'barış', 'سلام', 'صلح'),
  w('azadî', 'ئازادی', 'freedom', 'vrijheid', 'Freiheit', 'libertad', 'liberté', 'özgürlük', 'حرية', 'آزادی'),
  w('ronahî', 'ڕووناکی', 'light', 'licht', 'Licht', 'luz', 'lumière', 'ışık', 'نور', 'نور'),
  w('çem', 'ڕووبار', 'river', 'rivier', 'Fluss', 'río', 'rivière', 'nehir', 'نهر', 'رود'),
  w('spas', 'سوپاس', 'thank you', 'dank je', 'danke', 'gracias', 'merci', 'teşekkürler', 'شكرًا', 'سپاس'),
  w('silav', 'سڵاو', 'hello', 'hallo', 'hallo', 'hola', 'bonjour', 'merhaba', 'مرحبًا', 'سلام'),
  w('bajar', 'شار', 'city', 'stad', 'Stadt', 'ciudad', 'ville', 'şehir', 'مدينة', 'شهر'),
  w('pirtûk', 'کتێب', 'book', 'boek', 'Buch', 'libro', 'livre', 'kitap', 'كتاب', 'کتاب'),
  w('dayik', 'دایک', 'mother', 'moeder', 'Mutter', 'madre', 'mère', 'anne', 'أم', 'مادر'),
  w('bav', 'باوک', 'father', 'vader', 'Vater', 'padre', 'père', 'baba', 'أب', 'پدر'),
  w('zarok', 'منداڵ', 'child', 'kind', 'Kind', 'niño', 'enfant', 'çocuk', 'طفل', 'کودک'),
  w('hêvî', 'هیوا', 'hope', 'hoop', 'Hoffnung', 'esperanza', 'espoir', 'umut', 'أمل', 'امید'),
  w('kevir', 'بەرد', 'stone', 'steen', 'Stein', 'piedra', 'pierre', 'taş', 'حجر', 'سنگ'),
  w('xew', 'خەو', 'sleep', 'slaap', 'Schlaf', 'sueño', 'sommeil', 'uyku', 'نوم', 'خواب'),
  w('rê', 'ڕێگا', 'road', 'weg', 'Weg', 'camino', 'chemin', 'yol', 'طريق', 'راه'),
];

/** Days since 1 January 1970 for a calendar date, whatever the time zone. */
export const dayNumber = (year: number, month: number, day: number) => Math.floor(Date.UTC(year, month, day) / 864e5);

/** The index of the word for a day number. */
export const wordIndex = (day: number) => ((day % words.length) + words.length) % words.length;

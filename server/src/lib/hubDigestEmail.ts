// Learning Hub parent emails — the weekly "This week in <child>'s learning" digest, the two homework nudges
// (a reminder before the due date, a gentle "not handed in yet" after) and the opt-out confirmation page.
// PURE: strings in, HTML out (no Firestore, no mail) so it self-tests (hubDigest.selftest.ts) and previews anywhere.
//
// Tone rules baked into the wording: positive first, never shaming, no "overdue/late/failed", only the child's FIRST
// name and their own homework/results. Family-facing product name is "Learning Hub"; the button/CTA uses the same translated name as the app (hubshell.lbl_learning_hub) in pl/ro/pt/es/fr.
// All 11 platform locales (lib/i18n/config.ts); ar + ur render right-to-left. A locale missing a key falls back to English.
//
// NOTE for Kaz: translations are careful first drafts, not native-reviewed — worth a quick read by a speaker of each
// language before switching the feature on for real families.

import { isRTL, LOCALES, type LocaleCode } from "../../../lib/i18n/config";
import { scrubHtml } from "../oak/noOakResponse";
import { pluralChain } from "../../../lib/i18n/plural";

export type MailKind = "digest" | "nudge_before" | "nudge_after";

export interface DigestData {
  childName: string;
  provider: string;
  homework: { title: string; status: "assigned" | "submitted" | "marked"; dueAt: string | null; score?: number; max?: number; /** An interactive lesson on this homework (for the "Watch along" link). */ noteId?: string }[];
  quizzes: { title: string; pct: number | null }[];
  lessons: { title: string }[];
  streakDays: number;
  strongest: string | null;
  celebrate: Celebrate;
  upcoming: { kind: "homework" | "lesson"; title: string; at: string }[];
}
export type Celebrate =
  | { kind: "score"; title: string; pct: number }
  | { kind: "streak"; n: number }
  | { kind: "allin" }
  | { kind: "quizzes"; n: number }
  | { kind: "lessons"; n: number }
  | { kind: "keep" };

export interface NudgeData { childName: string; provider: string; title: string; dueAt: string }
/** `watch`: the parent's view-only "Watch along" link to the child's lesson (optional: only when the homework has one). */
export interface Links { hub: string; stop: string; watch?: string }

type S = Record<string, string>;
const EN: S = {
  subject: "This week in {name}'s learning",
  hello: "Hello,",
  intro: "Here is a quick look at how {name} got on this week with {provider}.",
  celebrate: "Something to celebrate",
  c_score: "{name} scored {pct}% on “{title}”. Well done!",
  c_streak: "{name} has been learning {n} days in a row. What a great habit!",
  c_allin: "All of {name}'s homework is handed in. Fantastic effort!",
  c_quizzes: "Quizzes finished this week: {n}. Great effort, {name}!",
  c_lessons: "Live lessons joined this week: {n}. Lovely to see {name} there!",
  c_keep: "Thank you for supporting {name}'s learning. Every small step counts!",
  hw: "Homework",
  s_todo: "To do",
  s_in: "Handed in",
  s_marked: "Marked: {score}/{max}",
  due: "Due {date}",
  quizzes: "Quizzes and lessons",
  q_row: "{title}: {pct}%",
  l_row: "Live lesson: {title}",
  streak: "Learning streak: {n} days in a row",
  strong: "Strongest area this week: {subject}",
  up: "Coming up",
  up_hw: "Homework due: {title} ({date})",
  up_lesson: "Live lesson: {title} ({date})",
  cta: "Open Learning Hub",
  why: "You are receiving this because {name} is enrolled with {provider}. We only ever share {name}'s first name and their own learning.",
  stop_digest: "Stop the weekly summary",
  sign: "Warm wishes, {provider}",
  n_subject_before: "A friendly reminder: {name}'s homework is due soon",
  n_subject_after: "{name}'s homework hasn't been handed in yet",
  n_before: "A little reminder that “{title}” is due {date}. It hasn't been handed in yet, so a bit of time today would be perfect.",
  n_after: "“{title}” was due {date} and hasn't been handed in yet. No worries, it's easy to catch up. If {name} needs more time, just message the tutor.",
  n_ignore: "If it's already done, please ignore this. Thank you!",
  watch_cta: "Watch along with {name}",
  watch_note: "View only, as {name} sees it. Nothing is saved.",
  n_cta: "Open the homework",
  stop_nudge: "Stop homework reminders",
  u_title_digest: "Stop the weekly summary?",
  u_title_nudge: "Stop homework reminders?",
  u_body: "You will no longer get these emails from {provider}. You can ask your tutor to switch them back on at any time.",
  u_btn: "Yes, stop these emails",
  u_done: "Done. You won't get these emails any more.",
  u_bad: "This link couldn't be read. Please reply to any email from your tutor and we'll help.",
};

const T: Record<LocaleCode, Partial<S>> = {
  en: EN,
  pl: {
    watch_cta: "Oglądaj razem z: {name}", watch_note: "Podgląd lekcji dokładnie tak, jak widzi ją {name}. Nic, co tam zrobisz, nie zostanie zapisane.",
    subject: "Ten tydzień w nauce – {name}",
    hello: "Dzień dobry,",
    intro: "Oto krótkie podsumowanie tygodnia nauki: {name} w {provider}.",
    celebrate: "Powód do radości",
    c_score: "Wynik {name} w „{title}”: {pct}%. Brawo!",
    c_streak: "Nauka {name} trwa już {n} dni z rzędu. Świetny nawyk!",
    c_allin: "Wszystkie prace domowe {name} zostały oddane. Świetny wysiłek!",
    c_quizzes: "Ukończone quizy w tym tygodniu: {n}. Świetny wysiłek, {name}!",
    c_lessons: "Lekcje na żywo w tym tygodniu: {n}. Miło nam było widzieć na lekcji: {name}!",
    c_keep: "Dziękujemy za wsparcie w nauce {name}. Każdy mały krok się liczy!",
    hw: "Praca domowa", s_todo: "Do zrobienia", s_in: "Oddana", s_marked: "Oceniona: {score}/{max}", due: "Termin: {date}",
    quizzes: "Quizy i lekcje", l_row: "Lekcja na żywo: {title}",
    streak: "Seria nauki: {n} dni z rzędu", strong: "Najmocniejszy obszar w tym tygodniu: {subject}",
    up: "Co nas czeka", up_hw: "Termin pracy domowej: {title} ({date})", up_lesson: "Lekcja na żywo: {title} ({date})",
    cta: "Otwórz Centrum nauki",
    why: "Otrzymujesz tę wiadomość, ponieważ {name} jest zapisany(-a) w {provider}. Udostępniamy wyłącznie imię {name} i jego/jej własne postępy w nauce.",
    stop_digest: "Wyłącz cotygodniowe podsumowanie",
    sign: "Serdecznie pozdrawiamy, {provider}",
    n_subject_before: "Przyjazne przypomnienie: zbliża się termin pracy domowej ucznia ({name})",
    n_subject_after: "Praca domowa ucznia ({name}) nie została jeszcze oddana",
    n_before: "Małe przypomnienie: termin oddania „{title}” to {date}, a praca nie została jeszcze oddana. Chwila czasu dzisiaj byłaby idealna.",
    n_after: "Termin oddania „{title}” minął {date}, a praca nie została jeszcze oddana. Nic się nie stało, łatwo to nadrobić. Jeśli {name} potrzebuje więcej czasu, wystarczy napisać do korepetytora.",
    n_ignore: "Jeśli praca jest już zrobiona, prosimy zignorować tę wiadomość. Dziękujemy!",
    n_cta: "Otwórz pracę domową", stop_nudge: "Wyłącz przypomnienia o pracach domowych",
    u_title_digest: "Wyłączyć cotygodniowe podsumowanie?", u_title_nudge: "Wyłączyć przypomnienia o pracach domowych?",
    u_body: "Nie będziesz już otrzymywać tych wiadomości od {provider}. W każdej chwili możesz poprosić korepetytora o ich ponowne włączenie.",
    u_btn: "Tak, wyłącz te wiadomości", u_done: "Gotowe. Nie będziesz już otrzymywać tych wiadomości.",
    u_bad: "Nie udało się odczytać tego linku. Odpowiedz na dowolną wiadomość od korepetytora, a pomożemy.",
  },
  ro: {
    watch_cta: "Urmărește împreună cu {name}", watch_note: "O privire doar pentru vizualizare asupra lecției, exact cum o vede {name}. Nimic din ce faci acolo nu se salvează.",
    subject: "Săptămâna aceasta în învățarea lui {name}",
    hello: "Bună ziua,",
    intro: "Iată o scurtă privire asupra săptămânii lui {name} la {provider}.",
    celebrate: "Ceva de sărbătorit",
    c_score: "{name} a obținut {pct}% la „{title}”. Felicitări!",
    c_streak: "{name} învață de {n} zile la rând. Ce obicei frumos!",
    c_streak_one: "{name} învață de {n} zi la rând. Ce obicei frumos!",
    c_streak_few: "{name} învață de {n} zile la rând. Ce obicei frumos!",
    c_streak_other: "{name} învață de {n} de zile la rând. Ce obicei frumos!",
    c_allin: "Toate temele lui {name} au fost predate. Efort minunat!",
    c_quizzes: "Teste terminate săptămâna aceasta: {n}. Bravo pentru efort, {name}!",
    c_lessons: "Lecții live la care {name} a participat săptămâna aceasta: {n}. Ne bucurăm!",
    c_keep: "Vă mulțumim că sprijiniți învățarea lui {name}. Fiecare pas mic contează!",
    hw: "Teme", s_todo: "De făcut", s_in: "Predată", s_marked: "Notată: {score}/{max}", due: "Termen: {date}",
    quizzes: "Teste și lecții", l_row: "Lecție live: {title}",
    streak: "Serie de învățare: {n} zile la rând",
    streak_one: "Serie de învățare: {n} zi la rând",
    streak_few: "Serie de învățare: {n} zile la rând",
    streak_other: "Serie de învățare: {n} de zile la rând", strong: "Domeniul la care stă cel mai bine în această săptămână: {subject}",
    up: "Urmează", up_hw: "Temă de predat: {title} ({date})", up_lesson: "Lecție live: {title} ({date})",
    cta: "Deschide Centrul de învățare",
    why: "Primiți acest mesaj deoarece {name} este înscris(ă) la {provider}. Nu partajăm decât prenumele lui {name} și propria activitate de învățare.",
    stop_digest: "Nu mai doresc rezumatul săptămânal",
    sign: "Cu drag, {provider}",
    n_subject_before: "O mică reamintire: tema lui {name} are termen curând",
    n_subject_after: "Tema lui {name} nu a fost încă predată",
    n_before: "O mică reamintire: „{title}” are termen {date} și nu a fost încă predată. Puțin timp astăzi ar fi perfect.",
    n_after: "„{title}” avea termen {date} și nu a fost încă predată. Nicio grijă, recuperarea e ușoară. Dacă {name} are nevoie de mai mult timp, scrieți profesorului.",
    n_ignore: "Dacă e deja făcută, ignorați acest mesaj. Vă mulțumim!",
    n_cta: "Deschide tema", stop_nudge: "Nu mai doresc memento-uri pentru teme",
    u_title_digest: "Opriți rezumatul săptămânal?", u_title_nudge: "Opriți memento-urile pentru teme?",
    u_body: "Nu veți mai primi aceste e-mailuri de la {provider}. Puteți cere oricând profesorului să le reactiveze.",
    u_btn: "Da, opriți aceste e-mailuri", u_done: "Gata. Nu veți mai primi aceste e-mailuri.",
    u_bad: "Linkul nu a putut fi citit. Răspundeți la orice e-mail de la profesor și vă vom ajuta.",
  },
  ur: {
    watch_cta: "{name} کے ساتھ دیکھیں", watch_note: "سبق کی صرف دیکھنے والی جھلک، بالکل ویسی جیسی {name} کو نظر آتی ہے۔ وہاں آپ جو کچھ بھی کریں گے وہ محفوظ نہیں ہوگا۔",
    subject: "اس ہفتے {name} کی تعلیم کا احوال",
    hello: "السلام علیکم،",
    intro: "{provider} میں اس ہفتے {name} کی کارکردگی کی ایک مختصر جھلک یہ ہے۔",
    celebrate: "خوشی کی بات",
    c_score: "{name} نے “{title}” میں {pct}% نمبر حاصل کیے۔ شاباش!",
    c_streak: "{name} کی مسلسل {n} دن کی پڑھائی۔ کتنی اچھی عادت ہے!",
    c_allin: "{name} کا تمام ہوم ورک جمع ہو چکا ہے۔ بہترین کوشش!",
    c_quizzes: "اس ہفتے مکمل کیے گئے کوئز: {n}۔ بہترین کوشش، {name}!",
    c_lessons: "اس ہفتے لائیو اسباق میں شرکت: {n}۔ {name} کو دیکھ کر خوشی ہوئی!",
    c_keep: "{name} کی تعلیم میں آپ کے تعاون کا شکریہ۔ ہر چھوٹا قدم اہم ہے!",
    hw: "ہوم ورک", s_todo: "کرنا باقی ہے", s_in: "جمع ہو گیا", s_marked: "نمبر لگ گئے: {score}/{max}", due: "آخری تاریخ: {date}",
    quizzes: "کوئز اور اسباق", l_row: "لائیو سبق: {title}",
    streak: "مسلسل پڑھائی: {n} دن", strong: "اس ہفتے سب سے مضبوط شعبہ: {subject}",
    up: "آنے والا وقت", up_hw: "ہوم ورک کی آخری تاریخ: {title} ({date})", up_lesson: "لائیو سبق: {title} ({date})",
    cta: "لرننگ ہب کھولیں",
    why: "آپ کو یہ ای میل اس لیے مل رہی ہے کہ {name} {provider} میں داخل ہے۔ ہم صرف {name} کا پہلا نام اور اس کی اپنی تعلیمی سرگرمی شیئر کرتے ہیں۔",
    stop_digest: "ہفتہ وار خلاصہ بند کریں",
    sign: "نیک تمناؤں کے ساتھ، {provider}",
    n_subject_before: "ایک دوستانہ یاد دہانی: {name} کے ہوم ورک کی تاریخ قریب ہے",
    n_subject_after: "{name} کا ہوم ورک ابھی جمع نہیں ہوا",
    n_before: "ایک ہلکی سی یاد دہانی: “{title}” کی آخری تاریخ {date} ہے اور یہ ابھی جمع نہیں ہوا۔ آج تھوڑا وقت نکال لیا جائے تو بہت اچھا رہے گا۔",
    n_after: "“{title}” کی آخری تاریخ {date} تھی اور یہ ابھی جمع نہیں ہوا۔ کوئی بات نہیں، اسے پورا کرنا آسان ہے۔ اگر {name} کو مزید وقت چاہیے تو ٹیوٹر کو پیغام بھیج دیں۔",
    n_ignore: "اگر یہ پہلے ہی ہو چکا ہے تو اس پیغام کو نظر انداز کر دیں، شکریہ!",
    n_cta: "ہوم ورک کھولیں", stop_nudge: "ہوم ورک کی یاد دہانیاں بند کریں",
    u_title_digest: "ہفتہ وار خلاصہ بند کریں؟", u_title_nudge: "ہوم ورک کی یاد دہانیاں بند کریں؟",
    u_body: "آپ کو {provider} کی طرف سے یہ ای میلز نہیں ملیں گی۔ آپ کسی بھی وقت اپنے ٹیوٹر سے انہیں دوبارہ چالو کرنے کا کہہ سکتے ہیں۔",
    u_btn: "جی ہاں، یہ ای میلز بند کریں", u_done: "ہو گیا۔ آپ کو یہ ای میلز اب نہیں ملیں گی۔",
    u_bad: "یہ لنک پڑھا نہیں جا سکا۔ براہِ کرم ٹیوٹر کی کسی بھی ای میل کا جواب دیں، ہم مدد کریں گے۔",
  },
  pa: {
    watch_cta: "{name} ਦੇ ਨਾਲ ਵੇਖੋ", watch_note: "ਪਾਠ ਦੀ ਸਿਰਫ਼ ਵੇਖਣ ਵਾਲੀ ਝਲਕ, ਬਿਲਕੁਲ ਜਿਵੇਂ {name} ਨੂੰ ਦਿਸਦਾ ਹੈ। ਉੱਥੇ ਤੁਸੀਂ ਜੋ ਵੀ ਕਰੋਗੇ ਉਹ ਸੰਭਾਲਿਆ ਨਹੀਂ ਜਾਵੇਗਾ।",
    subject: "ਇਸ ਹਫ਼ਤੇ {name} ਦੀ ਪੜ੍ਹਾਈ",
    hello: "ਹੈਲੋ,",
    intro: "{provider} ਵਿੱਚ ਇਸ ਹਫ਼ਤੇ {name} ਦੀ ਪੜ੍ਹਾਈ ਦੀ ਇੱਕ ਛੋਟੀ ਝਲਕ ਇਹ ਹੈ।",
    celebrate: "ਖ਼ੁਸ਼ੀ ਦੀ ਗੱਲ",
    c_score: "{name} ਨੇ “{title}” ਵਿੱਚ {pct}% ਅੰਕ ਲਏ। ਸ਼ਾਬਾਸ਼!",
    c_streak: "{name} ਦੀ ਲਗਾਤਾਰ {n} ਦਿਨਾਂ ਦੀ ਪੜ੍ਹਾਈ। ਕਿੰਨੀ ਵਧੀਆ ਆਦਤ ਹੈ!",
    c_allin: "{name} ਦਾ ਸਾਰਾ ਹੋਮਵਰਕ ਜਮ੍ਹਾ ਹੋ ਗਿਆ ਹੈ। ਬਹੁਤ ਵਧੀਆ ਕੋਸ਼ਿਸ਼!",
    c_quizzes: "ਇਸ ਹਫ਼ਤੇ ਪੂਰੇ ਕੀਤੇ ਕੁਇਜ਼: {n}। ਬਹੁਤ ਵਧੀਆ ਕੋਸ਼ਿਸ਼, {name}!",
    c_lessons: "ਇਸ ਹਫ਼ਤੇ ਲਾਈਵ ਪਾਠਾਂ ਵਿੱਚ ਹਾਜ਼ਰੀ: {n}। {name} ਨੂੰ ਵੇਖ ਕੇ ਖ਼ੁਸ਼ੀ ਹੋਈ!",
    c_keep: "{name} ਦੀ ਪੜ੍ਹਾਈ ਵਿੱਚ ਸਾਥ ਦੇਣ ਲਈ ਧੰਨਵਾਦ। ਹਰ ਛੋਟਾ ਕਦਮ ਮਾਇਨੇ ਰੱਖਦਾ ਹੈ!",
    hw: "ਹੋਮਵਰਕ", s_todo: "ਕਰਨਾ ਬਾਕੀ", s_in: "ਜਮ੍ਹਾ ਹੋ ਗਿਆ", s_marked: "ਅੰਕ ਲੱਗ ਗਏ: {score}/{max}", due: "ਆਖ਼ਰੀ ਤਾਰੀਖ਼: {date}",
    quizzes: "ਕੁਇਜ਼ ਅਤੇ ਪਾਠ", l_row: "ਲਾਈਵ ਪਾਠ: {title}",
    streak: "ਲਗਾਤਾਰ ਪੜ੍ਹਾਈ: {n} ਦਿਨ", strong: "ਇਸ ਹਫ਼ਤੇ ਸਭ ਤੋਂ ਮਜ਼ਬੂਤ ਖੇਤਰ: {subject}",
    up: "ਅੱਗੇ ਆ ਰਿਹਾ", up_hw: "ਹੋਮਵਰਕ ਦੀ ਆਖ਼ਰੀ ਤਾਰੀਖ਼: {title} ({date})", up_lesson: "ਲਾਈਵ ਪਾਠ: {title} ({date})",
    cta: "ਲਰਨਿੰਗ ਹੱਬ ਖੋਲ੍ਹੋ",
    why: "ਤੁਹਾਨੂੰ ਇਹ ਈਮੇਲ ਇਸ ਲਈ ਮਿਲ ਰਹੀ ਹੈ ਕਿਉਂਕਿ {name} {provider} ਵਿੱਚ ਦਾਖ਼ਲ ਹੈ। ਅਸੀਂ ਸਿਰਫ਼ {name} ਦਾ ਪਹਿਲਾ ਨਾਂ ਅਤੇ ਉਸ ਦੀ ਆਪਣੀ ਪੜ੍ਹਾਈ ਦੀ ਜਾਣਕਾਰੀ ਸਾਂਝੀ ਕਰਦੇ ਹਾਂ।",
    stop_digest: "ਹਫ਼ਤਾਵਾਰੀ ਸਾਰ ਬੰਦ ਕਰੋ",
    sign: "ਸ਼ੁਭ ਇੱਛਾਵਾਂ ਸਹਿਤ, {provider}",
    n_subject_before: "ਦੋਸਤਾਨਾ ਯਾਦ-ਦਹਾਨੀ: {name} ਦੇ ਹੋਮਵਰਕ ਦੀ ਤਾਰੀਖ਼ ਨੇੜੇ ਹੈ",
    n_subject_after: "{name} ਦਾ ਹੋਮਵਰਕ ਹਾਲੇ ਜਮ੍ਹਾ ਨਹੀਂ ਹੋਇਆ",
    n_before: "ਇੱਕ ਛੋਟੀ ਯਾਦ-ਦਹਾਨੀ: “{title}” ਦੀ ਆਖ਼ਰੀ ਤਾਰੀਖ਼ {date} ਹੈ ਅਤੇ ਇਹ ਹਾਲੇ ਜਮ੍ਹਾ ਨਹੀਂ ਹੋਇਆ। ਅੱਜ ਥੋੜ੍ਹਾ ਸਮਾਂ ਕੱਢ ਲਿਆ ਜਾਵੇ ਤਾਂ ਬਹੁਤ ਵਧੀਆ ਰਹੇਗਾ।",
    n_after: "“{title}” ਦੀ ਆਖ਼ਰੀ ਤਾਰੀਖ਼ {date} ਸੀ ਅਤੇ ਇਹ ਹਾਲੇ ਜਮ੍ਹਾ ਨਹੀਂ ਹੋਇਆ। ਕੋਈ ਗੱਲ ਨਹੀਂ, ਇਸ ਨੂੰ ਪੂਰਾ ਕਰਨਾ ਸੌਖਾ ਹੈ। ਜੇ {name} ਨੂੰ ਹੋਰ ਸਮਾਂ ਚਾਹੀਦਾ ਹੈ ਤਾਂ ਟਿਊਟਰ ਨੂੰ ਸੁਨੇਹਾ ਭੇਜ ਦਿਓ।",
    n_ignore: "ਜੇ ਇਹ ਪਹਿਲਾਂ ਹੀ ਹੋ ਚੁੱਕਾ ਹੈ ਤਾਂ ਇਸ ਸੁਨੇਹੇ ਨੂੰ ਅਣਡਿੱਠਾ ਕਰ ਦਿਓ, ਧੰਨਵਾਦ!",
    n_cta: "ਹੋਮਵਰਕ ਖੋਲ੍ਹੋ", stop_nudge: "ਹੋਮਵਰਕ ਦੀਆਂ ਯਾਦ-ਦਹਾਨੀਆਂ ਬੰਦ ਕਰੋ",
    u_title_digest: "ਹਫ਼ਤਾਵਾਰੀ ਸਾਰ ਬੰਦ ਕਰਨਾ ਹੈ?", u_title_nudge: "ਹੋਮਵਰਕ ਦੀਆਂ ਯਾਦ-ਦਹਾਨੀਆਂ ਬੰਦ ਕਰਨੀਆਂ ਹਨ?",
    u_body: "ਤੁਹਾਨੂੰ {provider} ਵੱਲੋਂ ਇਹ ਈਮੇਲਾਂ ਨਹੀਂ ਮਿਲਣਗੀਆਂ। ਤੁਸੀਂ ਕਿਸੇ ਵੀ ਸਮੇਂ ਟਿਊਟਰ ਨੂੰ ਇਹ ਦੁਬਾਰਾ ਚਾਲੂ ਕਰਨ ਲਈ ਕਹਿ ਸਕਦੇ ਹੋ।",
    u_btn: "ਹਾਂ, ਇਹ ਈਮੇਲਾਂ ਬੰਦ ਕਰੋ", u_done: "ਹੋ ਗਿਆ। ਤੁਹਾਨੂੰ ਹੁਣ ਇਹ ਈਮੇਲਾਂ ਨਹੀਂ ਮਿਲਣਗੀਆਂ।",
    u_bad: "ਇਹ ਲਿੰਕ ਪੜ੍ਹਿਆ ਨਹੀਂ ਜਾ ਸਕਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਟਿਊਟਰ ਦੀ ਕਿਸੇ ਵੀ ਈਮੇਲ ਦਾ ਜਵਾਬ ਦਿਓ, ਅਸੀਂ ਮਦਦ ਕਰਾਂਗੇ।",
  },
  bn: {
    watch_cta: "{name}-এর সঙ্গে দেখুন", watch_note: "পাঠটির শুধু দেখার একটি ঝলক, ঠিক যেমন {name} দেখে। সেখানে আপনি যা-ই করুন তা সংরক্ষিত হবে না।",
    subject: "এই সপ্তাহে {name}-এর শেখা",
    hello: "প্রিয় অভিভাবক,",
    intro: "{provider}-এ এই সপ্তাহে {name}-এর পড়াশোনা কেমন চলল, তার একটি সংক্ষিপ্ত ঝলক এখানে।",
    celebrate: "আনন্দের খবর",
    c_score: "“{title}”-এ {name} {pct}% নম্বর পেয়েছে। চমৎকার!",
    c_streak: "{name} টানা {n} দিন পড়াশোনা করেছে। কী সুন্দর অভ্যাস!",
    c_allin: "{name}-এর সব বাড়ির কাজ জমা দেওয়া হয়েছে। দারুণ চেষ্টা!",
    c_quizzes: "এই সপ্তাহে সম্পন্ন কুইজ: {n}। দারুণ চেষ্টা, {name}!",
    c_lessons: "এই সপ্তাহে লাইভ ক্লাসে উপস্থিতি: {n}। {name}-কে দেখে ভালো লাগল!",
    c_keep: "{name}-এর শেখায় পাশে থাকার জন্য ধন্যবাদ। প্রতিটি ছোট পদক্ষেপই গুরুত্বপূর্ণ!",
    hw: "বাড়ির কাজ", s_todo: "করা বাকি", s_in: "জমা দেওয়া হয়েছে", s_marked: "নম্বর দেওয়া হয়েছে: {score}/{max}", due: "জমার তারিখ: {date}",
    quizzes: "কুইজ ও পাঠ", l_row: "লাইভ ক্লাস: {title}",
    streak: "শেখার ধারা: টানা {n} দিন", strong: "এই সপ্তাহের সবচেয়ে ভালো করা বিষয়: {subject}",
    up: "সামনে যা আছে", up_hw: "বাড়ির কাজ জমার তারিখ: {title} ({date})", up_lesson: "লাইভ ক্লাস: {title} ({date})",
    cta: "লার্নিং হাব খুলুন",
    why: "আপনি এই ইমেইলটি পাচ্ছেন কারণ {name} {provider}-এ ভর্তি আছে। আমরা শুধু {name}-এর প্রথম নাম এবং তার নিজের শেখার তথ্য শেয়ার করি।",
    stop_digest: "সাপ্তাহিক সারাংশ বন্ধ করুন",
    sign: "শুভেচ্ছান্তে, {provider}",
    n_subject_before: "একটি বন্ধুত্বপূর্ণ অনুস্মারক: {name}-এর বাড়ির কাজের সময় ঘনিয়ে আসছে",
    n_subject_after: "{name}-এর বাড়ির কাজ এখনও জমা দেওয়া হয়নি",
    n_before: "ছোট্ট একটি অনুস্মারক: “{title}” জমা দেওয়ার তারিখ {date}, এবং এটি এখনও জমা হয়নি। আজ একটু সময় দিলেই চমৎকার হবে।",
    n_after: "“{title}” জমার তারিখ ছিল {date} এবং এটি এখনও জমা হয়নি। চিন্তার কিছু নেই, এটি সহজেই পূরণ করা যায়। {name}-এর আরও সময় লাগলে টিউটরকে একটি বার্তা পাঠান।",
    n_ignore: "যদি ইতিমধ্যে হয়ে গিয়ে থাকে, তাহলে এই বার্তাটি উপেক্ষা করুন। ধন্যবাদ!",
    n_cta: "বাড়ির কাজ খুলুন", stop_nudge: "বাড়ির কাজের অনুস্মারক বন্ধ করুন",
    u_title_digest: "সাপ্তাহিক সারাংশ বন্ধ করবেন?", u_title_nudge: "বাড়ির কাজের অনুস্মারক বন্ধ করবেন?",
    u_body: "আপনি {provider}-এর কাছ থেকে আর এই ইমেইলগুলো পাবেন না। আপনি যেকোনো সময় টিউটরকে এগুলো আবার চালু করতে বলতে পারেন।",
    u_btn: "হ্যাঁ, এই ইমেইল বন্ধ করুন", u_done: "হয়ে গেছে। আপনি আর এই ইমেইলগুলো পাবেন না।",
    u_bad: "লিংকটি পড়া যায়নি। অনুগ্রহ করে শিক্ষকের যেকোনো ইমেইলের উত্তর দিন, আমরা সাহায্য করব।",
  },
  ar: {
    watch_cta: "شاهد مع {name}", watch_note: "نظرة للعرض فقط على الدرس، تمامًا كما يراه {name}. لن يُحفظ أي شيء تفعله هناك.",
    subject: "أسبوع {name} في التعلّم",
    hello: "مرحبًا،",
    intro: "إليكم لمحة سريعة عن أداء {name} هذا الأسبوع مع {provider}.",
    celebrate: "أمر يستحق الاحتفال",
    c_score: "حصل {name} على {pct}% في «{title}». أحسنت!",
    c_streak: "{name}: أيام التعلّم المتتالية {n}. يا لها من عادة رائعة!",
    c_allin: "تم تسليم جميع واجبات {name} المنزلية. جهد رائع!",
    c_quizzes: "الاختبارات القصيرة المكتملة هذا الأسبوع: {n}. جهد رائع يا {name}!",
    c_lessons: "الدروس المباشرة التي حضرها {name} هذا الأسبوع: {n}. سعدنا بحضور {name}!",
    c_keep: "شكرًا لدعمكم تعلّم {name}. كل خطوة صغيرة لها قيمتها!",
    hw: "الواجب المنزلي", s_todo: "قيد الإنجاز", s_in: "تم التسليم", s_marked: "تم التصحيح: {score}/{max}", due: "الموعد: {date}",
    quizzes: "الاختبارات والدروس", l_row: "درس مباشر: {title}",
    streak: "أيام التعلّم المتتالية: {n}", strong: "أقوى مجال هذا الأسبوع: {subject}",
    up: "القادم", up_hw: "موعد تسليم الواجب: {title} ({date})", up_lesson: "درس مباشر: {title} ({date})",
    cta: "افتح مركز التعلّم",
    why: "تصلكم هذه الرسالة لأن {name} مسجّل لدى {provider}. نحن لا نشارك سوى الاسم الأول للطفل ({name}) ونشاطه التعليمي الخاص.",
    stop_digest: "إيقاف الملخص الأسبوعي",
    sign: "مع أطيب التحيات، {provider}",
    n_subject_before: "تذكير ودّي: اقترب موعد تسليم واجب {name}",
    n_subject_after: "لم يُسلَّم واجب {name} بعد",
    n_before: "تذكير بسيط: موعد تسليم «{title}» هو {date} ولم يُسلَّم بعد. سيكون رائعًا لو خُصِّص له بعض الوقت اليوم.",
    n_after: "كان موعد تسليم «{title}» هو {date} ولم يُسلَّم بعد. لا داعي للقلق، من السهل اللحاق. وإذا احتاج {name} إلى مزيد من الوقت، فراسلوا المعلّم.",
    n_ignore: "إن كان قد أُنجز بالفعل، فتجاهلوا هذه الرسالة مع الشكر!",
    n_cta: "افتح الواجب", stop_nudge: "إيقاف تذكيرات الواجبات",
    u_title_digest: "إيقاف الملخص الأسبوعي؟", u_title_nudge: "إيقاف تذكيرات الواجبات؟",
    u_body: "لن تصلكم هذه الرسائل من {provider} بعد الآن. يمكنكم في أي وقت أن تطلبوا من المعلّم إعادة تفعيلها.",
    u_btn: "نعم، أوقفوا هذه الرسائل", u_done: "تم. لن تصلكم هذه الرسائل بعد الآن.",
    u_bad: "تعذّرت قراءة هذا الرابط. يُرجى الرد على أي رسالة من المعلّم وسنساعدكم.",
  },
  pt: {
    watch_cta: "Ver em conjunto com {name}", watch_note: "Uma vista só de leitura da aula, exatamente como {name} a vê. Nada do que fizer aí é guardado.",
    subject: "Esta semana na aprendizagem de {name}",
    hello: "Olá,",
    intro: "Eis um breve resumo de como correu a semana de {name} com {provider}.",
    celebrate: "Algo para celebrar",
    c_score: "{name} obteve {pct}% em «{title}». Parabéns!",
    c_streak: "{name} estuda há {n} dias seguidos. Que ótimo hábito!",
    c_allin: "Todos os trabalhos de casa de {name} foram entregues. Excelente esforço!",
    c_quizzes: "Quizzes concluídos esta semana: {n}. Excelente esforço, {name}!",
    c_lessons: "Aulas em direto a que {name} assistiu esta semana: {n}. Foi um prazer contar com {name}!",
    c_keep: "Agradecemos o seu apoio à aprendizagem de {name}. Cada pequeno passo conta!",
    hw: "Trabalho de casa", s_todo: "Por fazer", s_in: "Entregue", s_marked: "Corrigido: {score}/{max}", due: "Entrega até {date}",
    quizzes: "Quizzes e aulas", l_row: "Aula em direto: {title}",
    streak: "Sequência de aprendizagem: {n} dias seguidos", strong: "Área mais forte esta semana: {subject}",
    up: "A seguir", up_hw: "Trabalho de casa para entregar: {title} ({date})", up_lesson: "Aula em direto: {title} ({date})",
    cta: "Abrir o Centro de Aprendizagem",
    why: "Recebe este e-mail porque {name} está inscrito(a) em {provider}. Só partilhamos o primeiro nome de {name} e a sua própria atividade de aprendizagem.",
    stop_digest: "Parar o resumo semanal",
    sign: "Com os melhores cumprimentos, {provider}",
    n_subject_before: "Um lembrete amigável: o trabalho de casa de {name} termina em breve",
    n_subject_after: "O trabalho de casa de {name} ainda não foi entregue",
    n_before: "Um pequeno lembrete: «{title}» deve ser entregue até {date} e ainda não foi entregue. Um pouco de tempo hoje seria perfeito.",
    n_after: "«{title}» era para {date} e ainda não foi entregue. Não faz mal, é fácil recuperar. Se {name} precisar de mais tempo, basta enviar uma mensagem ao tutor.",
    n_ignore: "Se já estiver feito, ignore esta mensagem. Agradecemos!",
    n_cta: "Abrir o trabalho de casa", stop_nudge: "Parar os lembretes de trabalhos de casa",
    u_title_digest: "Parar o resumo semanal?", u_title_nudge: "Parar os lembretes de trabalhos de casa?",
    u_body: "Deixará de receber estes e-mails de {provider}. Pode pedir ao tutor para os reativar a qualquer momento.",
    u_btn: "Sim, parar estes e-mails", u_done: "Feito. Não receberá mais estes e-mails.",
    u_bad: "Não foi possível ler esta ligação. Responda a qualquer e-mail do tutor e ajudaremos.",
  },
  es: {
    watch_cta: "Ver en paralelo con {name}", watch_note: "Una vista de solo lectura de la lección, exactamente como la ve {name}. Nada de lo que hagas allí se guarda.",
    subject: "Esta semana en el aprendizaje de {name}",
    hello: "Hola:",
    intro: "Este es un breve resumen de cómo le fue a {name} esta semana con {provider}.",
    celebrate: "Algo que celebrar",
    c_score: "{name} obtuvo un {pct}% en «{title}». ¡Enhorabuena!",
    c_streak: "{name} lleva {n} días seguidos aprendiendo. ¡Qué gran hábito!",
    c_allin: "Todos los deberes de {name} están entregados. ¡Un esfuerzo estupendo!",
    c_quizzes: "Quizzes completados esta semana: {n}. ¡Gran esfuerzo, {name}!",
    c_lessons: "Clases en directo a las que asistió {name} esta semana: {n}. ¡Un placer contar con {name}!",
    c_keep: "Gracias por apoyar el aprendizaje de {name}. ¡Cada pequeño paso cuenta!",
    hw: "Deberes", s_todo: "Pendiente", s_in: "Entregado", s_marked: "Corregido: {score}/{max}", due: "Para el {date}",
    quizzes: "Quizzes y clases", l_row: "Clase en directo: {title}",
    streak: "Racha de aprendizaje: {n} días seguidos", strong: "Área más fuerte esta semana: {subject}",
    up: "Próximamente", up_hw: "Deberes para entregar: {title} ({date})", up_lesson: "Clase en directo: {title} ({date})",
    cta: "Abrir el Centro de aprendizaje",
    why: "Recibe este correo porque {name} está inscrito/a en {provider}. Solo compartimos el nombre de pila de {name} y su propia actividad de aprendizaje.",
    stop_digest: "Dejar de recibir el resumen semanal",
    sign: "Un cordial saludo, {provider}",
    n_subject_before: "Un recordatorio amistoso: los deberes de {name} vencen pronto",
    n_subject_after: "Los deberes de {name} todavía no se han entregado",
    n_before: "Un pequeño recordatorio: «{title}» debe entregarse el {date} y aún no se ha entregado. Un rato hoy sería perfecto.",
    n_after: "«{title}» era para el {date} y aún no se ha entregado. No pasa nada, es fácil ponerse al día. Si {name} necesita más tiempo, escriba al tutor.",
    n_ignore: "Si ya está hecho, ignore este mensaje. ¡Gracias!",
    n_cta: "Abrir los deberes", stop_nudge: "Dejar de recibir recordatorios de deberes",
    u_title_digest: "¿Dejar de recibir el resumen semanal?", u_title_nudge: "¿Dejar de recibir recordatorios de deberes?",
    u_body: "Dejará de recibir estos correos de {provider}. Puede pedirle al tutor que los vuelva a activar en cualquier momento.",
    u_btn: "Sí, dejar de recibirlos", u_done: "Hecho. No recibirá más estos correos.",
    u_bad: "No se pudo leer este enlace. Responda a cualquier correo del tutor y le ayudaremos.",
  },
  fr: {
    watch_cta: "Regarder avec {name}", watch_note: "Un aperçu en lecture seule de la leçon, exactement comme {name} la voit. Rien de ce que vous y faites n'est enregistré.",
    subject: "Cette semaine dans les apprentissages de {name}",
    hello: "Bonjour,",
    intro: "Voici un bref aperçu de la semaine de {name} avec {provider}.",
    celebrate: "À célébrer",
    c_score: "{name} a obtenu {pct} % à « {title} ». Bravo !",
    c_streak: "{name} apprend depuis {n} jours de suite. Quelle belle habitude !",
    c_allin: "Tous les devoirs de {name} ont été rendus. Un super effort !",
    c_quizzes: "Quiz terminés cette semaine : {n}. Bel effort, {name} !",
    c_lessons: "Cours en direct suivis cette semaine : {n}. Quel plaisir de voir {name} !",
    c_keep: "Merci de soutenir les apprentissages de {name}. Chaque petit pas compte !",
    hw: "Devoirs", s_todo: "À faire", s_in: "Rendu", s_marked: "Corrigé : {score}/{max}", due: "Pour le {date}",
    quizzes: "Quiz et cours", q_row: "{title} : {pct} %", l_row: "Cours en direct : {title}",
    streak: "Série d'apprentissage : {n} jours de suite", strong: "Point fort de la semaine : {subject}",
    up: "À venir", up_hw: "Devoirs à rendre : {title} ({date})", up_lesson: "Cours en direct : {title} ({date})",
    cta: "Ouvrir l’Espace d’apprentissage",
    why: "Vous recevez ce message car {name} est inscrit(e) chez {provider}. Nous ne partageons que le prénom de {name} et son propre parcours d'apprentissage.",
    stop_digest: "Arrêter le résumé hebdomadaire",
    sign: "Cordialement, {provider}",
    n_subject_before: "Un petit rappel : les devoirs de {name} sont bientôt à rendre",
    n_subject_after: "Les devoirs de {name} n'ont pas encore été rendus",
    n_before: "Un petit rappel : « {title} » est à rendre pour le {date} et n'a pas encore été rendu. Un peu de temps aujourd'hui serait parfait.",
    n_after: "« {title} » était à rendre pour le {date} et n'a pas encore été rendu. Pas d'inquiétude, il est facile de rattraper. Si {name} a besoin de plus de temps, écrivez simplement au professeur.",
    n_ignore: "S'il est déjà fait, ignorez ce message. Merci !",
    n_cta: "Ouvrir les devoirs", stop_nudge: "Arrêter les rappels de devoirs",
    u_title_digest: "Arrêter le résumé hebdomadaire ?", u_title_nudge: "Arrêter les rappels de devoirs ?",
    u_body: "Vous ne recevrez plus ces e-mails de la part de {provider}. Vous pouvez demander au professeur de les réactiver à tout moment.",
    u_btn: "Oui, arrêter ces e-mails", u_done: "C'est fait. Vous ne recevrez plus ces e-mails.",
    u_bad: "Ce lien n'a pas pu être lu. Répondez à un e-mail du professeur et nous vous aiderons.",
  },
  cy: {
    watch_cta: "Gwylio gyda {name}", watch_note: "Golwg gwylio'n unig ar y wers, yn union fel mae {name} yn ei gweld. Ni chaiff dim a wnewch yno ei gadw.",
    subject: "Dysgu {name} yr wythnos hon",
    hello: "Helo,",
    intro: "Dyma gipolwg cyflym ar sut hwyl gafodd {name} yr wythnos hon gyda {provider}.",
    celebrate: "Rhywbeth i'w ddathlu",
    c_score: "Cafodd {name} {pct}%: “{title}”. Da iawn!",
    c_streak: "Mae {name} wedi dysgu am {n} diwrnod yn olynol. Am arfer gwych!",
    c_allin: "Mae holl waith cartref {name} wedi'i gyflwyno. Ymdrech wych!",
    c_quizzes: "Cwisiau wedi'u cwblhau'r wythnos hon: {n}. Ymdrech wych, {name}!",
    c_lessons: "Gwersi byw a fynychwyd yr wythnos hon: {n}. Braf gweld {name} yno!",
    c_keep: "Diolch am gefnogi dysgu {name}. Mae pob cam bach yn cyfrif!",
    hw: "Gwaith cartref", s_todo: "I'w wneud", s_in: "Wedi'i gyflwyno", s_marked: "Wedi'i farcio: {score}/{max}", due: "Erbyn {date}",
    quizzes: "Cwisiau a gwersi", l_row: "Gwers fyw: {title}",
    streak: "Rhediad dysgu: {n} diwrnod yn olynol", strong: "Y maes cryfaf yr wythnos hon: {subject}",
    up: "Yn dod nesaf", up_hw: "Gwaith cartref i'w gyflwyno: {title} ({date})", up_lesson: "Gwers fyw: {title} ({date})",
    cta: "Agor yr Hyb Dysgu",
    why: "Rydych yn cael yr e-bost hwn oherwydd bod {name} wedi cofrestru gyda {provider}. Dim ond enw cyntaf {name} a’r gweithgarwch dysgu perthnasol a rennir gennym.",
    stop_digest: "Stopio'r crynodeb wythnosol",
    sign: "Cofion cynnes, {provider}",
    n_subject_before: "Nodyn atgoffa cyfeillgar: mae gwaith cartref {name} i mewn cyn bo hir",
    n_subject_after: "Nid yw gwaith cartref {name} wedi'i gyflwyno eto",
    n_before: "Nodyn bach i'ch atgoffa: mae “{title}” i mewn erbyn {date} ac nid yw wedi'i gyflwyno eto. Byddai ychydig o amser heddiw yn berffaith.",
    n_after: "Roedd “{title}” i fod i mewn erbyn {date} ac nid yw wedi'i gyflwyno eto. Peidiwch â phoeni, mae'n hawdd dal i fyny. Os oes angen mwy o amser ar {name}, anfonwch neges at y tiwtor.",
    n_ignore: "Os yw eisoes wedi'i wneud, anwybyddwch y neges hon. Diolch!",
    n_cta: "Agor y gwaith cartref", stop_nudge: "Stopio nodiadau atgoffa gwaith cartref",
    u_title_digest: "Stopio'r crynodeb wythnosol?", u_title_nudge: "Stopio nodiadau atgoffa gwaith cartref?",
    u_body: "Ni fyddwch yn cael yr e-byst hyn gan {provider} mwyach. Gallwch ofyn i'r tiwtor eu troi ymlaen eto unrhyw bryd.",
    u_btn: "Ie, stopiwch yr e-byst hyn", u_done: "Wedi'i wneud. Ni fyddwch yn cael yr e-byst hyn mwyach.",
    u_bad: "Doedd dim modd darllen y ddolen hon. Atebwch unrhyw e-bost gan y tiwtor a byddwn yn helpu.",
  },
};

export const DIGEST_LOCALES = LOCALES.map((l) => l.code);
/** A stored locale (users/{uid}.locale) → a supported code; anything unknown / missing → English. */
export function normLocale(x: unknown): LocaleCode {
  const c = typeof x === "string" ? x.trim().toLowerCase().split(/[-_]/)[0] : "";
  return (DIGEST_LOCALES as string[]).includes(c) ? (c as LocaleCode) : "en";
}
/** The string table for a locale, English filling any gap. */
export const strings = (loc: LocaleCode): S => ({ ...EN, ...(T[loc] ?? {}) } as S);

export const esc = (s: unknown): string => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
/** `key_<plural form>` for n when the locale supplies one (ro: few vs other needs "de" from 20), else the plain `key`. */
const plur = (s: S, key: string, n: number, loc: string): string => { for (const f of pluralChain(loc, n)) { const v = s[`${key}_${f}`]; if (v !== undefined) return v; } return s[key] as string; };
const fill = (tpl: string, v: Record<string, string | number>) => tpl.replace(/\{(\w+)\}/g, (_m, k) => (k in v ? String(v[k]) : `{${k}}`));
/** Fill a template and HTML-escape the result (values are escaped once, here). */
const f = (tpl: string, v: Record<string, string | number>) => esc(fill(tpl, v));

/** "Mon 29 Sep" in the family's language, UK time (the platform's wall clock). */
export function fmtDate(iso: string, loc: LocaleCode): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // ar/ur/bn/pa default to native digits in Intl; every other number in the email ({pct}, {n}) is Western, so pin the numbering system.
  const tag = loc === "en" ? "en-GB" : (["ar", "ur", "bn", "pa"] as string[]).includes(loc) ? `${loc}-u-nu-latn` : loc;
  try { return new Intl.DateTimeFormat(tag, { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short" }).format(d); }
  catch { return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short" }).format(d); }
}

// ── layout ──────────────────────────────────────────────────────────────────
const INK = "#1f2a44", MUTED = "#5b6472", BRAND = "#3b5bdb", SOFT = "#f4f7fc", GOOD = "#e8f7ee", GOODINK = "#1b6b3a";

function shell(loc: LocaleCode, o: { title: string; provider: string; body: string; foot: string; stopHref: string; stopLabel: string }): string {
  const rtl = isRTL(loc);
  const dir = rtl ? "rtl" : "ltr";
  const align = rtl ? "right" : "left";
  return `<!doctype html>
<html lang="${loc}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(o.title)}</title></head>
<body style="margin:0;padding:0;background:${SOFT};font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Noto Sans','Noto Sans Arabic','Noto Nastaliq Urdu','Noto Sans Gurmukhi','Noto Sans Bengali',Arial,sans-serif;color:${INK}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SOFT};padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;direction:${dir};text-align:${align}">
<tr><td style="background:${BRAND};color:#fff;padding:14px 24px;font-size:14px;font-weight:600;text-align:${align}">${esc(o.provider)}</td></tr>
<tr><td style="padding:26px 24px 8px;text-align:${align}">
<h1 style="margin:0 0 14px;font-size:24px;line-height:1.3;color:${INK}">${esc(o.title)}</h1>
${o.body}
</td></tr>
<tr><td style="padding:14px 24px 26px;border-top:1px solid #e6eaf2;font-size:12px;line-height:1.6;color:${MUTED};text-align:${align}">
${o.foot}
<div style="margin-top:8px"><a href="${esc(o.stopHref)}" style="color:${MUTED};text-decoration:underline">${esc(o.stopLabel)}</a></div>
</td></tr></table></td></tr></table></body></html>`;
}
const p = (html: string, extra = "") => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;${extra}">${html}</p>`;
const h2 = (t: string) => `<h2 style="margin:22px 0 8px;font-size:15px;color:${BRAND};text-transform:none">${esc(t)}</h2>`;
const ul = (rows: string[]) => `<ul style="margin:0 0 6px;padding-inline-start:20px;font-size:14px;line-height:1.7">${rows.map((r) => `<li>${r}</li>`).join("")}</ul>`;
const button = (href: string, label: string) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 10px"><tr><td style="background:${BRAND};border-radius:12px"><a href="${esc(href)}" style="display:inline-block;padding:16px 32px;font-size:17px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px">${esc(label)}</a></td></tr></table>`;

/** The optional, quiet "Watch along" line under the main button: a view-only link to the child's own lesson (no button weight, so it never competes). */
function watchBlock(links: Links, s: S, v: Record<string, string | number>): string {
  if (!links.watch) return "";
  return p(`<a href="${esc(links.watch)}" style="color:${BRAND};font-weight:600">👀 ${f(s.watch_cta, v)}</a><br><span style="color:${MUTED};font-size:13px">${f(s.watch_note, v)}</span>`);
}

function celebrateText(c: Celebrate, s: S, name: string, loc: string): string {
  switch (c.kind) {
    case "score": return fill(s.c_score, { name, pct: c.pct, title: c.title });
    case "streak": return fill(plur(s, "c_streak", c.n, loc), { name, n: c.n });
    case "allin": return fill(s.c_allin, { name });
    case "quizzes": return fill(s.c_quizzes, { name, n: c.n });
    case "lessons": return fill(s.c_lessons, { name, n: c.n });
    default: return fill(s.c_keep, { name });
  }
}

export interface Rendered { subject: string; html: string; locale: LocaleCode }

export function renderDigest(d: DigestData, loc: LocaleCode, links: Links): Rendered {
  const s = strings(loc);
  const v = { name: d.childName, provider: d.provider };
  const subject = fill(s.subject, v);
  let body = p(esc(s.hello)) + p(f(s.intro, v));
  body += `<div style="background:${GOOD};border-radius:12px;padding:14px 16px;margin:6px 0 4px"><div style="font-weight:700;color:${GOODINK};font-size:14px;margin-bottom:4px">🌟 ${esc(s.celebrate)}</div><div style="font-size:15px;line-height:1.55;color:${GOODINK}">${esc(celebrateText(d.celebrate, s, d.childName, loc))}</div></div>`;
  if (d.homework.length) {
    body += h2(s.hw) + ul(d.homework.map((h) => {
      const st = h.status === "marked" ? fill(s.s_marked, { score: h.score ?? 0, max: h.max ?? 0 }) : h.status === "submitted" ? s.s_in : s.s_todo;
      const due = h.dueAt ? ` · ${fill(s.due, { date: fmtDate(h.dueAt, loc) })}` : "";
      return `<strong><bdi>${esc(h.title)}</bdi></strong> — ${esc(st)}<span style="color:${MUTED}">${esc(due)}</span>`;
    }));
  }
  if (d.quizzes.length || d.lessons.length) {
    body += h2(s.quizzes) + ul([
      ...d.quizzes.map((q) => esc(fill(s.q_row, { title: q.title, pct: q.pct ?? "–" }))),
      ...d.lessons.map((l) => esc(fill(s.l_row, { title: l.title }))),
    ]);
  }
  const facts: string[] = [];
  if (d.streakDays >= 2) facts.push(f(plur(s, "streak", d.streakDays, loc), { n: d.streakDays }));
  if (d.strongest) facts.push(f(s.strong, { subject: d.strongest }));
  if (facts.length) body += ul(facts);
  if (d.upcoming.length) {
    body += h2(s.up) + ul(d.upcoming.map((u) => f(u.kind === "homework" ? s.up_hw : s.up_lesson, { title: u.title, date: fmtDate(u.at, loc) })));
  }
  body += button(links.hub, s.cta) + watchBlock(links, s, v) + p(f(s.sign, v), `color:${MUTED};font-size:14px`);
  const foot = `<div>${f(s.why, v)}</div>`;
  return { subject, locale: loc, html: scrubHtml(shell(loc, { title: subject, provider: d.provider, body, foot, stopHref: links.stop, stopLabel: s.stop_digest })) };
}

export function renderNudge(kind: "nudge_before" | "nudge_after", n: NudgeData, loc: LocaleCode, links: Links): Rendered {
  const s = strings(loc);
  const v = { name: n.childName, provider: n.provider, title: n.title, date: fmtDate(n.dueAt, loc) };
  const subject = fill(kind === "nudge_before" ? s.n_subject_before : s.n_subject_after, v);
  const body = p(esc(s.hello)) + p(f(kind === "nudge_before" ? s.n_before : s.n_after, v)) + button(links.hub, s.n_cta) + watchBlock(links, s, v)
    + p(f(s.n_ignore, v), `color:${MUTED};font-size:14px`) + p(f(s.sign, v), `color:${MUTED};font-size:14px`);
  return { subject, locale: loc, html: scrubHtml(shell(loc, { title: subject, provider: n.provider, body, foot: `<div>${f(s.why, v)}</div>`, stopHref: links.stop, stopLabel: s.stop_nudge })) };
}

/** The public opt-out pages. `step` "confirm" = a button (a mail scanner opening the link changes nothing); "done"; "bad". */
export function renderUnsubPage(loc: LocaleCode, o: { scope: "digest" | "nudge"; provider: string; step: "confirm" | "done" | "bad"; action?: string }): string {
  const s = strings(loc);
  const rtl = isRTL(loc);
  const title = o.step === "bad" ? s.u_bad : o.step === "done" ? s.u_done : o.scope === "digest" ? s.u_title_digest : s.u_title_nudge;
  const inner = o.step === "confirm"
    ? `<h1 style="font-size:21px;margin:0 0 10px">${esc(title)}</h1><p style="font-size:14px;line-height:1.6;color:${MUTED}">${f(s.u_body, { provider: o.provider })}</p><form method="post" action="${esc(o.action ?? "")}"><button type="submit" style="margin-top:12px;background:${BRAND};color:#fff;border:0;border-radius:12px;padding:14px 26px;font-size:16px;font-weight:700;cursor:pointer">${esc(s.u_btn)}</button></form>`
    : `<h1 style="font-size:19px;margin:0;line-height:1.5">${esc(title)}</h1>`;
  return `<!doctype html><html lang="${loc}" dir="${rtl ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title></head><body style="margin:0;background:${SOFT};font-family:system-ui,-apple-system,Arial,sans-serif;color:${INK};padding:44px 16px"><div style="max-width:460px;margin:0 auto;background:#fff;border-radius:18px;padding:30px;text-align:center;box-shadow:0 16px 44px -22px rgba(20,33,58,.5)">${inner}</div></body></html>`;
}

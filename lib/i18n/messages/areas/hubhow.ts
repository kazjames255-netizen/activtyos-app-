// Translations for the `hubhow.` area (Teaching / Learning Hub). Keyed by locale; every locale holds the SAME
// flat keys (no "hubhow." prefix). {placeholders}, emoji, numbers and proper nouns are shared across languages.
// Covers the "How it works" ENTRY points (hero pill, kid card, "Watch: ..." links). The explainer videos / narration themselves are still English.
const hubhow: Record<string, Record<string, string>> = {
  en: {
    btn: "How it works", btnThis: "How this works", heroTitle: "Watch a short, narrated walkthrough", heroAria: "{label} — watch a short guided video",
    kidAria: "{label}: watch and listen", kidSub: "Watch and listen. It is short!", cardSub: "A short narrated walkthrough, with real screens.",
    w_home: "Watch: your Home screen", w_students: "Watch: your students", w_notes: "Watch: lessons and the curriculum", w_tools: "Watch: how tools work",
    w_live: "Watch: live lessons", w_homework: "Watch: set, collect and mark homework", w_quizzes: "Watch: quizzes",
    w_diagnostic: "Watch: quizzes and starting quizzes", w_flashcards: "Watch: flashcards", w_dashboard: "Watch: how progress works", w_messages: "Watch: messages", w_hwParent: "Watch: how homework works",
  },
  pl: {
    btn: "Jak to działa", btnThis: "Jak to działa", heroTitle: "Obejrzyj krótki przewodnik z narracją", heroAria: "{label} — obejrzyj krótki film instruktażowy",
    kidAria: "{label}: obejrzyj i posłuchaj", kidSub: "Obejrzyj i posłuchaj. To krótkie!", cardSub: "Krótki przewodnik z narracją, na prawdziwych ekranach.",
    w_home: "Obejrzyj: twój ekran główny", w_students: "Obejrzyj: twoi uczniowie", w_notes: "Obejrzyj: lekcje i program nauczania", w_tools: "Obejrzyj: jak działają narzędzia",
    w_live: "Obejrzyj: lekcje na żywo", w_homework: "Obejrzyj: zadawanie, zbieranie i sprawdzanie prac domowych", w_quizzes: "Obejrzyj: quizy",
    w_diagnostic: "Obejrzyj: quizy i quizy startowe", w_flashcards: "Obejrzyj: fiszki", w_dashboard: "Obejrzyj: jak działają postępy", w_messages: "Obejrzyj: wiadomości", w_hwParent: "Obejrzyj: jak działają prace domowe",
  },
  ro: {
    btn: "Cum funcționează", btnThis: "Cum funcționează", heroTitle: "Urmărește un scurt ghid cu narațiune", heroAria: "{label} — urmărește un scurt clip ghidat",
    kidAria: "{label}: urmărește și ascultă", kidSub: "Urmărește și ascultă. Este scurt!", cardSub: "Un scurt ghid narat, cu ecrane reale.",
    w_home: "Urmărește: ecranul tău principal", w_students: "Urmărește: elevii tăi", w_notes: "Urmărește: lecțiile și programa școlară", w_tools: "Urmărește: cum funcționează instrumentele",
    w_live: "Urmărește: lecții live", w_homework: "Urmărește: cum dai, aduni și corectezi temele", w_quizzes: "Urmărește: testele",
    w_diagnostic: "Urmărește: teste și teste de start", w_flashcards: "Urmărește: fișe de memorare", w_dashboard: "Urmărește: cum funcționează progresul", w_messages: "Urmărește: mesajele", w_hwParent: "Urmărește: cum funcționează temele",
  },
  ur: {
    btn: "یہ کیسے کام کرتا ہے", btnThis: "یہ کیسے کام کرتا ہے", heroTitle: "ایک مختصر بیانیہ رہنما ویڈیو دیکھیں", heroAria: "{label} — ایک مختصر رہنما ویڈیو دیکھیں",
    kidAria: "{label}: دیکھیں اور سنیں", kidSub: "دیکھیں اور سنیں۔ یہ مختصر ہے!", cardSub: "اصل اسکرینوں کے ساتھ ایک مختصر بیانیہ رہنما۔",
    w_home: "دیکھیں: آپ کی ہوم اسکرین", w_students: "دیکھیں: آپ کے طلبہ", w_notes: "دیکھیں: اسباق اور نصاب", w_tools: "دیکھیں: ٹولز کیسے کام کرتے ہیں",
    w_live: "دیکھیں: لائیو اسباق", w_homework: "دیکھیں: ہوم ورک دینا، جمع کرنا اور نشان لگانا", w_quizzes: "دیکھیں: کوئز",
    w_diagnostic: "دیکھیں: کوئز اور ابتدائی کوئز", w_flashcards: "دیکھیں: فلیش کارڈز", w_dashboard: "دیکھیں: پیش رفت کیسے کام کرتی ہے", w_messages: "دیکھیں: پیغامات", w_hwParent: "دیکھیں: ہوم ورک کیسے کام کرتا ہے",
  },
  pa: {
    btn: "ਇਹ ਕਿਵੇਂ ਕੰਮ ਕਰਦਾ ਹੈ", btnThis: "ਇਹ ਕਿਵੇਂ ਕੰਮ ਕਰਦਾ ਹੈ", heroTitle: "ਇੱਕ ਛੋਟੀ ਬਿਆਨ ਵਾਲੀ ਗਾਈਡ ਵੇਖੋ", heroAria: "{label} — ਇੱਕ ਛੋਟੀ ਗਾਈਡ ਵੀਡੀਓ ਵੇਖੋ",
    kidAria: "{label}: ਵੇਖੋ ਅਤੇ ਸੁਣੋ", kidSub: "ਵੇਖੋ ਅਤੇ ਸੁਣੋ। ਇਹ ਛੋਟਾ ਹੈ!", cardSub: "ਅਸਲੀ ਸਕ੍ਰੀਨਾਂ ਨਾਲ ਇੱਕ ਛੋਟੀ ਬਿਆਨ ਵਾਲੀ ਗਾਈਡ।",
    w_home: "ਵੇਖੋ: ਤੁਹਾਡੀ ਹੋਮ ਸਕ੍ਰੀਨ", w_students: "ਵੇਖੋ: ਤੁਹਾਡੇ ਵਿਦਿਆਰਥੀ", w_notes: "ਵੇਖੋ: ਪਾਠ ਅਤੇ ਪਾਠਕ੍ਰਮ", w_tools: "ਵੇਖੋ: ਟੂਲ ਕਿਵੇਂ ਕੰਮ ਕਰਦੇ ਹਨ",
    w_live: "ਵੇਖੋ: ਲਾਈਵ ਪਾਠ", w_homework: "ਵੇਖੋ: ਹੋਮਵਰਕ ਦੇਣਾ, ਇਕੱਠਾ ਕਰਨਾ ਅਤੇ ਜਾਂਚਣਾ", w_quizzes: "ਵੇਖੋ: ਕਵਿਜ਼",
    w_diagnostic: "ਵੇਖੋ: ਕਵਿਜ਼ ਅਤੇ ਸ਼ੁਰੂਆਤੀ ਕਵਿਜ਼", w_flashcards: "ਵੇਖੋ: ਫਲੈਸ਼ਕਾਰਡ", w_dashboard: "ਵੇਖੋ: ਤਰੱਕੀ ਕਿਵੇਂ ਕੰਮ ਕਰਦੀ ਹੈ", w_messages: "ਵੇਖੋ: ਸੁਨੇਹੇ", w_hwParent: "ਵੇਖੋ: ਹੋਮਵਰਕ ਕਿਵੇਂ ਕੰਮ ਕਰਦਾ ਹੈ",
  },
  bn: {
    btn: "এটি কীভাবে কাজ করে", btnThis: "এটি কীভাবে কাজ করে", heroTitle: "একটি ছোট বর্ণনাসহ গাইড দেখুন", heroAria: "{label} — একটি ছোট গাইড ভিডিও দেখুন",
    kidAria: "{label}: দেখুন ও শুনুন", kidSub: "দেখুন ও শুনুন। এটি ছোট!", cardSub: "আসল স্ক্রিনসহ একটি ছোট বর্ণনাসহ গাইড।",
    w_home: "দেখুন: আপনার হোম স্ক্রিন", w_students: "দেখুন: আপনার শিক্ষার্থীরা", w_notes: "দেখুন: পাঠ ও পাঠ্যক্রম", w_tools: "দেখুন: টুল কীভাবে কাজ করে",
    w_live: "দেখুন: লাইভ পাঠ", w_homework: "দেখুন: বাড়ির কাজ দেওয়া, সংগ্রহ ও নম্বর দেওয়া", w_quizzes: "দেখুন: কুইজ",
    w_diagnostic: "দেখুন: কুইজ ও শুরুর কুইজ", w_flashcards: "দেখুন: ফ্ল্যাশকার্ড", w_dashboard: "দেখুন: অগ্রগতি কীভাবে কাজ করে", w_messages: "দেখুন: বার্তা", w_hwParent: "দেখুন: বাড়ির কাজ কীভাবে কাজ করে",
  },
  ar: {
    btn: "كيف يعمل", btnThis: "كيف يعمل هذا", heroTitle: "شاهد جولة قصيرة مع شرح صوتي", heroAria: "{label} — شاهد فيديو إرشاديًا قصيرًا",
    kidAria: "{label}: شاهد واستمع", kidSub: "شاهد واستمع. إنه قصير!", cardSub: "جولة قصيرة مع شرح صوتي، على شاشات حقيقية.",
    w_home: "شاهد: شاشتك الرئيسية", w_students: "شاهد: طلابك", w_notes: "شاهد: الدروس والمنهج", w_tools: "شاهد: كيف تعمل الأدوات",
    w_live: "شاهد: الدروس المباشرة", w_homework: "شاهد: كيف تعيّن الواجبات وتجمعها وتصححها", w_quizzes: "شاهد: الاختبارات",
    w_diagnostic: "شاهد: الاختبارات واختبارات البداية", w_flashcards: "شاهد: البطاقات التعليمية", w_dashboard: "شاهد: كيف يعمل التقدم", w_messages: "شاهد: الرسائل", w_hwParent: "شاهد: كيف تعمل الواجبات المنزلية",
  },
  pt: {
    btn: "Como funciona", btnThis: "Como isto funciona", heroTitle: "Veja um breve guia narrado", heroAria: "{label} — veja um breve vídeo guiado",
    kidAria: "{label}: veja e ouça", kidSub: "Veja e ouça. É curto!", cardSub: "Um breve guia narrado, com ecrãs reais.",
    w_home: "Veja: o seu ecrã principal", w_students: "Veja: os seus alunos", w_notes: "Veja: as aulas e o currículo", w_tools: "Veja: como funcionam as ferramentas",
    w_live: "Veja: aulas ao vivo", w_homework: "Veja: como definir, recolher e corrigir trabalhos de casa", w_quizzes: "Veja: os questionários",
    w_diagnostic: "Veja: questionários e questionários iniciais", w_flashcards: "Veja: cartões de memória", w_dashboard: "Veja: como funciona o progresso", w_messages: "Veja: as mensagens", w_hwParent: "Veja: como funcionam os trabalhos de casa",
  },
  es: {
    btn: "Cómo funciona", btnThis: "Cómo funciona esto", heroTitle: "Mira una breve guía narrada", heroAria: "{label} — mira un breve vídeo guiado",
    kidAria: "{label}: mira y escucha", kidSub: "Mira y escucha. ¡Es corto!", cardSub: "Una breve guía narrada, con pantallas reales.",
    w_home: "Mira: tu pantalla de inicio", w_students: "Mira: tus alumnos", w_notes: "Mira: las lecciones y el currículo", w_tools: "Mira: cómo funcionan las herramientas",
    w_live: "Mira: clases en directo", w_homework: "Mira: cómo poner, recoger y corregir tareas", w_quizzes: "Mira: los cuestionarios",
    w_diagnostic: "Mira: cuestionarios y cuestionarios iniciales", w_flashcards: "Mira: tarjetas de estudio", w_dashboard: "Mira: cómo funciona el progreso", w_messages: "Mira: los mensajes", w_hwParent: "Mira: cómo funcionan las tareas",
  },
  fr: {
    btn: "Comment ça marche", btnThis: "Comment ça marche", heroTitle: "Regardez un court guide commenté", heroAria: "{label} — regardez une courte vidéo guidée",
    kidAria: "{label} : regarde et écoute", kidSub: "Regarde et écoute. C’est court !", cardSub: "Un court guide commenté, avec de vrais écrans.",
    w_home: "Regardez : votre écran d’accueil", w_students: "Regardez : vos élèves", w_notes: "Regardez : les leçons et le programme", w_tools: "Regardez : comment fonctionnent les outils",
    w_live: "Regardez : cours en direct", w_homework: "Regardez : donner, collecter et corriger les devoirs", w_quizzes: "Regardez : les quiz",
    w_diagnostic: "Regardez : quiz et quiz de départ", w_flashcards: "Regardez : cartes mémoire", w_dashboard: "Regardez : comment fonctionne le suivi", w_messages: "Regardez : les messages", w_hwParent: "Regardez : comment fonctionnent les devoirs",
  },
  cy: {
    btn: "Sut mae'n gweithio", btnThis: "Sut mae hyn yn gweithio", heroTitle: "Gwyliwch daith fer wedi'i hadrodd", heroAria: "{label} — gwyliwch fideo cyfarwyddo byr",
    kidAria: "{label}: gwyliwch a gwrandewch", kidSub: "Gwyliwch a gwrandewch. Mae'n fyr!", cardSub: "Taith fer wedi'i hadrodd, gyda sgriniau go iawn.",
    w_home: "Gwyliwch: eich sgrin Cartref", w_students: "Gwyliwch: eich myfyrwyr", w_notes: "Gwyliwch: y gwersi a'r cwricwlwm", w_tools: "Gwyliwch: sut mae'r offer yn gweithio",
    w_live: "Gwyliwch: gwersi byw", w_homework: "Gwyliwch: gosod, casglu a marcio gwaith cartref", w_quizzes: "Gwyliwch: cwisiau",
    w_diagnostic: "Gwyliwch: cwisiau a chwisiau cychwynnol", w_flashcards: "Gwyliwch: cardiau fflach", w_dashboard: "Gwyliwch: sut mae cynnydd yn gweithio", w_messages: "Gwyliwch: negeseuon", w_hwParent: "Gwyliwch: sut mae gwaith cartref yn gweithio",
  },
};
export default hubhow;

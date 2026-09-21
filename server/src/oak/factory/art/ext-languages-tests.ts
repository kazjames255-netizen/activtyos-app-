// X5 policy unit tests for the French / Spanish / German extension (positive AND negative for every family of picture / emoji, incl. false friends).
// Imported by cli.ts (TESTS = [...TESTS, ...EXT_LANG_TESTS]).
import type { Slide } from "../../../../../features/learninghub/lesson/slides/types";
type T = { name: string; slide: Pick<Slide, "kind" | "title" | "blocks">; subject: string; lessonTitle?: string; expect: string[]; emoji?: string[] };
const lead = (text: string) => ({ t: "lead" as const, text });
const text = (t: string) => ({ t: "text" as const, text: t });
const define = (...it: [string, string][]) => ({ t: "define" as const, items: it.map(([term, def]) => ({ term, def })) });
const S = (kind: Slide["kind"], title: string, ...blocks: Slide["blocks"]): T["slide"] => ({ kind, title, blocks });

export const EXT_LANG_TESTS: T[] = [
  // ── emoji: false friends and exact forms ──
  { name: "fr: chat = cat (two mentions, title + lead)", subject: "French", slide: S("explain", "Le chat", lead("Le chat est gris. Un chat dort.")), expect: [], emoji: ["🐈"] },
  { name: "de: Chat (online) is NOT a cat", subject: "German", slide: S("explain", "Der Chat", lead("Im Chat schreiben wir online. Der Chat ist toll.")), expect: [], emoji: [] },
  { name: "fr: English 'chat' (conversation) is not a cat", subject: "French", slide: S("explain", "Let's chat", lead("We chat about school. You can chat with a partner about chat.")), expect: [], emoji: [] },
  { name: "fr: 'elle porte' (she wears) is not a door", subject: "French", slide: S("explain", "Elle porte", lead("Elle porte une robe. Elle porte un manteau.")), expect: [], emoji: [] },
  { name: "fr: 'il lit' (he reads) is not a bed", subject: "French", slide: S("explain", "Il lit", lead("Il lit un livre. Il lit le soir.")), expect: [], emoji: [] },
  { name: "es: 'metro' (metre) gets no underground picture", subject: "Spanish", slide: S("explain", "El metro", lead("Un metro mide cien centímetros. El metro es una unidad.")), expect: [], emoji: [] },
  { name: "es: agua = water", subject: "Spanish", slide: S("explain", "El agua", lead("El agua es fría. Bebo agua.")), expect: [], emoji: ["💧"] },
  { name: "de: plural Hunde = dog", subject: "German", slide: S("explain", "Die Hunde", lead("Die Hunde sind groß. Zwei Hunde spielen.")), expect: [], emoji: ["🐕"] },
  { name: "fr: irregular plural oiseaux and elided l'oiseau", subject: "French", slide: S("explain", "L’oiseau", lead("L’oiseau chante. Les oiseaux chantent.")), expect: [], emoji: ["🐦"] },
  { name: "fr: a sound lesson ([eau]) never gets the water emoji", subject: "French", slide: S("explain", "Practising the sound eau", lead("The sound eau is spelled e-a-u. Say eau and water.")), expect: [], emoji: [] },
  { name: "de: a school TRIP is not the school building", subject: "German", slide: S("explain", "The school trip", lead("Practising vocabulary for a school trip. The school trip is fun.")), expect: [], emoji: [] },
  { name: "es: tongue twister is not a tongue", subject: "Spanish", slide: S("explain", "A tongue twister", lead("Recite a tongue twister. The tongue twister trains your tongue.")), expect: [], emoji: [] },
  // ── verb tables ──
  { name: "fr: être gets its present tense table", subject: "French", slide: S("intro", "Key words", define(["être", "French verb meaning 'to be, being'"])), expect: ["fr-verb-etre"] },
  { name: "fr: être in the imperative gets NO present-tense table", subject: "French", slide: S("explain", "Using être in the imperative", lead("Use être in the imperative: sois, soyez.")), expect: [] },
  { name: "fr: être on an imperfect-tense lesson gets the imperfect endings, never the present table", subject: "French", lessonTitle: "Historical figures: imperfect tense", slide: S("intro", "Key words", define(["être", "French verb meaning to be"], ["imperfect tense", "tense used to describe how things were"])), expect: ["fr-imperfect"] },
  { name: "es: tiene is a form of tener", subject: "Spanish", slide: S("intro", "Key words", define(["tiene", "she, he, it has, part of the verb tener"])), expect: ["es-verb-tener"] },
  { name: "de: sein (possessive his) gets the possessive table, not the verb sein", subject: "German", slide: S("intro", "Key words", define(["possessive adjective", "describes who possesses a noun, e.g. mein Bruder"], ["sein", "possessive adjective meaning his"])), expect: ["de-possessive"] },
  { name: "de: können present-tense table", subject: "German", slide: S("intro", "Key words", define(["können", "verb meaning to be able to, can"])), expect: ["de-verb-konnen"] },
  { name: "fr: regular -er verbs", subject: "French", slide: S("explain", "Using -er verbs in the present", lead("Regular -er verbs have the following endings in the singular form: -e, -es, -e.")), expect: ["fr-regular-er"] },
  { name: "fr: -er verbs in the perfect tense: no present-tense endings table", subject: "French", slide: S("explain", "The perfect tense of -er verbs", lead("Form the perfect tense of -er verbs with avoir and the past participle.")), expect: ["fr-perfect"] },
  { name: "fr: stem-changing -er verbs get no regular table", subject: "French", slide: S("explain", "Stem changing -er verbs", lead("Some -er verbs are stem changing: spelling changes.")), expect: [] },
  { name: "es: regular preterite needs the regular -ar / -er / -ir context", subject: "Spanish", slide: S("intro", "Key words", define(["preterite", "verb tense used to talk about something completed in the past"], ["-ar verb", "a verb whose infinitive ends in -ar"])), expect: ["es-preterite"] },
  { name: "es: irregular preterite (fui, fue) gets no regular table", subject: "Spanish", slide: S("explain", "The preterite of ir", lead("In the preterite the singular forms of ir are fui, fuiste and fue.")), expect: [] },
  { name: "es: imperfect regular", subject: "Spanish", slide: S("intro", "Key words", define(["imperfect tense", "tense used to describe how things were or used to be in the past"], ["-ar verb", "a verb whose infinitive ends in -ar"])), expect: ["es-imperfect"] },
  { name: "fr: near future aller + infinitive", subject: "French", slide: S("intro", "Key words", define(["aller + infinitive", "2-verb future structure meaning going to + infinitive"])), expect: ["fr-near-future"] },
  { name: "fr: the aller verb table is not shown for aller + infinitive", subject: "French", slide: S("explain", "Talking about the future with aller + infinitive", lead("Use aller + infinitive to say what you are going to do.")), expect: ["fr-near-future"] },
  { name: "fr: simple future and near future together: neither (would contradict the other)", subject: "French", slide: S("explain", "Near future and simple future", lead("The simple future and aller + infinitive both talk about the future.")), expect: [] },
  // ── grammar frames ──
  { name: "fr: negation ne ... pas", subject: "French", slide: S("explain", "Negation with ne … pas", lead("The verb goes between ne and pas in a negation.")), expect: ["fr-negation"] },
  { name: "fr: negation with pas de / ne … que is NOT the ne … pas frame", subject: "French", slide: S("explain", "Negation with ne … que", lead("Negation with ne que means only. Use pas de after negation.")), expect: [] },
  { name: "de: weil sends the verb to the end (word order three)", subject: "German", slide: S("intro", "Key words", define(["word order three (WO3)", "after certain conjunctions, the verb is sent to the end of the clause"])), expect: ["de-verb-final"] },
  { name: "de: denn does NOT send the verb to the end: no WO3 frame", subject: "German", slide: S("explain", "weil versus denn", lead("Word order three follows weil but not denn.")), expect: [] },
  { name: "de: word order two (verb second)", subject: "German", slide: S("intro", "Key words", define(["word order two (WO2)", "inverts the subject and verb in a sentence"])), expect: ["de-verb-second"] },
  { name: "fr: object pronouns before the verb", subject: "French", slide: S("intro", "Key words", define(["direct object pronoun", "replaces the noun receiving the action of the verb"])), expect: ["fr-object-pronoun"] },
  { name: "fr: object pronouns in the imperative go AFTER the verb: no frame", subject: "French", slide: S("explain", "Direct object pronouns in the imperative", lead("A direct object pronoun follows the verb in a positive imperative.")), expect: [] },
  { name: "de: yes/no questions vs question words", subject: "German", slide: S("intro", "Key words", define(["closed question", "a question that can be answered with yes or no"])), expect: ["de-questions"] },
  { name: "de: question words card", subject: "German", slide: S("intro", "Key words", define(["open question", "question starting with a wh- word"])), expect: ["de-question-words"] },
  { name: "es: gustar agrees with the thing liked", subject: "Spanish", slide: S("explain", "Using gustar", lead("Gustar agrees with the thing that is liked.")), expect: ["es-gustar"] },
  { name: "fr: comparatives, but not the irregular ones", subject: "French", slide: S("explain", "Comparatives", lead("Use plus, moins or aussi with an adjective and que to compare.")), expect: ["fr-comparative"] },
  { name: "fr: irregular comparatives (meilleur) get no regular frame", subject: "French", slide: S("explain", "Comparatives", lead("Irregular comparatives: bon becomes meilleur. Comparatives.")), expect: [] },
  // ── tables ──
  { name: "fr: articles", subject: "French", slide: S("intro", "Key words", define(["definite article", "the words le, la and l' meaning the"])), expect: ["fr-articles"] },
  { name: "de: nominative articles der / die / das", subject: "German", slide: S("intro", "Key words", define(["definite article", "words der, die, das meaning the"])), expect: ["de-articles"] },
  { name: "de: accusative articles get the cases table, not the nominative-only one", subject: "German", slide: S("explain", "Definite articles in the accusative", lead("The accusative definite article changes for masculine nouns: der becomes den. Articles in the accusative case.")), expect: ["de-cases-articles"] },
  { name: "de: dative preposition lessons WITHOUT articles get no cases table", subject: "German", slide: S("explain", "Using von with the dative", lead("The preposition von is followed by the dative case.")), expect: [] },
  { name: "fr: adjective agreement (regular)", subject: "French", slide: S("intro", "Key words", define(["adjective agreement", "when the ending of an adjective matches the noun it describes"])), expect: ["fr-adjective-agreement"] },
  { name: "fr: adjectives ending in -e do not change: no +e picture", subject: "French", slide: S("explain", "Adjective agreement", lead("Adjective agreement: adjectives ending in e do not change in the feminine.")), expect: [] },
  { name: "fr: possessive adjectives", subject: "French", slide: S("intro", "Key words", define(["possessive adjective", "a word that goes before a noun to show ownership"])), expect: ["fr-possessive"] },
  { name: "de: possessive adjectives in the accusative get no nominative table", subject: "German", slide: S("explain", "Possessive adjectives in the accusative", lead("Possessive adjectives take accusative endings: meinen Bruder.")), expect: [] },
  { name: "fr: partitive article", subject: "French", slide: S("intro", "Key words", define(["partitive article", "the words du, de la, de l' and des meaning some"])), expect: ["fr-partitive"] },
  { name: "fr: negative subject pronouns are not the plain subject-pronoun table", subject: "French", slide: S("explain", "Negative subject pronouns", lead("A negative subject pronoun such as personne is a subject pronoun.")), expect: [] },
  { name: "es: reflexive pronouns", subject: "Spanish", slide: S("intro", "Key words", define(["reflexive pronoun", "replaces the object in a sentence using a reflexive verb"])), expect: ["es-reflexive"] },
  { name: "de: dative reflexive pronouns get no accusative reflexive table", subject: "German", slide: S("explain", "Dative reflexive pronouns", lead("A reflexive pronoun in the dative: mir and dir.")), expect: [] },
  // ── vocabulary pictures ──
  { name: "fr: numbers 1-12 exactly (not 1-31)", subject: "French", slide: S("explain", "Numbers 1-12", lead("Learn the numbers 1-12.")), expect: ["fr-numbers-1-12"] },
  { name: "fr: numbers 1-31 gets 13-31, not 1-12", subject: "French", slide: S("explain", "Numbers 1-31", lead("Count from 1-31.")), expect: ["fr-numbers-13-31"] },
  { name: "fr: numbers 32-69 gets no numerals picture", subject: "French", slide: S("explain", "Numbers 32-69", lead("Numbers 32-69 combine tens and units.")), expect: [] },
  { name: "de: days of the week", subject: "German", slide: S("explain", "Days of the week", lead("Learn the days of the week and use Montag and Dienstag.")), expect: ["de-days"] },
  { name: "es: months of the year", subject: "Spanish", slide: S("explain", "Months of the year", lead("Learn the months of the year and birthdays.")), expect: ["es-months"] },
  { name: "es: seasons", subject: "Spanish", slide: S("explain", "The seasons", lead("Learn the seasons: spring, summer, autumn and winter.")), expect: ["es-seasons"] },
  { name: "fr: colours chart, not on colour agreement", subject: "French", slide: S("explain", "Colours", lead("Learn the colours in French.")), expect: ["fr-colours"] },
  { name: "fr: colour agreement gets no colours chart", subject: "French", slide: S("explain", "Using colours and adjective agreement", lead("Colours can be used as adjectives and must agree with what they are describing. Colours.")), expect: [] },
  { name: "de: telling the time (halb vier = 3:30 picture)", subject: "German", slide: S("explain", "Telling the time", lead("Telling the time: halb vier is half past three, the half hour before four.")), expect: ["de-telling-time"] },
  { name: "de: the 24-hour clock gets no 12-hour clock picture", subject: "German", slide: S("explain", "Telling the time with the 24-hour clock", lead("Telling the time with the 24-hour clock in minutes past the hour.")), expect: [] },
  { name: "fr: accents", subject: "French", slide: S("explain", "Accents", lead("Accents can change the pronunciation of a letter. The letter ç is a cedilla.")), expect: ["fr-accents"] },
  { name: "de: umlauts", subject: "German", slide: S("intro", "Key words", define(["umlaut", "pair of dots placed over the vowels a, o, u in German"])), expect: ["de-umlauts"] },
  // ── flags (named country only) ──
  { name: "es: Peru named in the title -> the flag of Peru", subject: "Spanish", lessonTitle: "Christmas celebrations in Peru", slide: S("intro", "Today’s learning", lead("I can learn about Christmas traditions in Peru.")), expect: ["flag-peru"] },
  { name: "es: Mexico AND Spain named: no flag at all", subject: "Spanish", lessonTitle: "Spain and Mexico", slide: S("intro", "Spain and Mexico", lead("I can compare Spain and Mexico.")), expect: [] },
  { name: "fr: France AND Haiti named: no flag", subject: "French", lessonTitle: "Celebrations in France and Haiti", slide: S("intro", "Today’s learning", lead("I can describe celebrations in France and Haiti.")), expect: [] },
  { name: "fr: Haiti only -> the flag of Haiti", subject: "French", lessonTitle: "Christmas in Haiti", slide: S("intro", "Today’s learning", lead("I can describe a typical Christmas in Haiti.")), expect: ["flag-haiti"] },
  { name: "es: history of Peru: no flag", subject: "Spanish", lessonTitle: "The history of Peru", slide: S("intro", "Today’s learning", lead("I can retell the history of Peru.")), expect: [] },
  { name: "fr: écrire is drawn with the elided j'écris", subject: "French", slide: S("intro", "Key words", define(["écrire", "the verb to write"])), expect: ["fr-verb-ecrire"] },
  { name: "fr: Senegal -> its flag", subject: "French", lessonTitle: "Senegal", slide: S("intro", "Senegal", lead("I can form sentences about Senegal.")), expect: ["flag-senegal"] },
];

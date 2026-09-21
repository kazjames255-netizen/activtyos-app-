// German — Identity & Culture (GCSE, Years 10 and 11). Original content aligned to the DfE GCSE modern foreign languages subject content (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q10 = qb("deide", 10);
const q11 = qb("deide", 11);

export const TOPIC: CTopic = {
  key: "deide",
  topic: "Identity & Culture",
  subject: "German",
  years: {
    10: {
      year: 10,
      subtopic: "GCSE Year 10",
      yearsCovered: [10],
      objectives: [
        "Describe family members, friends and relationships, including character and appearance.",
        "Use reflexive verbs and verbs with fixed prepositions (sich verstehen mit, sich interessieren für, sich streiten mit).",
        "Use the dative after mit and for indirect objects, and possessive articles in the right case.",
        "Compare people with comparatives and superlatives (älter als, am liebsten).",
        "Give opinions and reasons with weil, using verb-final word order.",
      ],
      note: {
        title: "Year 10: family, friends, character and relationships",
        body: `## Vocabulary

| German | English |
| --- | --- |
| das Einzelkind | only child |
| die Großeltern (pl.) | grandparents |
| der Neffe / die Nichte | nephew / niece |
| der Zwilling | twin |
| verlobt | engaged (to be married) |
| hilfsbereit | helpful |
| zuverlässig | reliable |
| eingebildet | conceited |

## Verbs with fixed prepositions

Many reflexive verbs need a set preposition, and the preposition decides the case.

| Verb | Case |
| --- | --- |
| sich verstehen **mit** | dative |
| sich streiten **mit** | dative |
| sich interessieren **für** | accusative |
| sich verlieben **in** | accusative |
| sich freuen **auf** | accusative |

**mit** always takes the dative: *mit meinem Onkel, mit meiner Tante, mit meinen Freunden*. An indirect object is dative too: *Ich schenke meiner Oma Blumen.*

## Comparing

Add **-er** and use **als**: *jünger als*. Irregular: gut → besser → am besten; gern → lieber → am liebsten.

## Model sentences

- **Sie versteht sich gut mit ihrem Onkel, weil er so lustig ist.** She gets on well with her uncle because he is so funny.
- **Ich interessiere mich für Kunst, aber am liebsten fahre ich Rad.** I am interested in art, but I like cycling best.
- **Meine Großeltern wohnen in Dresden; ich besuche sie am liebsten im Sommer.** My grandparents live in Dresden; I like visiting them most in summer.

Sound tip: **ei** sounds like English "eye" (zwei, beide), **eu** like "oy" (Freund), **ie** like "ee" (Wien, viel).

## Common errors

- *mit mein Bruder* (needs the dative: mit meinem Bruder).
- *weil er ist lustig* (verb goes last: weil er lustig ist).
- *größer wie ich* (use als for comparisons).`,
      },
      quiz: {
        title: "Identity & Culture: Year 10 quiz",
        questions: [
          q10.single("What does 'der Stiefvater' mean?", "stepfather", ["grandfather", "godfather", "father-in-law"], "Stief- means 'step-', so der Stiefvater is a stepfather. A grandfather is der Großvater.", 1),
          q10.short("Translate into German: 'my cousin' (a girl).", "meine Cousine", "Cousine is feminine, so the possessive is meine. The spelling Kusine is also correct.", 1, { acc: ["meine Kusine"] }),
          q10.single("Choose the correct word: « Ich streite mich oft ___ meiner Schwester. »", "mit", ["für", "bei", "zu"], "Sich streiten takes mit + dative, and meiner is the feminine dative form.", 2, true),
          q10.single("Which word means 'divorced'?", "geschieden", ["verheiratet", "verwitwet", "verlobt"], "Geschieden = divorced. Verheiratet = married, verwitwet = widowed, verlobt = engaged.", 2),
          q10.multi("Which words describe POSITIVE character traits? Choose all that apply.", ["hilfsbereit", "zuverlässig", "ehrlich"], ["launisch", "eingebildet"], "Hilfsbereit = helpful, zuverlässig = reliable, ehrlich = honest. Launisch = moody and eingebildet = conceited are negative.", 2),
          q10.single(
            "Read the text. Why do Lena's parents like Mia?\n\n« Ich heiße Lena und bin sechzehn Jahre alt. Ich habe keine Geschwister, aber ich habe eine sehr enge Freundin, Mia. Wir kennen uns seit der Grundschule. Mia ist ehrlich und witzig, aber manchmal ist sie ein bisschen launisch. Am Wochenende gehen wir oft zusammen schwimmen oder wir kochen bei mir zu Hause. Meine Eltern mögen Mia sehr, denn sie ist immer höflich. Nächstes Jahr möchten wir zusammen nach Berlin fahren. »",
            "Because she is always polite.",
            ["Because she cooks for them.", "Because she has known Lena since birth.", "Because she is very funny."],
            "The text says: Meine Eltern mögen Mia sehr, denn sie ist immer höflich. Witzig describes Mia, but it is not the parents' reason.",
            2, true,
          ),
          q10.single("Which sentence means 'My brother is older than me'?", "Mein Bruder ist älter als ich.", ["Mein Bruder ist älter wie ich.", "Mein Bruder ist mehr alt als ich.", "Mein Bruder ist so älter als ich."], "German comparatives add -er to the adjective (alt → älter, with an umlaut) and use als, not wie.", 2),
          q10.short("Fill the gap with one word: « Am ______ spiele ich Tennis. » (I like playing tennis best of all.)", "liebsten", "The superlative of gern is am liebsten: gern → lieber → am liebsten.", 2),
          q10.single("Choose the correct form: « Tim hat ___ besten Freundin ein Buch geschenkt. »", "seiner", ["seine", "seinem", "seinen"], "Freundin is the indirect object (dative) and feminine, so the possessive takes the dative feminine ending: seiner.", 3),
          q10.single("Which sentence is correct? 'Because my best friend lives far away, we rarely see each other.'", "Weil meine beste Freundin weit weg wohnt, sehen wir uns selten.", ["Weil meine beste Freundin wohnt weit weg, sehen wir uns selten.", "Weil meine beste Freundin weit weg wohnt, wir sehen uns selten.", "Weil meine beste Freundin weit weg wohnt, uns sehen wir selten."], "After weil the verb goes to the end of its clause (wohnt). The main clause that follows then starts with its verb: sehen wir uns.", 3),
          q10.short("Translate into German: 'I get on well with my stepmother.'", "Ich verstehe mich gut mit meiner Stiefmutter.", "Sich verstehen mit + dative; Stiefmutter is feminine, so mit meiner Stiefmutter.", 3, { acc: ["Ich komme gut mit meiner Stiefmutter aus.", "Mit meiner Stiefmutter verstehe ich mich gut.", "Ich verstehe mich sehr gut mit meiner Stiefmutter.", "Ich verstehe mich mit meiner Stiefmutter gut.", "Ich komme mit meiner Stiefmutter gut aus.", "Mit meiner Stiefmutter komme ich gut aus.", "Ich verstehe mich gut mit meiner Stiefmama.", "Ich verstehe mich gut mit meiner Stiefmutter."] }),
          q10.written(
            "Write 5–6 sentences in German about your family and your best friend. Include one comparison with 'als', one reflexive verb with its preposition, and one 'weil' clause.",
            "Meine Familie ist ziemlich groß. Ich habe zwei Geschwister: Mein Bruder ist jünger als ich und meine Schwester ist älter. Ich verstehe mich gut mit meiner Schwester, aber ich streite mich manchmal mit meinem Bruder. Meine beste Freundin heißt Amira. Sie ist sehr hilfsbereit, weil sie immer zuhört, wenn ich Probleme habe. Am liebsten treffen wir uns am Wochenende und gehen zusammen ins Kino.",
            "Marking guide (12): comparison with correct adjective + als (2); reflexive verb with the right preposition and case, e.g. mit + dative (3); weil clause with the verb at the end (3); noun capitals, verb-second order elsewhere and gender (2); range of vocabulary and opinions (2).",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["das Einzelkind", "only child"],
        ["twin (noun)", "der Zwilling (pl. die Zwillinge)"],
        ["zuverlässig", "reliable"],
        ["eingebildet", "conceited, full of yourself"],
        ["to get on with (someone)", "sich verstehen mit + Dativ: Ich verstehe mich gut mit ihm."],
        ["sich interessieren für + which case?", "Accusative: Ich interessiere mich für Musik."],
        ["taller than (comparison)", "größer als (never 'wie')"],
        ["am liebsten", "best of all, most of all"],
        ["The preposition 'mit' takes which case?", "Dative: mit meiner Tante, mit meinem Onkel"],
        ["verlobt", "engaged (to be married)"],
      ]),
    },
    11: {
      year: 11,
      subtopic: "GCSE Year 11",
      yearsCovered: [11],
      objectives: [
        "Discuss technology and social media: uses, advantages, disadvantages and safety.",
        "Describe customs and festivals in German-speaking countries and how you celebrate.",
        "Give and justify opinions using dass, weil, obwohl and einerseits … andererseits.",
        "Use the perfect tense with separable verbs (heruntergeladen) and with sein (gegangen).",
        "Use the correct prepositions with festivals (zu Weihnachten, an Silvester).",
      ],
      note: {
        title: "Year 11: technology, social media, customs and festivals",
        body: `## Vocabulary

| German | English |
| --- | --- |
| das Passwort | password |
| die Sicherheit | safety, security |
| soziale Medien (pl.) | social media |
| herunterladen | to download |
| süchtig | addicted |
| der Weihnachtsmarkt | Christmas market |
| der Karneval / die Fastnacht | carnival (Fasching in Bavaria and Austria) |
| das Feuerwerk | fireworks |

## Opinions and connectors

Opinion phrases: *Meiner Meinung nach…, Ich finde, dass…, Einerseits… andererseits…, Der Nachteil ist, dass…*

- After **dass, weil, obwohl** the verb goes to the **end**: *Ich finde, dass das Internet nützlich ist.*
- After *Meiner Meinung nach* the verb is in second place: *Meiner Meinung nach ist das gefährlich.*
- With a modal, the modal is last: *dass man vorsichtig sein muss.*

## Festivals and prepositions

**zu** Weihnachten, **zu** Ostern, **an** Silvester, **im** Februar, **am** Neujahrstag (no article for Weihnachten and Ostern).

## Separable verbs in the perfect

*herunterladen* → **heruntergeladen** (the -ge- sits in the middle): *Ich habe ein Lied heruntergeladen.* Verbs of movement use sein: *Sie ist gestern angekommen.*

## Model sentences

- **Ich finde, dass soziale Medien viel Zeit stehlen, obwohl sie auch nützlich sind.** I think social media steals a lot of time, although it is also useful.
- **Zu Ostern suchen die Kinder bunte Eier im Garten.** At Easter the children look for coloured eggs in the garden.
- **In Köln feiert man im Februar Karneval; viele Leute tragen Kostüme.** In Cologne people celebrate carnival in February; many wear costumes.

Sound tip: **v** sounds like English "f" (Verkleidung), **w** like English "v" (Weihnachten).

## Common errors

- *in Weihnachten* (say zu Weihnachten).
- *Ich habe es heruntergeladet* (use heruntergeladen).
- *dass sie hat keine Zeit* (verb last: dass sie keine Zeit hat).`,
      },
      quiz: {
        title: "Identity & Culture: Year 11 quiz",
        questions: [
          q11.single("What does 'der Bildschirm' mean?", "screen", ["keyboard", "battery", "charger"], "Der Bildschirm is the screen of a computer or phone. A keyboard is die Tastatur.", 1),
          q11.short("Translate into German: 'on New Year's Eve'.", "an Silvester", "New Year's Eve is Silvester in German, and the preposition is an (zu Silvester is also heard).", 1, { acc: ["zu Silvester", "am Silvesterabend"] }),
          q11.single("Which sentence is correct?", "Ich denke, dass Handys für Kinder gefährlich sein können.", ["Ich denke, dass Handys für Kinder können gefährlich sein.", "Ich denke, dass können Handys für Kinder gefährlich sein.", "Ich denke, dass Handys können für Kinder sein gefährlich."], "After dass the verbs go to the end, and the modal (können) comes last: gefährlich sein können.", 2, true),
          q11.single("Choose the best connector: « Er hat kein Handy, ___ er es zu teuer findet. »", "weil", ["obwohl", "damit", "ob"], "The second clause gives the reason (he finds it too expensive), so weil fits. Obwohl means 'although' and would make no sense.", 2),
          q11.multi("Which phrases are correct German? Choose all that apply.", ["zu Weihnachten", "am Heiligabend", "im Dezember"], ["in Weihnachten", "im Heiligabend"], "Use zu with Weihnachten and Ostern, am (an dem) with a named day such as Heiligabend, and im with months.", 2),
          q11.single(
            "Read the text. Why is the writer dressing up as a pirate this year?\n\n« Im Februar feiern wir in unserer Stadt Karneval. Schon am Donnerstag ziehen Kinder in bunten Kostümen durch die Straßen, und in den Schulen gibt es Partys. Am Sonntag findet ein großer Umzug mit Musik und Wagen statt. Dabei werfen die Leute Süßigkeiten in die Menge. Meine Oma trägt jedes Jahr ein Clownkostüm. Ich verkleide mich dieses Jahr als Pirat, weil das Kostüm nicht teuer ist. Am Dienstag ist alles vorbei, und wir essen zusammen Krapfen. »",
            "The costume is cheap.",
            ["Grandma chose it.", "It is a family tradition.", "There is a school competition."],
            "The text says: weil das Kostüm nicht teuer ist. Only Grandma's clown costume is mentioned as a habit, not the pirate.",
            2, true,
          ),
          q11.single("What does 'die Verkleidung' mean?", "costume, fancy dress", ["procession", "celebration", "sweets"], "Sich verkleiden = to dress up, so die Verkleidung is a costume or disguise. The procession is der Umzug.", 2),
          q11.short("Complete with one word: « Gestern sind wir zum Weihnachtsmarkt ______. » (gehen)", "gegangen", "Gehen is a verb of movement, so the perfect uses sein + the participle gegangen.", 2),
          q11.single("Which sentence means 'Although I like social media, I don't use it much'?", "Obwohl ich soziale Medien mag, benutze ich sie nicht oft.", ["Obwohl ich soziale Medien mag, ich benutze sie nicht oft.", "Obwohl ich mag soziale Medien, benutze ich sie nicht oft.", "Obwohl ich soziale Medien mag, ich sie nicht oft benutze."], "The obwohl clause sends mag to the end. The main clause that follows then starts with its verb: benutze ich sie.", 3),
          q11.short("Translate into German: 'The advantage is that I can always reach my friends.'", "Der Vorteil ist, dass ich meine Freunde immer erreichen kann.", "Der Vorteil ist, dass… starts a dass-clause, so the verbs go to the end with the modal last: erreichen kann.", 3, { acc: ["Der Vorteil ist, dass ich immer meine Freunde erreichen kann.", "Der Vorteil ist, dass ich meine Freunde immer kontaktieren kann.", "Der Vorteil ist, dass ich immer meine Freunde kontaktieren kann.", ...["Der"].flatMap((a) => ["immer", "jederzeit", "stets"].flatMap((b) => ["erreichen", "kontaktieren"].flatMap((v) => [`${a} Vorteil ist, dass ich meine Freunde ${b} ${v} kann.`, `${a} Vorteil ist, dass ich ${b} meine Freunde ${v} kann.`])))] }),
          q11.multi("Which sentences are grammatically correct? Choose all that apply.", ["Weil ich müde war, bin ich früh ins Bett gegangen.", "Er sagt, dass er kein Handy hat.", "Nach dem Feuerwerk sind wir nach Hause gefahren."], ["Ich habe die App gestern herunterladet.", "Er sagt, dass er hat kein Handy."], "The wrong sentences use a wrong participle (heruntergeladen is correct) and verb-second order after dass (the verb must be last).", 3),
          q11.written(
            "Write 5–6 sentences in German about technology in your life and a festival you enjoy. Include one 'obwohl' or 'weil' clause, one 'dass' clause and one perfect-tense sentence.",
            "Ich benutze mein Handy jeden Tag, obwohl ich weiß, dass es viel Zeit kostet. Ich finde, dass soziale Medien praktisch sind, weil man mit Freunden in Kontakt bleiben kann. Einerseits sind sie unterhaltsam, andererseits können sie süchtig machen. Zu Weihnachten besuche ich mit meiner Familie den Weihnachtsmarkt in unserer Stadt. Letztes Jahr haben wir dort Kerzen gekauft und heiße Schokolade getrunken.",
            "Marking guide (12): correct verb-final order in the obwohl/weil clause (3); dass clause with verb last (3); perfect tense with correct auxiliary and participle (3); correct festival preposition, capitals and spelling (2); opinions and range (1).",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["das Passwort", "password"],
        ["die Sicherheit", "safety, security"],
        ["to download (separable verb)", "herunterladen: Perfekt = heruntergeladen"],
        ["süchtig", "addicted"],
        ["at Christmas", "zu Weihnachten"],
        ["der Weihnachtsmarkt", "Christmas market"],
        ["Where does the verb go after dass, weil, obwohl?", "To the end of the clause"],
        ["einerseits … andererseits", "on the one hand … on the other hand"],
        ["das Feuerwerk", "fireworks"],
        ["Meiner Meinung nach ist das gefährlich.", "In my opinion that is dangerous. (verb second)"],
      ]),
    },
  },
};

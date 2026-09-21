// German — Local, National & Global Areas of Interest (GCSE, Years 10 and 11). Original content aligned to the DfE GCSE modern foreign languages subject content (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q10 = qb("deloc", 10);
const q11 = qb("deloc", 11);

export const TOPIC: CTopic = {
  key: "deloc",
  topic: "Local, National & Global Areas of Interest",
  subject: "German",
  years: {
    10: {
      year: 10,
      subtopic: "GCSE Year 10",
      yearsCovered: [10],
      objectives: [
        "Describe your home, town and region and compare town and countryside.",
        "Use es gibt + accusative and kein/keine/keinen to say what a place has and lacks.",
        "Use two-way prepositions (in, an, auf, neben, vor, hinter, zwischen) with the dative for position and the accusative for movement.",
        "Talk about holidays, accommodation and travel in the perfect tense (with sein and haben).",
        "Understand short texts about places and give reasons with weil.",
      ],
      note: {
        title: "Year 10: home, town, region, travel and tourism",
        body: `## Vocabulary

| German | English |
| --- | --- |
| die Innenstadt | town centre |
| die Umgebung | surroundings |
| die Unterkunft | accommodation |
| die Jugendherberge | youth hostel |
| die Sehenswürdigkeit | tourist attraction |
| gegenüber (+ Dat.) | opposite |

## Es gibt + accusative

*Es gibt* is always followed by the **accusative**, so only masculine nouns change: *In unserer Stadt gibt es einen Bahnhof, eine Bibliothek und ein Schwimmbad.* Negative: *kein Kino, keine Bank, keinen Park.*

## Two-way prepositions

| Question | Case | Example |
| --- | --- | --- |
| **Wo?** (position) | dative | Das Café liegt **neben dem** Bahnhof. |
| **Wohin?** (movement) | accusative | Wir gehen **in die** Altstadt. |

The nine two-way prepositions are *in, an, auf, neben, vor, hinter, über, unter, zwischen*. Contractions: *im, am, ins, ans, aufs*. Use **nach** for cities and countries without an article: *nach Berlin, nach Italien*.

## Holidays in the perfect

Verbs of movement use **sein**: *Wir sind nach Wien gereist.* Most other verbs use **haben**: *Wir haben im Hotel gewohnt.*

## Model sentences

- **Das Dorf liegt in den Bergen, aber es gibt keinen Supermarkt.** The village is in the mountains, but there is no supermarket.
- **Am Wochenende fahre ich in die Stadt, weil ich dort meine Freunde treffe.** At the weekend I go into town because I meet my friends there.
- **Letzten Herbst haben wir in einer Jugendherberge übernachtet.** Last autumn we stayed overnight in a youth hostel.

Sound tip: **ch** after a, o, u, au is a throaty sound (Buch), but after i, e, ä, ö, ü it is softer (ich, Bücher); **sp** and **st** at the start of a word sound like "shp" and "sht".

## Common errors

- *Ich wohne in die Stadt* (position needs the dative: in der Stadt).
- *Es gibt ein Flughafen* (masculine accusative: einen Flughafen).
- *Ich bin in Frankreich gefahren* (use nach for movement to a place).`,
      },
      quiz: {
        title: "Local, National & Global Areas of Interest: Year 10 quiz",
        questions: [
          q10.single("What does 'die Sehenswürdigkeit' mean?", "tourist attraction", ["souvenir", "town hall", "tourist office"], "Sehenswürdigkeit comes from sehen (to see) and würdig (worthy): a sight worth seeing, i.e. a tourist attraction.", 1),
          q10.short("Translate into German, including the article: 'the youth hostel'.", "die Jugendherberge", "Die Jugendherberge is feminine (Herberge = inn, hostel).", 1, {}),
          q10.single("Choose the correct form: « In meinem Dorf gibt es ___ Supermarkt. »", "einen", ["ein", "einem", "eine"], "Es gibt is followed by the accusative, and der Supermarkt is masculine: einen Supermarkt.", 2, true),
          q10.single("Choose the correct form: « Wohin fahrt ihr am Samstag? – Wir fahren ___ Stadtmitte. »", "in die", ["in der", "in den", "im"], "The question asks wohin (movement towards), so in takes the accusative; Stadtmitte is feminine: in die Stadtmitte. In der Stadtmitte would answer wo? (where at).", 2),
          q10.single("Which word means 'opposite' (across from)?", "gegenüber", ["hinter", "zwischen", "neben"], "Gegenüber = opposite. Hinter = behind, zwischen = between, neben = next to.", 2),
          q10.single(
            "Read the text. How do the writer and friends get to the cinema?\n\n« Ich wohne in einer kleinen Stadt im Süden Deutschlands. Es gibt hier eine schöne Altstadt mit vielen Cafés, aber kein Kino. Für Jugendliche ist das nicht ideal, denn abends ist wenig los. Wenn wir ins Kino gehen wollen, müssen wir mit dem Zug in die nächste Großstadt fahren. Das dauert vierzig Minuten. Trotzdem gefällt mir das Leben hier, weil die Berge ganz in der Nähe sind. Im Winter fahre ich mit meinen Freunden Ski, und im Sommer wandern wir am Wochenende. In einer Großstadt möchte ich später nicht wohnen; sie ist mir zu laut. »",
            "By train to the next big city.",
            ["By bus to the mountains.", "By bike to the old town.", "By car to a nearby village."],
            "The text says: müssen wir mit dem Zug in die nächste Großstadt fahren. The mountains are where they ski and hike.",
            2, true,
          ),
          q10.short("Fill the gap with one word: « Letzten Sommer ______ wir nach Österreich gefahren. »", "sind", "Fahren is a verb of movement, so the perfect tense uses sein: wir sind gefahren.", 2),
          q10.multi("Which sentences are correct? Choose all that apply.", ["Ich wohne in der Innenstadt.", "Wir gehen ins Museum.", "Der Bus hält vor dem Rathaus."], ["Ich wohne in die Innenstadt.", "Der Bus hält vor das Rathaus."], "Position (wo?) takes the dative: in der Innenstadt, vor dem Rathaus. Movement (wohin?) takes the accusative: ins Museum.", 2),
          q10.single("Choose the correct forms: « Der Bahnhof liegt zwischen ___ Post und ___ Kino. »", "der Post und dem Kino", ["die Post und das Kino", "der Post und das Kino", "die Post und dem Kino"], "The position (wo?) needs the dative: die Post is feminine (der Post), das Kino is neuter (dem Kino).", 3),
          q10.short("Translate into German: 'There is a park next to our school.'", "Neben unserer Schule gibt es einen Park.", "Es gibt + accusative (einen Park, masculine); neben + dative for position, and Schule is feminine: neben unserer Schule.", 3, { acc: ["Es gibt einen Park neben unserer Schule.", "Es gibt neben unserer Schule einen Park.", "Neben unserer Schule ist ein Park.", "Neben unserer Schule liegt ein Park.", "Neben unserer Schule befindet sich ein Park.", "Ein Park ist neben unserer Schule.", "Ein Park liegt neben unserer Schule."] }),
          q10.single("Which sentence means 'Last year we travelled to Vienna'?", "Letztes Jahr sind wir nach Wien gefahren.", ["Letztes Jahr wir sind nach Wien gefahren.", "Letztes Jahr haben wir nach Wien gefahren.", "Letztes Jahr sind wir in Wien gefahren."], "Use nach for cities, sein for movement, and put the verb in second place after the time phrase: sind wir … gefahren.", 3),
          q10.written(
            "Write 5–6 sentences in German describing where you live and a recent holiday. Include 'es gibt' with the accusative, one two-way preposition and one perfect-tense sentence with sein.",
            "Ich wohne in einem Vorort von Manchester. In meiner Straße gibt es einen kleinen Park und eine Bäckerei, aber kein Kino. Das Stadtzentrum liegt zehn Minuten vom Bahnhof entfernt. Letzten Sommer sind wir nach Spanien geflogen und haben zwei Wochen in einer Ferienwohnung am Meer gewohnt. Jeden Tag sind wir an den Strand gegangen. Es hat mir sehr gut gefallen.",
            "Marking guide (12): es gibt with the correct accusative or kein-form (3); two-way preposition with the correct case (3); perfect tense with sein and a correct participle (3); word order, gender and noun capitals (2); range and detail (1).",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["die Innenstadt", "town centre"],
        ["die Umgebung", "surroundings"],
        ["accommodation", "die Unterkunft"],
        ["die Sehenswürdigkeit", "tourist attraction, sight"],
        ["Es gibt … takes which case?", "Accusative: es gibt einen Park, eine Bank, ein Kino"],
        ["Wo? (position) after in, an, auf, neben…", "Dative: neben dem Bahnhof"],
        ["Wohin? (movement) after in, an, auf…", "Accusative: in die Stadt"],
        ["Which preposition for cities and countries?", "nach: nach Berlin, nach Italien"],
        ["opposite (preposition + dative)", "gegenüber: gegenüber dem Rathaus"],
        ["Ich bin gereist / Ich habe gewohnt", "Movement uses sein; most other verbs use haben"],
      ]),
    },
    11: {
      year: 11,
      subtopic: "GCSE Year 11",
      yearsCovered: [11],
      objectives: [
        "Discuss environmental issues (climate change, recycling, transport, energy) and what should be done.",
        "Talk about social issues: charity, volunteering, homelessness and poverty.",
        "Make recommendations with sollen, müssen and können.",
        "Use um … zu and wenn ich … hätte, würde ich … to express purpose and hypotheses.",
        "Use für/gegen + accusative and sich engagieren für.",
      ],
      note: {
        title: "Year 11: environment, charity and global issues",
        body: `## Vocabulary

| German | English |
| --- | --- |
| die Umwelt | environment |
| der Klimawandel | climate change |
| der Müll | rubbish |
| erneuerbare Energien (pl.) | renewable energy |
| spenden | to donate |
| ehrenamtlich | as a volunteer |
| die Armut | poverty |
| die Obdachlosen (pl.) | homeless people |

## Saying what should be done

- **sollen** (should), **müssen** (must), **können** (can): the modal is in position 2, the infinitive goes last. *Wir sollten öfter den Bus nehmen.*
- **um … zu + infinitive** gives a purpose: *Um Geld zu sammeln, verkaufen wir Kuchen.* With a separable verb, *zu* goes between prefix and verb: *um früh aufzustehen* (from aufstehen), *um Strom einzusparen*.
- **Wenn ich reich wäre, würde ich ein Tierheim bauen.** *würde* + infinitive (at the end) is the everyday conditional.
- **für** and **gegen** always take the accusative: *Ich bin gegen Plastiktüten.*

## Model sentences

- **Ich spende regelmäßig Kleidung für Obdachlose.** I regularly donate clothes for homeless people.
- **Viele Menschen leben in Armut, obwohl es genug Essen gibt.** Many people live in poverty although there is enough food.
- **Wenn ich reich wäre, würde ich ein Tierheim bauen.** If I were rich, I would build an animal shelter.

Sound tip: **-ung** is said "oong" with a soft final "ng" (Verschmutzung), and **z** always sounds like "ts" (Zukunft, Zeit).

## Common errors

- *um zu Geld sammeln* (correct: um Geld zu sammeln).
- *Man muss nicht rauchen* means 'you don't have to smoke'; for 'must not' say *Man darf nicht rauchen*.
- *Wenn ich Geld habe würde* (verb order: Wenn ich Geld hätte, würde ich …).`,
      },
      quiz: {
        title: "Local, National & Global Areas of Interest: Year 11 quiz",
        questions: [
          q11.single("What does 'die Umwelt' mean?", "environment", ["energy", "traffic", "weather"], "Die Umwelt is the environment (um = around, Welt = world). The weather is das Wetter.", 1),
          q11.short("Translate into German (one word): 'to donate'.", "spenden", "Spenden = to donate, and die Spende is a donation.", 1, {}),
          q11.single("Which verb form completes the recommendation? « Man ______ weniger Auto fahren. » (One should drive less.)", "sollte", ["wollte", "konnte", "durfte"], "Sollte expresses what one ought to do. Wollte = wanted to, konnte = was able to, durfte = was allowed to.", 2),
          q11.single("Which sentence means 'We have to save energy'?", "Wir müssen Energie sparen.", ["Wir dürfen Energie sparen.", "Wir sparen Energie müssen.", "Wir müssen Energie gespart."], "A modal verb takes the second position and the infinitive goes to the end: Wir müssen Energie sparen. Dürfen means 'are allowed to'.", 2, true),
          q11.multi("Which phrases describe eco-friendly actions? Choose all that apply.", ["Müll trennen", "mit dem Fahrrad fahren", "Strom sparen"], ["Plastiktüten benutzen", "das Licht anlassen"], "Müll trennen = separate rubbish for recycling, Strom sparen = save electricity. Using plastic bags and leaving lights on are not eco-friendly.", 2),
          q11.single(
            "Read the text. Why does Jan think the experience is important?\n\n« Seit einem Jahr arbeite ich ehrenamtlich in einem Tierheim. Jeden Samstag gehe ich dorthin und gehe mit den Hunden spazieren. Manchmal muss ich auch die Katzen füttern oder die Käfige putzen. Das ist nicht immer angenehm, aber es macht mir Spaß, weil ich Tiere liebe. Meine Mutter findet, dass ich mehr lernen sollte, doch ich glaube, dass man auch durch praktische Arbeit viel lernt. Später möchte ich Tierarzt werden. Deshalb ist die Erfahrung für mich sehr wichtig. Nächsten Monat organisieren wir einen Flohmarkt, um Geld für neue Decken zu sammeln. »",
            "He wants to become a vet.",
            ["His mother told him to go.", "He gets paid for it.", "He wants to run a flea market."],
            "The text says: Später möchte ich Tierarzt werden. Deshalb ist die Erfahrung für mich sehr wichtig.",
            2, true,
          ),
          q11.short("Fill the gap with one word: « Ich engagiere mich ___ die Umwelt. »", "für", "Sich engagieren für + accusative means 'to be committed to / campaign for'.", 2, { na: true }),
          q11.single("What does 'die Obdachlosen' mean?", "homeless people", ["volunteers", "unemployed people", "refugees"], "Obdach = shelter, and -los = without: people without shelter, i.e. homeless people.", 2),
          q11.single("Which sentence is correct?", "Um die Umwelt zu schützen, sollten wir weniger Plastik benutzen.", ["Um die Umwelt zu schützen, wir sollten weniger Plastik benutzen.", "Um die Umwelt schützen, sollten wir weniger Plastik benutzen.", "Um zu die Umwelt schützen, sollten wir weniger Plastik benutzen."], "Um … zu + infinitive forms a clause in first position, so the main verb comes straight after the comma: sollten wir.", 3),
          q11.short("Translate into German: 'Many young people volunteer because they want to help.'", "Viele junge Leute arbeiten ehrenamtlich, weil sie helfen wollen.", "Weil sends the verb to the end of its clause, with the modal last: weil sie helfen wollen.", 3, { acc: ["Viele Jugendliche arbeiten ehrenamtlich, weil sie helfen wollen.", "Viele junge Menschen arbeiten ehrenamtlich, weil sie helfen wollen.", "Viele junge Leute engagieren sich ehrenamtlich, weil sie helfen wollen.", ...["junge Leute", "Jugendliche", "junge Menschen"].flatMap((s) => ["arbeiten ehrenamtlich", "engagieren sich ehrenamtlich", "arbeiten freiwillig", "engagieren sich freiwillig", "sind ehrenamtlich tätig"].flatMap((v) => ["helfen wollen", "helfen möchten"].map((t) => `Viele ${s} ${v}, weil sie ${t}.`)))] }),
          q11.single("Which sentence means 'If I had more time, I would volunteer'?", "Wenn ich mehr Zeit hätte, würde ich ehrenamtlich arbeiten.", ["Wenn ich mehr Zeit habe, würde ich ehrenamtlich arbeiten.", "Wenn ich mehr Zeit hätte, ich würde ehrenamtlich arbeiten.", "Wenn ich mehr Zeit hätte, arbeite ich ehrenamtlich."], "Use the subjunctive hätte in the wenn-clause and würde + infinitive in the main clause, which starts with its verb: würde ich.", 3),
          q11.written(
            "Write 5–6 sentences in German about an environmental or social problem and what should be done. Include 'sollen' or 'müssen', a 'weil' clause and a 'wenn ich … hätte/wäre, würde ich …' sentence.",
            "Der Klimawandel ist ein großes Problem, weil das Wetter immer extremer wird. Wir sollten weniger Auto fahren und öfter das Fahrrad oder den Bus benutzen. Außerdem müssen wir Strom sparen und Müll trennen. Ich engagiere mich in unserer Schule für die Umwelt: Wir sammeln jeden Monat Plastikmüll im Park. Wenn ich mehr Zeit hätte, würde ich auch für Obdachlose arbeiten.",
            "Marking guide (12): modal verb with infinitive at the end (3); weil clause with the verb last (3); wenn + hätte/wäre and würde + infinitive with correct order (3); vocabulary of the topic, spelling and capitals (2); opinion and detail (1).",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["die Umwelt", "environment"],
        ["der Klimawandel", "climate change"],
        ["der Müll", "rubbish"],
        ["to volunteer (adjective + arbeiten)", "ehrenamtlich arbeiten"],
        ["spenden", "to donate"],
        ["die Armut", "poverty"],
        ["Um … zu + infinitive", "in order to: Um Geld zu sammeln, verkaufen wir Kuchen."],
        ["Wenn ich reich wäre, würde ich …", "If I were rich, I would … (wäre/hätte + würde)"],
        ["für / gegen take which case?", "Accusative: für die Umwelt, gegen Plastik"],
        ["erneuerbare Energien", "renewable energy"],
      ]),
    },
  },
};

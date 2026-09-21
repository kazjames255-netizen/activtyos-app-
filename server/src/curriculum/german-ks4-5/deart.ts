// German — Artistic Culture (A-level, Years 12 and 13). Original content aligned to the DfE GCE modern foreign languages subject content (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q12 = qb("deart", 12);
const q13 = qb("deart", 13);

// All acceptable combinations for the 'sich informieren' translation (Y12 Q11).
const informAcc: string[] = [];
for (const s of ["junge Leute", "Jugendliche", "junge Menschen"])
  for (const a of ["hauptsächlich", "vor allem", "überwiegend", "meist"])
    for (const o of ["soziale Medien", "die sozialen Medien", "Social Media"])
      informAcc.push(`Viele ${s} informieren sich ${a} über ${o}.`);

export const TOPIC: CTopic = {
  key: "deart",
  topic: "Artistic Culture",
  subject: "German",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12",
      yearsCovered: [12],
      objectives: [
        "Discuss the media (press, television, streaming, social media), public-service broadcasting and the reliability of information.",
        "Discuss music and live culture: genres, festivals, streaming versus concerts, and the German musical heritage.",
        "Evaluate performances and media content with a range of adjectives.",
        "Use participles as adjectives, sowohl … als auch, weder … noch and je … desto.",
        "Use relative clauses with prepositions (der Sänger, über den alle sprechen).",
      ],
      note: {
        title: "Year 12: media, music and evaluating culture",
        body: `## Vocabulary

| German | English |
| --- | --- |
| die Berichterstattung | (news) coverage |
| der Sender | broadcaster, channel |
| das Publikum | audience |
| die Falschmeldung | false report, fake news |
| die Meinungsbildung | forming of opinions |
| öffentlich-rechtlich | public-service |

**Evaluating**: *mitreißend* (gripping), *anspruchsvoll* (demanding, high-quality), *unterhaltsam* (entertaining), *eintönig* (monotonous).

## Participles as adjectives

The present participle (-d) and past participle take normal adjective endings: *das laufende Programm* (the current programme), *das renovierte Theater*, *eine überzeugende Leistung* (a convincing performance).

## Pairs and patterns

- **sowohl … als auch** (both … and), **weder … noch** (neither … nor), **nicht nur … sondern auch**.
- **je + comparative … desto + comparative**: *Je früher man übt, desto besser spielt man.* The verb is last in the je-part and second in the desto-part.
- **Relative pronoun after a preposition**: the preposition governs the case: *der Sänger, über den alle sprechen* (über + accusative), *die Band, von der alle sprechen* (von + dative).

## Model sentences

- **Öffentlich-rechtliche Sender wie ARD und ZDF werden durch einen Rundfunkbeitrag finanziert.** Public-service broadcasters such as ARD and ZDF are financed by a licence fee.
- **Bach und Beethoven gehören zu den bekanntesten deutschen Komponisten.** Bach and Beethoven are among the best-known German composers.
- **Weder das Fernsehen noch die Zeitung erreicht alle jungen Leute.** Neither television nor the newspaper reaches all young people.

## Common errors

- *Je mehr Übung, desto mehr gut* (the comparative of gut is besser).
- *der Sänger, der alle sprechen* (the preposition is missing: über den).
- *eine überzeugender Leistung* (die Leistung: eine überzeugende Leistung).`,
      },
      quiz: {
        title: "Artistic Culture: Year 12 quiz",
        questions: [
          q12.single("What does 'die Schlagzeile' mean?", "headline", ["hit song", "editor", "advert"], "Die Schlagzeile is the headline of a newspaper article. A hit song is a Schlager, though the two words look similar.", 1),
          q12.short("Translate into German, with the article: 'advertising'.", "die Werbung", "Die Werbung is feminine and means advertising or an advert.", 1, { acc: ["Werbung"] }),
          q12.single("Which word means 'superficial'?", "oberflächlich", ["übertrieben", "überzeugend", "übersichtlich"], "Oberflächlich contains Oberfläche (surface). Übertrieben = exaggerated, überzeugend = convincing, übersichtlich = clearly laid out.", 2),
          q12.single("Choose the correct ending: « Das war ein ___ Konzert. » (impressive)", "beeindruckendes", ["beeindruckender", "beeindruckendem", "beeindruckend"], "Konzert is neuter; after ein in the nominative neuter the adjective takes -es: ein beeindruckendes Konzert.", 2, true),
          q12.single("Choose the correct pair: « Sowohl die Zeitung ___ das Fernsehen berichten darüber. »", "als auch", ["wie noch", "oder auch", "und noch"], "Sowohl … als auch means 'both … and'.", 2),
          q12.single(
            "Read the text. Why does the writer check important news on the pages of reputable broadcasters?\n\n« Mein Opa liest jeden Morgen die Zeitung und schaut abends die Nachrichten im Fernsehen. Ich dagegen informiere mich fast nur auf dem Handy. Das hat Vorteile: Ich kann Meldungen sofort lesen und sie mit Freunden teilen. Allerdings gibt es im Netz viele Falschmeldungen, und man weiß oft nicht, wer die Texte geschrieben hat. Deshalb überprüfe ich wichtige Nachrichten auf den Seiten seriöser Sender. Mein Opa sagt, dass er der Zeitung mehr vertraut, weil dort Journalisten arbeiten, deren Namen man kennt. Vielleicht hat er recht. »",
            "There are many false reports online.",
            ["Her grandfather told her to.", "She dislikes reading on a phone.", "The newspaper is too expensive."],
            "The text says: Allerdings gibt es im Netz viele Falschmeldungen … Deshalb überprüfe ich wichtige Nachrichten … The word Deshalb links the problem to her action.",
            2, true,
          ),
          q12.multi("Which words express a POSITIVE assessment? Choose all that apply.", ["mitreißend", "eindrucksvoll", "unterhaltsam"], ["langweilig", "eintönig"], "Mitreißend = gripping, eindrucksvoll = impressive, unterhaltsam = entertaining. Langweilig = boring and eintönig = monotonous are negative.", 2),
          q12.single("Which sentence is correct? 'The film was praised by the critics.'", "Der Film wurde von den Kritikern gelobt.", ["Der Film wurde von die Kritiker gelobt.", "Der Film hat von den Kritikern gelobt.", "Der Film wurde durch den Kritikern gelobt."], "The passive uses wurde + past participle, and von takes the dative plural: von den Kritikern.", 2),
          q12.single("Choose the correct relative pronoun: « Das Konzert, ___ ich gestern war, war ausverkauft. »", "auf dem", ["auf das", "das", "dessen"], "Auf einem Konzert sein is a position, so auf takes the dative; the pronoun agrees with the neuter noun Konzert: auf dem.", 3),
          q12.short("Fill the gap with one word: « Je mehr Menschen soziale Medien nutzen, ______ wichtiger werden sie für die Meinungsbildung. »", "desto", "The pattern je + comparative … desto (or umso) + comparative links two changes.", 3, { acc: ["umso"] }),
          q12.short("Translate into German using 'sich informieren': 'Many young people mainly get informed via social media.'", "Viele junge Leute informieren sich hauptsächlich über soziale Medien.", "Sich informieren über + accusative: the reflexive pronoun sich follows the verb and über takes the accusative.", 3, { acc: informAcc, na: true }),
          q12.written(
            "Write about 100 words in German on the influence of music or social media on young people. Use a relative clause with a preposition, a participle used as an adjective and either 'sowohl … als auch' or 'je … desto'.",
            "Musik spielt im Leben vieler Jugendlicher eine große Rolle. Die Künstler, von denen die Jugendlichen begeistert sind, entdecken sie meist im Internet. Sowohl Streamingdienste als auch soziale Medien beeinflussen, welche Künstler bekannt werden. Je mehr Menschen ein Lied teilen, desto schneller wird es populär. Ein beeindruckendes Konzert bleibt dagegen etwas Besonderes, weil man die Stimmung mit dem Publikum erlebt.",
            "Marking guide (15): relative clause with the correct preposition and case (3); participle as adjective with the right ending (2); sowohl … als auch or je … desto used correctly (3); verb position in subordinate clauses (3); range of media/music vocabulary and evaluation (2); spelling and capitals (2).",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["die Schlagzeile", "headline"],
        ["die Berichterstattung", "(news) coverage, reporting"],
        ["die Falschmeldung", "false report, fake news"],
        ["das Publikum", "audience"],
        ["mitreißend", "gripping, rousing"],
        ["anspruchsvoll", "demanding, of high quality"],
        ["sowohl … als auch", "both … and"],
        ["weder … noch", "neither … nor"],
        ["je … desto …", "the more … the more … (comparative in both parts)"],
        ["der Sänger, über den alle sprechen", "the singer everyone is talking about (preposition + relative pronoun)"],
      ]),
    },
    13: {
      year: 13,
      subtopic: "A-level Year 13",
      yearsCovered: [13],
      objectives: [
        "Discuss cultural heritage: World Heritage sites, museums, monument protection and how culture is funded.",
        "Describe festivals and regional traditions (Brauchtum) and their effect on tourism.",
        "Describe architecture and design (Fachwerkhaus, Bauhaus, Fassade) with precise vocabulary.",
        "Use nominal style, formal passives and modal passives in descriptions.",
        "Argue for and against public funding of culture using the structures of opinion and justification.",
      ],
      note: {
        title: "Year 13: heritage, traditions, architecture and funding culture",
        body: `## Vocabulary

| German | English |
| --- | --- |
| das Kulturerbe / das Welterbe | cultural heritage / World Heritage |
| der Denkmalschutz | protection of historic monuments |
| die Kulturförderung | funding of culture |
| die Subvention | subsidy |
| das Fachwerkhaus | half-timbered house |
| die Fassade | façade |
| das Bauhaus | design school founded in 1919 in Weimar |

## Nominal style

Written German often replaces a clause with a noun phrase and a genitive preposition: *Weil die Fassade restauriert wird, ist die Kirche gesperrt.* → *Aufgrund der Restaurierung der Fassade ist die Kirche gesperrt.* The genitive prepositions *wegen, aufgrund, trotz, während* take the genitive.

## Passive and modal passive

*Alte Gebäude sollten erhalten werden.* In a dass-clause the chain is last: *…, dass alte Gebäude erhalten werden sollten.*

## Separable verbs and formal verbs

*Die Stadt lädt zu einem Fest ein. Der Umzug findet am Sonntag statt.* Formal register also uses *stattfinden, bestehen aus, zählen zu*.

## Opinion and justification

*Ich bin der Ansicht, dass Museen für alle zugänglich sein müssen, weil Bildung ein Grundrecht ist.* In both dass and weil clauses the finite verb is last.

## Model sentences

- **Viele Bräuche werden von Vereinen und Freiwilligen gepflegt.** Many customs are kept alive by clubs and volunteers.
- **Die Stadt lädt jedes Jahr zu einem Fest ein, das an ihre Geschichte erinnert.** Every year the town invites people to a festival that recalls its history.

## Common errors

- *Aufgrund die hohen Kosten* (genitive: aufgrund der hohen Kosten).
- *…, dass Gebäude sollten erhalten werden* (verbs last: erhalten werden sollten).
- *Das Fest findet statt am Samstag* (the prefix goes to the end: findet am Samstag statt).`,
      },
      quiz: {
        title: "Artistic Culture: Year 13 quiz",
        questions: [
          q13.single("What does 'das Denkmal' mean?", "monument, memorial", ["museum", "exhibition", "mirror"], "Das Denkmal is a monument or memorial (from denken + Mal, a sign to remember). Der Denkmalschutz protects historic buildings.", 1),
          q13.short("Translate into German, with the article: 'the exhibition'.", "die Ausstellung", "Die Ausstellung comes from ausstellen (to display) and is feminine.", 1, { acc: ["Ausstellung"] }),
          q13.single("What does 'das Brauchtum' mean?", "customs and traditions", ["brewery", "tourism", "trade"], "Das Brauchtum (from Brauch = custom) means the customs and traditions of a region.", 2),
          q13.single("Choose the correct verb: « Die Altstadt von Bamberg ___ als Welterbe geschützt. »", "wird", ["wurden", "werden", "haben"], "Present passive, third person singular: die Altstadt wird geschützt.", 2),
          q13.multi("Which words are architectural terms? Choose all that apply.", ["das Fachwerkhaus", "die Fassade", "das Gebäude"], ["die Bühne", "das Publikum"], "Fachwerkhaus, Fassade and Gebäude describe buildings. Die Bühne (stage) and das Publikum (audience) belong to the theatre.", 2),
          q13.single(
            "Read the text. How is the museum kept going?\n\n« Am Rand unserer Stadt steht ein kleines Freilichtmuseum. Dort wurden alte Bauernhäuser aus der Region wieder aufgebaut, die sonst abgerissen worden wären. Besucher können sehen, wie die Menschen vor zweihundert Jahren gelebt haben. Im Sommer finden Handwerkstage statt, an denen man Brot backen oder Wolle spinnen darf. Das Museum wird zum Teil vom Land finanziert, aber ohne die vielen Freiwilligen könnte es nicht bestehen. Viele Schulklassen besuchen es, weil man Geschichte dort nicht nur lesen, sondern auch erleben kann. »",
            "Through regional funding and many volunteers.",
            ["Through ticket sales and school fees.", "Through a private company's sponsorship.", "Through donations from local farmers."],
            "The text says: Das Museum wird zum Teil vom Land finanziert, aber ohne die vielen Freiwilligen könnte es nicht bestehen.",
            2, true,
          ),
          q13.short("Fill the gap with one word: « Wegen ___ schlechten Wetters wurde das Fest abgesagt. »", "des", "Wegen takes the genitive; das Wetter is neuter, so des (schlechten) Wetters.", 2, {}),
          q13.single("Which sentence means 'The festival attracts thousands of tourists every year'?", "Das Fest zieht jedes Jahr Tausende von Touristen an.", ["Das Fest anzieht jedes Jahr Tausende von Touristen.", "Das Fest zieht an jedes Jahr Tausende von Touristen.", "Das Fest zieht jedes Jahr Tausende von Touristen."], "Anziehen is separable: the verb is in second place and the prefix an goes to the very end.", 2, true),
          q13.single("Which sentence is the best nominal version of 'Weil das Theater renoviert wird, bleibt es geschlossen'?", "Wegen der Renovierung des Theaters bleibt es geschlossen.", ["Wegen die Renovierung des Theaters bleibt es geschlossen.", "Wegen der Renovierung von Theater bleibt es geschlossen.", "Wegen des Renovierung des Theaters bleibt es geschlossen."], "Wegen takes the genitive: die Renovierung is feminine, so der Renovierung, followed by the genitive of the theatre: des Theaters.", 3),
          q13.single("Which sentence has the correct word order?", "Ich vertrete die Meinung, dass der Staat Theater subventionieren sollte, weil Kultur zur Bildung gehört.", ["Ich vertrete die Meinung, dass der Staat sollte Theater subventionieren, weil Kultur zur Bildung gehört.", "Ich vertrete die Meinung, dass der Staat Theater subventionieren sollte, weil Kultur gehört zur Bildung.", "Ich vertrete die Meinung, dass der Staat Theater sollte subventionieren, weil Kultur zur Bildung gehört."], "In both the dass-clause and the weil-clause the finite verb is last: … subventionieren sollte; … zur Bildung gehört.", 3),
          q13.short("Translate into German: 'Traditions must be preserved.'", "Traditionen müssen bewahrt werden.", "Modal passive: modal verb + past participle + werden at the end. Erhalten or gepflegt also works.", 3, { acc: ["Traditionen müssen erhalten werden.", "Traditionen müssen gepflegt werden.", "Man muss Traditionen bewahren.", "Man muss Traditionen erhalten.", "Man muss Traditionen pflegen.", ...["", "Die "].flatMap((a) => [...["bewahrt", "erhalten", "gepflegt", "beibehalten"].map((v) => `${a}Traditionen müssen ${v} werden.`), ...["bewahren", "erhalten", "pflegen", "beibehalten"].map((v) => `Man muss ${a.toLowerCase()}Traditionen ${v}.`)])], na: true }),
          q13.written(
            "Write about 100 words in German: should the state pay for theatres and museums? Give your opinion with 'Ich bin der Ansicht, dass …', use a nominal phrase with wegen/aufgrund + genitive and a modal passive.",
            "Ich bin der Ansicht, dass der Staat Theater und Museen finanziell unterstützen sollte. Aufgrund der hohen Kosten könnten viele Häuser sonst nicht überleben. Kultur muss für alle zugänglich sein, weil sie die Gesellschaft verbindet. Kritiker sagen, dass das Geld besser für Schulen ausgegeben werden sollte. Zwar ist Bildung wichtig, aber Kunst und Bildung gehören zusammen. Deshalb sollten kulturelle Einrichtungen weiterhin gefördert werden.",
            "Marking guide (15): opinion clause with dass and the verb last (3); nominal phrase with a genitive preposition and correct genitive endings (3); modal passive with the verb chain in the right order (3); vocabulary of heritage and funding (3); structure, connectors and spelling (3).",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["das Denkmal", "monument, memorial"],
        ["der Denkmalschutz", "protection of historic monuments"],
        ["das Brauchtum", "customs and traditions"],
        ["das Welterbe", "World Heritage"],
        ["die Kulturförderung", "funding of culture"],
        ["das Fachwerkhaus", "half-timbered house"],
        ["aufgrund / wegen + which case?", "Genitive: aufgrund der hohen Kosten"],
        ["Das Fest findet am Samstag statt.", "The festival takes place on Saturday. (separable: statt at the end)"],
        ["Alte Gebäude sollten erhalten werden.", "Old buildings should be preserved. (modal + participle + werden)"],
        ["Ich bin der Ansicht, dass …", "I am of the opinion that … (verb last)"],
      ]),
    },
  },
};

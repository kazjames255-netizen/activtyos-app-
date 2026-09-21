// German — Film & Literature (A-level, Years 12 and 13). Original content aligned to the DfE GCE modern foreign languages subject content (OGL v3.0).
// All film and story titles, synopses and extracts below are invented for ActivityOS.
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q12 = qb("defilm", 12);
const q13 = qb("defilm", 13);

// Acceptable variants for the Y13 'Der Autor will zeigen, dass …' translation.
const showAcc: string[] = [];
for (const who of ["Der Autor", "Die Autorin", "Der Schriftsteller", "Die Schriftstellerin"])
  for (const m of ["will", "möchte"])
    for (const [np, vs] of [["die Erinnerung", ["prägt", "formt", "gestaltet"]], ["Erinnerung", ["prägt", "formt", "gestaltet"]], ["die Erinnerungen", ["prägen", "formen", "gestalten"]], ["Erinnerungen", ["prägen", "formen", "gestalten"]]] as [string, string[]][])
      for (const id of ["die Identität", "Identität"])
        for (const v of vs) showAcc.push(`${who} ${m} zeigen, dass ${np} ${id} ${v}.`);

export const TOPIC: CTopic = {
  key: "defilm",
  topic: "Film & Literature",
  subject: "German",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12",
      yearsCovered: [12],
      objectives: [
        "Use precise film vocabulary (Regisseur, Drehbuch, Handlung, Schauplatz, Kameraführung, Schnitt).",
        "Summarise a plot in the present tense with sequencing words (zunächst, dann, schließlich).",
        "Describe characters, motives and development (sich entwickeln von … zu …).",
        "Use handeln von, es geht um, erzählen and indirect questions (Der Film zeigt, wie …).",
        "Evaluate a film with justified opinions.",
      ],
      note: {
        title: "Year 12: describing and evaluating film",
        body: `## Film vocabulary

| German | English |
| --- | --- |
| der Regisseur / die Regisseurin | director |
| das Drehbuch | screenplay |
| die Handlung | plot |
| die Hauptfigur / die Nebenfigur | main / minor character |
| der Schauplatz | setting |
| die Kameraführung / der Schnitt | camerawork / editing |
| der Höhepunkt | climax |

## Summarising

Use the **present tense** throughout. Useful patterns:

- *Der Film spielt in + dative*; *handelt von + dative*; *es geht um + accusative*; *erzählt die Geschichte + genitive*.
- Sequence: *zunächst, dann, danach, schließlich*.
- Change: *Die Figur entwickelt sich von einem Kind zu einem Erwachsenen.*
- Indirect question, verb last: *Der Film zeigt, wie ein Krieg eine Familie trennt / warum sie flieht.*
- Evaluation: *überzeugend, glaubwürdig, klischeehaft, berührend.* *Ich fand den Film gelungen, weil …*

## Model summary (invented film)

**„Sommer im Hochhaus“ erzählt die Geschichte eines zwölfjährigen Jungen, der im Sommer allein in der Stadt bleibt. Zunächst langweilt er sich, dann freundet er sich mit einer älteren Nachbarin an. Schließlich hilft er ihr, ihr Haus vor dem Abriss zu retten.**
*“Summer in the Tower Block” tells the story of a twelve-year-old boy who stays alone in the city during the summer. At first he is bored, then he becomes friends with an older neighbour. In the end he helps her to save her house from demolition.*

## Common errors

- *Der Film handelt über* (use handelt von).
- *Es geht von Liebe* (use es geht um + accusative).
- *Der Film zeigt, wie trennt ein Krieg eine Familie* (the verb goes last: wie ein Krieg eine Familie trennt).
- *sich entwickeln in* (use zu).`,
      },
      quiz: {
        title: "Film & Literature: Year 12 quiz",
        questions: [
          q12.single("What does 'der Regisseur' mean?", "director", ["producer", "actor", "screenwriter"], "Der Regisseur directs the film. The producer is der Produzent, the screenwriter is der Drehbuchautor.", 1),
          q12.short("Translate into German, with the article: 'the plot'.", "die Handlung", "Die Handlung (from handeln, to act) is the plot of a film or story.", 1, { acc: ["Handlung"] }),
          q12.single("Choose the correct word: « Der Film handelt ___ einer Familie im Winter. »", "von", ["um", "für", "an"], "Handeln von + dative means 'to be about'. Es geht um + accusative is the other common pattern.", 2, true),
          q12.single("Choose the correct word: « Es geht ___ Freundschaft und Verrat. »", "um", ["von", "über", "für"], "Es geht um + accusative means 'it is about'.", 2),
          q12.single(
            "Read the synopsis. Why does Malin's father want to give up?\n\n« Der Film „Die letzte Fähre“ spielt auf einer kleinen Nordseeinsel. Die sechzehnjährige Malin lebt dort mit ihrem Vater, der die einzige Fähre zum Festland steuert. Als die Reederei die Verbindung einstellen will, müssen beide entscheiden, ob sie die Insel verlassen. Malin will bleiben und kämpft mit den Nachbarn für die Fähre. Ihr Vater dagegen möchte aufgeben, weil er nach dem Tod seiner Frau nicht mehr kämpfen kann. Am Ende gelingt es der Insel, die Fähre zu retten, doch Malin geht trotzdem für ein Studium aufs Festland. »",
            "He can no longer fight after his wife's death.",
            ["He wants to leave the island for a new job.", "He is afraid of the sea.", "The neighbours have turned against him."],
            "The text says: weil er nach dem Tod seiner Frau nicht mehr kämpfen kann. Malin, not her father, wants to stay and fight.",
            2, true,
          ),
          q12.single("Which word means 'turning point'?", "der Wendepunkt", ["der Höhepunkt", "der Endpunkt", "der Standpunkt"], "Der Wendepunkt is the turning point (wenden = to turn). Der Höhepunkt is the climax.", 2),
          q12.multi("Which terms refer to TECHNIQUE (how the film is made)? Choose all that apply.", ["der Schnitt", "die Kameraführung", "die Filmmusik"], ["die Handlung", "die Nebenfigur"], "Editing, camerawork and score are techniques. The plot and the minor characters belong to the content.", 2),
          q12.single("Which word means 'finally, in the end' in a plot summary?", "schließlich", ["zunächst", "inzwischen", "außerdem"], "Schließlich = finally. Zunächst = at first, inzwischen = meanwhile, außerdem = besides.", 2),
          q12.single("Which sentence correctly describes the character's development?", "Im Verlauf des Films entwickelt sich Malin von einem schüchternen Mädchen zu einer selbstbewussten jungen Frau.", ["Im Verlauf des Films entwickelt sich Malin von einem schüchternen Mädchen zu eine selbstbewusste junge Frau.", "Im Verlauf des Films entwickelt sich Malin von ein schüchternes Mädchen zu einer selbstbewussten jungen Frau.", "Im Verlauf des Films entwickelt sich Malin von einem schüchternen Mädchen in eine selbstbewusste junge Frau."], "Sich entwickeln von + dative zu + dative: von einem schüchternen Mädchen zu einer selbstbewussten jungen Frau.", 3),
          q12.short("Translate into German: 'The film tells the story of a young woman who is looking for her brother.'", "Der Film erzählt die Geschichte einer jungen Frau, die ihren Bruder sucht.", "Erzählen die Geschichte + genitive (einer jungen Frau), and the relative clause has its verb last: die ihren Bruder sucht.", 3, { acc: ["Der Film erzählt von einer jungen Frau, die ihren Bruder sucht.", "Der Film handelt von einer jungen Frau, die ihren Bruder sucht.", "Der Film erzählt die Geschichte einer jungen Frau, die nach ihrem Bruder sucht.", ...["Der Film erzählt die Geschichte einer jungen Frau", "Der Film erzählt die Geschichte von einer jungen Frau", "Der Film erzählt von einer jungen Frau", "Der Film handelt von einer jungen Frau"].flatMap((h) => [`${h}, die ihren Bruder sucht.`, `${h}, die nach ihrem Bruder sucht.`])] }),
          q12.single("Which sentence is a correct indirect question?", "Der Film zeigt, wie sich die Beziehung zwischen Vater und Tochter verändert.", ["Der Film zeigt, wie verändert sich die Beziehung zwischen Vater und Tochter.", "Der Film zeigt, wie sich verändert die Beziehung zwischen Vater und Tochter.", "Der Film zeigt, wie verändert die Beziehung zwischen Vater und Tochter sich."], "In an indirect question introduced by wie the finite verb goes to the end: … wie sich die Beziehung … verändert.", 3),
          q12.written(
            "Write about 100 words in German summarising a film (real or invented). Use the present tense, 'handeln von' or 'es geht um', at least three sequencing words, one 'wie'/'warum' clause, and give an opinion with 'weil'.",
            "Der Film „Nachtzug nach Wien“ handelt von zwei Geschwistern, die heimlich zu ihrer Großmutter reisen. Zunächst wirkt die ältere Schwester sehr streng, aber im Verlauf der Reise entwickelt sie sich zu einer mutigen Beschützerin. Der Wendepunkt kommt, als der Zug plötzlich stehen bleibt. Schließlich erreichen sie Wien und finden ihre Großmutter. Der Film zeigt, wie sich die Beziehung der Geschwister verändert. Ich fand den Film überzeugend, weil die Kamera die enge Stimmung im Zug sehr gut zeigt.",
            "Marking guide (15): present tense and correct handeln von/es geht um (3); sequencing words and coherent structure (3); indirect question with the verb last (3); opinion with weil and evaluation vocabulary (3); accuracy of cases, endings and spelling (3).",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["der Regisseur", "director"],
        ["das Drehbuch", "screenplay"],
        ["die Hauptfigur / die Nebenfigur", "main character / minor character"],
        ["der Schauplatz", "setting, location"],
        ["die Kameraführung", "camerawork"],
        ["Der Film handelt von …", "The film is about … (von + dative)"],
        ["Es geht um …", "It is about … (um + accusative)"],
        ["zunächst … dann … schließlich", "first … then … finally"],
        ["sich entwickeln von … zu …", "to develop from … into …"],
        ["Der Film zeigt, wie sich die Figur verändert.", "The film shows how the character changes. (verb last)"],
      ]),
    },
    13: {
      year: 13,
      subtopic: "A-level Year 13",
      yearsCovered: [13],
      objectives: [
        "Use literary analysis vocabulary (Erzähler, Erzählperspektive, Motiv, Symbol, Metapher, Ironie, Zitat).",
        "Interpret the meaning of symbols, motifs and narrative perspective in short original texts.",
        "Structure an essay: introduction, argument, quotation, conclusion (Zusammenfassend lässt sich sagen, dass …).",
        "Report an author's intention (Der Autor will zeigen, dass …) and use quotation formulae (Im Text heißt es …).",
        "Use relative clauses with dessen/deren, conditional inversion and formal register.",
      ],
      note: {
        title: "Year 13: analysing literature and writing an essay",
        body: `## Analysis vocabulary

| German | English |
| --- | --- |
| der Erzähler / die Erzählperspektive | narrator / narrative perspective |
| der Ich-Erzähler | first-person narrator |
| der Autor / die Autorin | author |
| das Motiv / das Symbol | motif / symbol |
| die Metapher / der Vergleich / die Ironie | metaphor / simile / irony |
| das Zitat | quotation |

## Structuring an essay

- **Introduction**: *In der Kurzgeschichte „…“ von … geht es um …*
- **Argument**: *Auffällig ist …, Dies verdeutlicht …, Der Autor will zeigen, dass …*
- **Quotation**: *Im Text heißt es: „…“*
- **Conclusion**: *Zusammenfassend lässt sich sagen, dass …; Meines Erachtens …*

## Useful structures

- **Genitive relative pronouns**: *die Figur, deren Vater verschwunden ist* (feminine); *das Buch, dessen Titel schlicht ist* (masculine, neuter); plural *deren*.
- **Conditional inversion**: *Hätte sie geschwiegen, wäre alles anders gekommen.*
- **Reporting**: *Die Autorin möchte darauf aufmerksam machen, dass …*

## Model synopsis (invented text)

**In der Erzählung „Der leere Stuhl“ deckt eine alte Frau jeden Abend den Tisch für zwei Personen, obwohl ihr Mann seit Jahren tot ist. Die Erzählung zeigt, wie Erinnerung Trost und Last zugleich sein kann.**
*In the story “The Empty Chair” an old woman lays the table for two every evening although her husband has been dead for years. The story shows how memory can be comfort and burden at the same time.*

## Common errors

- *Im Text steht es* (Im Text heißt es).
- *die Frau, dessen Sohn* (feminine: deren Sohn).
- *Zusammenfassend ich denke* (Zusammenfassend denke ich, or Zusammenfassend lässt sich sagen …).`,
      },
      quiz: {
        title: "Film & Literature: Year 13 quiz",
        questions: [
          q13.single("What does 'der Erzähler' mean?", "narrator", ["the author of the book", "the reader of the story", "the hero of the story"], "Der Erzähler is the voice that tells the story. It can differ from the author (der Autor).", 1),
          q13.short("Translate into German, with the article: 'the author' (male).", "der Autor", "Der Autor is the male author; the female form is die Autorin. Der Schriftsteller is also correct.", 1, { acc: ["der Schriftsteller"] }),
          q13.single("Which narrator is this? « Ich stand am Fenster und wusste nicht, was ich sagen sollte. »", "Ich-Erzähler (first-person narrator)", ["auktorialer Erzähler (omniscient narrator)", "personaler Erzähler (third-person limited)", "neutraler Erzähler (neutral narrator)"], "The narrator speaks as a character using ich, so this is a first-person narrator.", 2, true),
          q13.single(
            "Read the extract. What does the umbrella most likely symbolise?\n\n« Der Regenschirm lag noch im Flur. Seit Monaten hatte niemand ihn berührt, so als könnte er sonst zerbrechen wie die Erinnerung an den Mann, dem er gehörte. Anna schaute ihn an, öffnete die Tür und ließ ihn stehen. »",
            "The memory of the man who is gone.",
            ["Anna's wish to travel far away.", "The rainy weather outside the flat.", "A birthday present meant for Anna."],
            "The umbrella belongs to a man who is no longer there; nobody touches it, as if it could break like the memory of him.",
            2, true,
          ),
          q13.single("Which word means 'summary'?", "die Zusammenfassung", ["die Zusammenarbeit", "die Zusammenkunft", "die Zusammensetzung"], "Die Zusammenfassung is a summary (zusammenfassen = to sum up). Zusammenarbeit = co-operation, Zusammenkunft = meeting.", 2),
          q13.single("Which phrase begins a conclusion in an essay?", "Zusammenfassend lässt sich sagen, dass …", ["Zunächst möchte ich kurz erwähnen, dass …", "Als Beispiel dient …", "Einerseits gibt es …"], "Zusammenfassend lässt sich sagen, dass … signals a conclusion. The other phrases introduce a point, an example or a contrast.", 2),
          q13.short("Fill the gap with one word: « Im Text ______ es: „Er sah sie nicht mehr an.“ »", "heißt", "Im Text heißt es introduces a quotation: 'the text says'.", 2, { na: true }),
          q13.multi("Which are figures of speech (Stilmittel)? Choose all that apply.", ["die Metapher", "der Vergleich", "die Ironie"], ["der Erzähler", "der Schauplatz"], "Metaphor, simile (Vergleich) and irony are stylistic devices; the narrator and the setting are elements of the story.", 2),
          q13.single("Which sentence means 'Had Jonas stayed, he would never have overcome his loneliness'?", "Wäre Jonas geblieben, hätte er seine Einsamkeit nie überwunden.", ["Wenn Jonas bleibt, hätte er seine Einsamkeit nie überwunden.", "Wäre Jonas geblieben, würde er seine Einsamkeit nie überwunden.", "Wenn Jonas geblieben hätte, wäre er seine Einsamkeit nie überwunden."], "Without wenn the verb comes first: Wäre … geblieben. The past subjunctive II in the main clause is hätte … überwunden (überwinden takes haben).", 3),
          q13.short("Translate into German: 'The author wants to show that memory shapes identity.'", "Der Autor will zeigen, dass die Erinnerung die Identität prägt.", "Dass sends the verb to the end: … dass die Erinnerung die Identität prägt.", 3, { acc: showAcc, na: true }),
          q13.single("Choose the correct relative pronoun: « Der Roman, ___ Autor unbekannt ist, wurde ein Bestseller. »", "dessen", ["deren", "welcher", "den"], "The genitive relative pronoun shows possession. Roman is masculine, so dessen Autor; deren would be used for a feminine or plural noun.", 3),
          q13.written(
            "Write about 100 words in German analysing a story or a scene (real or invented): identify a symbol or motif, comment on the narrator, use a quotation formula ('Im Text heißt es …'), one 'Der Autor will zeigen, dass …' sentence and finish with 'Zusammenfassend lässt sich sagen, dass …'.",
            "In der Kurzgeschichte „Der leere Stuhl“ geht es um eine alte Frau, die um ihren Mann trauert. Auffällig ist der Stuhl am Tisch, der als Symbol für die Erinnerung dient. Im Text heißt es, sie decke jeden Abend den Tisch für zwei Personen. Der Autor will zeigen, dass Trauer nicht einfach verschwindet. Der Ich-Erzähler, der die Frau beobachtet, wirkt dabei distanziert, und gerade das verstärkt die Wirkung. Zusammenfassend lässt sich sagen, dass die Erzählung Erinnerung als Trost und Last zugleich darstellt.",
            "Marking guide (15): correct analysis vocabulary and a well-explained symbol or motif (3); narrator/perspective comment (2); quotation formula and reporting with dass (3); essay structure with an introduction and conclusion formula (3); accuracy of cases, subjunctive I for indirect reports and spelling (2); register and cohesion (2).",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["der Erzähler", "narrator"],
        ["die Erzählperspektive", "narrative perspective"],
        ["das Symbol / das Motiv", "symbol / motif"],
        ["die Metapher / der Vergleich", "metaphor / simile"],
        ["Im Text heißt es: „…“", "The text says: “…” (quotation formula)"],
        ["Zusammenfassend lässt sich sagen, dass …", "In conclusion, it can be said that …"],
        ["Der Autor will zeigen, dass …", "The author wants to show that … (verb last)"],
        ["dessen / deren", "whose (masc./neut. genitive / fem. and plural genitive)"],
        ["Hätte sie geschwiegen, wäre alles anders gekommen.", "Had she stayed silent, everything would have turned out differently."],
        ["die Autorin", "the author (female)"],
      ]),
    },
  },
};

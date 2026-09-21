// German — Free Time (Year 8). Original content aligned to the DfE KS3 modern foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q8 = qb("deft", 8);

export const TOPIC: CTopic = {
  key: "deft",
  topic: "Free Time",
  subject: "German",
  years: {
    8: {
      year: 8,
      objectives: [
        "Talk about a wider range of free-time activities, with opinions and reasons.",
        "Say how often you do things with adverbs such as immer, oft, manchmal, selten and nie.",
        "Use the correct word order: verb second after a time expression, and adverbs after the subject.",
        "Make, accept and refuse an invitation (Hast du Lust …? / Wollen wir …?).",
      ],
      note: {
        title: "Year 8: Meine Freizeit",
        body: `## Activities

| German | English |
| --- | --- |
| Musik hören | to listen to music |
| fernsehen (separable) | to watch TV |
| Freunde treffen | to meet friends |
| ins Kino gehen | to go to the cinema |
| schwimmen / wandern / einkaufen gehen | to go swimming / hiking / shopping |
| Videospiele spielen | to play video games |
| Rad fahren / Skateboard fahren | to cycle / to skateboard |
| im Internet surfen | to surf the internet |
| Comics lesen | to read comics |

**ins** = *in das* (das Kino → ins Kino). Stem-changers: *ich treffe, du triffst, er trifft*; *ich fahre, du fährst*; *ich lese, du liest*; *ich sehe fern, er sieht fern*.

## How often?

immer (always) · oft (often) · manchmal (sometimes) · selten (rarely) · nie (never). Put them **after the verb and subject**: *Ich gehe selten schwimmen.* Add **jeden Tag** (every day), **am Wochenende** (at the weekend), **montags** (on Mondays).

## Opinions and invitations

- **Es macht (mir) Spaß** = it is fun. **Ich finde Wandern anstrengend** = I find hiking tiring.
- **Hast du Lust, ins Theater zu gehen?** = Do you fancy going to the theatre? (The **zu** comes right before the infinitive at the end.) **Wollen wir schwimmen gehen?** = Shall we go swimming?
- Accept: **Ja, gute Idee!** Refuse politely: **Leider kann ich nicht.** or **Ich habe keine Zeit** (I have no time), softened with **Tut mir leid** (I'm sorry).

## Model sentences

- Am Sonntag gehe ich manchmal wandern.
- Ich sehe selten fern, aber ich surfe oft im Internet.
- Wollen wir am Freitag Videospiele spielen? – Ja, gute Idee!

## Sound tip

**ö** in *hören* is a rounded "ay" with pursed lips; **ch** in *machen* is a rough sound at the back of the throat; **sp** at the start of *Spaß* is "shp"; **ä** in *fährst* is "air"; **w** in *wandern* is "v".

## Common mistakes

- Putting the verb third: **Am Wochenende gehe ich …**, not "Am Wochenende ich gehe …".
- Forgetting **zu** with a Lust-question: *Hast du Lust, … zu spielen?*
- Using the ich form for du: **du triffst / du fährst / du liest**, not "du treffe".`,
      },
      quiz: {
        title: "Free Time: Year 8 quiz",
        questions: [
          q8.single("What does 'manchmal' mean?", "sometimes", ["always", "rarely", "every day"], "Manchmal means sometimes. Immer is always and selten is rarely.", 1),
          q8.single("What does 'nie' mean?", "never", ["often", "now", "again"], "Nie means never, the opposite of immer (always).", 1),
          q8.single("What does 'Ich gehe ins Kino' mean?", "I go to the cinema.", ["I am in the cinema.", "I work at the cinema.", "I am buying a ticket."], "Ins Kino is 'into the cinema', so ich gehe ins Kino means I go to the cinema.", 1),
          q8.single("What does 'Am Wochenende gehe ich oft schwimmen' mean?", "At the weekend I often go swimming.", ["At the weekend I always go shopping.", "On weekdays I sometimes swim.", "At the weekend I never swim."], "Am Wochenende is at the weekend, oft is often and schwimmen gehen is to go swimming.", 2, true),
          q8.short("Complete: Ich ____ gern Musik. (I like listening to music.)", "höre", "The verb hören (to hear, to listen) ends in -e with ich.", 2, { na: true, diag: true }),
          q8.single("Which sentence correctly says 'On Saturday I often meet friends'?", "Am Samstag treffe ich oft Freunde.", ["Am Samstag ich treffe oft Freunde.", "Am Samstag treffe oft ich Freunde.", "Ich am Samstag treffe oft Freunde."], "The verb must be second: Am Samstag treffe ich …; the adverb oft comes after ich.", 3),
          q8.single("What does 'Hast du Lust, ins Kino zu gehen?' mean?", "Do you fancy going to the cinema?", ["Do you have a cinema ticket?", "Have you been to the cinema?", "Are you at the cinema?"], "Hast du Lust means do you feel like it, and ins Kino zu gehen means to go to the cinema.", 2),
          q8.single("What does 'Tut mir leid, ich habe keine Zeit' mean?", "Sorry, I don't have time.", ["Sorry, I am late.", "Yes, I have time.", "Thanks, it is a good idea."], "Tut mir leid is I'm sorry, and keine Zeit is no time.", 2),
          q8.multi("Which of these words say HOW OFTEN you do something? Choose all that apply.", ["immer", "manchmal", "nie"], ["heute", "morgen"], "Immer, manchmal and nie are frequency words. Heute (today) and morgen (tomorrow) say when.", 2),
          q8.single("'Ich gehe oft schwimmen, aber ich spiele nie Fußball. Am Sonntag lese ich manchmal.' Which statement is TRUE?", "The writer often swims but never plays football.", ["The writer never swims but often plays football.", "The writer reads every Sunday without fail.", "The writer sometimes swims and often plays football."], "Oft schwimmen is often swimming, nie Fußball is never football, and manchmal is only sometimes.", 3),
        ],
      },
      flashcards: cards([
        ["Musik hören", "to listen to music"],
        ["to watch TV", "fernsehen"],
        ["Freunde treffen", "to meet friends"],
        ["oft", "often"],
        ["rarely", "selten"],
        ["Es macht Spaß.", "It is fun."],
        ["Hast du Lust, schwimmen zu gehen?", "Do you fancy going swimming?"],
        ["Yes, good idea!", "Ja, gute Idee!"],
        ["Wollen wir wandern gehen?", "Shall we go hiking?"],
        ["du triffst", "you meet (du form of treffen)"],
      ]),
    },
  },
};

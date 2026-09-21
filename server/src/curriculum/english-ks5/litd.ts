// A-level English Literature — Drama (Years 12–13). Original content aligned to the DfE GCE AS/A-level subject content for English Literature.
// Public-domain plays (Shakespeare, Marlowe, Webster, Wilde, Ibsen's original) referenced; short quotations only where certain. Unseen extracts are ORIGINAL.
import type { CTopic } from "../types";
import { build, mu, sg, sh, wr } from "./_h";

export const TOPIC: CTopic = {
  key: "litd",
  topic: "English Literature — Drama",
  subject: "English",
  years: {
    12: {
      year: 12,
      objectives: [
        "Analyse tragic conventions: tragic hero, hamartia, peripeteia, catharsis, soliloquy, dramatic irony and blank verse.",
        "Explore how staging, stage directions and performance choices create meaning.",
        "Study Shakespeare's language and dramatic methods in context (Elizabethan and Jacobean theatre).",
        "Consider the challenge to convention in a modern realist drama such as Ibsen's A Doll's House.",
      ],
      note: {
        title: "Year 12: tragedy, Shakespeare and staging",
        body: `## Tragic conventions

Aristotle's *Poetics* describes tragedy as imitating a serious action that arouses pity and fear. Key terms:

| Term | Meaning |
| --- | --- |
| Tragic hero | A figure of high status whose fall matters |
| Hamartia | A flaw or error of judgement |
| Peripeteia | Reversal of fortune |
| Anagnorisis | Recognition or discovery |
| Catharsis | Emotional release felt by the audience |
| Soliloquy | A character alone speaks thoughts aloud |
| Aside | A brief remark to the audience |
| Dramatic irony | The audience knows more than a character |
| Blank verse | Unrhymed iambic pentameter |

Shakespeare usually gives high-status characters blank verse and lower-status or disturbed characters prose. A. C. Bradley's *Shakespearean Tragedy* (1904) emphasised the hero's flaw; later critics stress political and social forces.

**Staging** matters: entrances, silence, lighting, props, costume, space and the audience's position. Read stage directions and imagine performance choices, then explain their effect. Modern realist drama (Ibsen) brings tragedy into domestic settings and questions social convention.

## Model analytic paragraph

Data: "As flies to wanton boys are we to th' gods; / They kill us for their sport." (Gloucester, *King Lear*)

"Gloucester's simile reduces human beings to insects and the gods to careless children, so cruelty is casual rather than purposeful. The plural 'we' universalises his despair, while 'sport' suggests that suffering is entertainment. The bleak, end-stopped finality of the second line delivers a fatalistic view of the universe that challenges any belief in divine justice, and the audience sees this in the context of Lear's blinded world."`,
      },
      quiz: {
        title: "Drama: Year 12 quiz",
        questions: build("litd", 12, [
          sg("What is a soliloquy?", "A speech in which a character alone on stage speaks their thoughts aloud", ["A brief remark made to the audience that the other characters on stage cannot hear", "A private conversation between two lovers that the audience overhears", "A speech delivered by a chorus that comments on the action for the audience"], 0, "A soliloquy gives the audience access to a character's inner thoughts, since no other character hears them.", 1),
          sg("What does hamartia mean in relation to tragedy?", "A flaw or error of judgement that contributes to the hero's downfall", ["The audience's emotional release of pity and fear at the end of the play", "A sudden reversal of the hero's fortune at the play's turning point", "A scene of recognition in which the hero discovers the truth"], 2, "Hamartia is a term from Aristotle; catharsis is the audience's purging of emotion and peripeteia is reversal.", 1),
          sg("What is blank verse?", "Unrhymed iambic pentameter", ["Rhyming couplets", "Prose spoken in verse form", "Verse with no rhythm"], 1, "Blank verse has a regular rhythm but no end rhyme and is the standard verse form for Shakespeare's serious characters.", 1),
          sh("What is the term for the emotional purging that the audience feels at the end of a tragedy?", "catharsis", ["a catharsis", "catharsis.", "katharsis", "cathartic"], "Aristotle used 'catharsis' for the release of pity and fear that tragedy is meant to produce.", 2),
          sg("Macbeth asks 'Is this a dagger which I see before me, / The handle toward my hand?' What does the question form suggest?", "His disturbed mind and doubt about whether he can trust his own senses", ["That he is certain of what he sees and is calmly describing a real weapon", "That he is talking to another character who is holding the dagger out to him", "That he is amused by the dagger"], 3, "The rhetorical question shows uncertainty and hallucination, revealing his guilt and psychological strain.", 2, true),
          sg("Iago warns 'O, beware, my lord, of jealousy; / It is the green-eyed monster which doth mock / The meat it feeds on'. What is the effect?", "Jealousy is personified as a predatory creature, and there is irony because Iago is stirring Othello's jealousy", ["It shows Iago is genuinely jealous of Othello", "It describes Desdemona's cooking", "It is a plain, literal statement about a medical condition that Iago sincerely wants Othello to avoid, with no figurative language or irony"], 0, "The monster personification is vivid, but the warning is deceptive, because Iago aims to inflame the jealousy he names.", 2),
          sg("Othello repeatedly calls Iago 'honest'. Which technique does this create?", "Dramatic irony, because the audience knows Iago is deceiving him", ["Soliloquy, because Othello is alone", "Aside, because Othello turns to the audience to explain what he privately feels about Iago", "Blank verse, because the word is a noun"], 2, "The audience is aware of Iago's plotting, so Othello's trust in 'honest Iago' is painfully ironic.", 2, true),
          sg("What is peripeteia?", "A reversal of the hero's fortune", ["A speech spoken alone", "The hero's recognition of the truth", "A chorus of townspeople"], 1, "Peripeteia is Aristotle's term for the turning point, often linked to anagnorisis (recognition).", 2),
          mu("Which are typical conventions of Shakespearean tragedy?", ["A protagonist of high status", "A flaw or error leading to downfall", "Many deaths and a final restoration of order", "A festive ending with several marriages", "A purely domestic middle-class setting"], ["A protagonist of high status", "A flaw or error leading to downfall", "Many deaths and a final restoration of order"], "Festive marriages belong to comedy, and domestic middle-class settings are typical of later realist drama.", 2),
          sg("In Macbeth: 'Tomorrow, and tomorrow, and tomorrow, / Creeps in this petty pace from day to day'. Which reading is best?", "The repetition and slow, creeping rhythm imitate wearisome time and express Macbeth's despair and loss of meaning", ["The repetition shows excitement about the future", "It is a cheerful, optimistic speech about the next day's plans, showing that Macbeth is eager to continue ruling and looks forward to the future", "It is prose because it lacks a regular rhythm"], 3, "Triple repetition and the verb 'creeps' slow the line down, and 'petty pace' belittles time.", 3),
          sg("What is the most convincing dramatic significance of Nora's exit at the end of A Doll's House (1879)?", "She rejects the conventional role of wife and mother, and her decision defies the expected happy resolution for its time", ["She is thrown out by a tyrannical judge", "She is persuaded by her husband to stay, so the ending restores the family and confirms the marriage as a happy and secure one for both", "She returns to happily resume her old life"], 1, "The ending breaks with the well-made-play convention of reconciliation; it made the play controversial and influential.", 3),
          sg("Read this original extract.\n\n(The room is half-packed. A single trunk stands open. MARA folds a coat, unfolds it, folds it again. She does not look at JOSEPH, who has entered and remains by the door.)\nJOSEPH: You said Thursday.\nMARA: (to the coat) I said a great many things.\n\nWhich analysis is best?", "The stage directions build subtext: her repeated folding and refusal to look at him show avoidance, while the clipped dialogue leaves the conflict unspoken", ["The scene is a comic farce built on mistaken identity, with MARA and JOSEPH playing to the audience through exaggerated physical gags and asides", "MARA is delivering a soliloquy to the audience", "The scene is set in a public square and gives no clues about emotion"], 2, "Action and silence carry emotion; the line spoken 'to the coat' displaces the confrontation.", 3),
          wr("Lady Macbeth in Act 5 scene 1: \"Out, damned spot! out, I say!\" Write an analytical paragraph on how Shakespeare presents guilt in this moment, including one point about staging. (About 150 words.)", "Mark scheme (6): 2 marks for precise methods (imperatives and exclamations, repetition 'out', the shift into prose, the imagery of a stain that cannot be removed, the sleepwalking scene); 2 marks for interpretation of guilt as haunting and psychological, linking to earlier commands about washing blood, with reversal of her earlier control; 1 mark for a staging point (candle, hand-washing gesture, actor's voice, the watching Doctor and Gentlewoman as an on-stage audience); 1 mark for controlled writing with short quotations. Do not credit a plot summary.", 3),
        ]),
      },
      flashcards: [
        { front: "Hamartia", back: "The flaw or error of judgement that contributes to a tragic hero's downfall." },
        { front: "Peripeteia and anagnorisis", back: "Reversal of fortune, and recognition of the truth." },
        { front: "Catharsis", back: "The emotional release felt by the audience at the end of a tragedy." },
        { front: "Soliloquy vs aside", back: "Soliloquy: a character alone speaks thoughts aloud. Aside: a brief remark to the audience." },
        { front: "Dramatic irony", back: "The audience knows something that a character does not." },
        { front: "Blank verse", back: "Unrhymed iambic pentameter, the usual form of Shakespeare's serious speech." },
        { front: "Verse and prose in Shakespeare", back: "Verse for high status and formal speech; prose for lower status, informality or disturbed minds." },
        { front: "Bradley, 1904", back: "A. C. Bradley's Shakespearean Tragedy emphasised the hero's character and flaw." },
        { front: "Iago and 'honest'", back: "Othello's repeated 'honest Iago' creates dramatic irony." },
        { front: "A Doll's House (1879)", back: "Ibsen's realist drama ending with Nora leaving her family, which challenged Victorian expectations of marriage." },
      ],
    },
    13: {
      year: 13,
      objectives: [
        "Compare tragedy, revenge tragedy and comedy across periods: Jacobean, Restoration and Victorian drama.",
        "Analyse comic methods: wit, epigram, paradox, farce and satire of manners.",
        "Relate plays to theatre history (closure of theatres, actresses, changing audiences) and to contexts.",
        "Evaluate how performance and staging shape interpretation.",
      ],
      note: {
        title: "Year 13: Jacobean, Restoration and comic drama across periods",
        body: `## Periods and conventions

| Period or type | Key features |
| --- | --- |
| Morality play | Allegorical characters, good and bad angels, temptation and salvation |
| Revenge tragedy | Ghost, revenge, real or feigned madness, play within a play |
| Jacobean tragedy | Reign of James I (1603 to 1625); corruption, cruelty, complex characters |
| Restoration comedy | After 1660; witty, sexually frank comedy of manners |
| Comedy of manners | Satirises the manners of fashionable society |
| Farce | Absurd situations, mistaken identity |
| Epigram and paradox | Short, witty statements that reverse expectations |

**Theatre history:** the public theatres were closed by Parliament in 1642 and reopened in 1660 with the restored monarchy; women began to play female roles on the professional stage. Restoration audiences were smaller and more aristocratic.

**Comedy and tragedy overlap:** comic scenes may parody a serious plot, and tragicomic tone can deepen a play.

**Staging and interpretation:** the same lines can be performed as comic or chilling; explain how a director's choices affect meaning.

## Model analytic paragraph

Data: "Was this the face that launch'd a thousand ships, / And burnt the topless towers of Ilium?" (Marlowe, *Doctor Faustus*)

"Faustus's rhetorical question is delivered in elevated blank verse, turning Helen into a symbol of myth. The hyperbole of 'a thousand ships' and the adjective 'topless' magnify her beauty, while the question form shows him seeking reassurance that the illusion is real. The irony is tragic: he embraces a demonic spirit and, in doing so, deepens his damnation, so the poetry seduces both the audience and Faustus."`,
      },
      quiz: {
        title: "Drama: Year 13 quiz",
        questions: build("litd", 13, [
          sg("What does a comedy of manners chiefly do?", "Satirises the behaviour, wit and affectations of fashionable society", ["Retells a religious legend with allegorical figures of virtue and vice", "Shows a high-status hero's fall from greatness through a flaw", "Presents a ghost who demands revenge from a hesitating son"], 1, "Comedy of manners relies on witty dialogue and social satire, as in Congreve and Wilde.", 1),
          sg("Which event marks the start of the Restoration period in theatre?", "The return of Charles II in 1660 and the reopening of the theatres", ["The closure of the public theatres by order of Parliament in 1642, at the start of the Civil War", "The death of Shakespeare in 1616 and the publication of the First Folio in 1623", "The death of Queen Victoria in 1901"], 2, "The monarchy was restored in 1660; the public theatres, closed since 1642, reopened.", 1),
          sh("What word describes the mistaken use of a word for a similar-sounding one, named after a character in Sheridan's The Rivals?", "malapropism", ["a malapropism", "malapropisms", "malapropism.", "malaprop", "a malaprop"], "Mrs Malaprop's comic misuse of words gave the term its name.", 1),
          sg("Lady Bracknell says: 'To lose one parent, Mr. Worthing, may be regarded as a misfortune; to lose both looks like carelessness.' What is the comic effect?", "Deadpan inversion of moral expectation, satirising aristocratic callousness with epigrammatic wit", ["A sincere expression of sympathy", "A slapstick physical joke in which Lady Bracknell falls over, played for broad farce rather than for wit or satire of any kind", "A soliloquy on grief"], 0, "The witty reversal treats a personal tragedy as social carelessness, exposing her values.", 2, true),
          sg("In The Duchess of Malfi, the Duchess declares 'I am Duchess of Malfi still.' What does this show?", "Defiant dignity and an assertion of identity while under torture and threat", ["She has finally been persuaded to submit to her brothers' commands and to give up her wish to marry again", "She denies she is a duchess", "She is comically unaware of her situation"], 3, "The line asserts her status and will against attempts to break her.", 2),
          sg("Mephistophilis says 'Why this is hell, nor am I out of it.' What does he mean?", "Hell is not only a place but a state of separation from God that he carries with him", ["He is describing the physical prison in which Faustus is locked in Wittenberg, and is speaking literally about a room", "He is joking about the weather", "He has found a way to escape hell"], 1, "The line suggests that hell is a condition of deprivation and suffering, wherever one is.", 2),
          sg("Which is a morality-play convention found in Doctor Faustus?", "A Good Angel and a Bad Angel who represent the pull between salvation and damnation", ["A proviso scene in which two lovers negotiate the terms of their marriage with wit", "A festive marriage at the end that restores social order and rewards the hero", "A play performed entirely in prose, with no blank verse for the high-status characters"], 2, "Allegorical figures such as the Good and Bad Angels reflect the play's morality-play heritage.", 2, true),
          sg("In Congreve's The Way of the World, the 'proviso scene' shows:", "Mirabell and Millamant negotiating the terms of their marriage with wit", ["A ghost demanding revenge", "A duel between two rival brothers that ends in a dramatic reconciliation and a return of the family's estate", "A servant's confession"], 0, "The lovers set conditions for their marriage, showing witty equality and the comedy of manners.", 2),
          sg("After 1660 in English professional theatre, what change to casting became standard?", "Women played female roles", ["Boys played all female roles", "Masks were compulsory", "Women were banned from audiences"], 1, "Before 1642 boys played women's parts; after the Restoration actresses appeared.", 2),
          mu("Which are conventions of revenge tragedy?", ["A ghost or supernatural prompt to revenge", "Real or feigned madness", "A play within a play, as in The Spanish Tragedy and Hamlet", "A happy multiple-wedding ending", "A rural, pastoral setting"], ["A ghost or supernatural prompt to revenge", "Real or feigned madness", "A play within a play, as in The Spanish Tragedy and Hamlet"], "Revenge tragedy typically ends in bloodshed, not festive marriage, and is not pastoral.", 3),
          sg("Read this original Restoration-style exchange.\n\nLADY FLIGHT: I hear you have vowed never to marry, Sir Timothy.\nSIR TIMOTHY: Madam, I have vowed a great many things; the pleasure of the vow is that one need not keep it.\n\nWhich is the best analysis?", "Witty paradox delivered as epigram, satirising the insincerity of fashionable society", ["A serious, sincere oath that the audience is meant to trust as Sir Timothy's genuine moral position on marriage", "A soliloquy about death", "A prose speech in a tragic setting"], 2, "The joke is that the pleasure of a vow lies in breaking it, typical of comedy-of-manners cynicism.", 3),
          sg("Why might the comic scenes in Doctor Faustus be significant?", "They parody Faustus's ambition by showing his powers used for trivial pranks, undermining his grand aims", ["They prove that the play is a pure comedy with no serious content, and that Faustus is never really in danger of damnation", "They show Faustus repenting", "They have no link to the main plot"], 3, "The clowning and pranks contrast with his early boasts, exposing how far he has sunk.", 3),
          wr("Jack explains he was found in a handbag. Lady Bracknell replies: \"A handbag?\" (Wilde, The Importance of Being Earnest). Analyse how the dramatist and performer might create comedy in this moment. (About 150 words.)", "Mark scheme (6): 2 marks for methods (the repeated word turned into a question, incredulity, the absurdity of the object, class satire, the comic pause and tone); 2 marks for effects (revealing Lady Bracknell's snobbery and the farce of Jack's origins, epigrammatic understatement, audience delight in her absolute authority); 1 mark for a staging point (a deadpan delivery, timing, a gasp or stillness from the other characters); 1 mark for context (Victorian class anxieties about birth, Wilde's satire). Do not credit a retelling of the plot.", 3),
        ]),
      },
      flashcards: [
        { front: "Comedy of manners", back: "Comedy that satirises the wit, affectations and morals of fashionable society." },
        { front: "1642 and 1660", back: "Theatres closed by Parliament in 1642; reopened in 1660 at the Restoration." },
        { front: "Actresses", back: "After 1660 women played female roles on the English professional stage." },
        { front: "Malapropism", back: "Comic misuse of a similar-sounding word, named after Sheridan's Mrs Malaprop." },
        { front: "Epigram", back: "A short, witty saying that often contains a paradox, typical of Wilde." },
        { front: "Morality play", back: "Allegorical drama of temptation and salvation, with figures like Good and Bad Angels; an influence on Doctor Faustus." },
        { front: "Revenge tragedy conventions", back: "Ghost, revenge, madness, a play within a play, and a bloody ending." },
        { front: "Jacobean", back: "Relating to the reign of James I, 1603 to 1625." },
        { front: "The Duchess of Malfi", back: "Webster's Jacobean tragedy: 'I am Duchess of Malfi still' asserts her defiance." },
        { front: "Proviso scene", back: "Congreve's scene in The Way of the World where lovers negotiate marriage terms." },
      ],
    },
  },
};

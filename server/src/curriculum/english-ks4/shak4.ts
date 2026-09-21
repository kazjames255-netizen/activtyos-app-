// English GCSE — Shakespeare & Drama (Years 10–11). Original questions aligned to the DfE GCSE English Literature subject content
// (exam-board neutral). Y10: Macbeth and Romeo and Juliet. Y11: The Tempest and Much Ado About Nothing.
// Shakespeare is public domain; quotations are short and standard-text accurate.
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q10 = qb("shak4", 10);
const q11 = qb("shak4", 11);

export const TOPIC: CTopic = {
  key: "shak4",
  topic: "Shakespeare & Drama",
  subject: "English",
  years: {
    10: {
      year: 10,
      objectives: [
        "Read, understand and respond to Shakespeare’s Macbeth and Romeo and Juliet, connecting extracts to the whole play (AO1).",
        "Analyse how Shakespeare uses language, form and structure (soliloquy, verse, imagery, foreshadowing) to create meaning (AO2).",
        "Explore themes such as ambition, guilt, fate, love and conflict, and how characters develop.",
        "Show understanding of the contexts in which the plays were written and first performed (AO3).",
        "Use accurate, well-chosen short quotations to support a personal interpretation.",
      ],
      note: {
        title: "Year 10: Macbeth and Romeo and Juliet: themes, language and context",
        body: `## Reading a Shakespeare play

Build each paragraph with **PEEL** (point, evidence, explain, link).

Ask: **What happens? Who changes? What ideas are explored? Why did Shakespeare write it this way for this audience?**

| Term | Meaning |
| --- | --- |
| Tragedy | A play in which the hero’s flaw or fate leads to downfall |
| Soliloquy | A character alone on stage voicing their thoughts |
| Aside | A remark to the audience unheard by others on stage |
| Foreshadowing | Hints at what will happen later |
| Dramatic irony | The audience knows more than the characters |
| Blank verse | Unrhymed iambic pentameter, used by high-status characters |

## Context to know

- ***Macbeth*** (first performed around 1606): written in the reign of **James I**, who was interested in witchcraft and believed in the **divine right of kings**. The **Gunpowder Plot (1605)** made regicide a very real fear.
- ***Romeo and Juliet*** (written around 1595): set in Verona, in a **patriarchal** society where fathers often arranged marriages. Shakespeare based it on Arthur Brooke’s 1562 poem.

## Worked model paragraph

*Shakespeare presents Lady Macbeth’s ruthlessness in her soliloquy. Her plea “Come, thick night, / And pall thee in the dunnest smoke of hell” asks the night to conceal her deed. The imperative “Come” shows her taking command, and the image of the “dunnest smoke of hell” suggests she associates her plan with darkness and evil. The audience feels uneasy, because a woman who invites darkness seems dangerously determined.*

Notice how one imperative verb and one contrast carry the analysis, and the paragraph ends on the audience’s response.`,
      },
      quiz: {
        title: "Shakespeare & Drama: Year 10 quiz",
        questions: [
          q10.single("In Macbeth, who first tells Macbeth that he will become king?", "The three witches", ["Banquo", "King Duncan", "Lady Macbeth, his wife"], "The witches greet Macbeth as Thane of Glamis, Thane of Cawdor and “king hereafter”, which starts his ambition.", 1),
          q10.single("In which monarch’s reign was Macbeth most likely written and first performed?", "James I", ["Elizabeth I", "Henry VIII", "Charles I"], "Macbeth dates from about 1606, soon after James I took the throne in 1603. He was fascinated by witchcraft and traced his ancestry to Banquo.", 1),
          q10.single("Lady Macbeth advises her husband: “Look like th’ innocent flower, / But be the serpent under ’t.” What does this suggest?", "He should hide his deadly intentions behind a friendly, innocent appearance", ["He should show his ambition openly, so that everyone at court knows what he wants", "He should be honest with King Duncan and confess his dark thoughts to him at once", "He should leave the castle before Duncan arrives, so that he is not tempted"], "The flower and serpent contrast appearance and reality, pointing to the theme of deceit. She urges him to look welcoming while planning murder.", 2, true),
          q10.multi("Which THREE are important themes in Macbeth?", ["Ambition and its consequences", "Guilt and conscience", "Fate and the supernatural"], ["Colonial exploitation of a native people", "The joy of a country pastoral life"], "Macbeth explores unchecked ambition, guilt after the murders and the influence of the witches’ prophecies.", 2),
          q10.single("Lady Macbeth’s sleepwalking words include “Out, damned spot!” How does blood work as a symbol in the play?", "It represents guilt that cannot be washed away, even (as Macbeth fears) by “all great Neptune’s ocean”", ["It represents family loyalty and pride, as the Macbeths shed blood to protect their line", "It only reminds the audience of the bloody battle setting at the start of the play", "It represents Macbeth’s growing wealth and the rich reward of becoming king"], "Both Macbeth and Lady Macbeth are haunted by blood, so it becomes a symbol of lasting guilt rather than mere violence.", 3),
          q10.single("Macbeth says he has “no spur / To prick the sides of my intent, but only / Vaulting ambition”. What does the horse-riding imagery suggest?", "His only motive is ambition, imagined as a rider leaping too far and risking a fall", ["He is going hunting with Banquo and needs a horse to ride across the Scottish moors", "He is afraid of horses and refuses to ride them into battle against the rebels", "He wants to become a knight and to ride a horse in a grand royal procession"], "A spur drives a horse on. Macbeth admits he has no good reason to kill, only ambition that may overreach and cause his downfall.", 3),
          q10.short("What term describes a speech in which a character alone on stage reveals their thoughts to the audience? (one word)", "soliloquy", ["Soliloquy", "a soliloquy", "soliloquy.", "a soliloquy."], "In a soliloquy the audience hears a character’s private thoughts, which is how we see Macbeth’s inner conflict.", 1),
          q10.single("The Prologue to Romeo and Juliet calls them “A pair of star-cross’d lovers” who “take their life”. What is the effect of telling the audience this at the start?", "It tells us the lovers will die, so the tragedy feels fated", ["It hides the ending to keep the audience guessing until the last scene", "It promises a happy ending for the two families after a difficult time", "It shows that the play is a light comedy and that nothing bad will happen"], "Knowing the outcome makes every hopeful moment poignant and stresses the role of fate.", 2),
          q10.single("Juliet says: “What’s in a name? That which we call a rose / By any other name would smell as sweet.” What is her argument?", "Names are just labels: Romeo is the same person whether or not he is a Montague", ["Roses are her favourite flower, and she wants Romeo to bring her some", "A Montague name is a great honour that Romeo should be proud to keep", "She has forgotten Romeo’s name and is asking the audience to remind her tonight"], "She argues that a name does not change what someone is, so the family feud should not separate them.", 2, true),
          q10.single("Which event leads directly to Romeo’s banishment from Verona?", "He kills Tybalt after Mercutio’s death", ["He kills Paris in the tomb", "He marries Juliet in secret", "He attends the Capulet feast uninvited"], "Romeo avenges Mercutio by killing Tybalt in a street fight. The Prince banishes him rather than executing him.", 2),
          q10.single("Friar Laurence warns Romeo: “Wisely and slow; they stumble that run fast.” Which theme does this highlight?", "The danger of haste and impulsive passion", ["The importance of winning a fight", "The value of running away from problems as fast as one can", "The need to obey the Prince"], "The Friar urges caution, but the lovers’ fast decisions lead to disaster. The play repeatedly links haste to tragedy.", 2),
          q10.single("Which is the best comment linking context to a moment in Romeo and Juliet?", "Capulet expects Juliet to obey his choice of husband, reflecting a society where fathers commonly controlled daughters’ marriages, so her secret marriage is an act of rebellion", ["Juliet is nearly fourteen, the play was written in the 1590s, Shakespeare was born in Stratford-upon-Avon in 1564, and the story is set in Verona, which is a city in northern Italy", "Shakespeare wrote many plays in his lifetime, including comedies, histories and tragedies, and Romeo and Juliet is one of the tragedies, which means that it ends with deaths", "Verona is a real city in Italy that has a famous balcony, and many tourists visit it today because of the play, which shows how popular Shakespeare still is"], "Strong contextual writing explains how a social background shapes a moment. The other options list facts without linking them to meaning.", 3),
          q10.written("How does Shakespeare present ambition in Macbeth? Write ONE analytical PEEL paragraph (about 100–120 words) using a short quotation of your choice.", "A strong answer makes a clear point about ambition, embeds a short quotation (e.g. “Vaulting ambition”), analyses language or imagery, and links to the play’s themes or context (kingship, the supernatural).", "Mark scheme (8 marks, plain-language AO1/AO2/AO3): 2 marks for a clear point and personal interpretation; 2 marks for a well-chosen, accurate quotation; 3 marks for analysing Shakespeare’s methods (word choice, imagery, soliloquy, structure) with terminology; 1 mark for a link to context (Jacobean attitudes to kingship, order or witchcraft) or to the whole play.", 3, 8),
        ],
      },
      flashcards: cards([
        ["“Fair is foul, and foul is fair”", "Macbeth (the witches): appearance versus reality; moral confusion."],
        ["“Is this a dagger which I see before me”", "Macbeth: guilt and a disturbed mind, shown in a soliloquy before Duncan’s murder."],
        ["“Look like th’ innocent flower, / But be the serpent under ’t”", "Lady Macbeth: deceit; appearance versus reality."],
        ["“Out, damned spot!”", "Lady Macbeth: overwhelming guilt; blood as a symbol."],
        ["“A pair of star-cross’d lovers take their life”", "Romeo and Juliet Prologue: fate; the tragic ending is announced."],
        ["“My only love sprung from my only hate!”", "Juliet: love and hate, and the feud that divides the lovers."],
        ["“These violent delights have violent ends”", "Friar Laurence: foreshadowing; the danger of extreme passion."],
        ["Macbeth: context", "James I, the divine right of kings, the Gunpowder Plot (1605), interest in witchcraft."],
        ["Romeo and Juliet: source", "Based on Arthur Brooke’s poem The Tragicall Historye of Romeus and Juliet (1562)."],
        ["Dramatic irony", "The audience knows something the characters do not."],
      ]),
    },
    11: {
      year: 11,
      objectives: [
        "Read, understand and respond to The Tempest and Much Ado About Nothing, moving from extract to whole play (AO1).",
        "Analyse Shakespeare’s methods: verse and prose, imagery, structure, dramatic irony and genre (AO2).",
        "Trace character development and the exploration of themes such as power, forgiveness, deception and love.",
        "Relate the plays to their contexts, including colonial voyages, Jacobean and Elizabethan values, and comic conventions (AO3).",
        "Evaluate a character’s significance and use precise, embedded quotations.",
      ],
      note: {
        title: "Year 11: The Tempest and Much Ado About Nothing: methods and interpretation",
        body: `## From extract to whole play

Build each paragraph with **PEEL** (point, evidence, explain, link).

Start with the extract, zoom in on words, then **zoom out**: how does this moment link to the play’s wider ideas, structure and character journeys?

| Term | Meaning |
| --- | --- |
| Tragicomedy / late romance | A play mixing serious threats with a reconciling ending (*The Tempest*) |
| Comedy | A play ending in marriage and restored order (*Much Ado*) |
| Prose vs verse | Prose is often used for everyday or comic talk; verse for formal, high-status speech |
| Subplot | A secondary storyline that mirrors or contrasts the main one |
| Repartee | Quick, witty exchanges |
| Masque | A courtly entertainment with music, spectacle and allegory |

## Context to know

- ***The Tempest*** (about 1610–11): written as England’s voyages and settlements grew, with a shipwreck reflecting the 1609 wreck of the Sea Venture. Modern critics often read Prospero, Ariel and Caliban through **colonialism**.
- ***Much Ado About Nothing*** (about 1598–99): set in Messina; a comedy of **wit, gossip and deception**, in which reputation, especially a woman’s honour, is fragile.

## Worked model paragraph

*Shakespeare uses dramatic irony in Ariel’s song. When Ferdinand hears “Full fathom five thy father lies”, he believes his father drowned, yet the audience knows Alonso is alive. The gentle imagery of “sea-change / Into something rich and strange” sounds beautiful, but it is a piece of deception that shows Prospero’s control over what others see and feel.*

The paragraph names a device, explains what the audience knows, and links to the theme of control.`,
      },
      quiz: {
        title: "Shakespeare & Drama: Year 11 quiz",
        questions: [
          q11.single("In The Tempest, who is Prospero?", "The rightful Duke of Milan, exiled to an island by his brother Antonio", ["A shipwrecked sailor from Naples who is hoping to be rescued by a passing ship", "The king of Naples’ jester, who sails with the royal party to Tunis", "The native ruler of the island, who was there long before the Europeans arrived"], "Prospero was usurped by Antonio and left to drift with baby Miranda. He then rules the island with magic.", 1),
          q11.short("What is the name of the spirit who serves Prospero and is promised freedom? (one word)", "Ariel", ["ariel", "Ariel."], "Ariel carries out Prospero’s magic and is released at the end of the play.", 1),
          q11.single("Caliban says: “You taught me language, and my profit on’t / Is, I know how to curse.” Which reading is most convincing?", "He resents the coloniser: language is now a tool of control", ["He is thanking Prospero warmly for his kindness in teaching him to speak", "He is proudly showing that he can quote poetry and write in fine language", "He is describing his great love of learning and wish to study more books"], "The bitter tone links to the colonial reading of the play, where language is a way of imposing power.", 2, true),
          q11.single("Which real event is often linked to the inspiration for the shipwreck in The Tempest?", "The 1609 wreck of the Sea Venture on Bermuda on its way to Virginia", ["The Great Fire of London, which destroyed much of the city in 1666", "The defeat of the Spanish Armada by Elizabeth I’s navy in 1588, decades earlier", "The sinking of a river ferry on the Thames near the Globe Theatre"], "Accounts of the Sea Venture’s survival reached England around 1610 and are widely thought to have influenced the play.", 2),
          q11.single("In Act 5 Prospero says: “The rarer action is / In virtue than in vengeance.” Which best evaluates its significance?", "It marks a turning point: with power to punish, he chooses mercy and regains his humanity", ["It shows that he plans a cruel revenge on Antonio and his fellow conspirators", "It shows that he has lost his magic by accident and can no longer control anyone", "It shows that he is bored with his island and wants to sail home to Milan at once"], "The line shows Prospero’s growth from anger and control to forgiveness, which resolves the play’s conflict.", 3),
          q11.single("Prospero says: “We are such stuff / As dreams are made on, and our little life / Is rounded with a sleep.” What idea does this express?", "Life is brief and insubstantial, like a dream", ["Life is a long and heavy struggle", "Sleep is a punishment for the guilty", "Dreams are more real than the waking world for everyone"], "“Rounded with a sleep” means life is framed by sleep, both before birth and after death, so life seems short and illusory.", 2),
          q11.multi("Which THREE statements about The Tempest are true?", ["It is set almost entirely on a remote island", "Ferdinand and Miranda fall in love", "It ends with Prospero giving up his magic"], ["Caliban kills Prospero", "Miranda marries Caliban"], "Prospero renounces his “rough magic”, the young lovers unite the families, and no one is killed.", 1),
          q11.single("In Much Ado About Nothing, what makes Claudio reject Hero at the altar?", "Don John’s trick makes him believe Hero was unfaithful", ["Hero refuses to marry him because she loves another man at the court", "Beatrice tells him to leave and reject the match in front of everyone", "Leonato disapproves of the match and stops the wedding before it can start"], "Don John and Borachio stage a scene in which Margaret, dressed as Hero, appears at Hero’s window, and Claudio is deceived.", 2, true),
          q11.single("How do Beatrice and Benedick come to admit their love?", "Friends stage overheard conversations in which each is told the other is secretly in love", ["They meet again after years apart and realise that their old feelings remain", "They are forced to marry by their families after Don John makes a false claim", "Don John tells them the truth about each other in an honest private conversation"], "The “gulling” scenes play on eavesdropping and comic deception, and they show that gossip can also do good.", 2),
          q11.single("Beatrice says: “I had rather hear my dog bark at a crow than a man swear he loves me.” What does this suggest about her character?", "She is witty, independent and sceptical of flattery and romantic promises", ["She is afraid of dogs and dislikes the noise of birds such as crows in the garden", "She is madly in love with Claudio and cannot wait to be his wife", "She is shy and quiet, and rarely speaks to anyone at Leonato’s house"], "The comic comparison shows sharp wit and a refusal to be impressed by love talk.", 2),
          q11.single("The title Much Ado About Nothing plays on a pun. What is it?", "“Nothing” sounded like “noting”, hinting at how overhearing and rumour drive the plot", ["It means the play has no real plot and simply shows people doing nothing", "It refers to the nickname of the villain, Don John, whom others call Nothing", "It is a phrase taken directly from a famous Roman comedy that Shakespeare admired"], "“Noting” means noticing or eavesdropping. Misreading what is noted causes the plot’s trouble.", 3),
          q11.single("When Hero is disgraced, Beatrice tells Benedick: “Kill Claudio.” What does this moment show?", "Her fierce loyalty to Hero and anger at injustice, turning the comedy serious", ["That she wants Claudio to marry her", "That she is joking with Benedick to test how well he understands her humour", "That she has been tricked by Don John into believing that Claudio is innocent"], "The demand tests Benedick’s love and shows Beatrice acting on principle. The mood turns serious.", 3),
          q11.written("How does Shakespeare present power and control in The Tempest? Write ONE analytical PEEL paragraph (about 100–120 words) using a short quotation of your choice.", "A strong answer makes a clear point about power (e.g. Prospero over Caliban, Ariel or the shipwrecked), embeds a short quotation, analyses language or dramatic method, and links to context (colonialism) or the play’s ending.", "Mark scheme (8 marks, plain-language AO1/AO2/AO3): 2 marks for a clear point and personal interpretation; 2 marks for an accurate, well-chosen quotation; 3 marks for analysing methods (imperatives, imagery, structure, dramatic irony) with terminology; 1 mark for a contextual or whole-play link.", 3, 8),
        ],
      },
      flashcards: cards([
        ["“We are such stuff / As dreams are made on”", "The Tempest (Prospero): life is brief and dreamlike; illusion versus reality."],
        ["“This thing of darkness I / Acknowledge mine”", "The Tempest (Prospero): taking responsibility for Caliban; forgiveness and reconciliation."],
        ["“You taught me language, and my profit on’t / Is, I know how to curse”", "The Tempest (Caliban): colonial resentment; language as power."],
        ["“O brave new world, / That has such people in’t!”", "The Tempest (Miranda): innocence and wonder, with dramatic irony as the audience knows the people’s flaws."],
        ["“The rarer action is / In virtue than in vengeance”", "The Tempest (Prospero): mercy over revenge; character development."],
        ["“I had rather hear my dog bark at a crow than a man swear he loves me”", "Much Ado (Beatrice): wit, independence and scepticism about love."],
        ["“Kill Claudio.”", "Much Ado (Beatrice): loyalty to Hero; a turn towards near-tragedy."],
        ["“Sigh no more, ladies, sigh no more, / Men were deceivers ever”", "Much Ado (Balthasar’s song): a comic warning about men’s deception, echoing the play’s theme."],
        ["Much Ado: title pun", "“Nothing” sounded like “noting”: observing, overhearing and rumour drive events."],
        ["Prose and verse in Much Ado", "Beatrice and Benedick mostly speak in prose, suiting quick, witty, everyday exchanges."],
      ]),
    },
  },
};

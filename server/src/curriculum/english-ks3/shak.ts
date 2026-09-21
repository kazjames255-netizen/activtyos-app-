// KS3 English — Shakespeare & Drama (Years 7–9). Quotations are short and public domain; attributions (speaker, act/scene) are checked skeptically.
// Aligned to the DfE KS3 English programme of study (OGL v3.0). Quotations are checked in _check_e3.ts.
import type { CTopic } from "../types";
import { qb, cards } from "./_b";

const q7 = qb("shak", 7), q8 = qb("shak", 8), q9 = qb("shak", 9);

export const TOPIC: CTopic = {
  key: "shak",
  topic: "Shakespeare & Drama",
  subject: "English",
  years: {
    7: {
      year: 7,
      objectives: [
        "Study at least two plays by Shakespeare, in whole or in part, and understand their plots and characters.",
        "Understand the conventions of drama: acts, scenes, soliloquy, aside and stage directions.",
        "Understand the context of Elizabethan theatre.",
        "Explain the effect of Shakespeare's language, including metaphor.",
        "Recognise verse and prose.",
      ],
      note: {
        title: "Year 7: getting to know Shakespeare's stage and stories",
        body: `## What you need to know

William Shakespeare (1564–1616) was born in Stratford-upon-Avon and wrote plays for London theatres, especially **the Globe** (opened 1599, by the River Thames). Plays are divided into **acts** and **scenes**.

| Term | Meaning |
| --- | --- |
| Soliloquy | A character speaks their thoughts aloud, usually alone on stage |
| Aside | A short remark to the audience that other characters do not hear |
| Stage directions | Instructions in the script about movement, sound and mood |
| Prologue / Chorus | An opening speech that sets the scene |
| Blank verse | Unrhymed lines of ten syllables in a rhythm called iambic pentameter |
| Prose | Ordinary language without a fixed line pattern |
| Comedy / tragedy | Comedies end happily (often with marriage); tragedies end in the hero's death |

In Shakespeare's time, women were not allowed on the public stage: **boys and young men** played female roles. Nobles often speak in verse; lower-status characters often speak in prose.

## Model analysis (PEEL)

Ariel sings to Ferdinand: *"Full fathom five thy father lies; / Of his bones are coral made;"*

- **Point:** Shakespeare uses imagery of transformation to charm and unsettle.
- **Evidence:** "Of his bones are coral made".
- **Explain:** Turning bones into coral is a metaphor that makes death seem strange and beautiful, so the mood is haunting and magical.
- **Link:** This fits *The Tempest*, in which nothing is quite what it seems.`,
      },
      quiz: {
        title: "Shakespeare & Drama: Year 7 quiz",
        questions: [
          q7.single(
            "Which theatre, opened in 1599 beside the River Thames, is most closely linked with Shakespeare's company?",
            "The Globe",
            ["The Old Vic", "The Palladium", "The Colosseum"],
            "Shakespeare's company built the Globe theatre in London in 1599. The other names are theatres from other periods or places.",
            1,
          ),
          q7.single(
            "In Shakespeare's time, who played the female characters on stage?",
            "Boys and young men",
            ["Women from noble families", "Puppets", "The oldest actors in the company"],
            "Women were not allowed to perform on the public stage, so boy actors played roles such as Juliet and Viola.",
            1,
          ),
          q7.single(
            "What is a soliloquy?",
            "A speech in which a character speaks their thoughts aloud, usually alone",
            ["A short remark spoken only to one other actor on the stage", "A song that is sung by the whole cast at the end", "A written note that tells the actors where to stand"],
            "A soliloquy lets the audience hear a character's private thoughts. An aside is a brief remark; stage directions are instructions.",
            1,
          ),
          q7.single(
            `Read these opening lines of Romeo and Juliet.\n\nTwo households, both alike in dignity,\nIn fair Verona, where we lay our scene,\n\nWho speaks these lines, and what do they do?`,
            "The Chorus, who sets the scene and introduces the feud",
            ["Romeo, who declares his love for Juliet", "Friar Laurence, who marries the lovers", "Juliet's Nurse, who tells a joke"],
            "The Prologue is spoken by the Chorus, who tells the audience where the play is set and introduces the two feuding families.",
            2,
            { d: true, q: ["Two households, both alike in dignity,", "In fair Verona, where we lay our scene,"] },
          ),
          q7.single(
            `Romeo sees Juliet at her window and says:\n\nIt is the east, and Juliet is the sun.\n\nWhat does the metaphor “Juliet is the sun” suggest?`,
            "That Juliet is radiant and brings light and warmth to Romeo's world",
            ["That Juliet has a fiery, hot-tempered personality", "That Juliet lives in the eastern part of the city", "That Juliet is a distant and unfriendly star in the sky"],
            "Calling her the sun suggests she gives light and life. It shows Romeo's admiration.",
            2,
            { d: true, q: ["It is the east, and Juliet is the sun."] },
          ),
          q7.single(
            `Juliet, on her balcony, says:\n\nO Romeo, Romeo! wherefore art thou Romeo?\n\nWhat does “wherefore” mean here?`,
            "Why",
            ["Where", "When", "Who"],
            "“Wherefore” means “why”. Juliet is asking why he has to be Romeo, a Montague, her family's enemy. She is not asking where he is.",
            2,
            { q: ["O Romeo, Romeo! wherefore art thou Romeo?"] },
          ),
          q7.single(
            `In A Midsummer Night's Dream, Puck watches the mixed-up lovers and says to Oberon:\n\nLord, what fools these mortals be!\n\nWhat is Puck referring to?`,
            "The confused and comic behaviour of the human lovers",
            ["The foolish orders that the fairy king has given him", "A group of actors who are rehearsing a play in the wood", "A violent storm that is breaking over the sea at night"],
            "Puck finds the mortals' muddled love ridiculous. “Mortals” means humans.",
            2,
            { q: ["Lord, what fools these mortals be!"] },
          ),
          q7.multi(
            "Which TWO of these plays are comedies?",
            ["A Midsummer Night's Dream", "Twelfth Night"],
            ["Macbeth", "Romeo and Juliet"],
            "Comedies end in reconciliation or marriage. Macbeth and Romeo and Juliet are tragedies.",
            2,
          ),
          q7.single(
            "What is blank verse?",
            "Unrhymed lines of ten syllables in iambic pentameter",
            ["Poetry in which the poet leaves the last word of each line blank", "Rhyming couplets that are used at the end of every scene", "Any speech that is spoken very quietly on the stage"],
            "Blank verse does not rhyme but has a regular rhythm, close to natural speech. Shakespeare used it for many important characters.",
            3,
          ),
          q7.single(
            `In A Midsummer Night's Dream, Lysander says to Hermia:\n\nThe course of true love never did run smooth\n\nWhat has just happened to make Lysander say this?`,
            "Hermia's father has insisted she must marry Demetrius, not Lysander",
            ["Hermia has fallen asleep in the wood", "Lysander has been turned into a donkey", "Hermia has been banished to a convent by the queen"],
            "Egeus wants Hermia to marry Demetrius, so the young lovers face an obstacle, which Lysander sums up with this line.",
            3,
            { q: ["The course of true love never did run smooth"] },
          ),
        ],
      },
      flashcards: cards([
        ["Soliloquy", "A character speaks their thoughts aloud, usually alone."],
        ["Aside", "A short remark spoken to the audience that other characters don't hear."],
        ["Stage directions", "Instructions in the script about actions, sounds and mood."],
        ["Chorus", "A speaker (or group) who introduces or comments on the action."],
        ["Blank verse", "Unrhymed iambic pentameter: ten syllables, five stresses per line."],
        ["The Globe", "The London theatre (1599) where Shakespeare's company performed."],
        ["Who played Juliet originally?", "A boy actor: women did not perform on the public stage."],
        ["Comedy vs tragedy", "Comedies end happily; tragedies end with the hero's downfall and death."],
        ["“wherefore”", "Means “why”, not “where”."],
        ["Who says “Lord, what fools these mortals be!”?", "Puck, in A Midsummer Night's Dream."],
      ]),
    },
    8: {
      year: 8,
      objectives: [
        "Study plays by Shakespeare in greater depth, including Macbeth and Much Ado About Nothing.",
        "Analyse how language, imagery and structure create character and theme.",
        "Understand dramatic irony and the staging choices of a director.",
        "Explain how context (Elizabethan and Jacobean) shapes the plays.",
        "Support ideas with short, accurate quotations.",
      ],
      note: {
        title: "Year 8: language, character and context in the plays",
        body: `## What you need to know

At Year 8 you explore how Shakespeare uses **language** and **structure** to develop character and ideas, and how **context** affects meaning.

| Term | Meaning |
| --- | --- |
| Dramatic irony | The audience knows something that a character does not |
| Antithesis | Contrasting opposites in a balanced phrase |
| Motif | A repeated image or idea (e.g. blood, darkness) |
| Foil | A character who contrasts with another to highlight qualities |
| Context | The historical and social background of a text |
| Jacobean | The period of James I (1603–1625) |

**Macbeth** was written in the reign of James I. Audiences of the time were fascinated by **witchcraft**, feared **treason** and believed kings were chosen by God, so killing a king was seen as a crime against nature.

**Staging:** a director's choices about lighting, costume, sound and actor movement can change how we read a moment.

## Model analysis (PEEL)

Juliet: *"Parting is such sweet sorrow"*.

- **Point:** Shakespeare shows the lovers' mixed feelings.
- **Evidence:** "sweet sorrow".
- **Explain:** The oxymoron joins joy and pain, as leaving is sad but promises another meeting.
- **Link:** This reflects the play's constant tension between love and danger.`,
      },
      quiz: {
        title: "Shakespeare & Drama: Year 8 quiz",
        questions: [
          q8.single(
            `In Macbeth, three characters chant:\n\nDouble, double toil and trouble;\nFire burn, and cauldron bubble.\n\nWho speaks these lines?`,
            "The Three Witches",
            ["Lady Macbeth", "Banquo and Macduff", "The Porter"],
            "The rhyming chant is spoken by the Witches as they stir their cauldron in Act 4.",
            1,
            { q: ["Double, double toil and trouble;", "Fire burn, and cauldron bubble."] },
          ),
          q8.single(
            `In Act 1 Scene 1 of Macbeth, the Witches say:\n\nFair is foul, and foul is fair\n\nWhat is the effect of this line?`,
            "It reverses good and evil, creating confusion and disorder",
            ["It shows that the Witches are cheerful and generous to soldiers", "It gives clear instructions to the soldiers before the battle", "It shows that the weather is fine and the day is bright"],
            "The antithesis mixes up opposites, hinting that in this play nothing is what it seems and the moral order is upside down.",
            2,
            { q: ["Fair is foul, and foul is fair"] },
          ),
          q8.single(
            `Lady Macbeth advises her husband:\n\nLook like th' innocent flower,\nBut be the serpent under't.\n\nWhat is she telling him to do?`,
            "Appear harmless and welcoming while secretly planning to strike",
            ["Stay out of the garden, where dangerous animals often hide", "Be honest and kind with everyone that he happens to meet", "Tell the truth about his plans to the king as soon as he can"],
            "The flower and the serpent contrast outer beauty with hidden danger, urging him to hide his murderous plan behind a friendly face.",
            2,
            { d: true, q: ["Look like th' innocent flower,", "But be the serpent under't."] },
          ),
          q8.single(
            `Before he murders Duncan, Macbeth speaks alone on stage:\n\nIs this a dagger which I see before me,\nThe handle toward my hand?\n\nWhat does this soliloquy reveal about him?`,
            "He is tormented and imagining things, showing his guilt and fear",
            ["He is calm and completely certain about what he will do", "He is searching for a kitchen knife that he has lost", "He is telling his friend Banquo a joke to cheer him up"],
            "The vision of a dagger suggests a troubled mind. The soliloquy lets the audience see his inner conflict.",
            2,
            { q: ["Is this a dagger which I see before me,", "The handle toward my hand?"] },
          ),
          q8.single(
            `In the sleepwalking scene Lady Macbeth cries:\n\nOut, damned spot! Out, I say!\n\nWhat is she trying to do, and what does it show?`,
            "Wash imaginary blood from her hands, showing her overwhelming guilt",
            ["Clean a real stain on the floor that the servants left", "Scold a small dog that has been chasing the chickens", "Cook a meal for the guests who are coming to the castle"],
            "The “spot” is imagined blood from the murder. Her repeated, frantic washing shows guilt that has broken her mind.",
            2,
            { d: true, q: ["Out, damned spot! Out, I say!"] },
          ),
          q8.single(
            "In Macbeth, what do the Witches prophesy about Banquo?",
            "That his descendants will become kings",
            ["That he will be killed by Macduff", "That he will be crowned before Macbeth", "That he will become Thane of Cawdor"],
            "They tell Banquo that he will not be king himself, but he will be the father of kings. This makes Macbeth jealous and afraid.",
            1,
          ),
          q8.single(
            "Which fact about James I's reign helps explain why Macbeth interested Jacobean audiences?",
            "James was fascinated by witchcraft and claimed to be descended from Banquo",
            ["James I banned every play that showed a king on stage", "James I was born in Verona and loved Italian stories", "James I had abolished the monarchy and ruled as a republic"],
            "The king had written about witchcraft and traced his family line to Banquo, so a play showing witches, prophecy and a treasonous murder appealed to him.",
            3,
          ),
          q8.single(
            `In Much Ado About Nothing, Beatrice says:\n\nI had rather hear my dog bark at a crow than a man swear he loves me.\n\nWhat does this reveal about her?`,
            "She is witty, sharp-tongued and scornful of romantic promises",
            ["She is shy and afraid to speak her mind in public", "She is madly in love with every man that she meets", "She owns a pet dog and a crow that she is fond of"],
            "The comic comparison shows her sharp wit and her scorn for flowery declarations of love.",
            2,
            { q: ["I had rather hear my dog bark at a crow than a man swear he loves me."] },
          ),
          q8.single(
            `In Twelfth Night, Malvolio finds a forged letter and reads aloud:\n\nSome are born great, some achieve greatness, and some have greatness thrust upon ’em.\n\nWhy is this an example of dramatic irony?`,
            "The audience knows the letter is a trick but Malvolio thinks it real",
            ["Malvolio knows the letter is a trick, but the audience is unaware", "The audience does not understand the meaning of the letter at all", "The letter is written in prose, which is unusual for the play"],
            "Maria and the others forged the letter to fool Malvolio. The audience is in on the joke, so his pride becomes funny.",
            3,
            { q: ["Some are born great, some achieve greatness, and some have greatness thrust upon ’em."] },
          ),
          q8.single(
            `In Romeo and Juliet, the dying Mercutio says:\n\nA plague o' both your houses!\n\nWhat is he doing?`,
            "Cursing both families for the feud that has killed him",
            ["Blessing the two families and wishing them long peace", "Predicting that the play will have a happy ending", "Asking for a doctor to visit the houses of both families"],
            "Mercutio, fatally wounded in the fight with Tybalt, blames both families. “A plague” is a curse.",
            1,
            { q: ["A plague o' both your houses!"] },
          ),
        ],
      },
      flashcards: cards([
        ["Dramatic irony", "The audience knows something a character does not."],
        ["Antithesis", "Balanced contrast of opposites: Fair is foul, and foul is fair."],
        ["Motif", "A repeated image or idea in a text (blood, darkness in Macbeth)."],
        ["Foil", "A character who contrasts with another to highlight qualities."],
        ["Jacobean", "Relating to the reign of James I (1603–1625)."],
        ["Who speaks “Out, damned spot!”?", "Lady Macbeth, in the sleepwalking scene."],
        ["Who says “A plague o' both your houses!”?", "Mercutio, dying, in Romeo and Juliet."],
        ["Who says “Look like th' innocent flower”?", "Lady Macbeth, to Macbeth."],
        ["The Witches' prophecy for Banquo", "His descendants will be kings."],
        ["Oxymoron in Romeo and Juliet", "“Parting is such sweet sorrow”: joy and pain joined together."],
      ]),
    },
    9: {
      year: 9,
      objectives: [
        "Analyse Shakespeare's language, structure and staging in detail, including tragic and comic conventions.",
        "Explore themes such as ambition, power, identity and deception.",
        "Understand the tragic hero and the role of fate and choice.",
        "Interpret how productions realise the text.",
        "Write analytical responses with precise quotations and contextual insight.",
      ],
      note: {
        title: "Year 9: themes, tragedy and interpretation",
        body: `## What you need to know

By Year 9 you read Shakespeare **critically**: what does a moment mean, and how could a director bring it to life?

| Term | Meaning |
| --- | --- |
| Tragic hero | A great character brought down by a flaw and by fate |
| Hamartia | The tragic flaw (Macbeth: overreaching ambition) |
| Hubris | Excessive pride |
| Theme | An underlying idea (ambition, identity, power, revenge) |
| Interpretation | A reading of a scene or a production choice |
| Imperative | A command form: *Come, you spirits* |

**Tragedy** ends in the death of the protagonist and shows the cost of a fatal flaw. **Comedy** ends in reunion and celebration after confusion.

**Themes** to explore: **ambition and power** (Macbeth), **identity and disguise** (Twelfth Night), **honour and deception** (Much Ado), **power and freedom** (The Tempest).

## Model analysis (PEEL)

Lady Macbeth: *"Come, you spirits / That tend on mortal thoughts, unsex me here"*.

- **Point:** She rejects the qualities expected of a woman to gain power.
- **Evidence:** "unsex me here".
- **Explain:** The imperative "Come" shows she commands supernatural help, and "unsex" means she wants to remove gentleness and compassion.
- **Link:** This early moment makes her ruthless plan seem deliberate and shapes our view of her.`,
      },
      quiz: {
        title: "Shakespeare & Drama: Year 9 quiz",
        questions: [
          q9.single(
            `Juliet, on learning that Romeo is a Montague, exclaims:\n\nMy only love sprung from my only hate!\n\nWhich technique is used?`,
            "Antithesis, contrasting love and hate",
            ["Onomatopoeia, imitating the sound of a word", "Simile, comparing love to hate using “like”", "A pun that plays on the sound of Romeo's name"],
            "She sets “love” against “hate” in a balanced phrase to show her painful discovery that the man she loves is from the enemy family.",
            1,
            { q: ["My only love sprung from my only hate!"] },
          ),
          q9.single(
            `After hearing of Lady Macbeth's death, Macbeth says:\n\nLife's but a walking shadow, a poor player\nThat struts and frets his hour upon the stage\nAnd then is heard no more\n\nWhat does the metaphor of life as “a poor player” suggest?`,
            "That life is brief, empty and meaningless, like a poor performance",
            ["That life is a joyful celebration full of laughter and music", "That actors are far more important than kings and queens", "That Macbeth is planning to become a professional actor"],
            "The image of an actor who struts and then is forgotten expresses Macbeth's despair that life has no lasting meaning.",
            2,
            { d: true, q: ["Life's but a walking shadow, a poor player", "That struts and frets his hour upon the stage", "And then is heard no more"] },
          ),
          q9.single(
            `Macbeth continues:\n\nTomorrow, and tomorrow, and tomorrow,\nCreeps in this petty pace from day to day\n\nWhat is the effect of the repetition and the verb “creeps”?`,
            "It makes time seem slow, weary and meaningless",
            ["It shows that time is racing", "It shows that he is looking forward to the future", "It shows he is counting money"],
            "Repeating “tomorrow” and using “creeps” makes the days drag on, matching his exhausted hopelessness.",
            2,
            { q: ["Tomorrow, and tomorrow, and tomorrow,", "Creeps in this petty pace from day to day"] },
          ),
          q9.single(
            `In The Tempest, Caliban tells Prospero:\n\nYou taught me language, and my profit on't\nIs, I know how to curse.\n\nWhat does this show about Caliban's attitude?`,
            "He resents Prospero and uses his language to insult him",
            ["He is grateful to Prospero for teaching him how to speak", "He admires Prospero's poetry and wants to write his own", "He hopes to become a teacher of languages on the island"],
            "Caliban says the only benefit of language is being able to curse, showing bitterness about being controlled. This links to ideas of power and colonisation.",
            2,
            { d: true, q: ["You taught me language, and my profit on't", "Is, I know how to curse."] },
          ),
          q9.single(
            `Prospero says:\n\nWe are such stuff\nAs dreams are made on; and our little life\nIs rounded with a sleep.\n\nWhat does he suggest about human life?`,
            "That it is short and dream-like, ending in sleep",
            ["That it is long and full of certainty", "That dreams are more dangerous than magic", "That people sleep too much"],
            "“Our little life” is “rounded with a sleep”: life begins and ends in sleep, so it is brief and insubstantial.",
            2,
            { q: ["We are such stuff", "As dreams are made on; and our little life", "Is rounded with a sleep."] },
          ),
          q9.single(
            `Macbeth admits:\n\nI have no spur\nTo prick the sides of my intent, but only\nVaulting ambition, which o'erleaps itself\nAnd falls on th' other.\n\nWhat does “vaulting” suggest about his ambition?`,
            "It leaps too far and is likely to end in a fall",
            ["It is slow and cautious", "It is a form of gymnastic training", "It is small and easily satisfied"],
            "A vault is a leap. Ambition that “o'erleaps itself” overreaches and falls, foreshadowing his downfall.",
            3,
            { q: ["I have no spur", "To prick the sides of my intent, but only", "Vaulting ambition, which o'erleaps itself", "And falls on th' other."] },
          ),
          q9.single(
            `In Twelfth Night, Viola, disguised as Cesario, says:\n\nI am not what I am.\n\nWhich theme does this line highlight?`,
            "Disguise and identity: her outer appearance hides her true self",
            ["The importance of wealth: only the rich can find happiness", "The pleasures of travel: the joy of visiting new places", "The dangers of witchcraft: the risk of magic spells"],
            "She appears to be a young man but is really a woman, so the line sums up the play's interest in disguise and mistaken identity.",
            2,
            { q: ["I am not what I am."] },
          ),
          q9.single(
            `In Much Ado About Nothing, after Claudio has publicly shamed Hero at the altar, Beatrice says to Benedick:\n\nKill Claudio.\n\nWhy is this such a shocking moment?`,
            "It turns a witty romance into a serious test of Benedick's loyalty",
            ["It shows that Beatrice hates Benedick and wants to hurt him", "It shows that the play is a light farce with no serious themes", "It is a stage direction, not a line for an actor to speak"],
            "Beatrice's blunt command shows how strongly she defends her cousin's honour and challenges Benedick to prove his love.",
            3,
            { q: ["Kill Claudio."] },
          ),
          q9.single(
            "In a production of Macbeth, the lights turn red as Lady Macbeth says “Out, damned spot!”. What effect might this create?",
            "It suggests blood and guilt on stage",
            ["It suggests that a cheerful party is starting", "It suggests that the scene is set at a beach", "It suggests that time has stopped"],
            "Red lighting is a common symbol of blood and danger, reinforcing the theme of guilt.",
            1,
          ),
          q9.single(
            "Which statement best describes the difference between Shakespeare's tragedies and comedies?",
            "Tragedies end with the hero's downfall; comedies end with reunion",
            ["Tragedies are always shorter than comedies in performance", "Comedies are always written in prose rather than verse", "Tragedies never contain any humour or jokes at all"],
            "The endings differ: tragedy shows the cost of a fatal flaw, while comedy resolves confusion, often with weddings.",
            1,
          ),
        ],
      },
      flashcards: cards([
        ["Tragic hero", "A great figure who falls because of a flaw and circumstance."],
        ["Hamartia", "The tragic flaw of the hero (in Macbeth: overreaching ambition)."],
        ["Hubris", "Excessive pride that leads to downfall."],
        ["Theme", "An underlying idea explored in a text (ambition, identity, power)."],
        ["Vaulting ambition", "Macbeth's phrase: ambition that leaps too far and falls."],
        ["“Life's but a walking shadow”", "Macbeth, after Lady Macbeth's death: life is brief and meaningless."],
        ["“I am not what I am”", "Viola (as Cesario), Twelfth Night: disguise and identity."],
        ["“Kill Claudio”", "Beatrice to Benedick after Hero is shamed in Much Ado."],
        ["Caliban's complaint", "“You taught me language, and my profit on't / Is, I know how to curse.”"],
        ["Staging", "A director's choices (light, costume, sound, movement) that shape how a scene is read."],
      ]),
    },
  },
};

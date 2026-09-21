// English GCSE — Modern Prose & Drama (Years 10–11). Original questions aligned to the DfE GCSE English Literature subject content
// (exam-board neutral). Modern texts are in copyright, so NOTHING is quoted from them: method questions use ORIGINAL extracts
// invented for ActivityOS, and text knowledge is limited to well-known plot, theme and context.
// Y10: An Inspector Calls, Lord of the Flies. Y11: Animal Farm, Blood Brothers.
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q10 = qb("mod4", 10);
const q11 = qb("mod4", 11);

export const TOPIC: CTopic = {
  key: "mod4",
  topic: "Modern Prose & Drama",
  subject: "English",
  years: {
    10: {
      year: 10,
      objectives: [
        "Read, understand and respond to modern drama (An Inspector Calls) and modern prose (Lord of the Flies) (AO1).",
        "Analyse how writers use structure, staging, dramatic irony, symbolism and language to create meaning (AO2).",
        "Explore themes of responsibility, class, civilisation and savagery, and how characters change.",
        "Show understanding of the historical contexts of the texts (AO3).",
        "Analyse original unseen extracts of modern writing, referring to methods without needing to memorise quotations.",
      ],
      note: {
        title: "Year 10: An Inspector Calls and Lord of the Flies: methods and ideas",
        body: `## Writing about modern texts

Build each paragraph with **PEEL** (point, evidence, explain, link).

Modern texts are in copyright, so your best evidence is often **precise reference to events, structure and stage or narrative methods**, plus short quotations only if you have learned them accurately.

| Term | Meaning |
| --- | --- |
| Dramatic irony | The audience knows more than a character does |
| Stage directions | The writer’s instructions about action, lighting, sound and setting |
| Cliffhanger | An ending that leaves the audience unsure or unsettled |
| Symbol | An object or idea standing for something larger |
| Allegory | A story whose events carry a hidden, usually political, meaning |
| Theme | A central idea explored across the text |

## Context to know

- ***An Inspector Calls*** (J. B. Priestley, written 1945): set in 1912 but written at the end of the Second World War. Priestley was a socialist who wanted post-war Britain to care more for everyone. The audience’s hindsight creates **dramatic irony**.
- ***Lord of the Flies*** (William Golding, 1954): boys stranded on an island in wartime. Golding served in the Royal Navy in the Second World War, and the novel explores how quickly order can collapse.

## Worked model paragraph (using an invented extract)

*Extract: “Ravi turned the key twice, then tested the door again. The house behind him gave nothing back but the tick of the cooling boiler.”*

*The writer conveys Ravi’s anxiety through repeated actions. The phrase “turned the key twice, then tested the door again” suggests a need for reassurance, while the “tick of the cooling boiler” makes the house feel empty and unresponsive. The reader senses unease, because silence and repetition together hint at fear.*

Notice: a point about mood, a short quotation, an explanation of two methods, and the effect on the reader.`,
      },
      quiz: {
        title: "Modern Prose & Drama: Year 10 quiz",
        questions: [
          q10.single("When is An Inspector Calls set, and when was it written?", "Set in 1912; written in 1945", ["Set in 1945; written in 1912", "Set and written in 1945", "Set in 1912; written in 1980"], "Priestley set the play before the First World War but wrote it at the end of the Second World War, so the audience knows what came next.", 1),
          q10.single("In An Inspector Calls, Mr Birling confidently predicts that there will be no war and that the Titanic is unsinkable. What is the effect?", "Dramatic irony: the 1945 audience knows he is wrong, so he seems foolish", ["It shows that he is a wise, reliable prophet whom the audience should trust", "It proves that he is telling the truth about history and understands the future", "It makes the audience laugh at the Inspector for arriving without knowing the facts"], "The audience’s hindsight exposes Birling’s arrogance. This undermines his views about looking after only oneself.", 2, true),
          q10.single("What message does the Inspector deliver to the Birling family?", "People are responsible for one another, not just for themselves", ["Rich people should never help the poor because they would only waste the money", "Everyone is responsible only for their own family and for their own business", "Rules are more important than people, so the law must always be obeyed"], "The play argues for collective, social responsibility as opposed to the selfish individualism the older Birlings show.", 2),
          q10.single("The play ends with a phone call saying that a girl has just died and that an inspector is on his way. What is the effect?", "A cliffhanger that makes the audience question whether the family has really learned", ["It proves that the Inspector was an ordinary policeman all along and the case is closed", "It cheerfully resolves the story and shows that the whole family has changed for good", "It shows that Mr Birling’s business is safe and that the scandal will be forgotten"], "The unsettling ending leaves questions open, pushing the audience to reflect on responsibility after the curtain falls.", 3),
          q10.short("In Lord of the Flies, what object do the boys use to call meetings and to show who may speak? (one word)", "conch", ["the conch", "Conch", "conch.", "the conch.", "a conch", "conch shell", "the conch shell", "a conch shell", "shell"], "The conch shell represents democracy, order and civilisation, so its destruction later signals the collapse of order.", 1),
          q10.single("Who is killed when the boys mistake him for the beast in Lord of the Flies?", "Simon", ["Ralph", "Piggy", "Jack"], "Simon discovers the “beast” is a dead parachutist and is killed in a frenzied ritual dance.", 1),
          q10.single("What does the boys’ descent into savagery suggest about human nature in Golding’s view?", "Civilised behaviour is fragile: without rules, fear and power-seeking can take over", ["Children are naturally perfect, and it is only adults who teach them to be cruel", "Adults are always more dangerous than children, whatever the situation they are in", "Islands cannot support people for long, so violence is the only way to survive"], "Golding uses the boys to show that the potential for cruelty exists in everyone, not only in “other” people.", 2, true),
          q10.single("Which contextual point best helps to explain Golding’s view of human nature?", "After serving in the Royal Navy in the Second World War, he believed evil lay within people, not one nation", ["He had himself been stranded on a tropical island as a boy and survived for months by hunting pigs, so the novel is really autobiography", "He wrote it to promote a political party that was campaigning for a strong national leader who would bring back order after the war", "He believed that war had improved humanity by teaching people to work together"], "Golding’s wartime experience shaped his pessimistic view. That is a contextual point that links to the text’s meaning.", 3),
          q10.single("Original extract: “By the third day the shelter had stopped being a shelter and become a throne room. Kade sat at its mouth on a crate, and the others brought him things (a tin, a cracked mirror, half a biscuit) as though they had always done so. Nobody remembered agreeing to this.”\n\nWhat does the final sentence suggest?", "Power has been taken gradually, and the group has accepted it without question", ["Everyone voted for Kade in a formal election held in the shelter", "Kade is being punished by the group for taking the crate that they needed", "The group has forgotten how to speak, so they can only offer him objects"], "“Nobody remembered agreeing” implies no one ever consented, so authority has grown quietly through habit and gifts.", 2),
          q10.single("Original extract: “(The lights fade to a single lamp. MAYA sits at the kitchen table, folding and refolding a letter. The clock ticks. She stands, crosses to the window, then sits again.) MAYA: (quietly) Not yet. Not yet.”\n\nWhat is the effect of the repeated actions and the repeated words?", "They build tension, suggesting anxiety and an inability to decide", ["They show that Maya is calm and content as she waits for good news", "They show that the scene is a comic routine, like a music-hall sketch", "They show that the letter has already been sent and Maya has nothing left to do"], "Repeating movements and words (“Not yet”), together with the single lamp, isolates Maya and conveys nervous indecision.", 2),
          q10.single("An Inspector Calls takes place in one room over one evening. What is the effect of this setting?", "It increases pressure and claustrophobia, as the family cannot escape the questions", ["It makes the play feel like a fast-moving adventure across several different places", "It stops the audience from focusing on the characters because there is nothing to see", "It shows the family is on holiday"], "A single setting and real-time action keep the tension high, and it traps characters with the truth.", 2),
          q10.single("Original extract: “Ismail counted the coins twice. Even then he did not believe them. Somewhere behind the shop wall a radio played a song about a place he had never seen.”\n\nWhich best explains the effect of the final sentence?", "It contrasts his small worry with a distant, unknown world, hinting at longing", ["It shows that he is listening to the shop’s owner, who is playing his favourite song", "It shows that he wins the lottery and is about to escape from his small shop", "It shows that he is proud of the shop and has decorated it with the radio"], "The song about an unseen place widens the focus beyond the coins and hints that Ismail feels cut off and wishful.", 3),
          q10.written("How does Priestley (An Inspector Calls) or Golding (Lord of the Flies) present the theme of responsibility or power? Write ONE analytical PEEL paragraph (about 100–120 words). Refer to specific events and methods; use a short quotation only if you are certain of it.", "A strong answer makes a clear point about responsibility or power, refers precisely to an event, explains a method (dramatic irony, symbolism, structure), and links to context (post-war Britain or wartime experience).", "Mark scheme (8 marks, plain-language AO1/AO2/AO3): 2 marks for a clear point and personal interpretation; 2 marks for precise textual reference (event or accurate quotation); 3 marks for analysing methods (dramatic irony, staging, symbolism, structure) with terminology; 1 mark for a link to context or the whole text.", 3, 8),
        ],
      },
      flashcards: cards([
        ["An Inspector Calls: setting and date", "Set in 1912 in the Birling family’s dining room; written in 1945."],
        ["Priestley’s purpose", "To argue for collective social responsibility in post-war Britain."],
        ["Dramatic irony in An Inspector Calls", "Birling’s confident predictions about peace and the Titanic are wrong, and the audience knows it."],
        ["Ending of An Inspector Calls", "A phone call announces a girl’s death and an inspector on the way, a cliffhanger about responsibility."],
        ["Lord of the Flies: the conch", "Symbolises democracy, order and civilisation."],
        ["Lord of the Flies: Piggy’s glasses", "Symbolise intelligence and the power to make fire; their loss marks the collapse of reason."],
        ["Lord of the Flies: the beast", "Represents the boys’ fear and the savagery within themselves."],
        ["Golding’s context", "He served in the Royal Navy in the Second World War; the novel explores how easily order collapses."],
        ["Stage directions", "The playwright’s instructions for action, lighting, sound and setting."],
        ["Analysing an unseen extract", "Point about mood or meaning, a short quotation, explain the method and effect, then link."],
      ]),
    },
    11: {
      year: 11,
      objectives: [
        "Read, understand and respond to Animal Farm and Blood Brothers, linking extracts to the whole text (AO1).",
        "Analyse how writers use allegory, fable, structure, symbolism and staging to convey meaning (AO2).",
        "Explore themes of power, class, propaganda, fate and nature versus nurture.",
        "Relate the texts to their contexts, including Soviet history and class divisions in Liverpool (AO3).",
        "Analyse original extracts, using precise reference and terminology.",
      ],
      note: {
        title: "Year 11: Animal Farm and Blood Brothers: allegory, class and structure",
        body: `## Ideas and methods

Build each paragraph with **PEEL** (point, evidence, explain, link).

Modern texts often make a political or social point through **structure and symbol**. Ask: **Who has power? Who is silenced? What is the writer inviting the audience to judge?**

| Term | Meaning |
| --- | --- |
| Allegory | A story that stands for real events or ideas |
| Fable | A short tale, often with animals, that teaches a lesson |
| Propaganda | Biased information used to influence opinion |
| Nature versus nurture | Whether character is shaped by inheritance or by upbringing |
| Foreshadowing | Hints about what will happen later |
| Narrator (in drama) | A figure who comments on the action and guides the audience |

## Context to know

- ***Animal Farm*** (George Orwell, published 1945): an allegory of the Russian Revolution and Stalin’s rise. Orwell criticised the way revolutionary ideals were betrayed by leaders who gained power.
- ***Blood Brothers*** (Willy Russell, first staged in the 1980s): set in Liverpool; explores class divisions, poverty and chance through twin brothers raised in different circumstances.

## Worked model paragraph (using an invented extract)

*Extract: “The new headmaster lined the school’s old trophies up in the hall and told everyone how proud he was of them, though he had never once looked at their names.”*

*The writer suggests the headmaster’s pride is empty. His public display of the trophies (“lined … up”) implies show rather than care, while the phrase “never once looked at their names” exposes his lack of respect for the past. The reader feels distrust because the writer separates his words from his actions, a subtle form of irony.*

This works by pointing to the gap between speech and behaviour: exactly what allegories and satire often expose.`,
      },
      quiz: {
        title: "Modern Prose & Drama: Year 11 quiz",
        questions: [
          q11.single("Animal Farm is described as an allegory. What does that mean?", "Its characters and events stand for real people and events, hiding a political meaning", ["It is a text that has no plot and is made only of speeches by the farm animals", "It is a story that was written entirely in verse, like a long epic poem about a farm", "It is a diary that was kept by a real farmer during the years of the war"], "An allegory works on two levels: the surface story about animals and a deeper meaning about history and politics.", 1),
          q11.single("Which real leader is Napoleon in Animal Farm usually taken to represent?", "Joseph Stalin", ["Karl Marx", "Winston Churchill", "The last Russian Tsar"], "Napoleon, the ruthless pig who takes control, parallels Stalin’s rise. Old Major is often linked to Marx or Lenin.", 2, true),
          q11.single("What does Squealer represent in Animal Farm?", "Propaganda: the spokesman who twists the truth to support the leaders", ["The honest working class, who trust the pigs and work hard for them", "A neighbouring farmer who trades with Animal Farm and negotiates for the pigs", "The religious leaders who tell the animals about a happier life after death"], "Squealer persuades the animals to accept changes by justifying them with lies and statistics.", 1),
          q11.single("What does Boxer’s fate suggest about the pigs’ regime?", "The leaders betray and exploit their most loyal, hardest-working supporters", ["Loyal workers are always rewarded for their years of service to the farm", "Illness is a mark of weakness in animals, and the pigs punish it fairly", "The pigs care deeply about every animal’s health and provide the best care"], "Boxer works tirelessly, but Napoleon sells him when he can no longer work. The betrayal shows the pigs’ cruelty and hypocrisy.", 2),
          q11.single("Why might Orwell have chosen the form of an animal fable for political criticism?", "It presents corruption simply and accessibly, inviting readers to judge the pigs themselves", ["Because animals were the real leaders of the revolution and Orwell wanted to record it", "Because fables are always comic, and Orwell wanted readers to laugh at the pigs", "Because it made the book impossible to understand, so nobody could criticise it"], "A fable’s simplicity makes the message clear and memorable, and the animal disguise lets the writer make a hard political point indirectly.", 3),
          q11.single("Why was Animal Farm difficult to publish in 1944–45?", "Britain was allied with the Soviet Union in the war, so publishers feared criticising Stalin", ["Orwell had not finished writing it and kept changing the ending for years", "Books were banned for the whole of the war and only government texts were printed", "It was written in a foreign language that British publishers could not read"], "The Soviet Union was a wartime ally, so a satire of its leadership was politically sensitive at the time.", 2),
          q11.single("In which city is Blood Brothers set?", "Liverpool", ["Manchester", "London", "Glasgow"], "Willy Russell sets the play in Liverpool, and its working-class and middle-class worlds are central to the story.", 1),
          q11.single("Why does Mrs Johnstone give one of her twins to Mrs Lyons?", "She is poor with many children already, while Mrs Lyons is wealthy and childless", ["She dislikes one of the babies and wants to give away the one she cares for less", "She wants to move abroad and cannot take both of the babies with her on the ship", "Mrs Lyons is her sister and has asked to bring up one of the twins as her own"], "Mrs Johnstone’s desperation and Mrs Lyons’s persuasion create the central deal on which the play’s tragedy rests.", 2),
          q11.single("What question does Blood Brothers raise by showing twins raised in different classes?", "Whether upbringing and social class shape chances more than birth does", ["Whether twins are always identical in personality, however they are raised", "Whether superstition is scientifically true and can control people’s lives", "Whether Liverpool is a better place to live than London for young families"], "The twins begin equal, yet their lives diverge, so the play asks how much class and nurture matter. That question is the nature-versus-nurture debate.", 2, true),
          q11.single("Blood Brothers begins by showing that the twins die, and then tells the story. What is the effect?", "It creates dramatic irony and a sense of inevitability, so we watch how fate unfolds", ["It hides the ending until the very last minute so that the audience is surprised", "It makes the play a comedy because the audience already knows the twins survive", "It removes the need for a narrator, since the audience already knows the story from the very first scene"], "Revealing the tragedy first turns the drama into a study of how and why, and emphasises fate.", 3),
          q11.single("Original extract: “I remember the smell of that classroom: chalk, damp coats, and something sharper underneath: the smell of being watched. Miss Adair never raised her voice. She simply stood at the front and waited, and the whole room shrank.”\n\nWhat is the effect of “the whole room shrank”?", "A metaphor that suggests the pupils feel small and intimidated", ["A simile comparing the room to a balloon that is slowly losing its air", "Onomatopoeia imitating the sound of a door closing behind the pupils", "A rhetorical question that asks the reader how the pupils felt in the room"], "The room cannot literally shrink. The metaphor conveys how her silent authority makes the pupils feel small.", 2),
          q11.single("Original extract: “(A garden party. VIVIENNE, in a crisp white dress, holds a glass at arm’s length. JOSH, in borrowed shoes, tugs at his collar. VIVIENNE: You’ll get used to it. JOSH: (smiling too widely) I hope so.)”\n\nWhich best describes what the stage directions suggest?", "The contrast of crisp white and borrowed shoes hints at class difference and Josh’s discomfort", ["They show that Vivienne and Josh are twins who have been dressed by their mother", "They show that the party is a disaster caused by rain and by poor organisation", "They show that Josh is confident and wealthy and feels at home among the guests"], "Costume and gesture (“borrowed”, “tugs”, “smiling too widely”) signal unease and social difference without direct statement.", 3),
          q11.written("How does a writer you have studied (Orwell in Animal Farm or Russell in Blood Brothers) present the theme of power or class? Write ONE analytical PEEL paragraph (about 100–120 words). Refer to specific events and methods; use a short quotation only if you are certain of it.", "A strong answer makes a clear point about power or class, refers precisely to an event or character, analyses a method (allegory, propaganda, staging, structure), and links to context (Soviet history or class in Liverpool).", "Mark scheme (8 marks, plain-language AO1/AO2/AO3): 2 marks for a clear point and personal interpretation; 2 marks for precise textual reference (event or accurate quotation); 3 marks for analysing methods (allegory, fable form, narrator, structure, symbolism) with terminology; 1 mark for a link to context or the whole text.", 3, 8),
        ],
      },
      flashcards: cards([
        ["Allegory", "A story whose characters and events stand for real people, events or ideas."],
        ["Animal Farm: Napoleon", "Represents Stalin: the ruthless pig who seizes power."],
        ["Animal Farm: Snowball", "Often taken to represent Trotsky."],
        ["Animal Farm: Squealer", "Represents propaganda: the spokesman who twists the truth."],
        ["Animal Farm: Boxer", "Represents the loyal working class, betrayed by the leaders."],
        ["Orwell’s purpose", "To warn how revolutionary ideals can be betrayed by those who gain power."],
        ["Blood Brothers: setting", "Liverpool; the play contrasts working-class and middle-class lives."],
        ["Blood Brothers: central deal", "Mrs Johnstone gives one twin to the wealthy Mrs Lyons."],
        ["Nature versus nurture", "The debate over whether inheritance or upbringing shapes who we become."],
        ["Blood Brothers: structure", "The tragic ending is shown first, so the play is about how and why, with fate and superstition as themes."],
      ]),
    },
  },
};

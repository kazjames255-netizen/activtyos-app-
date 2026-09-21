// English GCSE — 19th-Century Novel (Years 10–11). Original questions aligned to the DfE GCSE English Literature subject content
// (exam-board neutral). Y10: A Christmas Carol, Strange Case of Dr Jekyll and Mr Hyde, Great Expectations.
// Y11: Jane Eyre, Frankenstein, Pride and Prejudice. All texts are public domain; quotations are short and standard-text accurate.
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q10 = qb("nov4", 10);
const q11 = qb("nov4", 11);

export const TOPIC: CTopic = {
  key: "nov4",
  topic: "19th-Century Novel",
  subject: "English",
  years: {
    10: {
      year: 10,
      objectives: [
        "Read, understand and respond to Dickens (A Christmas Carol, Great Expectations) and Stevenson (Dr Jekyll and Mr Hyde) (AO1).",
        "Analyse how writers use language, structure, narrative viewpoint and symbolism to create meaning (AO2).",
        "Explore the Victorian contexts: poverty and the Poor Law, class, respectability, science and the Gothic (AO3).",
        "Trace characters’ development and the writers’ social and moral messages.",
        "Support interpretations with short, accurate quotations.",
      ],
      note: {
        title: "Year 10: Dickens and Stevenson: Victorian contexts and methods",
        body: `## Reading a Victorian novel

Build each paragraph with **PEEL** (point, evidence, explain, link).

Ask: **Who narrates? What is the writer criticising or exploring? How does the setting reflect ideas?**

| Term | Meaning |
| --- | --- |
| Stave | A section of *A Christmas Carol* (Dickens uses “staves”, like song verses) |
| Gothic | Genre of mystery, fear, dark settings and the supernatural |
| Duality | The idea that a person has two opposing sides |
| Retrospective narrator | A narrator looking back on earlier events |
| Symbol | An object or image standing for a larger idea |
| Social criticism | A writer exposing injustice in society |

## Victorian context

- **Poverty and the Poor Law:** the 1834 Poor Law made workhouses harsh, and Dickens, a campaigner in his writing, attacked indifference to the poor.
- **Respectability:** Victorians valued a spotless public reputation, which could hide private wrongs.
- **Science:** Darwin’s *On the Origin of Species* (1859) unsettled beliefs about human nature, feeding the fears in Gothic fiction.

## Worked model paragraph

*Stevenson presents human nature as divided. Jekyll admits that “man is not truly one, but truly two”, a bold declaration that turns a private discovery into a universal claim. The adverb “truly” repeated twice sounds like a scientific statement, yet it hides a confession of guilt. This would unsettle Victorian readers who prized respectability, because it implies that everyone might hide a darker self.*

Notice: a clear point, a short quotation, analysis of one word, and a link to context.`,
      },
      quiz: {
        title: "19th-Century Novel: Year 10 quiz",
        questions: [
          q10.single("How many spirits visit Scrooge in A Christmas Carol after Marley’s ghost?", "Three", ["One", "Two", "Four"], "Scrooge is visited by the Ghosts of Christmas Past, Christmas Present and Christmas Yet to Come.", 1),
          q10.single("Dickens describes Scrooge as “Hard and sharp as flint, from which no steel had ever struck out generous fire; secret, and self-contained, and solitary as an oyster.” What is the effect?", "The similes present him as cold, hard and closed off from other people", ["They show that he is generous, warm and welcoming to every visitor", "They present him as a healthy creature of the sea that is full of life", "They suggest that he is a skilled blacksmith who shapes hot metal every day"], "Flint is hard and does not give warmth, and an oyster is sealed shut. Together they suggest a hard, isolated man.", 2, true),
          q10.single("The Ghost of Christmas Present reveals two children, Ignorance and Want. What is Dickens’s main purpose?", "To personify social problems and warn wealthy readers that neglect will bring disaster", ["To add a comic subplot that lightens the mood before the ending of the story", "To show Scrooge’s family tree and explain who he will leave his money to", "To advertise Victorian schools that Dickens hoped the rich would build for the poor in every parish"], "Dickens uses shocking, symbolic children to make readers feel responsible. The ghost warns most of all against Ignorance.", 3),
          q10.single("Scrooge asks the charity collectors, “Are there no prisons?” and “And the Union workhouses?” What is Dickens criticising?", "Uncaring attitudes towards the poor and the harsh Poor Law system", ["The high cost of Christmas dinners and the greed of Victorian shopkeepers", "The lack of transport in London, which made it hard to get to work", "A shortage of jobs for lawyers, clerks and other professional men in London"], "Scrooge repeats the harsh views of his day, and Dickens uses him to expose them as heartless.", 2),
          q10.short("What is the surname of the lawyer who investigates the mystery in Dr Jekyll and Mr Hyde? (one word)", "Utterson", ["utterson", "Mr Utterson", "Mr. Utterson", "Gabriel Utterson", "Gabriel John Utterson", "Utterson."], "Mr Utterson, Jekyll’s friend and lawyer, follows the trail of clues about Hyde.", 1),
          q10.single("Which best describes Stevenson’s Dr Jekyll and Mr Hyde?", "A Gothic mystery exploring the duality of human nature", ["A romantic comedy about marriage and family life in the countryside", "A historical epic about war and adventure across many countries", "A satire of country life that mocks the habits of the gentry"], "It has Gothic features (dark London, secrecy, a monstrous double) and asks whether good and evil live in the same person.", 2),
          q10.single("Which idea of the time helps explain Victorian fear in Dr Jekyll and Mr Hyde?", "Darwin’s theory linked people to animals, so a “beast” might hide beneath a civilised appearance", ["The discovery of electricity ended all superstition and made people fearless of the dark", "Victorians believed that everyone was equal and that no one could have a hidden side", "Science had proved that crime was impossible among educated and respectable people"], "Evolution (1859) made some readers fear that primitive instincts remained inside civilised people. Hyde is often described with animal-like features.", 2),
          q10.single("The mystery is told mostly through Utterson’s viewpoint, then through Lanyon’s letter and Jekyll’s own statement. What is the effect of this structure?", "It delays the revelation of Hyde’s identity, building suspense to the end", ["It reveals the ending at the start, so that the reader knows everything at once", "It removes all mystery by explaining Hyde’s identity in the first chapter", "It shows that the story is set in the future and told by a distant historian"], "Holding back the truth until the final documents keeps the reader guessing and gives a dramatic reveal.", 3),
          q10.single("In Great Expectations, who is the convict whom young Pip helps on the marshes?", "Abel Magwitch", ["Compeyson", "Bentley Drummle", "Orlick"], "Pip brings food and a file to Magwitch, and this kindness has huge consequences later.", 1),
          q10.single("Miss Havisham keeps her stopped clocks and her old wedding dress. What do they symbolise?", "Her refusal to move on from being jilted, as if time stopped then", ["Her love of fashion and timekeeping, and her pride in her expensive things", "Her wealth and generosity towards the children who visit Satis House", "Her plan to marry Pip when he becomes a gentleman and comes into money"], "The frozen time and decaying dress show a person trapped in the past by heartbreak and bitterness.", 2, true),
          q10.single("Great Expectations is narrated by the adult Pip looking back. What is the effect?", "We see the boy’s experience and the older man’s hindsight, regret and moral judgement", ["It makes the events seem unimportant, as though they happened to someone else", "It means that Pip never makes mistakes and always understands what is happening", "It hides Pip’s feelings from the reader until the very last chapter of the whole book, which is a surprise"], "A retrospective narrator can comment on his younger self, which adds honesty and moral reflection.", 3),
          q10.single("Pip says he loved Estella “against reason, against promise, against peace, against hope, against happiness, against all discouragement that could be.” Which technique is used?", "Repetition of “against”, showing how intense and irrational his love is", ["Alliteration of the “s” sound only, which makes the sentence hiss like a snake", "A simile comparing love to a war that he is fighting against Estella", "A rhetorical question asking the reader whether love can ever be reasonable"], "Listing “against” again and again builds a sense of relentless, unstoppable feeling despite every warning.", 2),
          q10.written("How does Dickens present social class in A Christmas Carol or Great Expectations? Write ONE analytical PEEL paragraph (about 100–120 words) using a short quotation of your choice.", "A strong answer makes a clear point about class, embeds a short quotation, analyses a word or technique, and links to Victorian context (poverty, the Poor Law, ambition to be a gentleman).", "Mark scheme (8 marks, plain-language AO1/AO2/AO3): 2 marks for a clear point and personal interpretation; 2 marks for a well-chosen, accurate quotation; 3 marks for analysing Dickens’s methods (word choice, symbolism, narrative viewpoint) with terminology; 1 mark for a link to Victorian context or the whole novel.", 3, 8),
        ],
      },
      flashcards: cards([
        ["“Bah! Humbug!”", "A Christmas Carol (Scrooge): his dismissal of Christmas and generosity at the start of the novella."],
        ["“solitary as an oyster”", "A Christmas Carol: simile presenting Scrooge as closed off and isolated."],
        ["“Mankind was my business”", "A Christmas Carol (Marley): social responsibility; the duty to help others."],
        ["“God bless us, every one!”", "A Christmas Carol (Tiny Tim): compassion; hope and generosity."],
        ["“man is not truly one, but truly two”", "Dr Jekyll and Mr Hyde (Jekyll): duality of human nature; hidden desires."],
        ["Gothic features in Jekyll and Hyde", "Dark London streets, mystery, secrecy, a monstrous double and fear of what is hidden."],
        ["Miss Havisham’s stopped clocks", "Great Expectations: refusing to move on from being jilted; time frozen by heartbreak."],
        ["“I loved her against reason…”", "Great Expectations (Pip): love as obsessive and irrational."],
        ["Victorian Poor Law (1834)", "A system that pushed the poor into harsh workhouses; criticised by Dickens."],
        ["Retrospective narrator", "A narrator who looks back on earlier events, adding hindsight and judgement."],
      ]),
    },
    11: {
      year: 11,
      objectives: [
        "Read, understand and respond to Jane Eyre, Frankenstein and Pride and Prejudice, linking extracts to the whole novel (AO1).",
        "Analyse how narrators, voice, irony, Gothic and Romantic imagery and structure create meaning (AO2).",
        "Explore contexts: gender and class, Romantic ideas about nature and science, and Regency marriage and inheritance (AO3).",
        "Trace character development and evaluate the writers’ messages.",
        "Use embedded quotations and precise terminology in developed responses.",
      ],
      note: {
        title: "Year 11: Brontë, Shelley and Austen: voices, ideas and contexts",
        body: `## Reading for voice and idea

Ask: **Whose voice do we hear, and can we trust it? What is challenged about society, science or gender?**

| Term | Meaning |
| --- | --- |
| Bildungsroman | A novel about a character’s growth and moral education |
| First-person retrospective | “I” looking back on events |
| Frame narrative | A story set inside another story (*Frankenstein*) |
| Gothic | Fear, secrets, isolated settings and the supernatural |
| The sublime | Awe and terror inspired by nature |
| Free indirect discourse | The narrator’s voice blends with a character’s thoughts |
| Irony | A gap between what is said and what is meant |

## Contexts to know

- ***Jane Eyre*** (1847): a governess’s story that challenges rigid ideas of class and gender.
- ***Frankenstein*** (1818): a Romantic-era Gothic novel, shaped by scientific advances, questions about creation and awe at nature; subtitled *The Modern Prometheus*.
- ***Pride and Prejudice*** (1813): Regency England, where daughters could not inherit an entailed estate, so marriage meant security.

## Worked model paragraph

*Charlotte Brontë makes Jane speak with passionate self-respect. Her outburst “Do you think, because I am poor, obscure, plain, and little, I am soulless and heartless?” is built from a list of self-descriptions that Jane then overturns. The rhetorical question demands Rochester’s respect, showing that Jane values equality of the soul over class or beauty. Readers respond with admiration for her courage.*

The paragraph follows the PEEL shape: point, evidence, explain (the list and rhetorical question), link to theme.`,
      },
      quiz: {
        title: "19th-Century Novel: Year 11 quiz",
        questions: [
          q11.single("In which novel does the narrator address the reader with the words “Reader, I married him”?", "Jane Eyre", ["Pride and Prejudice", "Frankenstein", "Great Expectations"], "Jane Eyre’s narrator speaks directly to “Reader”, creating intimacy and confidence as she describes her marriage to Rochester.", 1),
          q11.single("Jane declares: “I am no bird; and no net ensnares me: I am a free human being with an independent will.” Which idea is expressed?", "Her insistence on independence and equality, refusing to be controlled", ["Her wish to be kept safely in a cage, protected from the outside world", "Her love of birdwatching and of walking in the grounds of Thornfield", "Her fear of leaving Thornfield and of facing the world alone as a governess"], "The bird and net metaphors show she rejects being trapped or owned, a key feminist idea in the novel.", 2, true),
          q11.single("Which feature makes Jane Eyre a Gothic novel?", "A mysterious locked attic, strange laughter and a secret at Thornfield", ["A jolly village fair with dancing, music and a large crowd of visitors", "A courtroom battle over an inheritance between two wealthy families", "A dangerous journey to the Arctic on a ship crewed by explorers"], "Secrets, eerie sounds and a mysterious presence create Gothic tension at Thornfield.", 2),
          q11.single("Why can Jane marry Rochester only after Thornfield has burnt and he has been blinded and injured?", "She is now independent and he is humbled, so they can marry as equals", ["She wants to take his fortune now that he is helpless and cannot stop her", "She has forgotten his past and no longer cares about how he treated her", "She has been ordered to return by her family, who want her to look after him"], "By then Jane has inherited a fortune, and Rochester’s losses remove his dominance, making an equal partnership possible.", 3),
          q11.single("Who narrates the outer frame of Frankenstein through letters to his sister?", "Captain Robert Walton", ["Victor Frankenstein", "The Creature", "Henry Clerval"], "Walton writes to his sister Margaret from the Arctic and passes on Victor’s story, forming a frame narrative.", 1),
          q11.single("Victor says: “It was on a dreary night of November that I beheld the accomplishment of my toils.” What is the effect of the setting?", "The gloomy weather mirrors his dread and creates a Gothic atmosphere", ["It shows that the night is cheerful and full of promise for Victor’s project", "It proves that he is celebrating his success with a happy, lively party", "It suggests that the story is set in the middle of a warm, sunny summer"], "Describing gloomy weather to reflect a mood is pathetic fallacy. It prepares the reader for horror instead of triumph.", 2, true),
          q11.single("The Creature tells Victor: “I ought to be thy Adam, but I am rather the fallen angel.” What does this allusion suggest?", "He feels rejected by his creator, who failed in his duty as a parent", ["He thinks that he is better than Victor and deserves to rule over him", "He is thanking Victor for making him and for giving him such a happy life", "He wants to become a priest and to teach others about the Bible"], "By alluding to Adam and a fallen angel (from Genesis and Milton), he says he deserved care but was cast out.", 3),
          q11.multi("Which THREE are important themes in Frankenstein?", ["Dangerous ambition in scientific pursuit", "A creator’s responsibility for what they make", "Isolation and rejection"], ["The success of a courtship across class lines", "Celebration of industrial progress"], "Victor’s reckless ambition, his abandonment of the Creature and the Creature’s loneliness drive the novel.", 2),
          q11.short("The opening line of Pride and Prejudice (“It is a truth universally acknowledged…”) sets an amused, mocking tone. What one-word term describes this tone? ", "ironic", ["irony", "Ironic", "satirical", "ironical", "satire", "satiric", "ironic.", "irony.", "satirical.", "wry", "sardonic"], "Austen presents a supposed universal truth that is really a comment on marriage-hunting families. This gap between statement and meaning is irony.", 1),
          q11.single("Why is Mrs Bennet so determined to marry off her daughters?", "Women had limited financial independence, and the family estate was entailed to a male heir, so marriage meant security", ["She wants them to leave home as soon as possible so that she can have a quieter house", "Regency law required every daughter to be married by the age of twenty-one, or the family’s estate and income would be forfeited to the Crown", "She hopes to send them to work in London as governesses and shop assistants so that they can earn money for the family"], "In Regency England an entailed estate passed to a male relation, so daughters without a fortune needed advantageous marriages.", 2),
          q11.single("What does “free indirect discourse” allow Austen to do?", "Blend the narrator’s voice with a character’s thoughts, so we see their view and judge it ironically", ["Print the characters’ diaries in full so that each person tells their own story", "Show only what the characters say aloud, without giving any of their thoughts", "Make the narrator disappear completely, so the story is told only through dialogue"], "It lets us hear a character’s thoughts in the narrator’s third-person voice, so irony and insight combine.", 3),
          q11.single("After reading Darcy’s letter, Elizabeth says: “Till this moment I never knew myself.” What does this show?", "A moment of self-realisation: her pride and prejudice have misled her", ["That she has literally forgotten who she is and has lost her memory", "That she has fallen in love with Wickham and wants to run away with him", "That she is angry with her sister Jane for telling her family her secrets"], "Elizabeth recognises her own vanity and prejudice, a turning point in her development.", 2),
          q11.written("How does Mary Shelley present the dangers of ambition in Frankenstein? Write ONE analytical PEEL paragraph (about 100–120 words) using a short quotation of your choice.", "A strong answer makes a clear point about ambition’s dangers, embeds a short quotation, analyses language or narrative method (Gothic imagery, frame narrative, retrospective confession), and links to Romantic and scientific context.", "Mark scheme (8 marks, plain-language AO1/AO2/AO3): 2 marks for a clear point and personal interpretation; 2 marks for a well-chosen, accurate quotation; 3 marks for analysing Shelley’s methods (imagery, narrator, structure) with terminology; 1 mark for a link to context (Romantic ideas, scientific advances) or to the whole novel.", 3, 8),
        ],
      },
      flashcards: cards([
        ["“Reader, I married him”", "Jane Eyre: direct address; Jane’s agency and confidence in telling her own story."],
        ["“I am no bird; and no net ensnares me”", "Jane Eyre: independence and equality; refusing to be controlled."],
        ["“Do you think, because I am poor, obscure, plain, and little, I am soulless and heartless?”", "Jane Eyre: the equality of souls, regardless of class or beauty."],
        ["“I ought to be thy Adam, but I am rather the fallen angel”", "Frankenstein (the Creature): rejection by his creator; parental responsibility."],
        ["Frankenstein: subtitle", "The Modern Prometheus: the myth of a figure who defies the gods and is punished."],
        ["Frankenstein: frame narrative", "Walton’s letters frame Victor’s story, which in turn frames the Creature’s account."],
        ["“It is a truth universally acknowledged…”", "Pride and Prejudice: ironic opening about marriage and money."],
        ["“Till this moment I never knew myself”", "Pride and Prejudice (Elizabeth): self-realisation after Darcy’s letter."],
        ["Entail (Pride and Prejudice)", "A legal arrangement that passed the Bennets’ estate to a male heir, leaving the daughters unprotected."],
        ["Bildungsroman", "A novel tracing a character’s moral and emotional growth (e.g. Jane Eyre)."],
      ]),
    },
  },
};

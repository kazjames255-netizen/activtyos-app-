// A-level English Language — Frameworks & Methods (Years 12–13). Original content aligned to the DfE GCE AS/A-level subject content for English Language.
// All data extracts are ORIGINAL. Structural checks: _check_e5.ts
import type { CTopic } from "../types";
import { build, mu, sg, sh, wr } from "./_h";

export const TOPIC: CTopic = {
  key: "langf",
  topic: "English Language — Frameworks & Methods",
  subject: "English",
  years: {
    12: {
      year: 12,
      objectives: [
        "Use the language levels (phonology, lexis and semantics, grammar, pragmatics, discourse, graphology) with accurate terminology.",
        "Analyse how mode, field, audience, purpose and genre shape spoken, written and multimodal texts.",
        "Describe the features of spontaneous speech and use transcription conventions.",
        "Write a controlled analytical paragraph that links a feature, its effect and its context.",
      ],
      note: {
        title: "Year 12: the language levels and analysing data",
        body: `## Levels and context

Analyse any text level by level, then connect what you find to **context**: mode (spoken, written, multimodal), field (subject matter), audience, purpose and genre.

| Level | What you study | Example terms |
| --- | --- | --- |
| Phonology | sounds and prosody | alliteration, elision, intonation |
| Lexis and semantics | words and meanings | connotation, collocation, semantic field |
| Grammar | word and sentence structure | morphology, clause types, mood, minor sentence |
| Pragmatics | meaning in use | implicature, politeness, Grice's maxims |
| Discourse | whole-text structure | cohesion, turn-taking, openings |
| Graphology | visual layout | font, image, spacing |

**Sentence types:** simple (one main clause), compound (main clauses joined by a coordinator), complex (a main clause plus a subordinate clause) and minor (no finite verb). **Moods:** declarative, interrogative, imperative, exclamative.

**Speech:** spontaneous talk contains fillers, false starts, repair, overlaps and pauses. In common conventions (.) is a micropause and (2) a pause of two seconds. Do not treat these features as errors: they do interactive work.

## Model analytic paragraph

Data: *Small batch. Big morning. Made slowly in Kent, so you don't have to rush.* (coffee advert)

"The advert opens with two parallel minor sentences, 'Small batch. Big morning.', whose matching structure and contrasting adjectives compress the product's appeal into a slogan-like rhythm. The contraction 'don't' and direct address 'you' create an informal, friendly tenor, as if a producer were reassuring a friend. The contrast between the adverb 'slowly' and the verb 'rush' positions the coffee as an antidote to hurried mornings, which suits the persuasive purpose."

**Pattern:** feature, then quotation, then effect, then context.`,
      },
      quiz: {
        title: "Frameworks & Methods: Year 12 quiz",
        questions: build("langf", 12, [
          sg("Which term describes the study of word structure, such as prefixes and suffixes?", "Morphology", ["Phonology", "Pragmatics", "Graphology"], 0, "Morphology is the grammatical level concerned with how words are built from smaller meaningful units such as un-, -ness and -ed.", 1),
          sg("Which of these is a compound sentence?", "I stayed in, and she went out.", ["Although it rained, we went.", "The old dog slept in the sun all afternoon.", "Go home."], 0, "A compound sentence joins two main clauses with a coordinator (here 'and'). 'Although it rained, we went' is complex; the others are simple.", 1),
          sg("Which level of analysis deals with implied meaning, politeness and how context shapes what a speaker intends?", "Pragmatics", ["Morphology", "Graphology", "Phonology"], 3, "Pragmatics is meaning in use: what is implied or meant beyond the literal words, depending on context.", 1),
          sg("Here is an extract: \"Sign up today and we'll take care of the rest.\" What mood is the clause 'Sign up today'?", "Imperative", ["Declarative", "Interrogative", "Exclamative"], 1, "It is a command with no stated subject and a bare-infinitive verb, so it is imperative; advertisers use it to direct the reader to act.", 2, true),
          mu("Which of these are typical of spontaneous conversational speech?", ["Fillers and hesitation such as 'erm'", "Self-repair and false starts", "Carefully edited paragraph structure", "Standard punctuation throughout", "Overlaps between speakers"], ["Fillers and hesitation such as 'erm'", "Self-repair and false starts", "Overlaps between speakers"], "Spontaneous talk is unplanned and interactive, so it contains hesitation, repair and overlap. Edited paragraphs and standard punctuation belong to planned writing.", 2),
          sg("In common A-level transcription conventions, what does (2) placed between two words indicate?", "A timed pause of two seconds", ["A second speaker joining in", "Two syllables were dropped from the word", "The word was said twice"], 2, "A number in brackets records the length of a pause in seconds; (.) records a micropause.", 2),
          sg("Which of these is a feature of MODE rather than audience or purpose?", "Whether the text is spoken, written or multimodal", ["The age and background of the intended reader or listener", "The writer's aim to persuade, inform or entertain", "The subject matter or topic that the text is about"], 0, "Mode is the channel of communication. Audience is the reader, purpose is the aim and subject matter is the field.", 2),
          sg("'Slim' and 'skinny' both mean 'thin', but 'skinny' often sounds critical. This difference is a matter of:", "Connotation", ["Denotation", "Collocation", "Elision"], 1, "Denotation is the literal meaning, which the two words share. Connotation is the attitude or association each carries.", 2, true),
          sh("What is the term for the words that typically appear together, such as 'heavy' with 'rain'?", "collocation", ["collocations", "collocate", "collocates", "a collocation", "collocation.", "collocational"], "Collocation describes the habitual company words keep, and it can reveal register and meaning.", 2),
          sg("Here is an extract from a bicycle-repair advert: \"Flat tyre? Fixed by lunch. Ridden home by tea. We'll mend the puncture; you keep the plans.\" Which analysis of 'We'll mend the puncture; you keep the plans' is most accurate?", "The contraction and the contrast between 'we' and 'you' create an informal tone and split the roles between shop and customer, with balanced clauses.", ["The semi-colon joins a main clause to a subordinate clause beginning with 'you', which makes the register formal and legal, as in a contract between the shop and the customer.", "'puncture' and 'plans' are proper nouns naming the shop's services, and the capital-free layout makes the tone impersonal and businesslike.", "'Flat tyre?' is a declarative sentence that states a fact about the customer's bicycle, so the advert opens in a formal, informative register."], 3, "The semi-colon links two main clauses of similar shape (parallelism). 'We'll' and the pronoun contrast build a personal, informal tenor. The nouns are common nouns and 'Flat tyre?' is a minor interrogative.", 3),
          sg("A asks, 'Are you coming to the party?' B replies, 'I've got an early start.' Which Gricean maxim is B apparently flouting, and what is implied?", "Relation: the reply seems irrelevant but implies a refusal", ["Quality: B is telling a lie and implies enthusiasm", "Quantity: B gives too much detail and implies agreement", "Manner: B is ambiguous and implies uncertainty about the date"], 1, "B does not answer directly, so the maxim of relation (be relevant) seems flouted. The hearer works out the implicature: B is probably not coming.", 3),
          mu("Here is the start of the same bicycle advert: \"Flat tyre? Fixed by lunch. Ridden home by tea.\" Which techniques are used?", ["Minor sentences with the subject and auxiliary left out", "Parallel structure in 'Fixed by lunch' and 'Ridden home by tea'", "A question-and-answer pattern that mimics dialogue", "A complex sentence with several subordinate clauses", "A first-person narrative voice"], ["Minor sentences with the subject and auxiliary left out", "Parallel structure in 'Fixed by lunch' and 'Ridden home by tea'", "A question-and-answer pattern that mimics dialogue"], "Each unit lacks a finite verb phrase (minor), the two statements match in shape, and the opening question is answered as if in conversation. There is no complex sentence and no 'I' narrator.", 3),
          wr("Analyse the language of this extract from a holiday advert, using at least two levels of language and referring to context: \"Bed. Breakfast. Blue skies. Book a weekend you'll actually take.\" (Write one developed paragraph of about 120 words.)", "Mark scheme (6): 2 marks for accurate terminology across at least two levels (e.g. minor sentences, list of three with alliteration, imperative 'Book', contraction, adverb 'actually', second-person address); 2 marks for explaining effects (slogan rhythm, friendly informal tenor, the implied contrast with weekends never taken); 1 mark for linking to context (advert genre, persuasive purpose, consumer audience); 1 mark for clear, controlled expression in feature-quotation-effect-context order. Do not credit feature-spotting without effect.", 3),
        ]),
      },
      flashcards: [
        { front: "Morphology", back: "Grammatical level concerned with word structure: roots, prefixes, suffixes and inflections." },
        { front: "Connotation vs denotation", back: "Denotation is the literal meaning; connotation is the attitude or association a word carries." },
        { front: "Minor sentence", back: "A sentence with no finite verb, e.g. 'Fresh. Local. Yours.' Common in adverts and headlines." },
        { front: "Compound vs complex sentence", back: "Compound: main clauses joined by a coordinator. Complex: a main clause plus at least one subordinate clause." },
        { front: "Four sentence moods", back: "Declarative, interrogative, imperative, exclamative." },
        { front: "Mode", back: "The channel of a text: spoken, written or multimodal." },
        { front: "Field", back: "The subject matter or activity a text is about." },
        { front: "Pragmatics", back: "Meaning in use: implied meaning, politeness and the effect of context." },
        { front: "Transcription: (.) and (2)", back: "(.) is a micropause; (2) is a timed pause of two seconds." },
        { front: "Analytic paragraph pattern", back: "Feature, short quotation, effect, then link to context and purpose." },
      ],
    },
    13: {
      year: 13,
      objectives: [
        "Apply discourse and pragmatic frameworks (cohesion, adjacency pairs, politeness, Grice, speech acts) to unfamiliar data.",
        "Analyse power and representation through agency, passives, nominalisation and modality.",
        "Plan and evaluate a language investigation, including method, ethics and the limits of a small sample.",
        "Use theory selectively and critically rather than as a checklist.",
      ],
      note: {
        title: "Year 13: discourse, pragmatics and power, and investigation method",
        body: `## Frameworks at A2

Move from spotting features to **testing frameworks against data**. Use a theory only when the data invites it, and say where it fits badly.

| Term | Meaning |
| --- | --- |
| Adjacency pair | Two linked turns, such as question and answer |
| Anaphora / cataphora | Reference back to, or forward to, another item |
| Discourse marker | 'well', 'anyway', 'you know': manages talk |
| Politeness (Brown and Levinson) | Face-threatening acts softened by strategies |
| Negative politeness | Hedges, deference, indirectness |
| Indirect speech act | Form and function differ: 'Do you know the time?' |
| Agency | Who is shown as acting |
| Nominalisation | A process turned into a noun: 'the demolition' |
| Modality | Certainty or obligation: 'must', 'might' |

**Power in text:** an agentless passive ('routes will be cut') hides the decision-maker; a nominalisation ('the demolition of the old pool') presents an action as a settled fact.

**Investigation method:** state a hypothesis, choose a sample large enough for cautious claims, obtain consent and anonymise, and remember Labov's **observer's paradox**: people speak differently when they know they are being recorded. Report limitations honestly.

## Model analytic paragraph

Data: *Flood defences will be delayed until next year. Householders had been promised action, a residents' association says.*

"The report foregrounds the affected item, 'Flood defences', while the agentless passive 'will be delayed' leaves the decision-maker unnamed, so responsibility is obscured. The modal 'will' expresses high certainty, presenting the delay as fixed. The second passive, 'had been promised', also omits who made the promise, and the attribution 'a residents' association says' distances the reporter from the criticism, which fits news conventions of apparent neutrality."`,
      },
      quiz: {
        title: "Frameworks & Methods: Year 13 quiz",
        questions: build("langf", 13, [
          sg("Which of these is a typical adjacency pair?", "A question and its answer", ["Two adjectives placed together", "A simile followed by a metaphor", "Two syllables in one word"], 2, "An adjacency pair is two turns by different speakers where the first makes the second expected, such as question and answer or greeting and greeting.", 1),
          sg("In 'Ana lost her keys', the pronoun 'her' referring back to 'Ana' is an example of:", "Anaphoric reference", ["Cataphoric reference", "Ellipsis", "Substitution"], 3, "Anaphora points back to something already mentioned. Cataphora points forward.", 1),
          sh("What term describes items like 'well', 'anyway' and 'you know' that manage the flow of conversation?", "discourse markers", ["discourse marker", "markers", "marker", "a discourse marker", "discourse markers.", "discourse marker.", "discourse particles", "discourse particle", "pragmatic markers", "pragmatic marker"], "Discourse markers signal openings, shifts of topic and closings without adding propositional content.", 1),
          sg("Which is an example of cataphoric reference?", "Before he spoke, the driver checked the mirror.", ["The driver checked the mirror before speaking to Ana.", "Ana lost her keys and found them.", "The driver spoke, and then the driver left."], 1, "'He' points forward to 'the driver', which appears later in the sentence. The pattern of pointing forward is cataphora.", 2),
          sg("A speaker says, 'Sorry to bother you, but could you possibly turn the music down a little?' Using Brown and Levinson, the strategy is best described as:", "Negative politeness", ["Bald on-record", "Positive politeness", "Off-record only"], 2, "Apology, hedges ('possibly', 'a little') and an indirect question form show deference and minimise the imposition: negative politeness.", 2, true),
          mu("Which of these typically signal negative politeness?", ["Hedges such as 'possibly'", "An apology for interrupting", "An indirect request framed as a question", "In-group slang and nicknames", "Exaggerated praise of the hearer"], ["Hedges such as 'possibly'", "An apology for interrupting", "An indirect request framed as a question"], "Negative politeness respects the hearer's freedom from imposition. In-group markers and praise are typical of positive politeness.", 2),
          sg("What is a likely effect of the agentless passive in 'Three protesters were injured'?", "It can leave unclear who caused the injuries", ["It makes the text more informal", "It turns the verb into a noun", "It shows the writer is uncertain the injuries happened"], 0, "In a passive with no 'by' phrase the agent is deleted, so responsibility is hidden or downplayed.", 2),
          sg("Which sentence contains a nominalisation?", "The closure of the library disappointed many.", ["They closed the library.", "The library was closed by the council last spring.", "Was the library closed?"], 3, "'Closure' turns the action 'close' into a noun, which can present the event as a settled fact with no visible agent.", 2, true),
          sg("A student records friends chatting for a language investigation, but the friends become self-conscious and speak more carefully. This methodological problem is called:", "The observer's paradox", ["Hypercorrection", "Accommodation", "Code-switching between registers"], 1, "Labov's observer's paradox is that we want to observe natural speech but observation itself changes it.", 2),
          sg("'Can you pass the salt?' is asked, and the hearer passes it. The utterance is best described as:", "An indirect speech act: a question in form that functions as a request", ["A flout of the maxim of quality, since the speaker already knows that the hearer can pass it", "An adjacency pair in which the second part is missing because the hearer does not reply", "An example of ellipsis"], 2, "Following Searle, the interrogative form is not meant to elicit information about ability; its function is a polite request.", 3),
          mu("Which of these are sound practices in a language investigation?", ["Collect enough data to make cautious, qualified claims", "Obtain consent and anonymise participants", "Select only the extracts that support your hypothesis", "Link observations to frameworks and to context", "Treat a 300-word sample as proving a universal rule"], ["Collect enough data to make cautious, qualified claims", "Obtain consent and anonymise participants", "Link observations to frameworks and to context"], "Good method is ethical, uses adequate and representative data and links features to theory and context. Cherry-picking and over-generalising are flaws.", 3),
          sg("Extract: \"Bus routes will be cut across the county. Residents were not consulted, a campaign group says.\" Which analysis is best supported?", "The agentless passives leave the decision-maker unnamed, and the attribution 'a campaign group says' keeps the reporter at arm's length from the claim.", ["The modal 'will' shows that the reporter is unsure whether the cuts will happen, and the passive 'were not consulted' shows that residents chose not to attend.", "'Residents' is a pronoun that hides who was affected, and 'a campaign group' is a proper noun naming the council department that made the decision.", "The comma before 'a campaign group says' marks a change of speaker, showing that the extract is a spoken transcript rather than a written news report."], 0, "'will be cut' and 'were not consulted' have no stated agent. 'Will' expresses high certainty, and reporting the claim as someone else's speech distances the reporter.", 3),
          wr("Analyse the language of this extract, referring to at least two frameworks from this course: \"Library hours will be reduced from April. Parents were told by letter, the council confirmed.\" (About 150 words.)", "Mark scheme (6): 2 marks for accurate framework terms (agentless passive 'will be reduced', 'were told' with a later agent, modality 'will', reporting clause 'the council confirmed', foregrounding); 2 marks for explaining how they position the reader and hide or reveal responsibility; 1 mark for linking to context (news genre, apparent neutrality, audience); 1 mark for a critical evaluative comment (e.g. noting a passive can be neutral, or that the headline is not in the data). Award no marks for listing terms without effect.", 3),
        ]),
      },
      flashcards: [
        { front: "Adjacency pair", back: "Two related turns by different speakers, e.g. question and answer." },
        { front: "Anaphora vs cataphora", back: "Anaphora refers back to an earlier item; cataphora points forward to a later one." },
        { front: "Discourse marker", back: "Word or phrase such as 'well' or 'anyway' that manages the flow of talk." },
        { front: "Grice's four maxims", back: "Quantity, quality, relation and manner (the cooperative principle). Flouting them creates implicature." },
        { front: "Brown and Levinson: face", back: "Positive face is the wish to be liked; negative face is the wish not to be imposed on. Face-threatening acts are softened by politeness strategies." },
        { front: "Searle: indirect speech act", back: "An utterance whose form and function differ, e.g. 'Do you know the time?' as a request to be told it." },
        { front: "Agentless passive", back: "A passive with no 'by' phrase, which can hide who performed the action." },
        { front: "Nominalisation", back: "Turning a process into a noun ('cut' to 'the cut'), which can remove agents and sound like a fact." },
        { front: "Observer's paradox (Labov)", back: "Researchers want natural speech, but being observed changes how people speak." },
        { front: "Halliday: three metafunctions", back: "Ideational (representing experience), interpersonal (relationships) and textual (organising the message)." },
      ],
    },
  },
};

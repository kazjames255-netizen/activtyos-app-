// A-level English Language — Change & Variation (Years 12–13). Original content aligned to the DfE GCE AS/A-level subject content for English Language.
// Theory references are limited to attributions the author is certain of. Structural checks: _check_e5.ts
import type { CTopic } from "../types";
import { build, mu, sg, sh, wr } from "./_h";

export const TOPIC: CTopic = {
  key: "langc",
  topic: "English Language — Change & Variation",
  subject: "English",
  years: {
    12: {
      year: 12,
      objectives: [
        "Describe how English changes over time: lexical, semantic, grammatical, phonological and graphological change.",
        "Explain causes of change (technology, contact, social attitudes, prestige) and the role of standardisation.",
        "Distinguish prescriptivist and descriptivist attitudes and evaluate popular claims about language decline.",
        "Distinguish accent and dialect and describe basic regional variation, including Standard English as a dialect.",
      ],
      note: {
        title: "Year 12: language change, attitudes and regional variation",
        body: `## How English changes

| Type of change | Example |
| --- | --- |
| Lexical: borrowing | 'window' (Old Norse), 'algebra' (Arabic, via Latin) |
| Lexical: word formation | blend 'smog'; conversion 'to friend'; initialism 'BTW' |
| Semantic: narrowing | 'meat' once meant food in general |
| Semantic: broadening | 'bird' once meant a young bird |
| Semantic: amelioration | 'nice' moved from 'foolish' towards 'pleasant' |
| Semantic: pejoration | 'villain' moved from 'farm worker' towards 'wicked person' |
| Grammatical | plurals such as 'eyen' gave way to 'eyes' |
| Phonological | the Great Vowel Shift (roughly 1400 to 1700) |

**Causes:** technology (printing, digital media), contact with other languages, social change and prestige. **Standardisation** was pushed along by printing (Caxton, 1476) and dictionaries such as Johnson's (1755).

**Attitudes:** a **prescriptivist** says how language should be used and judges 'errors'; a **descriptivist** records how it is used. Jean Aitchison names three popular metaphors: the **damp spoon** (change is laziness), the **crumbling castle** (a perfect past decays) and the **infectious disease** (change spreads by contact).

**Variation:** an **accent** is pronunciation (for example H-dropping: 'ouse' for 'house'); a **dialect** includes grammar and vocabulary. Standard English is a prestigious dialect; Received Pronunciation is an accent.

## Model analytic paragraph

Data: *omg, that's sick, ttyl*

"The text shows lexical creativity: 'omg' and 'ttyl' are initialisms, driven by economy and speed in a text-based mode, while 'sick' shows semantic shift, since a negative word is used as an approving one in informal youth usage. Rather than the 'crumbling castle' view of decay, the data suggests users adapt their language to context, as descriptivists argue."`,
      },
      quiz: {
        title: "Change & Variation: Year 12 quiz",
        questions: build("langc", 12, [
          sg("What best describes the Great Vowel Shift?", "A series of changes in the pronunciation of English long vowels, roughly between 1400 and 1700", ["A change in English spelling introduced by the first printed dictionaries, which fixed the vowel letters used in most words", "The replacement of Old English vocabulary by Norman French words after the Conquest of 1066, especially in law and government", "A shift in the grammar of verbs from -eth to -s endings"], 0, "The Great Vowel Shift changed how long vowels were pronounced (for example a sound like 'mus' became 'mouse'), which is one reason spelling and pronunciation now differ.", 1),
          sg("Which statement is descriptivist?", "Linguists record how people actually use language without judging some forms as wrong.", ["'Between you and I' is a grammatical error that teachers should always correct, because the pronoun after a preposition must be 'me'.", "Text-speak is ruining young people's writing, and examiners should penalise any abbreviation they find.", "Dictionaries should decide which new words are allowed."], 1, "Descriptivists describe usage as it is; prescriptivists prescribe what should be used.", 1),
          sh("What word-formation process gives 'brunch' (breakfast plus lunch)?", "blend", ["blending", "portmanteau", "a blend", "a portmanteau", "portmanteau word", "a portmanteau word", "blend word", "a blend word", "blended", "blend.", "blending."], "A blend joins parts of two words to make a new one. 'Portmanteau word' is another name for the same process.", 1),
          sg("In Old English 'hund' meant any dog; 'hound' now means a specific type of dog. This semantic change is:", "Narrowing", ["Broadening", "Amelioration", "Pejoration"], 2, "The word's range of meaning has become smaller, so it is narrowing.", 2, true),
          sg("In Aitchison's metaphors, which suggests that language change spreads from speaker to speaker by contact?", "The infectious disease", ["The damp spoon", "The crumbling castle", "The unstoppable rising tide"], 0, "Aitchison's three metaphors are damp spoon (sloppiness), crumbling castle (decay from a golden past) and infectious disease (spread by contact).", 2),
          sg("Which 1755 publication is most associated with efforts to fix English spellings and meanings?", "Johnson's Dictionary", ["Caxton's first printed book", "Webster's American dictionary", "The first complete Oxford English Dictionary"], 3, "Samuel Johnson's dictionary of 1755 influenced standardisation. Caxton introduced printing in 1476; Webster's American dictionary is from 1828.", 2),
          sg("A speaker says 'bu'er' for 'butter', replacing the /t/ with a glottal stop. This is a feature of:", "Accent (pronunciation)", ["Dialect vocabulary", "Dialect grammar", "Standard English grammar"], 1, "Glottalling changes how a word is pronounced but not its form or meaning, so it is an accent feature.", 2, true),
          mu("Which of these are processes that produce new words?", ["Blending", "Conversion (for example noun to verb: 'to text')", "Initialism", "Pejoration", "Standardisation"], ["Blending", "Conversion (for example noun to verb: 'to text')", "Initialism"], "Blending, conversion and initialism create neologisms. Pejoration is a semantic shift in an existing word and standardisation is a social process.", 2),
          sg("The Old English word 'sælig' meant 'happy' or 'blessed'; the modern 'silly' means 'foolish'. This change is:", "Pejoration", ["Amelioration", "Narrowing", "Blending"], 3, "The word's meaning has become more negative, which is pejoration.", 2),
          mu("In the sentence 'Hast thou seen my friend? She cometh not', which features mark it as earlier English?", ["The second-person singular pronoun 'thou'", "The -eth verb ending in 'cometh'", "Question formation by inversion ('Hast thou seen...?') without 'do'", "The present perfect, a structure no longer used", "An initialism used for economy"], ["The second-person singular pronoun 'thou'", "The -eth verb ending in 'cometh'", "Question formation by inversion ('Hast thou seen...?') without 'do'"], "Thou, -eth endings and questions formed by inversion are typical of Early Modern English. The present perfect still exists and no initialism appears.", 3),
          sg("A newspaper columnist claims that texting is 'destroying English'. Which evaluation is best supported by descriptivist evidence such as David Crystal's?", "Texting adds informal forms alongside standard ones, and users still switch register for different contexts", ["Texting proves that children can no longer spell, because abbreviations such as 'gr8' replace the standard forms in their exam writing", "Any new word shows that the language is decaying, since a stable language should not need vocabulary that Johnson's dictionary did not record", "Only prescriptive rules taught in schools can keep a language stable, so texting should be banned in the classroom"], 0, "Crystal argues that text abbreviations are creative and used alongside standard English, so decay is not evidenced. The other options assume decay without evidence.", 3),
          sg("A letter to a newspaper says 'less people' is always wrong and a sign of falling standards. Which response is best?", "The complaint is prescriptivist; a descriptivist would point out that the usage is widespread and has a long history", ["The complaint is descriptivist, because it records a usage that the writer has observed and reports it to other readers", "The complaint is correct, because the rule that 'fewer' goes with countable nouns has never changed and is fixed in every dictionary", "The complaint shows that language change is caused by technology, since 'less people' is a form that first appeared in text messages"], 2, "Insisting that a form is wrong is prescriptivism. Descriptivists look at evidence of usage over time.", 3),
          wr("'Language change is decay.' Evaluate this view using at least two concepts from this course (for example semantic change, standardisation, Aitchison's metaphors or word formation). (About 150 words.)", "Mark scheme (6): 2 marks for accurate concepts with examples (e.g. amelioration 'nice', blending 'brunch', Great Vowel Shift, Johnson 1755); 2 marks for evaluation weighing attitudes (prescriptivist 'decay' against descriptivist evidence such as continual adaptation and the fact that every stage of English changed earlier forms); 1 mark for use of Aitchison's metaphors or Crystal on technology accurately; 1 mark for a reasoned conclusion. Do not credit opinion unsupported by linguistic evidence.", 3),
        ]),
      },
      flashcards: [
        { front: "Great Vowel Shift", back: "Change in the pronunciation of English long vowels, roughly 1400 to 1700; a reason for irregular spelling." },
        { front: "Narrowing, with an example", back: "A word's meaning becomes more specific: 'meat' from food in general to animal flesh." },
        { front: "Amelioration vs pejoration", back: "Amelioration: meaning improves ('nice'). Pejoration: meaning worsens ('villain')." },
        { front: "Blend, conversion, initialism", back: "Blend: 'smog'. Conversion: noun to verb, 'to friend'. Initialism: 'BTW'." },
        { front: "Aitchison's three metaphors", back: "Damp spoon (laziness), crumbling castle (decay from the past), infectious disease (spread by contact)." },
        { front: "Prescriptivism vs descriptivism", back: "Prescriptivism dictates correct use; descriptivism records actual use." },
        { front: "Accent vs dialect", back: "Accent is pronunciation only; dialect includes grammar and vocabulary as well." },
        { front: "Standard English", back: "A prestigious dialect (grammar and vocabulary), not an accent." },
        { front: "Caxton, 1476", back: "Introduced printing to England, which encouraged more fixed spelling." },
        { front: "Johnson, 1755", back: "Published A Dictionary of the English Language, influencing standardisation of spelling and meaning." },
      ],
    },
    13: {
      year: 13,
      objectives: [
        "Analyse social variation (class, age, gender, ethnicity, network) using key studies: Labov, Trudgill, Milroy and Giles.",
        "Evaluate approaches to language and gender (deficit, dominance, difference) and language and power.",
        "Describe and evaluate theories of child language acquisition (behaviourist, nativist, cognitive, interactionist) and stages of development.",
        "Apply theory to original data with critical awareness of its limits.",
      ],
      note: {
        title: "Year 13: social variation, gender and power, and child language acquisition",
        body: `## Theorists and ideas

| Theorist | Key idea |
| --- | --- |
| Labov | New York department stores: pronunciation of /r/ varies with class and formality |
| Trudgill | Norwich: covert prestige of non-standard forms |
| Milroy | Belfast: strong social networks maintain local speech |
| Giles | Accommodation: convergence towards, or divergence from, another speaker |
| Lakoff | Deficit view: women's language marked by hedges and tag questions |
| Zimmerman and West | Dominance: interruptions in mixed-sex talk |
| Tannen | Difference: report talk and rapport talk |
| Fairclough | Language and power, including synthetic personalisation |
| Skinner | Behaviourism: imitation and reinforcement |
| Chomsky | Nativism: an innate Language Acquisition Device |
| Piaget | Cognitive: language follows cognitive development |
| Bruner | Interactionism: scaffolding and a support system |
| Berko | The wug test: children apply rules to new words |
| Halliday | Seven functions of early language |

**Stages:** babbling, holophrastic (one word), two-word, telegraphic, then post-telegraphic speech with more grammar.

**Evaluate:** each study has limits (era, place, sample size, later criticism). Say when a theory explains the data and when it does not.

## Model analytic paragraph

Data: a child says *"Two mouses are in the box."*

"The plural 'mouses' shows an overgeneralisation: the child applies the regular -s rule to an irregular noun. This is difficult for behaviourism to explain, since adults do not say 'mouses', so it supports the view that children internalise rules, as Chomsky's nativism and Berko's wug test suggest. Bruner would add that caregivers scaffold correction by recasting it ('Yes, two mice')."`,
      },
      quiz: {
        title: "Change & Variation: Year 13 quiz",
        questions: build("langc", 13, [
          sg("Which theorist proposed that children are born with an innate Language Acquisition Device?", "Chomsky", ["Skinner", "Bruner", "Piaget"], 0, "Chomsky's nativist theory holds that children have an innate capacity for grammar (the LAD, later universal grammar).", 1),
          sg("Which theory claims that children learn language mainly through imitation and reinforcement?", "Behaviourist", ["Nativist", "Cognitive", "Interactionist"], 3, "Skinner's behaviourism held that language is learned through operant conditioning: imitation, praise and reward.", 1),
          sh("What is the name for the stage in which a child uses single words to stand for whole ideas?", "holophrastic", ["holophrastic stage", "one-word stage", "holophrase", "the holophrastic stage", "the one-word stage", "one word stage", "the one word stage", "single-word stage", "single word stage", "the single-word stage", "holophrastic phase", "holophrasis", "one-word", "holophrastic."], "In the holophrastic (one-word) stage a word such as 'milk' may mean 'I want milk'.", 1),
          sg("A three-year-old says 'I goed to the park'. What does this most likely show?", "The child has internalised the regular past-tense rule and overgeneralised it", ["The child is copying an adult who said 'goed', since children learn every form by imitating what they hear", "The child has no knowledge of grammar yet and is producing random sounds that happen to resemble words", "The child is still at the babbling stage"], 2, "Adults do not say 'goed', so the child has formed a rule (add -ed) and applied it to an irregular verb.", 2, true),
          sg("What did Jean Berko's wug test (1958) show?", "Children can apply morphological rules, such as plural -s, to invented words", ["Children learn every plural form by imitating adults, and cannot pluralise a word they have never heard", "Children cannot form plurals before school age, because the -s rule is only learned through reading", "Children ignore grammar in favour of vocabulary"], 1, "Children supplied 'wugs' for a nonsense word they had never heard, showing knowledge of rules.", 2),
          sg("Which idea is associated with Bruner?", "Adult support, such as scaffolding and routines, helps children acquire language", ["A child speaks only after passing through a fixed cognitive stage, which must be completed before words appear", "Language is learned only by reinforcement", "There is a single innate grammar module"], 3, "Bruner emphasised the social interaction that supports learning, sometimes called a Language Acquisition Support System.", 2),
          sg("Labov's 1960s department-store study of /r/ in New York found that:", "The pronunciation of /r/ varied with the status of the store and the formality of the speech", ["Everyone pronounced /r/ identically in every store, so class made no difference to speech at all", "Men used /r/ more than women in every store", "Only lower-status speakers used /r/"], 0, "The prestige store showed the highest rates of /r/, linking pronunciation to class and style.", 2),
          sg("Working-class speakers preferring non-standard forms because they signal solidarity and toughness illustrates:", "Covert prestige", ["Overt prestige", "Hypercorrection", "Received Pronunciation"], 1, "Covert prestige is the value attached to non-standard forms within a group, as reported in Trudgill's Norwich study.", 2),
          sg("Which statement best reflects Tannen's difference approach?", "Men and women often have different conversational styles, like cross-cultural differences, such as report talk and rapport talk", ["Women's speech is deficient compared with men's, marked by hedges and tag questions that show a lack of confidence", "Men control mixed-sex conversations through interruption and topic control, so the imbalance reflects social power rather than culture", "Gender has no influence on language use, and any apparent differences are explained entirely by class and region"], 2, "Tannen argues that differences are cultural rather than deficient. The deficit view is Lakoff's; dominance is Zimmerman and West's.", 2, true),
          mu("Which of these pairings are accurate?", ["Lakoff: hedges and tag questions in women's language", "Zimmerman and West: interruptions in mixed-sex conversation", "Halliday: seven functions of early language", "Labov: the Language Acquisition Device", "Piaget: the Great Vowel Shift"], ["Lakoff: hedges and tag questions in women's language", "Zimmerman and West: interruptions in mixed-sex conversation", "Halliday: seven functions of early language"], "The LAD is Chomsky's idea, and the Great Vowel Shift is a historical sound change unrelated to Piaget.", 3),
          sg("A speaker from Leeds gradually shifts towards the accent of the interviewer in a job interview. Which term applies, and why does Giles say people do this?", "Convergence, to gain approval and reduce social distance", ["Divergence, to stress the speaker's Leeds identity and mark distance from the interviewer", "Covert prestige, to hide their region by adopting the interviewer's non-standard forms", "Hypercorrection, to sound less formal"], 0, "Giles's accommodation theory says people converge to win approval and diverge to emphasise a separate identity.", 3),
          mu("Child: 'Doggie run.' Mother: 'Yes, the doggie is running fast!' Which ideas does this exchange illustrate?", ["A two-word stage utterance from the child", "Expansion or recasting by the adult", "Scaffolding of the child's language", "Overgeneralisation of a rule", "Canonical babbling"], ["A two-word stage utterance from the child", "Expansion or recasting by the adult", "Scaffolding of the child's language"], "The child's two words are typical of the two-word stage; the mother models a fuller structure. There is no rule overgeneralisation or babbling.", 3),
          wr("Evaluate the behaviourist and nativist explanations of children's language acquisition, using the child utterance \"I goed to the park\" as evidence. (About 150 words.)", "Mark scheme (6): 2 marks for accurate explanation of both theories (Skinner: imitation and reinforcement; Chomsky: innate LAD/universal grammar); 2 marks for applying 'goed' as overgeneralisation that behaviourism struggles to explain because adults do not say it; 1 mark for a balanced evaluation (limits of nativism such as the role of input, Bruner's interaction, Berko's wug test as support); 1 mark for a clear conclusion. Do not credit description of stages without evaluation.", 3),
        ]),
      },
      flashcards: [
        { front: "Chomsky: LAD", back: "Nativist idea that children are born with an innate capacity for language (Language Acquisition Device)." },
        { front: "Skinner", back: "Behaviourist: language is learned by imitation, reinforcement and conditioning." },
        { front: "Piaget", back: "Cognitive approach: language development follows general cognitive development." },
        { front: "Bruner", back: "Interactionist: caregivers scaffold learning, supported by routines and child-directed speech." },
        { front: "Berko's wug test", back: "Children add plural -s to invented words, showing they know rules." },
        { front: "Halliday: functions of early language", back: "Seven functions, such as instrumental, regulatory, interactional, personal, heuristic, imaginative and representational." },
        { front: "Labov: department stores", back: "Postvocalic /r/ in New York varied by store status and style; evidence of social stratification." },
        { front: "Trudgill: covert prestige", back: "Non-standard forms carry positive value within a group, especially for working-class men in Norwich." },
        { front: "Lakoff vs Tannen", back: "Lakoff: deficit view of women's language. Tannen: difference view (report talk and rapport talk)." },
        { front: "Giles: accommodation", back: "Convergence to win approval; divergence to mark a separate identity." },
      ],
    },
  },
};

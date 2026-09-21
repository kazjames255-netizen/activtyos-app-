// A-level English Literature — Critical Theory & Unseen (Years 12–13). Original content aligned to the DfE GCE AS/A-level subject content for English Literature.
// Theory attributions limited to those the author is certain of; all unseen extracts are ORIGINAL.
import type { CTopic } from "../types";
import { build, mu, sg, sh, wr } from "./_h";

export const TOPIC: CTopic = {
  key: "litt",
  topic: "English Literature — Critical Theory & Unseen",
  subject: "English",
  years: {
    12: {
      year: 12,
      objectives: [
        "Understand and apply Marxist, feminist and psychoanalytic approaches to literary texts.",
        "Use literary terminology accurately (pathetic fallacy, semantic field, juxtaposition, symbol, motif, syntax).",
        "Analyse an unseen prose or poetry extract with a controlled argument and short quotations.",
        "Recognise that a critical lens is a way of reading, to be justified by evidence in the text.",
      ],
      note: {
        title: "Year 12: critical lenses and unseen analysis",
        body: `## Three lenses

| Lens | Key ideas and thinkers |
| --- | --- |
| Marxist | Class, ownership, labour, **ideology** (beliefs that make power seem natural); Karl Marx |
| Feminist | Gender, **patriarchy**, representation; Simone de Beauvoir, Virginia Woolf, Gilbert and Gubar |
| Psychoanalytic | The unconscious, repression, id, ego and superego, the uncanny; Sigmund Freud |

A **lens** asks questions of a text, but you must ground every claim in the words. If the extract does not support a lens, say so rather than forcing it. Name your lens early in the answer, keep quotations short, and always explain the effect of the words you quote.

## Unseen technique

1. Read twice: first for meaning and tone, then for methods.
2. Choose two or three strong features (diction, imagery, syntax, structure, voice).
3. Write with a thesis; move from methods to effects to context.
4. Use terminology precisely: **semantic field**, **juxtaposition**, **symbol**, **motif**, **pathetic fallacy** (nature mirrors mood), **syntax** (sentence structure).

Also comment on **structure**: where the focus shifts, how the ending lands.

## Model analytic paragraph

Data: *The mill-owner's daughter was taught to sing beautifully and to say nothing.*

"A Marxist reading notes that the daughter's 'beautifully' trained voice is an accomplishment that decorates her family's wealth, so her skills signal class status. A feminist reading adds that the coordination 'sing beautifully and ... say nothing' shows patriarchal expectation that she be ornamental yet silent. The agentless passive 'was taught' leaves the teachers unnamed, which presents this socialisation as natural, an example of ideology at work."`,
      },
      quiz: {
        title: "Critical Theory & Unseen: Year 12 quiz",
        questions: build("litt", 12, [
          sg("Which critical approach focuses mainly on class, ownership and economic power in a text?", "Marxist criticism", ["Psychoanalytic criticism", "Ecocriticism", "Formalism"], 0, "Marxist criticism reads texts in terms of class relations, labour and ideology.", 1),
          sg("Which approach examines how gender and patriarchal power are represented?", "Feminist criticism", ["Marxist criticism", "New historicist criticism", "Structuralism"], 3, "Feminist criticism asks how women and men are represented, and how texts reinforce or challenge patriarchal structures.", 1),
          sh("Whose theory of the mind includes the id, ego and superego?", "Freud", ["Sigmund Freud", "sigmund freud", "Freud.", "Sigmund Freud.", "S. Freud"], "Freud's structural model divides the mind into the id, the ego and the superego.", 1),
          sg("In Marxist criticism, what does 'ideology' mean?", "Shared assumptions that make existing power relations seem natural or inevitable", ["A person's private religious belief about morality, which the text is meant to teach the reader directly", "A poem's rhyme scheme", "The date a text was written"], 2, "Ideology works by making the interests of the powerful look like common sense.", 2),
          sg("In feminist criticism, the 'madwoman in the attic' (Gilbert and Gubar) is used to discuss:", "How women writers and characters express repressed anger, with the mad or monstrous woman as a double of the heroine", ["The role of servants in Victorian houses, and how they resist their employers through open rebellion in every novel", "The architecture of Gothic castles", "Male narrators in adventure stories"], 1, "Gilbert and Gubar's study of women writers reads the 'madwoman' figure as an expression of female rage under patriarchy.", 2),
          sg("In psychoanalytic criticism, what is repression?", "The pushing of disturbing thoughts or desires out of conscious awareness, though they may resurface", ["The deliberate hiding of a book or letter by a character who does not want anyone else to find or read it", "The re-use of a rhyme scheme", "A character's political oppression only"], 2, "For Freud, repressed material persists in the unconscious and reappears in dreams, slips and symbols.", 2, true),
          sg("Read this original extract.\n\n\"By six the maids had laid out the breakfast in the long room, and by seven Mr Aldous had eaten it. He did not notice the girl who cleared the plates; she moved as the furniture did, as though she had always been part of the room. The silver, however, he noticed at once; the silver was his father's.\"\n\nWhich is the best Marxist reading of 'she moved as the furniture did'?", "The servant is treated like property, her labour invisible to the owner", ["The girl is admired by Mr Aldous for her grace and elegance, and is treated as a valued member of the family", "The girl is the owner of the room", "It is a joke about badly made furniture"], 3, "The simile reduces her to an object, and the contrast with the noticed silver shows how the owner values property over people.", 2, true),
          sg("In the original extract about Mr Aldous, the opening sentence 'By six the maids had laid out the breakfast in the long room, and by seven Mr Aldous had eaten it' uses which structure?", "Parallel structure that suggests the routine of a household", ["Free verse with irregular line lengths", "Alliterative verse in the Old English style", "Interrogative mood, asking the reader when breakfast was served"], 0, "The repeated 'by' phrases create a sequence that mirrors the ordered household timetable.", 2),
          mu("Which of these are examples of pathetic fallacy?", ["The sky wept over the funeral.", "Angry clouds gathered as the quarrel began.", "It rained on Tuesday.", "The postman's van was red.", "The wind howled its grief around the empty house."], ["The sky wept over the funeral.", "Angry clouds gathered as the quarrel began.", "The wind howled its grief around the empty house."], "Pathetic fallacy gives nature human feelings that reflect mood. The other two sentences are plain descriptions.", 2),
          sg("Which situation best matches Freud's idea of the uncanny?", "A familiar doll or image that suddenly seems strangely alive", ["A stranger politely asking for directions in an unfamiliar town, which is a normal social meeting", "A loud argument in a public place", "A well-known song on the radio"], 1, "The uncanny (das Unheimliche) is the familiar made strange, arousing unease.", 3),
          sg("Two critics read this original extract.\n\n\"By six the maids had laid out the breakfast in the long room, and by seven Mr Aldous had eaten it. He did not notice the girl who cleared the plates; she moved as the furniture did, as though she had always been part of the room. The silver, however, he noticed at once; the silver was his father's.\"\n\nWhich combined claim is best supported?", "It shows class hierarchy through the servant treated as furniture, and gender-coded domestic labour, both reinforced by inherited property", ["It proves that all servants in such households were happy, since the girl never complains about her work", "It shows equal relationships between master and maids, since they share the same room and the same breakfast table", "It is mainly a description of breakfast food and silverware, with no comment on the people who serve or eat it"], 2, "The class point rests on the simile and 'his father's' silver; the gender point rests on 'maids' and 'girl'. Both are grounded in the text.", 3),
          mu("Which are sound practices when analysing an unseen extract?", ["Quote briefly and analyse specific words", "Comment on structure as well as language", "Apply a lens only where the extract supports it", "Retell the plot in order", "Assume the author's biography explains every choice"], ["Quote briefly and analyse specific words", "Comment on structure as well as language", "Apply a lens only where the extract supports it"], "Good analysis is focused, evidence-based and selective. Retelling and assuming biography are weak.", 3),
          wr("Read this original extract and write an analytical paragraph from a Marxist or feminist perspective (choose one): \"By six the maids had laid out the breakfast in the long room, and by seven Mr Aldous had eaten it. He did not notice the girl who cleared the plates; she moved as the furniture did, as though she had always been part of the room. The silver, however, he noticed at once; the silver was his father's.\" (About 150 words.)", "Mark scheme (6): 2 marks for precise features (simile 'as the furniture did', parallel 'By six ... by seven', contrast between 'did not notice' and 'noticed at once', inherited 'silver', the words 'maids' and 'girl'); 2 marks for a clear lens-based argument (Marxist: ownership, invisible labour, inherited wealth; Feminist: gendered domestic labour, a male owner and female servants); 1 mark for a contextual or ideological insight (household hierarchy, ideology making the arrangement seem natural); 1 mark for controlled, quotation-based writing. Do not credit unsupported assertion.", 3),
        ]),
      },
      flashcards: [
        { front: "Marxist criticism", back: "Reads texts through class, ownership, labour and ideology." },
        { front: "Ideology", back: "Assumptions that make existing power relations seem natural." },
        { front: "Feminist criticism", back: "Examines gender, patriarchy and the representation of women and men." },
        { front: "Gilbert and Gubar, 1979", back: "The Madwoman in the Attic: reads mad or monstrous women as doubles expressing female anger." },
        { front: "de Beauvoir", back: "'One is not born, but rather becomes, a woman' (The Second Sex, 1949): gender is constructed." },
        { front: "Woolf, A Room of One's Own (1929)", back: "Argues that a woman needs money and a room of her own to write fiction." },
        { front: "Psychoanalytic criticism", back: "Uses Freud's ideas: the unconscious, repression, id, ego, superego and the uncanny." },
        { front: "Pathetic fallacy", back: "Nature reflecting human mood, as in stormy weather for anger." },
        { front: "Semantic field", back: "A group of words linked by meaning, e.g. words of war or of nature." },
        { front: "Unseen response pattern", back: "Read twice, choose strong features, argue with a thesis, and link method to effect." },
      ],
    },
    13: {
      year: 13,
      objectives: [
        "Apply post-colonial, ecocritical and new historicist approaches, and understand key ideas from deconstruction and psychoanalysis.",
        "Compare and evaluate critical readings of the same text or extract.",
        "Use critical terminology accurately and with a clear argument, including on unseen extracts.",
        "Recognise the limits and assumptions of each critical approach.",
      ],
      note: {
        title: "Year 13: post-colonial, ecocritical and new historicist lenses; evaluating theory",
        body: `## More lenses

| Lens | Key ideas and thinkers |
| --- | --- |
| Post-colonial | Empire, the **Other**, hybridity; Edward Said (Orientalism), Homi Bhabha, Frantz Fanon |
| Ecocritical | Literature and the environment; anthropocentrism against ecocentrism |
| New historicism | Literature and other period texts as parts of one culture and its power relations; Stephen Greenblatt |
| Deconstruction | Meaning is unstable; binary oppositions collapse; Jacques Derrida |
| Psychoanalytic (Lacan) | The **mirror stage**: the infant forms an ideal self-image through a reflection |

**Evaluating theory:** each lens reveals some things and hides others. A strong response says why a lens fits *this* text, and weighs an alternative reading. Avoid claiming that a lens proves what the writer intended.

**Applying lenses to an unseen:** pick the features that invite the lens (naming, mapping, resource words, silence), then test the reading against the words.

## Model analytic paragraph

Data: *The old oak on the boundary was marked with a blaze; by spring it would be a gatepost, and the estate ledger recorded it as timber, four pounds.*

"An ecocritical reading notes that the oak is converted from a living tree to 'timber', a resource valued in pounds, which reflects an anthropocentric view of nature. A Marxist reading would add that the 'estate ledger' turns the natural world into property. A new historicist reading might set the passage beside period estate records to show how ownership and management shaped what was seen as valuable. The modal 'would' registers the inevitability of this conversion."`,
      },
      quiz: {
        title: "Critical Theory & Unseen: Year 13 quiz",
        questions: build("litt", 13, [
          sg("Post-colonial criticism mainly examines:", "The effects of colonialism and empire, and how texts represent colonised peoples and cultures", ["The rhyme schemes and metres of poetry written in the colonies, without regard to power or politics or history", "How readers respond to punctuation", "Only texts written before 1800"], 0, "Post-colonial critics ask how imperial power shapes literature and how cultural identities are represented.", 1),
          sg("Ecocriticism studies:", "The relationship between literature and the natural environment", ["The class conflicts in factory novels and the working lives of Victorian mill workers and their employers", "The unconscious desires of characters", "The structure of Shakespearean sonnets"], 1, "Ecocriticism explores how texts represent nature and human responsibility to the environment.", 1),
          sh("Which 1978 book by Edward Said examines Western representations of the East?", "Orientalism", ["orientalism", "Orientalism (1978)", "Orientalism.", "'Orientalism'", "\"Orientalism\"", "‘Orientalism’", "“Orientalism”"], "Said argued that Western writing constructed an 'Orient' as exotic and inferior, supporting imperial power.", 1),
          sg("In post-colonial theory, 'the Other' refers to:", "A group defined as different and inferior in order to establish the coloniser's own identity", ["The author's second book", "An unreliable narrator whose account cannot be trusted, and who is treated by the text as the hero's double", "A rhyming pair of lines"], 2, "Constructing the colonised as Other reinforces the coloniser's sense of superiority.", 2, true),
          sg("Homi Bhabha's concept of hybridity describes:", "The mixing of cultures produced by colonial encounters, which unsettles ideas of pure or fixed identity", ["A poem that mixes two rhyme schemes within a single stanza to create tension", "A novel that combines two genres, such as Gothic romance and realist social comedy, in one plot", "A translation of a text from a colonised culture into the coloniser's language"], 3, "Hybridity suggests that cultural identities are mixed and unstable, undermining colonial hierarchies.", 2),
          sg("What does a new historicist critic (Greenblatt) typically do?", "Read a literary text alongside other texts of its period as parts of the same culture and its power relations", ["Ignore history and social context altogether in order to focus only on the rhyme and metre of the poem itself, as a self-contained object", "Explain a poem by the author's diary alone", "Rank texts as good or bad"], 1, "New historicism treats literature and non-literary documents as mutually shaping discourse.", 2),
          sg("What does an 'anthropocentric' view of nature assume?", "That nature is valued mainly for its use to humans", ["That nature has rights equal to those of human beings", "That nature does not exist", "That nature is only a symbol of emotion"], 0, "Anthropocentric means human-centred, in contrast to ecocentric views that value the wider ecosystem.", 2),
          sg("Read this original extract.\n\n\"The surveyors arrived in the dry season with their brass instruments and their certainty. They named the hill Mount Alder, though it had a name already, which the old women said only at dawn. By the time the rains came the river had been drawn on the map as a straight line, and a straight line, it seemed, could be sold.\"\n\nWhich reading of the naming is best supported?", "Naming the hill overrides an existing name, showing colonial appropriation and the marginalising of local knowledge", ["The surveyors respectfully preserve the old name and consult the old women about how the hill should be recorded on the map", "The naming shows the hill is not important", "It proves the narrator is a surveyor"], 2, "'Though it had a name already' signals that the imposed name erases indigenous naming, and the women's quiet dawn use suggests marginalised knowledge.", 2, true),
          sg("A deconstructive reading of a text would most likely:", "Show how meaning is unstable and how binary oppositions (such as nature and culture) undermine themselves", ["Establish the author's single intended meaning by checking the text against biography and letters, then fixing it", "Rank texts by moral value", "Reconstruct the author's biography"], 3, "Following Derrida, deconstruction traces contradictions and undecidability in the text's own language.", 2),
          sg("Lacan's 'mirror stage' proposes that:", "The infant recognises its reflection and forms an idealised self-image, which is a kind of misrecognition", ["Children learn language by copying adults exactly, so a child's speech mirrors the parents'", "Adults reflect on their pasts through diaries and photographs, forming a stable sense of self", "Society reflects class in art"], 0, "For Lacan, the sense of a unified self is an image that is formed from outside, hence a misrecognition.", 3),
          sg("Which is the best ecocritical reading of 'the river had been drawn on the map as a straight line, and a straight line, it seemed, could be sold'?", "Mapping abstracts a living river into measurable property, treating land as a resource rather than a system", ["The river is celebrated as a straight, ordered waterway that the surveyors have improved for the community", "The sentence shows a river's natural beauty, which the map faithfully preserves", "The sentence shows that maps are always accurate records of the landscape they depict"], 1, "The contrast between a winding river and the 'straight line' shows nature being simplified for commerce.", 3),
          mu("Read this original extract again.\n\n\"The surveyors arrived in the dry season with their brass instruments and their certainty. They named the hill Mount Alder, though it had a name already, which the old women said only at dawn. By the time the rains came the river had been drawn on the map as a straight line, and a straight line, it seemed, could be sold.\"\n\nWhich statements about it are best supported?", ["Post-colonial: the surveyors' naming and mapping enact imperial control", "Ecocritical: the river is treated as a resource to be measured and sold", "Psychoanalytic: the extract reveals the narrator's Oedipal desire", "New historicist: the extract proves the author personally worked as a surveyor", "Deconstructive: the extract shows that maps are neutral and complete"], ["Post-colonial: the surveyors' naming and mapping enact imperial control", "Ecocritical: the river is treated as a resource to be measured and sold"], "The other readings are unsupported by the text: there is no evidence of Oedipal desire, the biography claim is unwarranted and the extract undermines the idea that maps are neutral.", 3),
          wr("Compare how two critical lenses (choose from post-colonial, ecocritical and Marxist) illuminate this extract, and say which you find more convincing: \"The surveyors arrived in the dry season with their brass instruments and their certainty. They named the hill Mount Alder, though it had a name already, which the old women said only at dawn. By the time the rains came the river had been drawn on the map as a straight line, and a straight line, it seemed, could be sold.\" (About 200 words.)", "Mark scheme (6): 2 marks for accurate, text-based application of two lenses (e.g. post-colonial: naming, 'certainty', erased name; ecocritical: river as resource, 'straight line'; Marxist: 'sold', property); 2 marks for genuine comparison and evaluation of what each lens reveals or hides; 1 mark for accurate terminology and thinkers used relevantly (Other, appropriation, anthropocentrism); 1 mark for a reasoned judgement with a clear conclusion. Do not credit a list of theory definitions without application.", 3),
        ]),
      },
      flashcards: [
        { front: "Post-colonial criticism", back: "Examines empire, its legacies and the representation of colonised peoples and cultures." },
        { front: "Said, Orientalism (1978)", back: "Argues that Western writing constructed the 'Orient' as exotic and inferior, supporting imperial power." },
        { front: "The Other", back: "A group defined as different and inferior, which helps to define the dominant group's identity." },
        { front: "Bhabha: hybridity", back: "The mixing of cultures in colonial encounters, unsettling fixed identities." },
        { front: "Ecocriticism", back: "Studies how literature represents nature and the human relationship to the environment." },
        { front: "Anthropocentric vs ecocentric", back: "Anthropocentric: human-centred. Ecocentric: values the whole ecosystem." },
        { front: "New historicism (Greenblatt)", back: "Reads literature alongside other texts of its time as part of the same culture and power relations." },
        { front: "Deconstruction (Derrida)", back: "Shows how meaning is unstable and how binary oppositions undo themselves." },
        { front: "Lacan: mirror stage", back: "The infant forms an ideal self-image from its reflection, a misrecognition." },
        { front: "Evaluating a lens", back: "Explain what it reveals in this text, what it hides, and compare it with another reading." },
      ],
    },
  },
};

import type { KeyStage } from "../types";

// Data-driven writing frames. Original wording. Frames are scaffolds: the child writes, the frame only prompts.

export type FrameKind =
  | "narrative" | "profile" | "report" | "formal-letter" | "informal-letter" | "diary" | "speech" | "persuasive"
  | "instructions" | "newspaper" | "analysis" | "essay" | "argument" | "comparison" | "descriptive";

export interface FrameSection {
  id: string; heading: string; prompt: string; starters: string[]; checklist?: string[]; minWords?: number;
  /** A short model example. Hidden in assess mode. */
  exampleFor?: string;
}
export interface VocabBank { label: string; words: string[] }
export interface Frame {
  id: string; title: string; kind: FrameKind; keyStages: KeyStage[]; sections: FrameSection[]; overallChecklist: string[];
  /** Optional word banks shown beside the sections (e.g. analysis verbs). */
  banks?: VocabBank[];
}

const s = (id: string, heading: string, prompt: string, starters: string[], o: Partial<FrameSection> = {}): FrameSection => ({ id, heading, prompt, starters, ...o });

const ANALYSIS_BANK: VocabBank[] = [
  { label: "Analysis verbs", words: ["suggests", "implies", "connotes", "conveys", "reveals", "highlights", "emphasises", "reinforces", "foreshadows", "evokes", "portrays", "contrasts"] },
  { label: "Reader effect", words: ["creates tension", "builds sympathy", "unsettles the reader", "generates suspense", "invites us to question", "makes us feel"] },
];

export const FRAMES: Frame[] = [
  {
    id: "story-mountain", title: "Story mountain (narrative planner)", kind: "narrative", keyStages: [1, 2, 3],
    sections: [
      s("opening", "Opening", "Who is in your story, and where are they? Set the scene in a sentence or two.", ["One frosty morning,", "Nobody knew that today would be different.", "The old lighthouse stood alone", "Mia had always wondered what was behind the door."], { minWords: 20, exampleFor: "Every night, the lighthouse blinked at the sea. Tonight, Tom noticed it blinking back." }),
      s("buildup", "Build-up", "What happens next? Drop a hint that something is about to change.", ["Suddenly,", "Without warning,", "Slowly, the path began to", "A strange noise came from"], { minWords: 30 }),
      s("problem", "Problem", "What goes wrong? What does your character need to sort out?", ["Then everything changed when", "The trouble began as", "To make matters worse,", "There was only one way to"], { minWords: 30, checklist: ["The problem is clear to the reader", "I show how the character feels"] }),
      s("climax", "Climax", "This is the most exciting or scary moment. Slow it down and add detail.", ["Heart pounding,", "In that instant,", "Just as all seemed lost,", "With a deep breath,"], { minWords: 40, checklist: ["I used some short, sharp sentences", "I described what my character saw, heard or felt"] }),
      s("resolution", "Resolution", "How is the problem solved?", ["At last,", "It turned out that", "Finally, after all that effort,", "The problem was solved when"], { minWords: 25 }),
      s("ending", "Ending", "How do things end up? What has your character learned or changed?", ["From that day on,", "Looking back,", "Nothing was ever quite the same again because", "As the sun set,"], { minWords: 20 }),
    ],
    overallChecklist: ["Capital letters and full stops are in the right places", "I used a range of sentence openers", "I used some interesting adjectives and adverbs", "My story is in the same tense all the way through", "I read it aloud and it makes sense"],
  },
  {
    id: "character-setting", title: "Character and setting profile", kind: "profile", keyStages: [2],
    sections: [
      s("character-look", "Appearance", "What does your character look like? Choose the details that tell us something about them.", ["Her hair was", "He was tall and", "The first thing you noticed was", "Deep lines around his eyes showed"], { minWords: 20 }),
      s("character-personality", "Personality", "What is your character like inside? Show it with something they do or say.", ["She was the sort of person who", "Nothing made him happier than", "Although she seemed shy,", "He never gave up because"], { minWords: 20, exampleFor: "Zara always kept a spare pencil for anyone who forgot theirs, though she'd never admit she noticed." }),
      s("character-want", "Wants and fears", "What does your character want most, and what are they afraid of?", ["More than anything, he wanted", "She secretly feared", "The one thing holding them back was", "If only"], { minWords: 15 }),
      s("setting-place", "Setting: place", "Describe where the story happens.", ["The forest was", "Beyond the gate lay", "Everything in the room seemed", "Towering above the village,"], { minWords: 25 }),
      s("setting-senses", "Setting: senses", "What can you hear, smell and feel here?", ["The air smelled of", "In the distance, you could hear", "Underfoot, the ground felt", "A cold breeze carried"], { minWords: 20, checklist: ["I used at least two senses"] }),
    ],
    overallChecklist: ["I showed things through details, not just told", "I used interesting adjectives", "My description helps the reader picture the character and place"],
  },
  {
    id: "non-chronological-report", title: "Non-chronological report", kind: "report", keyStages: [2, 3],
    sections: [
      s("title-intro", "Title and introduction", "Say what your report is about in one or two sentences. Who or what is it?", ["Have you ever wondered about", "This report tells you about", "Some people call them", "One of the most fascinating"], { minWords: 20 }),
      s("group1", "Section 1: what it is like", "Describe its appearance or main features. Use a sub-heading.", ["They are usually", "One key feature is", "You can recognise it by", "Most have"], { minWords: 30 }),
      s("group2", "Section 2: where or how it lives or works", "Explain the place, habitat or way it works.", ["You can find them in", "They depend on", "This happens because", "Typically,"], { minWords: 30 }),
      s("group3", "Section 3: interesting facts", "Add surprising facts, numbers or comparisons.", ["Did you know that", "Amazingly,", "Compared with", "Scientists have discovered that"], { minWords: 25 }),
      s("closing", "Closing thought", "Finish with something to make the reader remember the topic.", ["In summary,", "All in all,", "Next time you see one,", "It is clear that"], { minWords: 15 }),
    ],
    overallChecklist: ["I used sub-headings", "I wrote in the present tense", "I wrote in the third person (it, they)", "I used topic words correctly", "Every paragraph is about one idea"],
  },
  {
    id: "formal-letter", title: "Formal letter", kind: "formal-letter", keyStages: [3, 4],
    sections: [
      s("addresses", "Addresses, date and greeting", "Your address top right, then the date, then the receiver's address on the left. Use Dear Sir or Madam, or Dear Mr/Ms Name.", ["Dear Sir or Madam,", "Dear Ms", "Dear Mr", "Dear Headteacher,"], { checklist: ["Sender address and date included", "Greeting matches the ending (Yours faithfully / Yours sincerely)"] }),
      s("purpose", "Opening: why you are writing", "State your purpose clearly in the first paragraph.", ["I am writing to enquire about", "I am writing to express my concern regarding", "I would like to apply for", "I am writing in response to"], { minWords: 25 }),
      s("detail", "Main body: the details", "Give the facts, reasons or evidence. One idea per paragraph.", ["Firstly,", "Furthermore,", "As you may be aware,", "In particular,"], { minWords: 50 }),
      s("request", "Request or action", "Say exactly what you would like to happen and by when.", ["I would be grateful if you could", "I would appreciate it if", "I look forward to receiving", "Please could you confirm"], { minWords: 20 }),
      s("closing", "Closing", "End politely and sign off. Dear Sir or Madam ends Yours faithfully; a named person ends Yours sincerely.", ["Thank you for your time and consideration.", "I look forward to hearing from you.", "Yours faithfully,", "Yours sincerely,"]),
    ],
    overallChecklist: ["Formal tone with no slang or contractions", "Standard English throughout", "Paragraphs are clear", "Sign-off matches the greeting", "Spelling and punctuation checked"],
  },
  {
    id: "informal-letter", title: "Informal letter or email", kind: "informal-letter", keyStages: [2, 3],
    sections: [
      s("greeting", "Greeting", "Start in a friendly way.", ["Hi", "Dear", "Hello", "Hey"]),
      s("opening", "Opening chat", "Say hello and ask something about them.", ["How are you? I hope you are", "Thanks so much for your message about", "It was great to hear", "I'm sorry I haven't written sooner because"], { minWords: 15 }),
      s("news", "Your news", "Tell them what you want to say. Add details that bring it to life.", ["The best thing that has happened is", "You will never guess what", "Last weekend, I", "I can't wait to tell you about"], { minWords: 40 }),
      s("question", "Questions and plans", "Ask them something or suggest a plan.", ["Do you fancy", "Would you like to", "What about", "Let me know if"], { minWords: 15 }),
      s("signoff", "Sign-off", "End warmly.", ["See you soon,", "Write back soon!", "Take care,", "Best wishes,"]),
    ],
    overallChecklist: ["My tone is friendly and chatty", "I used paragraphs for different topics", "I checked spelling of names and places", "I asked at least one question"],
  },
  {
    id: "diary-recount", title: "Diary or recount", kind: "diary", keyStages: [1, 2, 3],
    sections: [
      s("date", "Date and opening", "Write the date and where you were.", ["Dear Diary,", "Today was", "This morning,", "On Saturday I went to"]),
      s("events", "What happened", "Tell the events in order. Use time words.", ["First,", "After that,", "Later on,", "Just before lunch,"], { minWords: 40, checklist: ["Events are in time order", "Written in the past tense"] }),
      s("feelings", "How I felt", "Say what you thought and felt at the most important moment.", ["I felt so", "My stomach flipped when", "I couldn't believe", "Honestly, I was"], { minWords: 20 }),
      s("ending", "Looking ahead", "End with how you feel now or what happens next.", ["Tomorrow I hope", "I will never forget", "Now I know that", "I can't wait until"], { minWords: 10 }),
    ],
    overallChecklist: ["First person (I, we)", "Past tense for events", "Time words used to link events", "Feelings included, not just facts"],
  },
  {
    id: "speech", title: "Speech", kind: "speech", keyStages: [3, 4],
    sections: [
      s("hook", "Hook", "Grab your audience with a question, surprising fact or a bold claim.", ["Imagine a world where", "What if I told you that", "Ladies and gentlemen,", "Every year,"], { minWords: 15 }),
      s("point", "Main points", "Make your points one at a time. Use rhetorical questions and the rule of three.", ["Firstly,", "But that is not all:", "Ask yourself:", "We must, we can and we will"], { minWords: 60 }),
      s("audience", "Speak to the audience", "Use we and you. Include a personal story or example.", ["Some of you may remember", "Let me tell you about", "Together, we", "You know as well as I do that"], { minWords: 30 }),
      s("close", "Call to action", "Finish with a strong ending that tells them what to do or think.", ["So today I urge you to", "The choice is ours:", "Let us leave here determined to", "Thank you for listening."], { minWords: 20 }),
    ],
    overallChecklist: ["I addressed the audience directly", "I used rhetorical questions", "I used repetition or a rule of three", "It sounds good read aloud", "The ending is memorable"],
  },
  {
    id: "persuasive", title: "Persuasive letter or leaflet (AFOREST)", kind: "persuasive", keyStages: [2, 3, 4],
    sections: [
      s("claim", "Your argument", "State clearly what you want the reader to believe or do.", ["I strongly believe that", "It is time to", "We simply cannot ignore", "Surely everyone agrees that"], { minWords: 20 }),
      s("evidence", "Facts and evidence", "Back it up with facts, statistics or an expert opinion.", ["Research shows that", "According to", "Nine out of ten", "It has been proven that"], { minWords: 30, checklist: ["At least one fact or statistic", "An expert or witness quoted"] }),
      s("emotion", "Appeal to feelings", "Use emotive language and a direct address to the reader.", ["Imagine how it feels when", "Think of the children who", "How would you feel if", "It is heartbreaking that"], { minWords: 25 }),
      s("counter", "Answer the other side", "Mention an opposing view and explain why it is weaker.", ["Some people argue that", "Although it may seem", "Critics say, but", "It might be true that, yet"], { minWords: 25 }),
      s("action", "Call to action", "Tell the reader exactly what to do now.", ["Act now:", "Join us today", "Don't wait, because", "Sign the petition and"], { minWords: 10 }),
    ],
    overallChecklist: ["I used AFOREST devices (see the bank)", "I addressed the reader as you", "I used rhetorical questions", "I used a rule of three", "I finished with a call to action"],
    banks: [{ label: "AFOREST", words: ["Alliteration", "Facts", "Opinion", "Rhetorical question", "Emotive language", "Statistics", "Triples (rule of three)"] }, { label: "DAFOREST adds", words: ["Direct address"] }],
  },
  {
    id: "instructions", title: "Instructions", kind: "instructions", keyStages: [1, 2],
    sections: [
      s("goal", "Title and goal", "Say what people will make or do.", ["How to make", "How to play", "This will show you how to", "Want to learn to"], { minWords: 5 }),
      s("needs", "What you need", "List everything needed. Use bullet points.", ["You will need:", "Equipment:", "Ingredients:", "Before you start, get"], { minWords: 5 }),
      s("steps", "Steps", "Number each step. Begin each with a command verb.", ["First,", "Next,", "Then carefully", "After that,"], { minWords: 30, checklist: ["Each step starts with a command (mix, cut, press)", "Steps are in the right order"] }),
      s("tips", "Tips and warnings", "Add a hint that helps or a safety warning.", ["Be careful not to", "Top tip:", "Make sure you", "If it goes wrong,"], { minWords: 10 }),
    ],
    overallChecklist: ["Numbered steps in order", "Command verbs used", "Clear, short sentences", "Someone could follow it without asking me questions"],
  },
  {
    id: "newspaper-report", title: "Newspaper report (5Ws)", kind: "newspaper", keyStages: [2, 3],
    sections: [
      s("headline", "Headline", "Short, punchy and about the main event.", ["Shock as", "Local hero", "Chaos at", "Breaking:"], { minWords: 3 }),
      s("lead", "Opening paragraph: Who, What, When, Where, Why", "Answer the five Ws in the first paragraph.", ["Yesterday afternoon,", "A local", "Police have confirmed that", "Residents of"], { minWords: 30, checklist: ["Who", "What", "When", "Where", "Why"] }),
      s("detail", "More detail", "Give the story in order. Add facts and sequence.", ["The incident began when", "According to witnesses,", "It is understood that", "Officials said"], { minWords: 40 }),
      s("quotes", "Quotes", "Add what someone said, with speech marks and their job or role.", ["\"I have never seen anything like it,\" said", "One eyewitness explained,", "A spokesperson added:", "\"We are delighted,\" said"], { minWords: 15, exampleFor: "\"I could hardly believe my eyes,\" said shopkeeper Ali Khan." }),
      s("ending", "Ending", "Say what happens next.", ["The investigation will continue", "Further details will follow", "Meanwhile,", "Local people are hoping"], { minWords: 10 }),
    ],
    overallChecklist: ["Third person, past tense", "Formal reporting tone", "Quotes have speech marks", "Most important facts come first"],
  },
  {
    id: "pee", title: "PEE paragraph (Point, Evidence, Explain)", kind: "analysis", keyStages: [3, 4],
    sections: [
      s("point", "Point", "Answer the question with one clear idea.", ["The writer presents", "One way that the writer shows", "It is clear that", "The character is presented as"], { minWords: 15 }),
      s("evidence", "Evidence", "Use a short quotation or precise detail.", ["This is shown when", "For example, the writer says", "\"...\" (line", "The quotation \"...\""], { minWords: 8, checklist: ["The quotation is short and exact", "It is in speech marks"] }),
      s("explain", "Explain", "Say what the words suggest and how they make the reader feel.", ["This suggests that", "The word \"...\" implies", "This makes the reader feel", "The writer uses this to show"], { minWords: 30, exampleFor: "The verb \"crept\" suggests the character is afraid of being noticed, creating an uneasy mood." }),
    ],
    overallChecklist: ["Each part is linked to the question", "I explained a single word or phrase closely", "I used analysis verbs (suggests, implies)", "I did not just retell the story"],
    banks: ANALYSIS_BANK,
  },
  {
    id: "petal", title: "PETAL paragraph (Point, Evidence, Technique, Analysis, Link)", kind: "analysis", keyStages: [3, 4],
    sections: [
      s("point", "Point", "Make a clear argument that answers the question.", ["The writer presents", "A key idea in the text is", "Throughout the extract,", "It is significant that"], { minWords: 15 }),
      s("evidence", "Evidence", "Quote briefly.", ["This is evident when", "The writer states", "For instance, \"...\"", "In the line \"...\""], { minWords: 8 }),
      s("technique", "Technique", "Name the method, such as metaphor, verb choice or contrast.", ["The writer uses a metaphor", "The verb \"...\"", "The contrast between", "The use of repetition"], { minWords: 8 }),
      s("analysis", "Analysis", "Explore the effect. Zoom in on individual words.", ["This implies", "This connotes", "The word \"...\" carries connotations of", "This makes the reader"], { minWords: 35 }),
      s("link", "Link", "Tie back to the question or to the wider text.", ["This links to the idea that", "Overall, this reinforces", "This contrasts with", "Therefore, the writer wants us to"], { minWords: 12 }),
    ],
    overallChecklist: ["I named a technique accurately", "I explained its effect on the reader", "I linked back to the question", "I used precise vocabulary"],
    banks: ANALYSIS_BANK,
  },
  {
    id: "what-how-why", title: "What-How-Why analysis paragraph", kind: "analysis", keyStages: [3, 4],
    sections: [
      s("what", "What", "What is the writer showing? State the idea or message.", ["The writer shows that", "The writer presents", "Here we see", "A key message is"], { minWords: 15 }),
      s("how", "How", "How do they show it? Give evidence and language technique.", ["This is achieved through", "The writer uses", "By choosing the word \"...\",", "The structure of the passage"], { minWords: 25 }),
      s("why", "Why", "Why do they do it? What is the effect on the reader or the writer's purpose?", ["The writer does this to", "This encourages the reader to", "The effect is to", "Ultimately, this makes us"], { minWords: 25 }),
    ],
    overallChecklist: ["What, how and why are all covered", "I used short, exact quotes", "I explained the effect on the reader", "I wrote about the writer's purpose"],
    banks: ANALYSIS_BANK,
  },
  {
    id: "essay-planner", title: "Literature essay planner", kind: "essay", keyStages: [4, 5],
    sections: [
      s("thesis", "Thesis (your argument)", "Answer the question in one or two sentences. This is your big idea.", ["This essay argues that", "Through the character of", "The writer presents", "At the heart of the text is"], { minWords: 25, checklist: ["It answers the question directly", "It can be argued and is not just a fact"] }),
      s("para1", "Paragraph 1: idea and evidence", "First main idea. Add two pieces of evidence.", ["Firstly,", "To begin with,", "Evidence 1: \"...\"", "Evidence 2: \"...\""], { minWords: 80 }),
      s("para2", "Paragraph 2: idea and evidence", "Second idea. Show how it develops or contrasts.", ["Furthermore,", "This idea develops when", "Evidence 1: \"...\"", "Evidence 2: \"...\""], { minWords: 80 }),
      s("para3", "Paragraph 3: idea and evidence", "Third idea, ideally in a different part of the text.", ["Moreover,", "Towards the end of the text,", "Evidence 1: \"...\"", "Evidence 2: \"...\""], { minWords: 80 }),
      s("context", "Context and links", "Where does context (time, society, writer's life) add meaning?", ["In the context of", "At the time of writing,", "This reflects", "Contemporary audiences would have"], { minWords: 20 }),
      s("conclusion", "Conclusion", "Bring your argument together. Do not add new evidence.", ["In conclusion,", "Overall, the writer", "Ultimately, it is clear that", "Therefore, the text suggests"], { minWords: 40 }),
    ],
    overallChecklist: ["Thesis answers the question", "Each paragraph has a clear point", "Every point has evidence and analysis", "Context is linked to the argument", "Conclusion sums up without new points"],
    banks: ANALYSIS_BANK,
  },
  {
    id: "argument-16", title: "Argument planner (16-mark style)", kind: "argument", keyStages: [4],
    sections: [
      s("intro", "Introduction", "State the issue and your overall position in a sentence or two.", ["The question of whether", "There are strong arguments on both sides,", "This debate is important because", "In my view,"], { minWords: 30 }),
      s("for", "Arguments for", "Give two or three reasons in favour. Each needs evidence or an example.", ["One reason in favour is", "Supporters argue that", "For example,", "This matters because"], { minWords: 100, checklist: ["Each reason has evidence", "Each reason is explained"] }),
      s("against", "Arguments against", "Give two or three reasons against, in the same way.", ["On the other hand,", "Opponents argue that", "However,", "A significant drawback is"], { minWords: 100 }),
      s("judgement", "Judgement", "Weigh it up. Decide which side is stronger and why.", ["On balance,", "The most convincing argument is", "Although ... this is outweighed by", "Ultimately, I conclude that"], { minWords: 60, checklist: ["I made a clear decision", "I explained why one side outweighs the other"] }),
    ],
    overallChecklist: ["Both sides are fairly presented", "Points are developed, not just listed", "I used evidence or examples", "The judgement is justified", "I used connectives to link ideas"],
  },
  {
    id: "comparison", title: "Comparison paragraph", kind: "comparison", keyStages: [4, 5],
    sections: [
      s("point", "Comparative point", "State the similarity or difference between the two texts or characters.", ["Both writers present", "While text A shows, text B", "A key difference is", "Similarly,"], { minWords: 15 }),
      s("first", "Evidence from A", "Quote or refer to the first text and analyse it.", ["In the first text,", "The writer of A uses", "This is shown when \"...\"", "This suggests"], { minWords: 30 }),
      s("second", "Evidence from B", "Now use the second text. Link directly back to A.", ["In contrast, in the second text,", "Likewise, in B", "By comparison,", "Whereas A ..., B"], { minWords: 30 }),
      s("judge", "Overall comparison", "Say why the difference or similarity matters.", ["This difference reveals", "Both writers therefore", "Ultimately, A is more ... whereas B", "This comparison shows that"], { minWords: 20 }),
    ],
    overallChecklist: ["I used comparative connectives (whereas, similarly)", "I referred to both texts throughout", "I analysed language, not just retold", "I explained why the comparison matters"],
    banks: [{ label: "Comparison words", words: ["whereas", "similarly", "in contrast", "likewise", "on the other hand", "by comparison", "both", "unlike"] }],
  },
  {
    id: "descriptive", title: "Descriptive writing (five senses)", kind: "descriptive", keyStages: [2, 3, 4],
    sections: [
      s("see", "Sight", "What can you see? Think about colour, size, light and movement.", ["Golden light spilled across", "In the corner,", "Everywhere I looked,", "The shadows stretched"], { minWords: 20 }),
      s("hear", "Sound", "What can you hear? Include loud and quiet sounds.", ["The silence was broken by", "Somewhere, a", "A low rumble", "I could just make out"], { minWords: 20 }),
      s("smell", "Smell and taste", "What smells or tastes stand out?", ["The air was thick with", "A sweet scent of", "I could taste", "It smelled like"], { minWords: 15 }),
      s("touch", "Touch and feeling", "What does it feel like? Include temperature and texture, and how you feel.", ["The ground felt", "A chill crept", "My fingers brushed", "Warmth spread through"], { minWords: 15 }),
      s("figurative", "Figurative language", "Add a simile, a metaphor or personification.", ["The clouds were like", "The wind was a", "The trees whispered", "It was as ... as"], { minWords: 15, exampleFor: "The moon was a silver coin dropped in a dark pond." }),
    ],
    overallChecklist: ["I used at least three of the five senses", "I included a simile, metaphor or personification", "I chose precise verbs and adjectives", "I varied my sentence lengths", "I show the reader, not just tell"],
    banks: [{ label: "Figurative devices", words: ["simile", "metaphor", "personification", "onomatopoeia", "alliteration", "hyperbole"] }],
  },
];

export const KEY_STAGES: readonly KeyStage[] = [1, 2, 3, 4, 5];
export const getFrame = (id: unknown): Frame | undefined => (typeof id === "string" ? FRAMES.find((f) => f.id === id) : undefined);

/** Combine written sections into one piece (headings optional). */
export function combineSections(frame: Frame, text: Record<string, string>, withHeadings = false): string {
  return frame.sections.map((sec) => ({ sec, t: (text[sec.id] ?? "").trim() })).filter((x) => x.t)
    .map((x) => (withHeadings ? `${x.sec.heading}\n${x.t}` : x.t)).join("\n\n");
}

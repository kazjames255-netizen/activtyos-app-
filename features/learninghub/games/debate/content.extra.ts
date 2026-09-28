import { shuffleOptionIds, type QuizItem } from "../quiz/core";

// Debate Keep - more persuasive-writing items (KS2-KS3): spotting the technique in a real sentence, telling evidence from opinion, and structure (PEEL, essay shape,
// connectives). Every technique sentence is written to contain ONE dominant device so the answer is never a judgement call. The sentences are examples of a
// technique about school-life topics, not claims about the real world. Merged into DEBATE_ITEMS by content.ts; keys are `db2_*`.
const NAMES: Record<string, string> = {
  rhetorical_question: "a rhetorical question", rule_of_three: "the rule of three", emotive_language: "emotive language", statistic: "a statistic",
  expert_opinion: "an expert opinion", direct_address: "direct address", repetition: "repetition", hyperbole: "exaggeration (hyperbole)",
  anecdote: "an anecdote", counter_argument: "a counter-argument",
};
const ORDER = Object.keys(NAMES);
const EXPLAIN: Record<string, string> = {
  rhetorical_question: "A question asked to make the reader think, not to get an answer, so it pulls them towards agreeing: a rhetorical question.",
  rule_of_three: "Three linked items in a row sound complete and easy to remember: the rule of three.",
  emotive_language: "The words are chosen to make the reader FEEL something (pity, anger, joy), not just to inform: emotive language.",
  statistic: "A number used as evidence makes a claim sound measured and researched: a statistic.",
  expert_opinion: "Quoting someone with knowledge or authority to back up a claim: an expert opinion.",
  direct_address: "Speaking straight to the reader as “you” makes the argument feel personal: direct address.",
  repetition: "Saying the same word or phrase again hammers the point home and makes it memorable: repetition.",
  hyperbole: "An obvious exaggeration used for dramatic effect, not as an accurate claim: hyperbole.",
  anecdote: "A short, personal story used as evidence makes an issue feel real: an anecdote.",
  counter_argument: "Naming the OTHER side’s point and then answering it shows the writer has thought about both sides: a counter-argument.",
};
/** Three wrong technique names, picked from the other nine by a hash of the key (stable, and never the same three every time). */
function wrongFor(key: string, right: string): string[] {
  let h = 0; for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) >>> 0;
  const others = ORDER.filter((t) => t !== right); const out: string[] = [];
  while (out.length < 3) { const pick = others[h % others.length]!; h = (Math.imul(h, 1103515245) + 12345) >>> 0; if (!out.includes(pick)) out.push(pick); }
  return out.map((t) => NAMES[t]!);
}
function tech(n: number, tag: string, difficulty: 1 | 2 | 3, sentence: string): QuizItem {
  const key = `db2_t${n}`; const { options, correctId } = shuffleOptionIds(key, NAMES[tag]!, wrongFor(key, tag));
  return { key, topics: ["persuasive-technique", tag], difficulty, prompt: `“${sentence}” — which technique is this?`, options, correctId, explanation: EXPLAIN[tag]! };
}
function mc(key: string, topic: string, difficulty: 1 | 2 | 3, prompt: string, correct: string, wrongs: string[], explanation: string): QuizItem {
  const { options, correctId } = shuffleOptionIds(key, correct, wrongs);
  return { key, topics: [topic], difficulty, prompt, options, correctId, explanation };
}

let n = 0;
const t = (tag: string, d: 1 | 2 | 3, s: string) => tech(++n, tag, d, s);
export const DEBATE_EXTRA: QuizItem[] = [
  // rhetorical questions
  t("rhetorical_question", 1, "Who wouldn’t want cleaner air on the way to school?"),
  t("rhetorical_question", 2, "How many more litter-covered beaches must we see before we act?"),
  t("rhetorical_question", 1, "Can we honestly say a five-minute break is too much to ask?"),
  t("rhetorical_question", 2, "What kind of school lets its pupils go hungry?"),
  t("rhetorical_question", 2, "If not now, then when?"),
  t("rhetorical_question", 1, "Isn’t it time every child had a safe place to play?"),
  // rule of three
  t("rule_of_three", 1, "Recycling saves energy, money and wildlife."),
  t("rule_of_three", 1, "The trip will be fun, educational and free."),
  t("rule_of_three", 1, "Our club is friendly, welcoming and open to everyone."),
  t("rule_of_three", 2, "Reading opens minds, builds skills and creates friends."),
  t("rule_of_three", 2, "Healthy meals give pupils energy, focus and a good mood."),
  t("rule_of_three", 2, "A quicker, cleaner, quieter bus route would help everyone."),
  // emotive language
  t("emotive_language", 2, "Imagine the terrifying silence of a school with no laughter left in it."),
  t("emotive_language", 1, "The poor, helpless puppies were left shivering and alone."),
  t("emotive_language", 2, "It is a shameful disgrace that our beautiful park has been left to rot."),
  t("emotive_language", 1, "Heartbreaking scenes of homeless families should make us all ashamed."),
  t("emotive_language", 2, "The cruel factory poisoned the sparkling, innocent river."),
  t("emotive_language", 2, "The joyful shouts of children would fill our happy, vibrant playground."),
  // statistics
  t("statistic", 1, "Over 60% of pupils in our year walk to school."),
  t("statistic", 1, "In our school survey, 84 of the 100 pupils asked wanted a longer lunch break."),
  t("statistic", 1, "Only 2 out of 30 pupils in our class said they liked the old menu."),
  t("statistic", 2, "Around 8 million tonnes of plastic enter the world’s oceans every year."),
  t("statistic", 2, "The bike shelter is used by 45 pupils every day, up from 12 last year."),
  t("statistic", 3, "In our class trial, pupils who read for 20 minutes a day scored 12 points higher on the spelling test."),
  // expert opinions
  t("expert_opinion", 1, "Dentists recommend brushing your teeth twice a day."),
  t("expert_opinion", 1, "A sleep scientist at the local university says teenagers need about nine hours of sleep."),
  t("expert_opinion", 1, "The school nurse says drinking water keeps pupils alert in lessons."),
  t("expert_opinion", 2, "According to the fire chief, every home should have a working smoke alarm."),
  t("expert_opinion", 2, "Our teachers agree that a quiet reading corner helps pupils concentrate."),
  t("expert_opinion", 2, "Leading doctors advise children to get at least an hour of exercise every day."),
  // direct address
  t("direct_address", 1, "You deserve a school where your ideas are heard."),
  t("direct_address", 1, "You can make a difference by switching off the lights when you leave a room."),
  t("direct_address", 1, "Whatever your favourite sport, you can join our club."),
  t("direct_address", 1, "Dear reader, your voice matters more than you think."),
  t("direct_address", 2, "If you care about animals, you can help by signing our petition."),
  t("direct_address", 2, "Each of you can help by picking up just one piece of litter."),
  // repetition
  t("repetition", 1, "We will not give up. We will not back down."),
  t("repetition", 1, "This matters, this really matters."),
  t("repetition", 2, "We want fairness. We want fairness for every pupil, in every class."),
  t("repetition", 2, "Clean up the beach, clean up the beach before the tide turns."),
  t("repetition", 2, "It is a small change, a small change that would make a big difference."),
  t("repetition", 2, "The playground is too small, too small for all of us."),
  // hyperbole
  t("hyperbole", 1, "If we don’t get a new pitch, the whole team will die of boredom."),
  t("hyperbole", 1, "This homework is so long it will take me a hundred years."),
  t("hyperbole", 2, "Every single person on Earth loves our school fair."),
  t("hyperbole", 1, "The queue for the canteen was miles long."),
  t("hyperbole", 2, "Our new library is the greatest thing that has ever happened to anyone, anywhere."),
  t("hyperbole", 2, "One tiny piece of litter will destroy the entire planet forever."),
  // anecdotes
  t("anecdote", 1, "When I started playing chess last year I was shy, but the club helped me make my first real friends."),
  t("anecdote", 1, "My cousin walks to school every day and says it is now the best part of her morning."),
  t("anecdote", 2, "One winter my gran couldn’t leave the house because nobody cleared the path, and it showed me how much a small effort can help."),
  t("anecdote", 2, "Last week I saw a boy help a younger pupil find a lost shoe, and everyone in the corridor smiled."),
  t("anecdote", 2, "When our bus was cancelled last term I waited an hour in the rain, which is why I want a shelter."),
  t("anecdote", 1, "I remember being scared of reading aloud until a teacher patiently helped me practise every morning."),
  // counter-arguments
  t("counter_argument", 1, "Some people believe homework is pointless, but it helps pupils practise what they have learned."),
  t("counter_argument", 2, "It may be argued that screens harm learning; however, used well, they can bring lessons to life."),
  t("counter_argument", 2, "Critics say a longer school day would be tiring, but extra clubs could make it enjoyable."),
  t("counter_argument", 3, "Although a school garden costs money to start, it saves the school money on food in the long run."),
  t("counter_argument", 2, "You might think uniforms are expensive, yet one uniform lasts far longer than lots of fashionable outfits."),
  t("counter_argument", 3, "Opponents claim walking to school takes too long; on the contrary, it is often quicker than sitting in traffic."),

  // ── claim strength: evidence beats opinion ─────────────────────────────────────────────────────────────────────
  mc("db2_c1", "claim-strength", 1, "Which is the STRONGER argument for a longer library opening time?", "Library records show pupils borrowed 40% more books in the term when it opened until 4.30pm.", ["Books are great and everyone should read more."], "The strong argument gives a specific, checkable figure. The other is an opinion with nothing to back it up."),
  mc("db2_c2", "claim-strength", 1, "Which is the STRONGER argument for a water fountain in the playground?", "The school nurse reported fewer headaches on days when pupils drank water at break.", ["Water is nice and fountains look cool."], "A named source and a measured result make the first argument stronger."),
  mc("db2_c3", "claim-strength", 2, "Which is the STRONGER argument for a crossing patrol at the school gate?", "Three near-misses were logged at the gate in September, and a patrol on the busiest road reduced them to none the next month.", ["It is just plain scary out there and someone will get hurt eventually."], "Logged events and a before-and-after result are evidence. The other is a fear stated as a fact."),
  mc("db2_c4", "claim-strength", 2, "Which is the STRONGER argument for a homework club?", "Pupils who attended for a term handed in 25% more homework on time than those who did not.", ["Everyone finds homework hard, so a club would obviously help."], "A comparison with a figure supports the claim. “Obviously” is not evidence."),
  mc("db2_c5", "claim-strength", 2, "Which is the STRONGER argument for more bike racks?", "Twenty pupils cycle to school but there are only six racks, so 14 bikes are locked to the fence each day.", ["Cycling is the best way to travel and the school should support it."], "The strong argument counts the problem. “The best way” is an opinion."),
  mc("db2_c6", "claim-strength", 3, "Which is the STRONGER argument against a ban on all sweets at school?", "A ban would not tackle the real problem: our lunch survey found most sugar came from drinks, so cutting sweets alone would change little.", ["Sweets are yummy and banning them is cruel."], "It uses evidence from a survey to show the ban would miss the target, and it stays specific. The other relies on feelings."),
  mc("db2_c7", "claim-strength", 1, "Which sentence is a FACT (something that can be checked)?", "The school has 240 pupils.", ["Our school is the friendliest in the country."], "You can count the pupils. “Friendliest” is a matter of opinion."),
  mc("db2_c8", "claim-strength", 1, "Which sentence is an OPINION?", "Maths is the most exciting subject.", ["Maths lessons are on Tuesday afternoons."], "“Most exciting” cannot be measured. The timetable is a checkable fact."),
  mc("db2_c9", "claim-strength", 2, "Which of these is a sweeping generalisation?", "Nobody ever enjoys reading.", ["Some pupils find reading hard at first.", "Last term, 30 pupils joined the reading club.", "Many pupils said they would like more books."], "“Nobody ever” covers every person without proof, so it is almost certainly false and weakens an argument."),
  mc("db2_c10", "claim-strength", 2, "A writer says “A survey of just 3 pupils proves the whole school wants longer breaks.” What is the weakness?", "Three pupils are far too few to speak for a whole school", ["The survey was too long", "Breaks are not important", "Nothing, a survey is always right"], "A good survey asks enough people to be fair. A tiny sample cannot prove what everyone thinks."),
  mc("db2_c11", "claim-strength", 3, "Which source would be MOST reliable for a claim about how much sleep children need?", "A children’s doctor’s published health guidance", ["A friend’s guess", "An advert for a mattress", "A joke on a video site"], "Reliable evidence comes from a knowledgeable source with nothing to sell. Advertisers and guesses have different motives."),
  mc("db2_c12", "claim-strength", 3, "Why is “Everybody knows school lunches are too small” a weak way to start an argument?", "It asserts agreement instead of giving evidence", ["It is too short", "It uses the word “school”", "It is written in the present tense"], "“Everybody knows” tells the reader what to think rather than showing them why."),
  // ── structure and connectives ──────────────────────────────────────────────────────────────────────────────────
  mc("db2_s1", "structure-peel", 1, "In a PEEL paragraph, what does the first P stand for?", "Point", ["Persuade", "Paragraph", "Proof"], "PEEL: Point, Evidence, Explain, Link. You begin by stating your point clearly."),
  mc("db2_s2", "structure-peel", 1, "In a PEEL paragraph, what does the second E stand for, and what do you do there?", "Explain: say why the evidence supports your point", ["Emphasise: shout the point again", "Examples: list as many as possible", "End: finish the essay"], "The Explain sentence links the evidence back to the point so the reader can see why it matters."),
  mc("db2_s3", "structure-peel", 2, "In a PEEL paragraph, which sentence is the POINT? “Uniform should be optional. Two pupils in five said it made them uncomfortable. That shows comfort affects concentration. That is why choice matters.”", "Uniform should be optional.", ["Two pupils in five said it made them uncomfortable.", "That shows comfort affects concentration.", "That is why choice matters."], "The Point is the first sentence and states the claim. The next sentence is the evidence."),
  mc("db2_s4", "structure-essay", 1, "Which is the best way to OPEN a persuasive essay?", "With a hook that grabs the reader, such as a striking fact or question", ["With “I am going to write about…”", "With your conclusion", "With a long list of every point"], "An opening hook gets attention, and the stance follows straight after."),
  mc("db2_s5", "structure-essay", 2, "Where does a call to action, such as “Sign our petition today”, usually belong?", "In the conclusion, at the end", ["In the very first sentence", "Between every paragraph", "It should never be used"], "A call to action tells the reader what to do next, and works best as the final push."),
  mc("db2_s6", "structure-essay", 1, "Which connective adds another point to an argument?", "Furthermore", ["However", "Although", "Otherwise"], "Furthermore, moreover and in addition all add to the point made before."),
  mc("db2_s7", "structure-essay", 1, "Which connective introduces a CONTRAST with the point before?", "However", ["Furthermore", "In addition", "Moreover"], "However, but and on the other hand signal a different or opposing idea."),
  mc("db2_s8", "structure-essay", 2, "Which connective is best for beginning the conclusion?", "In conclusion", ["For example", "Meanwhile", "By the way"], "In conclusion, to sum up and overall signal that you are drawing the argument together."),
  mc("db2_s9", "structure-essay", 2, "Which connective introduces an EXAMPLE to support your point?", "For instance", ["Nevertheless", "Instead", "Finally"], "For example and for instance introduce a specific case that illustrates the point."),
  mc("db2_s10", "structure-essay", 2, "You are writing to your head teacher to ask for a change. Which opening is the most suitable?", "Dear Mrs Patel, I am writing to suggest a change to break times.", ["Hey Mrs P, listen up, break times are rubbish.", "Yo, I have got some ideas.", "To whoever reads this, whatever."], "A letter to an adult in authority uses a polite, formal register and states its purpose clearly."),
  mc("db2_s11", "structure-essay", 3, "A counter-argument is best placed...", "After your main points, and answered before the conclusion", ["In the first sentence, with no reply", "Only in the conclusion, unanswered", "Nowhere, because it weakens the essay"], "Raising the other side’s best point and then answering it makes your case more convincing."),
  mc("db2_s12", "structure-essay", 3, "What is the purpose of a persuasive essay’s conclusion?", "To pull the argument together and leave the reader convinced", ["To introduce a brand new argument", "To apologise for the essay", "To repeat the first paragraph word for word"], "A conclusion sums up the strongest points and closes with a final, memorable push."),
];

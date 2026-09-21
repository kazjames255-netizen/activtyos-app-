# Curriculum content (KS2 Maths first)

One file per topic in `ks2maths/<key>.ts` exporting `TOPIC: CTopic` (see `types.ts`). Validate with
`cd server && npx tsx src/curriculum/validate.ts [topicKey…]`. The seeder (`server/src/seedCurriculumKS2Maths.ts`)
turns this data into hub topics, notes, questions, quizzes, per-year placement (diagnostic) papers and flashcards.
Spec: `docs/curriculum-ks2-maths-spec.txt`. Images: PNGs in `scratch/curriculum-images/ks2maths/`.

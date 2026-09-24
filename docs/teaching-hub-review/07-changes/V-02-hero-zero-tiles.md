# Parent/child hero hides "0 lessons - 0 subjects"

**What.** `HubHero.tsx`: when a parent/child has 0 lessons and 0 subjects, the summary line drops those two parts and the Subjects/Lessons/Learning-as tile row is not rendered. Tutors unchanged.

**Revert.** `git revert` the commit.

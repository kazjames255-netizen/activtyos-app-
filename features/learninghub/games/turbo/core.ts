// Turbo Slide teaches EXACTLY the same skill as Penguin Slide: steer into the correct-answer lane among the 2-12
// times tables (see docs/games-prototypes/BACKEND-PATTERN.md "same domain, new skin"). It is a highway/rocket-sled
// reskin of the identical deterministic simulation - same fact selection (FSRS-lite + Elo), same lane physics, same
// server-authoritative replay. Reusing the core wholesale (rather than forking it) means a Turbo Slide run is exactly
// as trustworthy as a Penguin Slide run, and the two games share one fact-mastery map per child (hubFactState).
export * from "../penguin/core";

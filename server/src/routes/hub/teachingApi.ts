import { Router } from "express";
import { hubFlashcardsApi } from "./flashcardsApi";
import { hubHomeworkApi } from "./homeworkApi";
import { hubLessonsApi } from "./lessonsApi";
import { hubBoardsApi } from "./boardsApi";
import { hubLessonApi } from "./lessonApi";
import { hubInPersonApi } from "./inPersonApi";
import { hubRemoteSyncApi } from "./remoteSyncApi";
import { hubFamilyInvitesApi } from "./familyInvitesApi";
import { hubDoubtsApi } from "./doubtsApi";
import { hubCurriculumApi } from "./curriculumApi";
import { hubToolsApi } from "./toolsApi";

// Learning Hub — homework & submissions (milestone 6), flashcards & spaced
// repetition (milestone 7), live lessons (Daily video). Mounted by
// routes/learningHub.ts. Contract: docs/learning-hub.md. Every handler starts
// with resolveCtx() from ../../lib/hubCore; the routes live in the sibling files.
export const hubTeachingApi = Router();

hubTeachingApi.use(hubHomeworkApi);
hubTeachingApi.use(hubFlashcardsApi);
hubTeachingApi.use(hubLessonsApi);
hubTeachingApi.use(hubBoardsApi); // the live whiteboard's saved copy (Round 4)
hubTeachingApi.use(hubLessonApi); // the interactive lesson player's warm-up questions + instant checks
hubTeachingApi.use(hubInPersonApi); // a tutor running a lesson/quiz with children beside them (no video): sessions, attendance, per-child results
hubTeachingApi.use(hubRemoteSyncApi); // "Start lesson now (remote)": tutor broadcasts a lesson; remote students' screens follow, no video call
hubTeachingApi.use(hubFamilyInvitesApi); // a tutor's invite link for a family who never booked → the parent enrols their own child
hubTeachingApi.use(hubDoubtsApi); // "Ask my teacher": a per-slide/question doubt from inside a lesson, and the tutor's replies
hubTeachingApi.use(hubCurriculumApi); // "where do these lessons fit the national curriculum / GCSE?" — the map, a cell's lessons, a provider's own corrections
hubTeachingApi.use(hubToolsApi); // the Tools tab: autosaved tool state + anonymous usage counters

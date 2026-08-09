# Firestore Rules Analysis

## Scope

This note covers the small session-status update for the RevealQuiz live classroom flow.

## Firestore Paths

- `sessions/{code}`
- `sessions/{code}/players/{uid}`
- `sessions/{code}/answers/{answerId}`

## Queries

- `sessions/{code}` direct document listener.
- `sessions/{code}/players` collection listener.
- `sessions/{code}/answers` query with `where("questionId", "==", questionId)`.
- `sessions/{code}/players/{uid}` direct document listener.

## Data Model Change

- Added `leaderboard` to the allowed `sessions/{code}.status` values.
- Allowed `revealedAnswer` to remain present while `status == "leaderboard"` so students can transition from answer reveal to standings without exposing answers before reveal.
- Added `quizId` to sessions so Cloud Functions can score against a server-side quiz bank.
- Blocked browser writes that set `status == "revealed"` or create a non-null `revealedAnswer`; the Admin SDK function now performs those writes.
- Blocked browser score/streak updates on player documents; the Admin SDK function now performs those writes.
- Added scheduled backend cleanup for expired session documents and subcollections using Admin SDK recursive deletion.
- Added a deploy-time quiz sync script that validates and copies `public/quizzes/*.json` into `functions/quizzes`.

## Devil's Advocate Check

- Unauthenticated access remains denied by existing `isAuthenticated()` checks.
- Students still cannot update session state because session updates require `resource.data.instructorUid == request.auth.uid`.
- Students still cannot submit answers after lock/reveal/leaderboard because answer creation still requires `status == "question-open"`.
- Revealed answers are still rejected before reveal because `revealedAnswer` is only valid for `revealed`, `leaderboard`, or `ended`.
- Direct browser scoring is blocked because player self-updates must preserve `score` and `streak`, and instructor score updates are no longer allowed by rules.
- Direct browser reveals are blocked because instructor session updates cannot set `status == "revealed"` or introduce a non-null `revealedAnswer`.
- Session cleanup runs with Admin SDK privileges on a 24-hour schedule, so clients do not get any new deletion permissions.
- Schema pollution remains blocked by `hasOnly` field validators.

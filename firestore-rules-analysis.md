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

## Devil's Advocate Check

- Unauthenticated access remains denied by existing `isAuthenticated()` checks.
- Students still cannot update session state because session updates require `resource.data.instructorUid == request.auth.uid`.
- Students still cannot submit answers after lock/reveal/leaderboard because answer creation still requires `status == "question-open"`.
- Revealed answers are still rejected before reveal because `revealedAnswer` is only valid for `revealed`, `leaderboard`, or `ended`.
- Schema pollution remains blocked by `hasOnly` field validators.

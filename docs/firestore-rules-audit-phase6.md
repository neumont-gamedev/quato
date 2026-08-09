# Firestore Rules Audit - Phase 6 Teams and Achievements

## Scope

- Database: Cloud Firestore Standard, `(default)`, location `nam5`.
- Collections touched by this change:
  - `sessions/{code}`
  - `sessions/{code}/players/{uid}`
  - `sessions/{code}/answers/{answerId}`
  - `gradeExports/{code}`

## Access Patterns

- Anonymous authenticated instructors create and update their own classroom session documents.
- Anonymous authenticated students create their own player document under a session.
- Students read session/player state and submit one answer document while the active question is open.
- Cloud Functions Admin SDK updates scores, streaks, achievements, revealed answers, and grade exports.
- Instructors read grade exports for their own sessions.

## Rule Changes

- Session documents now include a validated `game` config for team mode, achievements, enabled achievement IDs, and boss multiplier.
- Player documents now require `teamId`, `teamName`, and `achievements`.
- Students may choose their team only when creating their player profile.
- Client updates must preserve `teamId`, `teamName`, `achievements`, `score`, and `streak`.
- Achievement IDs are constrained to the current Phase 6 achievement set.

## Devil's Advocate Checks

- Public list/read without auth: denied by the top-level `isAuthenticated()` requirements.
- Student edits another player: denied because player create/update requires `request.auth.uid == uid`.
- Student edits score, streak, team, or achievements after join: denied by immutable checks in `validPlayerUpdate`.
- Student adds arbitrary player fields or oversized strings: denied by `validPlayer` key and length validation.
- Instructor or client injects invalid game config fields: denied by `validGameConfig` key/type/range validation.
- Instructor changes game config mid-session: denied because `game` is immutable after session creation.
- Student submits after lock/reveal: denied because answer create requires session status `question-open`.
- Student reads correct answers before reveal: denied structurally because active questions contain only public question data; `revealedAnswer` is only non-null after server reveal.
- Grade export write from client: denied; exports are written through trusted backend logic only.

## Validation

- `firebase.cmd deploy --only firestore:rules --dry-run --project quato-1512c`

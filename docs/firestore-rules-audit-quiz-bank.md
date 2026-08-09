# Firestore Rules Audit: Quiz Bank

Date: 2026-08-09

## Codebase Findings

- Firestore edition: Standard, default database for project `quato-1512c`.
- New collection path: `users/{uid}/quizBank`.
- New queries:
  - `getDocs(collection(db, "users", uid, "quizBank"))` to list the signed-in instructor's saved quiz drafts.
  - `addDoc(collection(db, "users", uid, "quizBank"), data)` to save an approved quiz draft.
- Authentication: `QuizBankService` uses the existing Firebase Auth instance and signs in anonymously when no user exists.
- Data model:
  - `title`: string, required, 1..120 chars.
  - `description`: string, required, up to 500 chars.
  - `questionCount`: number, required, 1..100.
  - `quiz`: map, required, with `title`, optional `description`, optional `game`, and `questions` list.
  - `savedAt`: timestamp, required, set to server time.

## Rules Decisions

- Quiz bank entries are stored under the authenticated user UID.
- Reads are owner-only.
- Creates are owner-only and require a strict top-level schema.
- Client updates and deletes are denied for now, making saved entries append-only.
- The quiz payload is constrained at the top level and by question list size. Deep per-question validation remains in application validation because Firestore rules cannot ergonomically validate every map in a list.

## Attack Check

- Public list exploit: denied because reads require authentication and matching UID.
- Unauthorized read/write: denied by `request.auth.uid == uid`.
- Ownership hijack: denied because the path UID must match the authenticated UID.
- Schema pollution: denied by `keys().hasOnly(...)` on the quiz bank entry and quiz map.
- Type juggling: denied for all validated top-level fields.
- Resource exhaustion: limited by string length and question count caps.
- Timestamp manipulation: create requires `savedAt == request.time`.
- Update bypass: denied because client updates are not allowed.
- Orphaned subcollection access: acceptable for this owner-scoped path because the authenticated UID path is the ownership boundary and no parent user profile data is required.
- Query mismatch: owner-scoped collection reads match the app's `users/{uid}/quizBank` list query.

## Residual Risk

- Deep question validation is still enforced by the app's `QuizLoader` rather than Firestore rules. A future Cloud Function save endpoint could enforce the full schema server-side before writing to Firestore.

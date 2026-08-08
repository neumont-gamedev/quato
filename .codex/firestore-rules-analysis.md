Firestore rules analysis for RevealQuiz Phase 4/5.

Collections and paths:
- sessions/{code}
- sessions/{code}/players/{uid}
- sessions/{code}/answers/{questionId}_{uid}

Queries:
- Instructor listens to sessions/{code}.
- Instructor listens to sessions/{code}/players.
- Instructor listens to sessions/{code}/answers where questionId == active question ID.
- Student listens to sessions/{code}.
- Student listens to their own sessions/{code}/players/{uid} document after joining.

Auth:
- Anonymous Firebase Auth is used for both instructor and students in Phase 4/5.
- The instructor UID is stored on the session document and owns session state.
- Player and answer documents are scoped to request.auth.uid.

Security assumptions:
- Correct answers are not written to `activeQuestion`. A bounded `revealedAnswer` payload may be written to the session only when the instructor changes the session to `revealed`, and may remain visible after the session moves to `ended`.
- A `questionStartedAt` timestamp is written when the instructor opens a question and is used for speed-bonus scoring.
- Student display names are public within a session and capped at 32 chars.
- Students can read session and player data after authentication.
- Students can only create one answer document per question because updates are denied.
- Session counters are display hints and are instructor-owned; UI counts players/answers from snapshots.
- In Phase 5, instructor-owned client code updates player score/streak on reveal. This is a prototype authority model intended to move to Cloud Functions later.

Devil's advocate review:
- Public list exploit: denied because all reads require request.auth.
- Unauthorized session update: denied unless request.auth.uid equals session.instructorUid.
- Ownership hijacking: player and answer uid must equal request.auth.uid; session instructorUid is immutable.
- Update bypass: validators run for session/player updates; answers cannot update.
- Resource exhaustion: string/list/map fields have size limits.
- Schema pollution: hasOnly checks reject extra fields.
- Correct-answer leak: activeQuestion validator only permits public fields and no correct/answer/explanation fields. revealedAnswer is null until status is revealed; rules reject a non-null revealedAnswer for lobby/presenting/question-open/locked and allow it to remain available in ended sessions.
- Query mismatch: player collection reads and answer where(questionId == id) reads are allowed for authenticated users/instructors.
- Reveal payload abuse: revealedAnswer is schema-limited to questionId/type/correctAnswer/explanation with string length caps, and session updates remain instructor-only.
- Score tampering: students cannot update score/streak directly because instructor score updates require session instructor ownership and can only affect score/streak fields. This is still prototype authority because instructor client code, not Cloud Functions, calculates awards.

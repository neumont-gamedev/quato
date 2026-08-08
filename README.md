# RevealQuiz

RevealQuiz is an interactive classroom quiz and presentation platform built on Reveal.js.

This first phase provides a local quiz engine:

- Reveal.js slide deck
- JSON quiz loading
- Multiple choice, true/false, and fill-in-the-blank questions
- Question validation with clear load errors
- Local answer feedback
- Basic scoring and streak tracking
- Persistent classroom-style HUD
- Markdown presentation loading with `@question` references
- JSON Schema for quiz files
- Code-question support
- Query-string content and theme selection
- AI question draft generation workflow with instructor review

## Run Locally

```bash
npm install
npm run dev
```

Open the local Vite URL and navigate through the deck. Quiz slides are generated from `quizzes/example.json`.

## Authoring

Create a Markdown presentation in `public/presentations/` and a matching quiz JSON file in `public/quizzes/`.

```markdown
# C++ Smart Pointers

Lecture content goes here.

---

@question q1

---

@results
```

Question references must match IDs from the chosen quiz file. The quiz data shape is documented in
`public/schema/revealquiz.schema.json`.

Use query parameters to swap content:

```text
/?presentation=cpp-random&quiz=cpp-random&theme=signal
```

## AI Draft Generation

Phase 3 adds an instructor-facing draft generator:

```text
/?mode=generator
```

The current provider is a local mock provider that produces schema-compatible placeholder questions. It is intentionally
behind a review/edit/export step, so generated questions never become a live quiz automatically. Future API providers can
implement the same `AiQuestionProvider` interface.

## Build

```bash
npm run build
```

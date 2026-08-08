# RevealQuiz — Interactive Classroom Quiz & Presentation Platform

## Project Overview

**RevealQuiz** is a web-based interactive presentation and classroom quiz platform built on top of **Reveal.js**.

The goal is to combine traditional classroom presentations with a game-like quiz experience. Instructors should be able to create presentations containing instructional slides and interactive questions without manually building complex HTML layouts.

Questions and presentation content should be defined using simple **Markdown and/or JSON data**, while RevealQuiz automatically generates the appropriate Reveal.js slides and interactive components.

The long-term goal is to provide a **live classroom experience similar to Kahoot**, where students join an instructor-hosted session from their own devices, answer questions in real time, earn points, build streaks, and compete on a classroom leaderboard.

The instructor's Reveal.js presentation acts as the primary classroom display while students interact through a separate mobile-friendly interface.

---

# Primary Goals

The system should:

- Use **Reveal.js** as the presentation engine.
- Allow normal presentation slides and quiz questions to exist in the same deck.
- Make creating quizzes extremely fast.
- Store question data in a consistent JSON format.
- Support Markdown-based presentation authoring.
- Automatically generate Reveal.js question slides from question data.
- Support multiple question types.
- Provide reusable question templates.
- Provide a game-like experience with scores, streaks, timers, and feedback.
- Allow AI tools to easily generate compatible question sets.
- Eventually support live multiplayer classroom sessions.
- Use **Firebase** for real-time classroom communication and persistent data.
- Provide separate instructor/presentation and student experiences.
- Be easy to extend with new question types and game mechanics.

---

# Core Technologies

## Front End

### Reveal.js

Reveal.js will be the primary presentation framework.

It will handle:

- Slide rendering
- Slide navigation
- Transitions
- Fragments
- Speaker/presenter functionality
- Keyboard controls
- Full-screen classroom presentation
- Markdown presentation slides

RevealQuiz should extend Reveal.js rather than modify its core source.

Ideally, quiz functionality should eventually be implemented as a reusable Reveal.js plugin or modular extension.

### HTML

Used for generated question interfaces, HUD elements, menus, instructor controls, and student interfaces.

### CSS

Used for:

- Quiz themes
- Question layouts
- Answer buttons
- Game HUD
- Score displays
- Timers
- Correct/incorrect feedback
- Leaderboards
- Classroom presentation layouts
- Responsive student interfaces

### JavaScript / TypeScript

Prefer **TypeScript** for the application and quiz engine where practical.

The application code will manage:

- Quiz state
- Question generation
- Answer validation
- Scoring
- Timers
- Streaks
- Reveal.js integration
- Firebase communication
- Classroom session state
- Student state
- Instructor controls

---

# Firebase

Firebase will provide the backend infrastructure for the live classroom experience.

Expected Firebase technologies include:

### Firebase Authentication

Used to identify instructors and optionally students.

Students should initially be able to join a classroom session with minimal friction, preferably using:

- Session code
- Display name

Student accounts should not be required for basic classroom participation unless necessary.

### Cloud Firestore or Firebase Realtime Database

Used for live classroom state such as:

- Active classroom session
- Current question
- Connected students
- Student answers
- Scores
- Streaks
- Question state
- Timers
- Leaderboard
- Session status

Choose Firestore or Realtime Database based on which provides the simplest and most reliable architecture for synchronized classroom gameplay.

### Firebase Hosting

Can be used to deploy the application.

### Firebase Cloud Functions

May be used for server-authoritative operations such as:

- Score validation
- Session creation
- Game-state validation
- Preventing score manipulation
- AI question generation requests
- Leaderboard processing

Client applications should not be trusted to directly determine authoritative scores in competitive live sessions.

---

# Application Architecture

The project should separate the following major responsibilities.

## Presentation Engine

Responsible for Reveal.js integration.

Example:

```text
Reveal.js
    |
    +-- Presentation Slides
    |
    +-- Quiz Slides
    |
    +-- Game HUD
```

## Quiz Engine

Responsible for:

- Loading questions
- Creating question slides
- Displaying questions
- Evaluating answers
- Calculating local game state
- Providing feedback
- Advancing quiz state
- Communicating with the classroom session system

## Classroom Session System

Responsible for:

- Creating sessions
- Generating join codes
- Student connections
- Synchronizing questions
- Receiving answers
- Tracking scores
- Tracking streaks
- Maintaining the leaderboard
- Controlling classroom progression

## Student Client

A separate responsive interface designed primarily for phones, tablets, and laptops.

Students should not need to load the complete Reveal.js presentation.

The student client should focus on:

- Joining the session
- Entering a display name
- Viewing the active question
- Selecting/submitting an answer
- Seeing whether an answer was submitted
- Seeing feedback when appropriate
- Seeing personal score
- Seeing streaks
- Seeing position/rank when enabled

---

# Suggested Project Structure

```text
RevealQuiz/
│
├── index.html
├── package.json
├── README.md
│
├── src/
│   ├── quiz/
│   │   ├── QuizEngine.ts
│   │   ├── QuestionFactory.ts
│   │   ├── ScoreManager.ts
│   │   └── QuizLoader.ts
│   │
│   ├── questions/
│   │   ├── MultipleChoice.ts
│   │   ├── TrueFalse.ts
│   │   ├── FillBlank.ts
│   │   ├── MultipleSelect.ts
│   │   └── CodeQuestion.ts
│   │
│   ├── presentation/
│   │   ├── RevealIntegration.ts
│   │   └── SlideGenerator.ts
│   │
│   ├── classroom/
│   │   ├── SessionManager.ts
│   │   ├── StudentManager.ts
│   │   ├── LeaderboardManager.ts
│   │   └── FirebaseService.ts
│   │
│   ├── instructor/
│   │   └── InstructorController.ts
│   │
│   └── student/
│       └── StudentClient.ts
│
├── styles/
│   ├── quiz.css
│   ├── game-hud.css
│   ├── leaderboard.css
│   └── student.css
│
├── presentations/
│   └── example.md
│
├── quizzes/
│   ├── example.json
│   ├── cpp-random.json
│   └── smart-pointers.json
│
└── firebase/
    ├── firebase-config.ts
    ├── firestore.rules
    └── functions/
```

The exact architecture may change during development, but responsibilities should remain modular.

---

# Question Data Format

Questions should use a standardized JSON format.

A quiz file could contain:

```json
{
    "title": "C++ Random Numbers",
    "description": "Review of the C++ random library.",
    "questions": [
        {
            "id": "q1",
            "type": "multiple-choice",
            "question": "What does std::random_device provide?",
            "answers": [
                "A distribution",
                "A source of entropy",
                "A floating-point generator",
                "A container"
            ],
            "correct": 1,
            "points": 100,
            "timeLimit": 20,
            "explanation": "std::random_device provides access to a source of nondeterministic or implementation-defined entropy that can be used to seed a pseudo-random number generator."
        }
    ]
}
```

---

# Question Types

The initial system should support the following question types.

## Multiple Choice

```json
{
    "type": "multiple-choice",
    "question": "Which smart pointer represents exclusive ownership?",
    "answers": [
        "shared_ptr",
        "weak_ptr",
        "unique_ptr",
        "raw_ptr"
    ],
    "correct": 2
}
```

## True / False

```json
{
    "type": "true-false",
    "question": "std::mt19937 is a random distribution.",
    "answer": false
}
```

## Fill in the Blank

```json
{
    "type": "fill-blank",
    "question": "The C++ operator used to calculate the remainder is ____.",
    "answers": [
        "%"
    ],
    "caseSensitive": false
}
```

Fill-in-the-blank questions should allow multiple acceptable answers when appropriate.

Example:

```json
{
    "answers": [
        "std::vector",
        "vector"
    ]
}
```

## Multiple Select

Allow multiple answers to be correct.

## Code Question

Display formatted source code and ask students to determine:

- Output
- Result
- Error
- Appropriate function
- Missing code
- Correct implementation

Additional question types should be easy to add through a common question interface.

---

# Markdown Presentation Format

Normal lecture content should be easy to write using Markdown.

Example:

```markdown
# C++ Random Numbers

The `<random>` library provides modern tools for generating random values.

---

## Random Device

`std::random_device` can be used as an entropy source for seeding a pseudo-random generator.

---

@question q1

---

## Mersenne Twister

`std::mt19937` is a commonly used pseudo-random number generator.

---

@question q2
```

The `@question` syntax should reference questions stored in the associated JSON quiz file.

The parser should replace the question reference with the appropriate generated Reveal.js quiz slide.

This keeps presentation content separate from quiz data.

---

# AI-Generated Questions

AI-assisted question generation should be a major feature of the system.

The JSON question schema should be intentionally designed so that modern LLMs can reliably generate valid question files.

An instructor should eventually be able to provide information such as:

```text
Topic: C++ Smart Pointers
Level: Introductory
Number of Questions: 15

Question Types:
- 7 multiple choice
- 4 true/false
- 2 fill in the blank
- 2 code questions

Include explanations.
```

The AI should generate JSON matching the RevealQuiz schema.

Example workflow:

```text
Instructor
    ↓
Select Topic / Provide Notes
    ↓
AI Question Generator
    ↓
Structured JSON
    ↓
Schema Validation
    ↓
Instructor Review
    ↓
RevealQuiz
```

AI-generated questions should **never automatically become a live quiz without an instructor review step**.

The instructor should be able to:

- Edit questions
- Remove questions
- Regenerate questions
- Change difficulty
- Change question type
- Change answers
- Change point values
- Change time limits

The system should eventually support generating questions from:

- Topic descriptions
- Lecture notes
- Markdown presentations
- Instructor-provided text
- Existing question banks

---

# JSON Schema Validation

Create a formal JSON Schema for RevealQuiz questions.

AI-generated content should be validated against this schema before being loaded.

Validation should catch issues such as:

- Missing question text
- Invalid question type
- Missing answers
- Invalid correct answer index
- Multiple-choice question with too few answers
- Missing fill-in-the-blank answers
- Duplicate IDs
- Invalid point values
- Invalid time limits

The quiz engine should fail gracefully and clearly identify malformed questions.

---

# Game Experience

RevealQuiz should feel more like a lightweight game than a traditional online test.

The primary goal is engagement and classroom participation rather than formal assessment.

A persistent game HUD can display:

```text
QUESTION 7 / 15

SCORE
1,850

STREAK
🔥 4

RANK
#3
```

Possible game mechanics include:

- Points
- Answer streaks
- Time bonuses
- Accuracy bonuses
- Difficulty multipliers
- Boss questions
- Bonus rounds
- Power-ups
- Lives
- Classroom goals
- Team competitions

The initial implementation should focus on a small number of understandable mechanics rather than implementing everything immediately.

---

# Scoring

Example scoring system:

```text
Correct Answer       +100
Fast Answer           +50
3 Correct Streak     +100
No Hint               +25
Boss Question          x2
```

Scoring rules should be configurable.

For live classroom sessions, scoring should ultimately be calculated or validated by trusted backend logic rather than trusting values sent from student browsers.

---

# Question Flow

A typical question should follow this sequence:

```text
QUESTION DISPLAYED
        ↓
Timer Starts
        ↓
Students Answer
        ↓
Answers Locked
        ↓
Class Results Displayed
        ↓
Correct Answer Revealed
        ↓
Explanation
        ↓
Points Awarded
        ↓
Leaderboard / Game Feedback
        ↓
Instructor Advances
```

The instructor should control progression during a live classroom session.

The presentation should not automatically advance simply because all students answered unless that behavior is explicitly enabled.

---

# Instructor Experience

The instructor should be able to:

1. Open a RevealQuiz presentation.
2. Select **Start Live Session**.
3. Receive a short classroom join code.
4. Display the join code and QR code.
5. Wait for students to join.
6. See the number of connected students.
7. Start the quiz.
8. Advance through presentation slides normally.
9. Trigger interactive questions when reaching quiz slides.
10. See how many students have answered.
11. Close/lock answering.
12. Reveal results.
13. Reveal the correct answer.
14. Display leaderboard updates.
15. Continue the presentation.
16. End the session.

The instructor's presentation should remain visually clean and suitable for projection onto a classroom screen.

---

# Student Experience

Students should be able to visit the RevealQuiz student page and see:

```text
REVEALQUIZ

Enter Game Code

[ 4 8 2 7 1 3 ]

[ JOIN ]
```

After joining:

```text
Enter Your Name

[ Raymond ]

[ READY ]
```

The waiting screen could display:

```text
You're in!

Waiting for the instructor...

Players Joined: 23
```

When a question begins, the student's device becomes their answer controller.

Example:

```text
Which smart pointer represents
exclusive ownership?

[A] shared_ptr

[B] weak_ptr

[C] unique_ptr

[D] raw_ptr
```

After selecting:

```text
ANSWER SUBMITTED

Waiting for the class...
```

Once the instructor reveals the answer:

```text
CORRECT!

+142 POINTS

🔥 4 Answer Streak

Total Score
1,850
```

---

# Live Classroom Display

The projected Reveal.js presentation should show aggregate classroom information rather than exposing individual student answers while answering is still open.

Example:

```text
Which smart pointer represents
exclusive ownership?

23 / 27
Students Answered

████████████████░░░
```

Once answering closes, the instructor can reveal the answer distribution:

```text
shared_ptr      18%
weak_ptr         7%
unique_ptr      68% ✓
raw_ptr          7%
```

Then optionally show:

```text
LEADERBOARD

1. Alex       2,450
2. Samantha   2,320
3. Tyler      2,180
4. Robert     2,050
5. Emma       1,990
```

---

# Firebase Session Model

A classroom session might conceptually contain:

```text
sessions/
    ABC123/
        instructor
        status
        currentQuestion
        questionState
        startedAt

        players/
            player1/
                name
                score
                streak

            player2/
                name
                score
                streak

        answers/
            q1/
                player1/
                player2/
                player3/
```

Do not assume this is the final Firebase structure.

Design the actual schema around:

- Security
- Efficient realtime updates
- Low database usage
- Classroom-scale concurrency
- Preventing students from reading correct answers before reveal
- Preventing clients from changing scores
- Session cleanup

---

# Security

Firebase Security Rules must prevent students from:

- Modifying another student's data
- Modifying their own score directly
- Changing the active question
- Changing session state
- Reading correct answers before they are revealed
- Acting as the instructor
- Submitting answers after a question closes

The instructor or trusted backend should control authoritative game state.

---

# Reveal.js Integration

The quiz engine should listen to Reveal.js events.

Conceptually:

```javascript
Reveal.on("slidechanged", event => {
    // Determine whether the new slide contains a quiz question.
});
```

When a quiz slide becomes active:

```text
Reveal.js Slide Event
        ↓
Quiz Engine
        ↓
Load Question
        ↓
Update Firebase Session
        ↓
Student Clients Receive Question
```

Reveal.js remains responsible for presentation navigation while RevealQuiz manages the interactive state.

---

# RevealQuiz Plugin

Quiz functionality should eventually be encapsulated as a Reveal.js plugin.

Conceptually:

```javascript
Reveal.initialize({
    plugins: [
        RevealMarkdown,
        RevealHighlight,
        RevealNotes,
        RevealQuiz
    ]
});
```

The plugin should handle communication between Reveal.js and the RevealQuiz application.

---

# Presentation + Quiz Example

RevealQuiz should support a classroom experience such as:

```text
TITLE
  ↓
Lecture Slide
  ↓
Lecture Slide
  ↓
QUESTION
  ↓
Answer Results
  ↓
Lecture Slide
  ↓
QUESTION
  ↓
Lecture Slide
  ↓
BOSS QUESTION
  ↓
Leaderboard
  ↓
Lecture Slide
  ↓
QUESTION
  ↓
Final Results
```

Quiz questions should therefore be part of the presentation rather than requiring instructors to leave the presentation and open another application.

---

# Development Phases

## Phase 1 — Reveal.js Quiz Engine

Build the core local quiz system.

Implement:

- Reveal.js integration
- JSON quiz loading
- Question factory
- Multiple choice
- True/false
- Fill in the blank
- Question validation
- Answer feedback
- Basic scoring
- Game HUD

No Firebase is required for this phase.

---

## Phase 2 — Content Authoring

Implement:

- Markdown presentations
- Question references
- JSON Schema
- Quiz validation
- Easy loading of different quiz files
- Reusable themes
- Code-question support

The goal is to make creating a new presentation extremely fast.

---

## Phase 3 — AI Question Generation

Implement tools for generating RevealQuiz-compatible question JSON.

Support:

- Topic-based generation
- Generation from lecture content
- Difficulty selection
- Question-type selection
- Number of questions
- Explanations
- JSON Schema validation
- Instructor review/edit workflow

The AI provider should be abstracted so that different LLM APIs can potentially be supported.

---

## Phase 4 — Firebase Classroom Sessions

Implement:

- Firebase configuration
- Session creation
- Join codes
- Student joining
- Student names
- Presence
- Current question synchronization
- Answer submission
- Instructor controls
- Session state

---

## Phase 5 — Competitive Classroom Game

Implement:

- Authoritative scoring
- Timed questions
- Speed bonuses
- Streaks
- Leaderboards
- Question results
- Classroom results
- End-of-game results

At this stage the system should provide a complete live classroom experience.

---

## Phase 6 — Advanced Game Features

Possible future features:

- Teams
- Team scores
- Boss rounds
- Power-ups
- Wager questions
- Classroom cooperative goals
- Achievements
- Sound effects
- Animations
- Confetti
- Custom themes
- Instructor-created game modes
- Persistent student statistics
- Question-bank management

These features should not complicate the initial architecture unnecessarily.

---

# Design Principles

## Content First

Creating a quiz should involve writing content, not designing slides.

The instructor should primarily work with:

```text
Markdown
+
JSON
```

RevealQuiz handles presentation and layout.

## AI Friendly

The data structure should be simple enough that AI systems can reliably generate valid quizzes.

## Modular

Question types, scoring rules, AI providers, and Firebase functionality should remain modular.

## Presentation First

Reveal.js should continue to behave like a normal presentation system.

Quiz functionality should enhance Reveal.js rather than interfere with standard presentation functionality.

## Classroom Friendly

Joining a session should require as few steps as possible.

Ideally:

```text
Scan QR Code
    ↓
Enter Name
    ↓
Play
```

## Instructor Controlled

The instructor should remain in control of:

- Starting questions
- Closing questions
- Revealing answers
- Showing explanations
- Advancing slides
- Showing leaderboards

## Mobile First for Students

The student interface should work extremely well on phones.

Large buttons, readable text, fast response times, and minimal UI are more important than duplicating the instructor presentation.

---

# Minimum Viable Product

The first useful version should allow an instructor to:

1. Create a Reveal.js Markdown presentation.
2. Create a JSON quiz file.
3. Reference questions from the presentation.
4. Start the Reveal.js presentation.
5. Display multiple-choice, true/false, and fill-in-the-blank questions.
6. Answer questions locally.
7. Receive correct/incorrect feedback.
8. Earn points.
9. Build a streak.
10. See a final score.

The architecture should be designed from the beginning so that Firebase multiplayer can be added without rewriting the quiz engine.

---

# Final Product Vision

The completed RevealQuiz system should allow an instructor to create a lesson containing normal Reveal.js slides and interactive questions.

Before class, AI can help generate questions from the instructor's lesson material.

During class, the instructor starts a live session.

Students scan a QR code and join using their phones.

The instructor teaches normally using Reveal.js.

When the presentation reaches a quiz question, every student's device automatically receives the question.

Students answer.

The classroom display shows participation.

The instructor closes answering and reveals the results.

Students receive points based on correctness, speed, streaks, and configured game rules.

A leaderboard updates throughout the lesson.

The instructor then continues directly into the next teaching slide.

The experience should combine:

**Reveal.js presentations + AI-assisted quiz creation + live classroom response system + competitive game mechanics.**

The most important design goal is that instructors can create rich interactive classroom experiences **without spending significant time manually designing or programming individual slides or questions.**
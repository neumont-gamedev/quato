const fs = require("node:fs");
const path = require("node:path");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");

initializeApp();

const db = getFirestore();
const QUIZ_DIR = path.join(__dirname, "quizzes");
const SESSION_TTL_HOURS = 24;
const CLEANUP_BATCH_SIZE = 50;

exports.revealQuestion = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in is required.");
  }

  const code = normalizeCode(request.data?.code);
  const questionId = typeof request.data?.questionId === "string" ? request.data.questionId : "";

  if (!code || !questionId) {
    throw new HttpsError("invalid-argument", "A session code and question id are required.");
  }

  const sessionRef = db.collection("sessions").doc(code);
  const answersRef = sessionRef.collection("answers");
  const playersRef = sessionRef.collection("players");

  return db.runTransaction(async (transaction) => {
    const sessionSnapshot = await transaction.get(sessionRef);

    if (!sessionSnapshot.exists) {
      throw new HttpsError("not-found", "Session not found.");
    }

    const session = sessionSnapshot.data();

    if (session.instructorUid !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Only the session instructor can reveal a question.");
    }

    if (session.currentQuestionId !== questionId) {
      throw new HttpsError("failed-precondition", "The requested question is not active.");
    }

    const quiz = loadQuiz(session.quizId || "example");
    const question = quiz.questions.find((candidate) => candidate.id === questionId);

    if (!question) {
      throw new HttpsError("not-found", "Question not found in the server quiz bank.");
    }

    if (session.status === "revealed" || session.status === "leaderboard") {
      return {
        revealedAnswer: toRevealedAnswer(question),
        awards: [],
        alreadyRevealed: true
      };
    }

    if (session.status !== "question-open") {
      throw new HttpsError("failed-precondition", "Question is not open for scoring.");
    }

    const [playersSnapshot, answersSnapshot] = await Promise.all([
      transaction.get(playersRef),
      transaction.get(answersRef.where("questionId", "==", questionId))
    ]);
    const players = playersSnapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() }));
    const answers = answersSnapshot.docs.map((doc) => doc.data());
    const awards = scoreQuestionForPlayers({
      question,
      answers,
      players,
      questionStartedAt: session.questionStartedAt
    });

    awards.forEach((award) => {
      transaction.update(playersRef.doc(award.uid), {
        score: award.score,
        streak: award.streak
      });
    });

    const revealedAnswer = toRevealedAnswer(question);
    transaction.update(sessionRef, {
      status: "revealed",
      revealedAnswer,
      answeredCount: answers.length,
      updatedAt: FieldValue.serverTimestamp()
    });

    return {
      revealedAnswer,
      awards,
      alreadyRevealed: false
    };
  });
});

exports.cleanupExpiredSessions = onSchedule(
  {
    region: "us-central1",
    schedule: "every 24 hours",
    timeZone: "America/Denver"
  },
  async () => {
    const cutoff = Timestamp.fromMillis(Date.now() - SESSION_TTL_HOURS * 60 * 60 * 1000);
    const expiredSessions = await db
      .collection("sessions")
      .where("createdAt", "<=", cutoff)
      .limit(CLEANUP_BATCH_SIZE)
      .get();

    await Promise.all(expiredSessions.docs.map((session) => db.recursiveDelete(session.ref)));

    console.log(`Cleaned up ${expiredSessions.size} expired classroom sessions.`);
  }
);

function normalizeCode(code) {
  return typeof code === "string" ? code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) : "";
}

function loadQuiz(quizId) {
  const safeQuizId = String(quizId).replace(/[^A-Za-z0-9_-]/g, "") || "example";
  const quizPath = path.join(QUIZ_DIR, `${safeQuizId}.json`);

  if (!quizPath.startsWith(QUIZ_DIR)) {
    throw new HttpsError("invalid-argument", "Invalid quiz id.");
  }

  if (!fs.existsSync(quizPath)) {
    throw new HttpsError("not-found", "Quiz not found in the server quiz bank.");
  }

  return JSON.parse(fs.readFileSync(quizPath, "utf8"));
}

function scoreQuestionForPlayers(options) {
  const answersByUid = new Map(options.answers.map((answer) => [answer.uid, answer]));

  return options.players.map((player) => {
    const answer = answersByUid.get(player.uid);
    const submittedWithinLimit = isWithinTimeLimit(options.question, answer, options.questionStartedAt);
    const isCorrect = submittedWithinLimit && answer ? isAnswerCorrect(options.question, answer.value) : false;
    const nextStreak = isCorrect ? player.streak + 1 : 0;
    const basePoints = options.question.points || 100;
    const speedBonus = isCorrect ? calculateSpeedBonus(options.question, answer, options.questionStartedAt) : 0;
    const streakBonus = isCorrect && nextStreak > 0 && nextStreak % 3 === 0 ? 100 : 0;
    const points = isCorrect ? basePoints + speedBonus + streakBonus : 0;

    return {
      uid: player.uid,
      name: player.name,
      isCorrect,
      points,
      speedBonus,
      streakBonus,
      score: player.score + points,
      streak: nextStreak,
      timedOut: !!answer && !submittedWithinLimit
    };
  });
}

function isAnswerCorrect(question, value) {
  switch (question.type) {
    case "multiple-choice":
    case "code-question":
      return Number(value) === question.correct;
    case "true-false":
      return value === question.answer;
    case "fill-blank": {
      const submitted = String(value).trim();
      return question.answers.some((answer) =>
        question.caseSensitive ? answer === submitted : answer.toLowerCase() === submitted.toLowerCase()
      );
    }
    default:
      return false;
  }
}

function isWithinTimeLimit(question, answer, questionStartedAt) {
  if (!answer) {
    return false;
  }

  const startedAt = readMillis(questionStartedAt);
  const submittedAt = readMillis(answer.submittedAt);
  const timeLimit = question.timeLimit || 20;

  if (!startedAt || !submittedAt || timeLimit <= 0) {
    return false;
  }

  return submittedAt <= startedAt + timeLimit * 1000;
}

function calculateSpeedBonus(question, answer, questionStartedAt) {
  const timeLimit = question.timeLimit || 20;
  const startedAt = readMillis(questionStartedAt);
  const submittedAt = readMillis(answer?.submittedAt);

  if (!startedAt || !submittedAt || submittedAt <= startedAt || timeLimit <= 0) {
    return 0;
  }

  const elapsedSeconds = (submittedAt - startedAt) / 1000;
  const remainingRatio = Math.max(0, Math.min(1, (timeLimit - elapsedSeconds) / timeLimit));

  return Math.round(50 * remainingRatio);
}

function readMillis(value) {
  if (value && typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (value && typeof value.seconds === "number") {
    const nanoseconds = typeof value.nanoseconds === "number" ? value.nanoseconds : 0;
    return value.seconds * 1000 + Math.floor(nanoseconds / 1000000);
  }

  return null;
}

function toRevealedAnswer(question) {
  const base = {
    questionId: question.id,
    type: question.type,
    ...(question.explanation === undefined ? {} : { explanation: question.explanation })
  };

  switch (question.type) {
    case "multiple-choice":
    case "code-question":
      return {
        ...base,
        correctAnswer: question.answers[question.correct] || `Choice ${question.correct + 1}`
      };
    case "true-false":
      return {
        ...base,
        correctAnswer: question.answer ? "True" : "False"
      };
    case "fill-blank":
      return {
        ...base,
        correctAnswer: question.answers.join(" / ")
      };
    default:
      throw new HttpsError("invalid-argument", "Unsupported question type.");
  }
}

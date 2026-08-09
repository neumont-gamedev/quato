import type { ClassroomAnswer, ClassroomPlayer } from "./types";
import type { QuizGameConfig, QuizQuestion } from "../types/Question";
import { applyQuestionMultiplier, getQuestionMultiplier } from "../quiz/GameRules";

export interface ClassroomScoreAward {
  uid: string;
  name: string;
  isCorrect: boolean;
  points: number;
  speedBonus: number;
  streakBonus: number;
  multiplier: number;
  achievements: string[];
  newAchievements: string[];
  score: number;
  streak: number;
}

export function scoreQuestionForPlayers(options: {
  question: QuizQuestion;
  game?: QuizGameConfig;
  answers: ClassroomAnswer[];
  players: ClassroomPlayer[];
  questionStartedAt?: unknown;
}): ClassroomScoreAward[] {
  const answersByUid = new Map(options.answers.map((answer) => [answer.uid, answer]));

  return options.players.map((player) => {
    const answer = answersByUid.get(player.uid);
    const isCorrect = answer ? isAnswerCorrect(options.question, answer.value) : false;
    const nextStreak = isCorrect ? player.streak + 1 : 0;
    const basePoints = options.question.points ?? 100;
    const speedBonus = isCorrect ? calculateSpeedBonus(options.question, answer, options.questionStartedAt) : 0;
    const streakBonus = isCorrect && nextStreak > 0 && nextStreak % 3 === 0 ? 100 : 0;
    const points = isCorrect ? applyQuestionMultiplier(basePoints + speedBonus + streakBonus, options.question, options.game) : 0;

    return {
      uid: player.uid,
      name: player.name,
      isCorrect,
      points,
      speedBonus,
      streakBonus,
      multiplier: getQuestionMultiplier(options.question, options.game),
      achievements: player.achievements ?? [],
      newAchievements: [],
      score: player.score + points,
      streak: nextStreak
    };
  });
}

function isAnswerCorrect(question: QuizQuestion, value: ClassroomAnswer["value"]): boolean {
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
  }
}

function calculateSpeedBonus(
  question: QuizQuestion,
  answer: ClassroomAnswer | undefined,
  questionStartedAt: unknown
): number {
  const timeLimit = question.timeLimit ?? 20;
  const startedAt = readMillis(questionStartedAt);
  const submittedAt = readMillis(answer?.submittedAt);

  if (!startedAt || !submittedAt || submittedAt <= startedAt || timeLimit <= 0) {
    return 0;
  }

  const elapsedSeconds = (submittedAt - startedAt) / 1000;
  const remainingRatio = Math.max(0, Math.min(1, (timeLimit - elapsedSeconds) / timeLimit));

  return Math.round(50 * remainingRatio);
}

function readMillis(value: unknown): number | null {
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (value && typeof value === "object" && "seconds" in value && typeof value.seconds === "number") {
    const nanoseconds = "nanoseconds" in value && typeof value.nanoseconds === "number" ? value.nanoseconds : 0;
    return value.seconds * 1000 + Math.floor(nanoseconds / 1_000_000);
  }

  return null;
}

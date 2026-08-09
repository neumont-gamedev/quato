import type { QuizGameConfig, QuizQuestion } from "../types/Question";

export function isBossQuestion(question: QuizQuestion): boolean {
  return question.tags?.includes("boss") ?? false;
}

export function getBossMultiplier(game: QuizGameConfig | undefined): number {
  return game?.bossMultiplier && game.bossMultiplier > 1 ? game.bossMultiplier : 2;
}

export function getQuestionMultiplier(question: QuizQuestion, game: QuizGameConfig | undefined): number {
  return isBossQuestion(question) ? getBossMultiplier(game) : 1;
}

export function applyQuestionMultiplier(points: number, question: QuizQuestion, game: QuizGameConfig | undefined): number {
  return Math.round(points * getQuestionMultiplier(question, game));
}

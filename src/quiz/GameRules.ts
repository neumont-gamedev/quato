import type { QuizGameConfig, QuizQuestion } from "../types/Question";

export const DEFAULT_ENABLED_ACHIEVEMENTS = ["first-correct", "streak-3", "speed-demon", "boss-clear"];

export function isBossQuestion(question: QuizQuestion): boolean {
  return question.tags?.includes("boss") ?? false;
}

export function getBossMultiplier(game: QuizGameConfig | null | undefined): number {
  return game?.bossMultiplier && game.bossMultiplier > 1 ? game.bossMultiplier : 2;
}

export function getQuestionMultiplier(question: QuizQuestion, game: QuizGameConfig | null | undefined): number {
  return isBossQuestion(question) ? getBossMultiplier(game) : 1;
}

export function applyQuestionMultiplier(points: number, question: QuizQuestion, game: QuizGameConfig | null | undefined): number {
  return Math.round(points * getQuestionMultiplier(question, game));
}

export function isTeamModeEnabled(game: QuizGameConfig | null | undefined): boolean {
  return game?.teamMode === true;
}

export function areAchievementsEnabled(game: QuizGameConfig | null | undefined): boolean {
  return game?.achievementsEnabled === true;
}

export function getEnabledAchievements(game: QuizGameConfig | null | undefined): string[] {
  if (!areAchievementsEnabled(game)) {
    return [];
  }

  return Array.isArray(game?.enabledAchievements)
    ? game.enabledAchievements
    : DEFAULT_ENABLED_ACHIEVEMENTS;
}

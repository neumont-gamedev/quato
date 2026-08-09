import type { QuizGameConfig, QuizQuestion, ScoreState } from "../types/Question";
import { applyQuestionMultiplier } from "./GameRules";

export interface ScoreAward {
  points: number;
  newState: ScoreState;
}

export class ScoreManager {
  private state: ScoreState;

  constructor(totalQuestions: number, private readonly game?: QuizGameConfig) {
    this.state = {
      score: 0,
      streak: 0,
      answered: 0,
      correct: 0,
      totalQuestions
    };
  }

  getState(): ScoreState {
    return { ...this.state };
  }

  award(question: QuizQuestion, isCorrect: boolean): ScoreAward {
    const basePoints = question.points ?? 100;
    const nextStreak = isCorrect ? this.state.streak + 1 : 0;
    const streakBonus = isCorrect && nextStreak > 0 && nextStreak % 3 === 0 ? 100 : 0;
    const points = isCorrect ? applyQuestionMultiplier(basePoints + streakBonus, question, this.game) : 0;

    this.state = {
      ...this.state,
      score: this.state.score + points,
      streak: nextStreak,
      answered: this.state.answered + 1,
      correct: this.state.correct + (isCorrect ? 1 : 0)
    };

    return {
      points,
      newState: this.getState()
    };
  }
}

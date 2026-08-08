export type QuestionType = "multiple-choice" | "true-false" | "fill-blank" | "code-question";

export interface BaseQuestion {
  id: string;
  type: QuestionType;
  question: string;
  points?: number;
  timeLimit?: number;
  explanation?: string;
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  type: "multiple-choice";
  answers: string[];
  correct: number;
}

export interface TrueFalseQuestion extends BaseQuestion {
  type: "true-false";
  answer: boolean;
}

export interface FillBlankQuestion extends BaseQuestion {
  type: "fill-blank";
  answers: string[];
  caseSensitive?: boolean;
}

export interface CodeQuestion extends BaseQuestion {
  type: "code-question";
  language?: string;
  code: string;
  answers: string[];
  correct: number;
}

export type QuizQuestion =
  | MultipleChoiceQuestion
  | TrueFalseQuestion
  | FillBlankQuestion
  | CodeQuestion;

export interface QuizFile {
  title: string;
  description?: string;
  questions: QuizQuestion[];
}

export interface ValidationResult<T> {
  data?: T;
  errors: string[];
}

export interface AnswerResult {
  isCorrect: boolean;
  awardedPoints: number;
  correctAnswerLabel: string;
  explanation?: string;
}

export interface ScoreState {
  score: number;
  streak: number;
  answered: number;
  correct: number;
  totalQuestions: number;
}

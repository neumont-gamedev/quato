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

export interface RevealedAnswer {
  questionId: string;
  type: QuestionType;
  correctAnswer: string;
  explanation?: string;
}

export type PublicQuestion =
  | Omit<MultipleChoiceQuestion, "correct" | "explanation">
  | Omit<TrueFalseQuestion, "answer" | "explanation">
  | Omit<FillBlankQuestion, "answers" | "caseSensitive" | "explanation">
  | Omit<CodeQuestion, "correct" | "explanation">;

export function toRevealedAnswer(question: QuizQuestion): RevealedAnswer {
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
        correctAnswer: question.answers[question.correct] ?? `Choice ${question.correct + 1}`
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
  }
}

export function toPublicQuestion(question: QuizQuestion): PublicQuestion {
  const base = {
    id: question.id,
    type: question.type,
    question: question.question
  };
  const publicBase = {
    ...base,
    ...(question.points === undefined ? {} : { points: question.points }),
    ...(question.timeLimit === undefined ? {} : { timeLimit: question.timeLimit })
  };

  switch (question.type) {
    case "multiple-choice":
      return { ...publicBase, type: question.type, answers: question.answers };
    case "true-false":
      return { ...publicBase, type: question.type };
    case "fill-blank":
      return { ...publicBase, type: question.type };
    case "code-question":
      return {
        ...publicBase,
        type: question.type,
        code: question.code,
        answers: question.answers,
        ...(question.language === undefined ? {} : { language: question.language })
      };
  }
}

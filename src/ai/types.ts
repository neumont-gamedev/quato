import type { QuizFile, QuestionType } from "../types/Question";

export interface QuestionGenerationRequest {
  topic: string;
  level: "introductory" | "intermediate" | "advanced";
  notes: string;
  counts: Record<QuestionType, number>;
  includeExplanations: boolean;
  defaultPoints: number;
}

export interface QuestionGenerationResult {
  quiz: QuizFile;
  providerName: string;
  prompt: string;
}

export interface AiQuestionProvider {
  readonly name: string;
  generateQuestions(request: QuestionGenerationRequest): Promise<QuestionGenerationResult>;
}

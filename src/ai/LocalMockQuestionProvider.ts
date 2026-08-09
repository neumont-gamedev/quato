import type { QuizQuestion, QuestionType } from "../types/Question";
import { buildQuestionGenerationPrompt } from "./PromptBuilder";
import type { AiQuestionProvider, QuestionGenerationRequest, QuestionGenerationResult } from "./types";

const TYPE_ORDER: QuestionType[] = ["multiple-choice", "true-false", "fill-blank", "code-question"];

export class LocalMockQuestionProvider implements AiQuestionProvider {
  readonly name = "Local Draft Generator";

  async generateQuestions(request: QuestionGenerationRequest): Promise<QuestionGenerationResult> {
    const questions: QuizQuestion[] = [];
    let sequence = 1;

    TYPE_ORDER.forEach((type) => {
      const count = request.counts[type] ?? 0;

      for (let index = 0; index < count; index += 1) {
        questions.push(createQuestion(type, request, sequence));
        sequence += 1;
      }
    });

    return {
      providerName: this.name,
      prompt: buildQuestionGenerationPrompt(request),
      quiz: {
        title: `${request.topic} Review`,
        description: `Generated ${request.level} draft questions for instructor review.`,
        game: {
          teamMode: true,
          achievementsEnabled: true,
          enabledAchievements: ["first-correct", "streak-3", "speed-demon", "boss-clear"],
          bossMultiplier: 2
        },
        questions
      }
    };
  }
}

function createQuestion(type: QuestionType, request: QuestionGenerationRequest, sequence: number): QuizQuestion {
  const id = `ai-q${sequence}`;
  const points = request.defaultPoints;
  const topic = request.topic.trim();
  const explanation = request.includeExplanations
    ? `Review why this answer best matches the ${request.level} ${topic} learning goal before using it live.`
    : undefined;

  switch (type) {
    case "multiple-choice":
      return {
        id,
        type,
        question: `Which statement best describes ${topic} concept ${sequence}?`,
        answers: [
          `The most accurate ${topic} statement`,
          `A related but incomplete ${topic} statement`,
          `A statement that confuses terminology`,
          `An unrelated implementation detail`
        ],
        correct: 0,
        points,
        explanation
      };
    case "true-false":
      return {
        id,
        type,
        question: `${topic} should be explained with examples before students are quizzed on edge cases.`,
        answer: true,
        points,
        explanation
      };
    case "fill-blank":
      return {
        id,
        type,
        question: `A key term from ${topic} is ____.`,
        answers: [topic],
        caseSensitive: false,
        points,
        explanation
      };
    case "code-question":
      return {
        id,
        type,
        question: `What is the purpose of this ${topic} example?`,
        language: "cpp",
        code: `// Replace this draft with real ${topic} code before using live.\nint value = ${sequence};\nreturn value;`,
        answers: [
          `It demonstrates a ${topic} idea`,
          "It creates a database session",
          "It starts a Firebase listener",
          "It renders a Reveal.js slide"
        ],
        correct: 0,
        points,
        explanation
      };
  }
}

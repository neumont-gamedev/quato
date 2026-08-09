import type {
  CodeQuestion,
  FillBlankQuestion,
  MultipleChoiceQuestion,
  QuizFile,
  QuizQuestion,
  TrueFalseQuestion,
  QuizGameConfig,
  ValidationResult
} from "../types/Question";

const QUESTION_TYPES = new Set(["multiple-choice", "true-false", "fill-blank", "code-question"]);
const ACHIEVEMENT_IDS = new Set(["first-correct", "streak-3", "speed-demon", "boss-clear"]);

export class QuizLoader {
  async loadFromUrl(url: string): Promise<ValidationResult<QuizFile>> {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        return { errors: [`Unable to load quiz file: ${response.status} ${response.statusText}`] };
      }

      const rawData = (await response.json()) as unknown;
      return this.validate(rawData);
    } catch (error) {
      return {
        errors: [`Unable to parse quiz file: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  validate(rawData: unknown): ValidationResult<QuizFile> {
    const errors: string[] = [];

    if (!isRecord(rawData)) {
      return { errors: ["Quiz file must be a JSON object."] };
    }

    if (typeof rawData.title !== "string" || rawData.title.trim().length === 0) {
      errors.push("Quiz title is required.");
    }

    if (!Array.isArray(rawData.questions)) {
      errors.push("Quiz questions must be an array.");
      return { errors };
    }

    const ids = new Set<string>();
    const questions: QuizQuestion[] = [];
    const game = validateGameConfig(rawData.game, errors);

    rawData.questions.forEach((question, index) => {
      const prefix = `questions[${index}]`;
      const validated = this.validateQuestion(question, prefix);

      errors.push(...validated.errors);

      if (validated.data) {
        if (ids.has(validated.data.id)) {
          errors.push(`${prefix}.id must be unique; "${validated.data.id}" is duplicated.`);
        }

        ids.add(validated.data.id);
        questions.push(validated.data);
      }
    });

    if (errors.length > 0) {
      return { errors };
    }

    return {
      data: {
        title: rawData.title as string,
        description: typeof rawData.description === "string" ? rawData.description : undefined,
        ...(game === undefined ? {} : { game }),
        questions
      },
      errors: []
    };
  }

  private validateQuestion(rawQuestion: unknown, prefix: string): ValidationResult<QuizQuestion> {
    const errors: string[] = [];

    if (!isRecord(rawQuestion)) {
      return { errors: [`${prefix} must be an object.`] };
    }

    const id = readRequiredString(rawQuestion, "id", prefix, errors);
    const type = readRequiredString(rawQuestion, "type", prefix, errors);
    const question = readRequiredString(rawQuestion, "question", prefix, errors);
    const points = readOptionalPositiveInteger(rawQuestion, "points", prefix, errors);
    const timeLimit = readOptionalPositiveInteger(rawQuestion, "timeLimit", prefix, errors);
    const tags = readOptionalTags(rawQuestion, prefix, errors);
    const explanation =
      typeof rawQuestion.explanation === "string" && rawQuestion.explanation.trim().length > 0
        ? rawQuestion.explanation
        : undefined;

    if (!QUESTION_TYPES.has(type)) {
      errors.push(`${prefix}.type must be one of: ${Array.from(QUESTION_TYPES).join(", ")}.`);
    }

    if (errors.length > 0) {
      return { errors };
    }

    const base = { id, type, question, points, timeLimit, explanation, tags };

    switch (type) {
      case "multiple-choice":
        return validateMultipleChoice(rawQuestion, prefix, base);
      case "true-false":
        return validateTrueFalse(rawQuestion, prefix, base);
      case "fill-blank":
        return validateFillBlank(rawQuestion, prefix, base);
      case "code-question":
        return validateCodeQuestion(rawQuestion, prefix, base);
      default:
        return { errors: [`${prefix}.type is unsupported.`] };
    }
  }
}

function validateMultipleChoice(
  rawQuestion: Record<string, unknown>,
  prefix: string,
  base: { id: string; type: string; question: string; points?: number; timeLimit?: number; explanation?: string; tags?: string[] }
): ValidationResult<MultipleChoiceQuestion> {
  const errors: string[] = [];

  if (!Array.isArray(rawQuestion.answers) || rawQuestion.answers.length < 2) {
    errors.push(`${prefix}.answers must contain at least two answer choices.`);
  }

  const answers = Array.isArray(rawQuestion.answers)
    ? rawQuestion.answers.filter((answer): answer is string => typeof answer === "string" && answer.trim().length > 0)
    : [];

  if (Array.isArray(rawQuestion.answers) && answers.length !== rawQuestion.answers.length) {
    errors.push(`${prefix}.answers must contain only non-empty strings.`);
  }

  if (typeof rawQuestion.correct !== "number" || !Number.isInteger(rawQuestion.correct)) {
    errors.push(`${prefix}.correct must be a zero-based answer index.`);
  }

  if (
    typeof rawQuestion.correct === "number" &&
    Number.isInteger(rawQuestion.correct) &&
    Array.isArray(rawQuestion.answers) &&
    (rawQuestion.correct < 0 || rawQuestion.correct >= rawQuestion.answers.length)
  ) {
    errors.push(`${prefix}.correct must point to an existing answer choice.`);
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    data: {
      ...base,
      type: "multiple-choice",
      answers,
      correct: rawQuestion.correct as number
    },
    errors: []
  };
}

function validateTrueFalse(
  rawQuestion: Record<string, unknown>,
  prefix: string,
  base: { id: string; type: string; question: string; points?: number; timeLimit?: number; explanation?: string; tags?: string[] }
): ValidationResult<TrueFalseQuestion> {
  if (typeof rawQuestion.answer !== "boolean") {
    return { errors: [`${prefix}.answer must be true or false.`] };
  }

  return {
    data: {
      ...base,
      type: "true-false",
      answer: rawQuestion.answer
    },
    errors: []
  };
}

function validateCodeQuestion(
  rawQuestion: Record<string, unknown>,
  prefix: string,
  base: { id: string; type: string; question: string; points?: number; timeLimit?: number; explanation?: string; tags?: string[] }
): ValidationResult<CodeQuestion> {
  const errors: string[] = [];

  if (typeof rawQuestion.code !== "string" || rawQuestion.code.trim().length === 0) {
    errors.push(`${prefix}.code is required for code questions.`);
  }

  if (rawQuestion.language !== undefined && typeof rawQuestion.language !== "string") {
    errors.push(`${prefix}.language must be a string when provided.`);
  }

  if (!Array.isArray(rawQuestion.answers) || rawQuestion.answers.length < 2) {
    errors.push(`${prefix}.answers must contain at least two answer choices.`);
  }

  const answers = Array.isArray(rawQuestion.answers)
    ? rawQuestion.answers.filter((answer): answer is string => typeof answer === "string" && answer.trim().length > 0)
    : [];

  if (Array.isArray(rawQuestion.answers) && answers.length !== rawQuestion.answers.length) {
    errors.push(`${prefix}.answers must contain only non-empty strings.`);
  }

  if (typeof rawQuestion.correct !== "number" || !Number.isInteger(rawQuestion.correct)) {
    errors.push(`${prefix}.correct must be a zero-based answer index.`);
  }

  if (
    typeof rawQuestion.correct === "number" &&
    Number.isInteger(rawQuestion.correct) &&
    Array.isArray(rawQuestion.answers) &&
    (rawQuestion.correct < 0 || rawQuestion.correct >= rawQuestion.answers.length)
  ) {
    errors.push(`${prefix}.correct must point to an existing answer choice.`);
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    data: {
      ...base,
      type: "code-question",
      code: rawQuestion.code as string,
      language: typeof rawQuestion.language === "string" ? rawQuestion.language : undefined,
      answers,
      correct: rawQuestion.correct as number
    },
    errors: []
  };
}

function validateFillBlank(
  rawQuestion: Record<string, unknown>,
  prefix: string,
  base: { id: string; type: string; question: string; points?: number; timeLimit?: number; explanation?: string; tags?: string[] }
): ValidationResult<FillBlankQuestion> {
  const errors: string[] = [];

  if (!Array.isArray(rawQuestion.answers) || rawQuestion.answers.length === 0) {
    errors.push(`${prefix}.answers must contain at least one accepted answer.`);
  }

  const answers = Array.isArray(rawQuestion.answers)
    ? rawQuestion.answers.filter((answer): answer is string => typeof answer === "string" && answer.trim().length > 0)
    : [];

  if (Array.isArray(rawQuestion.answers) && answers.length !== rawQuestion.answers.length) {
    errors.push(`${prefix}.answers must contain only non-empty strings.`);
  }

  if (rawQuestion.caseSensitive !== undefined && typeof rawQuestion.caseSensitive !== "boolean") {
    errors.push(`${prefix}.caseSensitive must be a boolean when provided.`);
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    data: {
      ...base,
      type: "fill-blank",
      answers,
      caseSensitive: rawQuestion.caseSensitive as boolean | undefined
    },
    errors: []
  };
}

function readRequiredString(
  record: Record<string, unknown>,
  key: string,
  prefix: string,
  errors: string[]
): string {
  const value = record[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${prefix}.${key} is required.`);
    return "";
  }

  return value;
}

function readOptionalPositiveInteger(
  record: Record<string, unknown>,
  key: string,
  prefix: string,
  errors: string[]
): number | undefined {
  const value = record[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    errors.push(`${prefix}.${key} must be a positive integer when provided.`);
    return undefined;
  }

  return value;
}

function readOptionalTags(record: Record<string, unknown>, prefix: string, errors: string[]): string[] | undefined {
  if (record.tags === undefined) {
    return undefined;
  }

  if (!Array.isArray(record.tags)) {
    errors.push(`${prefix}.tags must be an array of strings when provided.`);
    return undefined;
  }

  const tags = record.tags.filter((tag): tag is string => typeof tag === "string" && /^[a-z][a-z0-9-]*$/.test(tag));

  if (tags.length !== record.tags.length) {
    errors.push(`${prefix}.tags may only contain lowercase tag strings such as "boss".`);
    return undefined;
  }

  return Array.from(new Set(tags));
}

function validateGameConfig(rawGame: unknown, errors: string[]): QuizGameConfig | undefined {
  if (rawGame === undefined) {
    return undefined;
  }

  if (!isRecord(rawGame)) {
    errors.push("game must be an object when provided.");
    return undefined;
  }

  const game: QuizGameConfig = {};

  if (rawGame.teamMode !== undefined) {
    if (typeof rawGame.teamMode !== "boolean") {
      errors.push("game.teamMode must be a boolean when provided.");
    } else {
      game.teamMode = rawGame.teamMode;
    }
  }

  if (rawGame.achievementsEnabled !== undefined) {
    if (typeof rawGame.achievementsEnabled !== "boolean") {
      errors.push("game.achievementsEnabled must be a boolean when provided.");
    } else {
      game.achievementsEnabled = rawGame.achievementsEnabled;
    }
  }

  if (rawGame.enabledAchievements !== undefined) {
    if (!Array.isArray(rawGame.enabledAchievements)) {
      errors.push("game.enabledAchievements must be an array when provided.");
    } else {
      const achievements = rawGame.enabledAchievements.filter(
        (achievement): achievement is string => typeof achievement === "string" && ACHIEVEMENT_IDS.has(achievement)
      );

      if (achievements.length !== rawGame.enabledAchievements.length) {
        errors.push(`game.enabledAchievements may only include: ${Array.from(ACHIEVEMENT_IDS).join(", ")}.`);
      } else {
        game.enabledAchievements = Array.from(new Set(achievements));
      }
    }
  }

  if (rawGame.bossMultiplier !== undefined) {
    if (typeof rawGame.bossMultiplier !== "number" || rawGame.bossMultiplier < 1 || rawGame.bossMultiplier > 10) {
      errors.push("game.bossMultiplier must be a number from 1 to 10 when provided.");
    } else {
      game.bossMultiplier = rawGame.bossMultiplier;
    }
  }

  return Object.keys(game).length === 0 ? undefined : game;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

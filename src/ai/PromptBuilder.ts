import type { QuestionGenerationRequest } from "./types";

export function buildQuestionGenerationPrompt(request: QuestionGenerationRequest): string {
  const requestedTypes = Object.entries(request.counts)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => `- ${count} ${type}`)
    .join("\n");

  return [
    "Generate a RevealQuiz-compatible quiz JSON object.",
    "Return valid JSON only. Do not wrap the result in Markdown fences.",
    "",
    `Topic: ${request.topic}`,
    `Level: ${request.level}`,
    "",
    "Question Types:",
    requestedTypes || "- 0 questions",
    "",
    "Requirements:",
    "- Return only JSON matching the RevealQuiz schema.",
    "- Top-level fields: title, description, game, questions.",
    `- game.teamMode must be ${request.teamMode}.`,
    `- game.achievementsEnabled must be ${request.achievementsEnabled}.`,
    `- game.enabledAchievements must be ${JSON.stringify(request.enabledAchievements)}.`,
    `- game.bossMultiplier must be ${request.bossMultiplier}.`,
    "- Use unique IDs.",
    "- IDs must contain only letters, numbers, underscores, or hyphens.",
    "- Include clear answer choices.",
    "- Do not reveal correct answers anywhere except the structured answer fields.",
    "- For multiple-choice and code-question, correct must be the zero-based answer index.",
    "- For true-false, answer must be a boolean.",
    "- For fill-blank, answers must be accepted answer strings.",
    "- Include code snippets only for code-question items.",
    "- If a question should be a boss round, add the tag \"boss\".",
    request.includeExplanations ? "- Include concise explanations." : "- Omit explanations.",
    `- Use ${request.defaultPoints} points unless a question deserves a different value.`,
    "",
    "Instructor Notes:",
    request.notes.trim() || "(none provided)"
  ].join("\n");
}

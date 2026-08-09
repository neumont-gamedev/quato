import type { QuestionGenerationRequest } from "./types";

export function buildQuestionGenerationPrompt(request: QuestionGenerationRequest): string {
  const requestedTypes = Object.entries(request.counts)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => `- ${count} ${type}`)
    .join("\n");

  return [
    "Generate a RevealQuiz-compatible quiz JSON object.",
    "",
    `Topic: ${request.topic}`,
    `Level: ${request.level}`,
    "",
    "Question Types:",
    requestedTypes || "- 0 questions",
    "",
    "Requirements:",
    "- Return only JSON matching the RevealQuiz schema.",
    "- Use unique IDs.",
    "- Include clear answer choices.",
    "- Do not reveal correct answers anywhere except the structured answer fields.",
    "- Include a game object with teamMode, achievementsEnabled, enabledAchievements, and bossMultiplier.",
    request.includeExplanations ? "- Include concise explanations." : "- Omit explanations.",
    `- Use ${request.defaultPoints} points unless a question deserves a different value.`,
    "",
    "Instructor Notes:",
    request.notes.trim() || "(none provided)"
  ].join("\n");
}

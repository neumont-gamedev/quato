import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";
import { firebaseApp } from "../firebase";
import { QuizLoader } from "../quiz/QuizLoader";
import { buildQuestionGenerationPrompt } from "./PromptBuilder";
import type { AiQuestionProvider, QuestionGenerationRequest, QuestionGenerationResult } from "./types";

const MODEL_NAME = "gemini-3.6-flash";

export class FirebaseAiQuestionProvider implements AiQuestionProvider {
  readonly name = "Firebase AI Logic";
  private readonly validator = new QuizLoader();

  async generateQuestions(request: QuestionGenerationRequest): Promise<QuestionGenerationResult> {
    const prompt = buildQuestionGenerationPrompt(request);
    const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });
    const model = getGenerativeModel(ai, {
      model: MODEL_NAME,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.65,
        topP: 0.95,
        maxOutputTokens: 8192
      }
    });

    const result = await generateWithFriendlyErrors(model, prompt);
    const rawText = result.response.text();
    let parsed = parseJsonResponse(rawText);
    let validation = this.validator.validate(parsed);

    if (!validation.data) {
      const repairPrompt = buildRepairPrompt(prompt, parsed, validation.errors);
      const repairResult = await generateWithFriendlyErrors(model, repairPrompt);
      parsed = parseJsonResponse(repairResult.response.text());
      validation = this.validator.validate(parsed);
    }

    if (!validation.data) {
      throw new Error(`Firebase AI returned invalid quiz JSON: ${validation.errors.join(" ")}`);
    }

    return {
      providerName: `${this.name} (${MODEL_NAME})`,
      prompt,
      quiz: validation.data
    };
  }
}

function buildRepairPrompt(originalPrompt: string, invalidJson: unknown, errors: string[]): string {
  return [
    "Repair this RevealQuiz JSON so it passes validation.",
    "Return valid JSON only. Do not wrap the result in Markdown fences.",
    "",
    "Validation errors:",
    ...errors.map((error) => `- ${error}`),
    "",
    "Critical schema reminders:",
    "- multiple-choice requires answers with at least 4 non-empty strings and correct as a zero-based index.",
    "- code-question requires code, answers with at least 4 non-empty strings, and correct as a zero-based index.",
    "- true-false requires answer as a boolean and should not use answers.",
    "- fill-blank requires answers with at least 1 accepted answer string.",
    "- Preserve the requested counts, topic, level, game settings, explanations preference, and point values.",
    "",
    "Original generation request:",
    originalPrompt,
    "",
    "Invalid JSON to repair:",
    JSON.stringify(invalidJson, null, 2)
  ].join("\n");
}

function parseJsonResponse(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

async function generateWithFriendlyErrors(
  model: ReturnType<typeof getGenerativeModel>,
  prompt: string
): Promise<Awaited<ReturnType<ReturnType<typeof getGenerativeModel>["generateContent"]>>> {
  try {
    return await model.generateContent(prompt);
  } catch (error) {
    throw new Error(formatFirebaseAiError(error));
  }
}

function formatFirebaseAiError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("prepayment credits are depleted") || message.includes("[429") || message.includes("RESOURCE_EXHAUSTED")) {
    return [
      "Firebase AI Logic reached Gemini, but Gemini API billing is out of usable credits.",
      "Add prepaid credits or fix billing in Google AI Studio, then try again.",
      "You can use the Local Draft Generator provider while billing is being fixed."
    ].join(" ");
  }

  if (message.includes("PERMISSION_DENIED")) {
    return "Firebase AI Logic is not enabled or allowed for this Firebase project yet. Enable AI Logic/Gemini API for quato-1512c, then try again.";
  }

  return `Firebase AI generation failed: ${message}`;
}

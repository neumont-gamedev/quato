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
    const parsed = parseJsonResponse(rawText);
    const validation = this.validator.validate(parsed);

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

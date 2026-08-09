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

    const result = await model.generateContent(prompt);
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

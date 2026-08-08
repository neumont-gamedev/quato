import type { FillBlankQuestion, QuizQuestion } from "../types/Question";
import { createFieldset, escapeHtml, type QuestionRenderer } from "./QuestionRenderer";

export class FillBlankRenderer implements QuestionRenderer {
  render(question: QuizQuestion): HTMLElement {
    const fillBlank = question as FillBlankQuestion;
    const fieldset = createFieldset(fillBlank);
    const label = document.createElement("label");
    label.className = "fill-blank";
    label.innerHTML = `
      <span>Your answer</span>
      <input name="answer" type="text" autocomplete="off" required />
    `;
    fieldset.append(label);
    return fieldset;
  }

  evaluate(question: QuizQuestion, value: FormData) {
    const fillBlank = question as FillBlankQuestion;
    const rawAnswer = String(value.get("answer") ?? "").trim();
    const normalize = (candidate: string) =>
      fillBlank.caseSensitive ? candidate.trim() : candidate.trim().toLowerCase();
    const isCorrect = fillBlank.answers.some((answer) => normalize(answer) === normalize(rawAnswer));

    return {
      isCorrect,
      correctAnswerLabel: fillBlank.answers.map(escapeHtml).join(" or "),
      explanation: fillBlank.explanation
    };
  }
}

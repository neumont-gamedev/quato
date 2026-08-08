import type { AnswerResult, QuizQuestion } from "../types/Question";

export interface QuestionRenderer {
  render(question: QuizQuestion): HTMLElement;
  evaluate(question: QuizQuestion, value: FormData): Omit<AnswerResult, "awardedPoints">;
}

export function createFieldset(question: QuizQuestion): HTMLFieldSetElement {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "quiz-fieldset";
  fieldset.setAttribute("aria-label", question.question);
  return fieldset;
}

export function createExplanation(result: AnswerResult): HTMLElement {
  const feedback = document.createElement("div");
  feedback.className = `quiz-feedback ${result.isCorrect ? "is-correct" : "is-incorrect"}`;
  feedback.innerHTML = `
    <p class="quiz-feedback__result">${result.isCorrect ? "Correct" : "Not quite"}</p>
    <p class="quiz-feedback__points">+${result.awardedPoints} points</p>
    <p class="quiz-feedback__answer">Answer: ${escapeHtml(result.correctAnswerLabel)}</p>
    ${result.explanation ? `<p class="quiz-feedback__explanation">${escapeHtml(result.explanation)}</p>` : ""}
  `;
  return feedback;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

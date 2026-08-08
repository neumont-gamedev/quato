import type { MultipleChoiceQuestion, QuizQuestion } from "../types/Question";
import { createFieldset, escapeHtml, type QuestionRenderer } from "./QuestionRenderer";

export class MultipleChoiceRenderer implements QuestionRenderer {
  render(question: QuizQuestion): HTMLElement {
    const multipleChoice = question as MultipleChoiceQuestion;
    const fieldset = createFieldset(multipleChoice);

    multipleChoice.answers.forEach((answer, index) => {
      const id = `${multipleChoice.id}-${index}`;
      const label = document.createElement("label");
      label.className = "answer-option";
      label.htmlFor = id;
      label.innerHTML = `
        <input id="${id}" type="radio" name="answer" value="${index}" required />
        <span class="answer-option__key">${String.fromCharCode(65 + index)}</span>
        <span>${escapeHtml(answer)}</span>
      `;
      fieldset.append(label);
    });

    return fieldset;
  }

  evaluate(question: QuizQuestion, value: FormData) {
    const multipleChoice = question as MultipleChoiceQuestion;
    const selected = Number(value.get("answer"));
    const correctAnswerLabel = multipleChoice.answers[multipleChoice.correct];

    return {
      isCorrect: selected === multipleChoice.correct,
      correctAnswerLabel,
      explanation: multipleChoice.explanation
    };
  }
}

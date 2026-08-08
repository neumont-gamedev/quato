import type { QuizQuestion, TrueFalseQuestion } from "../types/Question";
import { createFieldset, type QuestionRenderer } from "./QuestionRenderer";

export class TrueFalseRenderer implements QuestionRenderer {
  render(question: QuizQuestion): HTMLElement {
    const trueFalse = question as TrueFalseQuestion;
    const fieldset = createFieldset(trueFalse);

    [
      ["true", "True"],
      ["false", "False"]
    ].forEach(([value, labelText]) => {
      const id = `${trueFalse.id}-${value}`;
      const label = document.createElement("label");
      label.className = "answer-option";
      label.htmlFor = id;
      label.innerHTML = `
        <input id="${id}" type="radio" name="answer" value="${value}" required />
        <span class="answer-option__key">${labelText.at(0)}</span>
        <span>${labelText}</span>
      `;
      fieldset.append(label);
    });

    return fieldset;
  }

  evaluate(question: QuizQuestion, value: FormData) {
    const trueFalse = question as TrueFalseQuestion;
    const selected = value.get("answer") === "true";

    return {
      isCorrect: selected === trueFalse.answer,
      correctAnswerLabel: trueFalse.answer ? "True" : "False",
      explanation: trueFalse.explanation
    };
  }
}

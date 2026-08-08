import type { CodeQuestion, QuizQuestion } from "../types/Question";
import { createFieldset, escapeHtml, type QuestionRenderer } from "./QuestionRenderer";

export class CodeQuestionRenderer implements QuestionRenderer {
  render(question: QuizQuestion): HTMLElement {
    const codeQuestion = question as CodeQuestion;
    const wrapper = document.createElement("div");
    const codeLanguage = codeQuestion.language ? `language-${codeQuestion.language}` : "";
    const fieldset = createFieldset(codeQuestion);

    wrapper.className = "code-question";
    wrapper.innerHTML = `
      <pre class="code-question__block"><code class="${codeLanguage}">${escapeHtml(codeQuestion.code)}</code></pre>
    `;

    codeQuestion.answers.forEach((answer, index) => {
      const id = `${codeQuestion.id}-${index}`;
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

    wrapper.append(fieldset);
    return wrapper;
  }

  evaluate(question: QuizQuestion, value: FormData) {
    const codeQuestion = question as CodeQuestion;
    const selected = Number(value.get("answer"));

    return {
      isCorrect: selected === codeQuestion.correct,
      correctAnswerLabel: codeQuestion.answers[codeQuestion.correct],
      explanation: codeQuestion.explanation
    };
  }
}

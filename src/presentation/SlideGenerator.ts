import { QuestionFactory } from "../quiz/QuestionFactory";
import type { QuizQuestion } from "../types/Question";
import { escapeHtml } from "../questions/QuestionRenderer";

export class SlideGenerator {
  constructor(private readonly questionFactory: QuestionFactory) {}

  populateQuestionSlide(section: HTMLElement, question: QuizQuestion, position: number, total: number): void {
    const card = document.createElement("article");
    card.className = "quiz-card";
    card.dataset.questionId = question.id;

    card.innerHTML = `
      <div class="quiz-card__meta">
        <span>Question ${position} / ${total}</span>
        <span>${question.points ?? 100} pts</span>
      </div>
      <h2>${escapeHtml(question.question)}</h2>
      ${renderInstructorQuestionDisplay(question)}
      <div class="quiz-feedback-region"></div>
    `;

    section.classList.add("quiz-slide");
    section.replaceChildren(card);
  }
}

function renderInstructorQuestionDisplay(question: QuizQuestion): string {
  switch (question.type) {
    case "multiple-choice":
      return renderAnswerList(question.answers, question.correct, question.explanation);
    case "true-false":
      return renderAnswerList(["True", "False"], question.answer ? 0 : 1, question.explanation);
    case "fill-blank":
      return `
        <div class="quiz-fieldset">
          <div class="fill-blank fill-blank--display">
            <span>__________</span>
            ${renderRevealDetails(question.explanation)}
          </div>
        </div>
      `;
    case "code-question":
      return `
        <div class="code-question">
          <pre class="code-question__block"><code class="${question.language ? `language-${question.language}` : ""}">${escapeHtml(question.code)}</code></pre>
          ${renderAnswerList(question.answers, question.correct, question.explanation)}
        </div>
      `;
  }
}

function renderAnswerList(answers: string[], correctIndex: number, explanation: string | undefined): string {
  return `
    <div class="quiz-fieldset">
      ${answers
        .map(
          (answer, index) => `
            <div class="answer-option answer-option--display" data-answer-index="${index}">
              <span class="answer-option__key">${String.fromCharCode(65 + index)}</span>
              <span>${escapeHtml(answer)}</span>
              ${index === correctIndex ? renderRevealDetails(explanation) : ""}
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderRevealDetails(explanation: string | undefined): string {
  if (!explanation) {
    return "";
  }

  return `
    <div class="answer-option__explanation">
      <strong>Details</strong>
      <span>${escapeHtml(explanation)}</span>
    </div>
  `;
}

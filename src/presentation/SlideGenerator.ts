import { QuestionFactory } from "../quiz/QuestionFactory";
import type { QuizQuestion } from "../types/Question";
import { escapeHtml } from "../questions/QuestionRenderer";

export class SlideGenerator {
  constructor(private readonly questionFactory: QuestionFactory) {}

  populateQuestionSlide(section: HTMLElement, question: QuizQuestion, position: number, total: number): void {
    const renderer = this.questionFactory.getRenderer(question.type);
    const form = document.createElement("form");
    form.className = "quiz-card";
    form.dataset.questionId = question.id;

    form.innerHTML = `
      <div class="quiz-card__meta">
        <span>Question ${position} / ${total}</span>
        <span>${question.points ?? 100} pts</span>
      </div>
      <h2>${escapeHtml(question.question)}</h2>
    `;

    form.append(renderer.render(question));

    const actions = document.createElement("div");
    actions.className = "quiz-actions";
    actions.innerHTML = `
      <button class="quiz-submit" type="submit">Submit Answer</button>
      <button class="quiz-reset" type="button">Try Again</button>
    `;
    form.append(actions);

    const feedback = document.createElement("div");
    feedback.className = "quiz-feedback-region";
    form.append(feedback);

    section.classList.add("quiz-slide");
    section.replaceChildren(form);
  }
}

import { createExplanation } from "../questions/QuestionRenderer";
import { SlideGenerator } from "../presentation/SlideGenerator";
import type { QuizFile, QuizQuestion, ScoreState } from "../types/Question";
import { QuestionFactory } from "./QuestionFactory";
import { ScoreManager } from "./ScoreManager";

export interface QuizEngineOptions {
  onActiveQuestionChange?: (question: QuizQuestion | undefined, questionIndex: number, currentSlide?: HTMLElement) => void;
}

export class QuizEngine {
  private readonly questionFactory = new QuestionFactory();
  private readonly slideGenerator = new SlideGenerator(this.questionFactory);
  private readonly scoreManager: ScoreManager;
  private readonly questionsById: Map<string, QuizQuestion>;
  private readonly answeredQuestions = new Set<string>();
  private activeQuestion?: QuizQuestion;
  private lastActiveQuestionKey = "";

  constructor(
    private readonly quiz: QuizFile,
    private readonly hud: HTMLElement,
    private readonly finalScore: HTMLElement | null,
    private readonly options: QuizEngineOptions = {}
  ) {
    this.questionsById = new Map(quiz.questions.map((question) => [question.id, question]));
    this.scoreManager = new ScoreManager(quiz.questions.length, quiz.game);
  }

  mount(): void {
    const questionSections = document.querySelectorAll<HTMLElement>("[data-question-id]");

    questionSections.forEach((section) => {
      const questionId = section.dataset.questionId;
      const question = questionId ? this.questionsById.get(questionId) : undefined;

      if (!question) {
        section.classList.add("quiz-slide", "quiz-slide--error");
        section.innerHTML = `<h2>Missing Question</h2><p>No question found for id "${questionId ?? "unknown"}".</p>`;
        return;
      }

      const questionPosition = this.quiz.questions.findIndex((candidate) => candidate.id === question.id) + 1;
      this.slideGenerator.populateQuestionSlide(section, question, questionPosition, this.quiz.questions.length);
      this.bindQuestionForm(section, question);
    });

    this.renderHud();
    this.renderFinalScore();
  }

  handleSlideChanged(currentSlide?: HTMLElement): void {
    const questionId = currentSlide?.dataset.questionId;
    this.activeQuestion = questionId ? this.questionsById.get(questionId) : undefined;
    const questionIndex = this.activeQuestion
      ? this.quiz.questions.findIndex((question) => question.id === this.activeQuestion?.id) + 1
      : 0;
    const activeQuestionKey = getSlideKey(currentSlide, this.activeQuestion);

    if (activeQuestionKey !== this.lastActiveQuestionKey) {
      this.lastActiveQuestionKey = activeQuestionKey;
      this.options.onActiveQuestionChange?.(this.activeQuestion, questionIndex, currentSlide);
    }

    this.renderHud();
  }

  syncCurrentSlideFromDocument(): { question: QuizQuestion | undefined; questionIndex: number } {
    this.handleSlideChanged(document.querySelector<HTMLElement>("section.present") ?? undefined);

    return {
      question: this.activeQuestion,
      questionIndex: this.activeQuestion
        ? this.quiz.questions.findIndex((question) => question.id === this.activeQuestion?.id) + 1
        : 0
    };
  }

  private bindQuestionForm(section: HTMLElement, question: QuizQuestion): void {
    const form = section.querySelector<HTMLFormElement>("form");
    const resetButton = section.querySelector<HTMLButtonElement>(".quiz-reset");
    const feedbackRegion = section.querySelector<HTMLElement>(".quiz-feedback-region");

    form?.addEventListener("submit", (event) => {
      event.preventDefault();

      if (!form.reportValidity()) {
        return;
      }

      const renderer = this.questionFactory.getRenderer(question.type);
      const evaluated = renderer.evaluate(question, new FormData(form));
      const scoreAward = this.answeredQuestions.has(question.id)
        ? { points: 0, newState: this.scoreManager.getState() }
        : this.scoreManager.award(question, evaluated.isCorrect);

      this.answeredQuestions.add(question.id);
      form.classList.add("is-answered");
      form.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
        input.disabled = true;
      });

      if (feedbackRegion) {
        feedbackRegion.replaceChildren(
          createExplanation({
            ...evaluated,
            awardedPoints: scoreAward.points
          })
        );
      }

      this.renderHud(scoreAward.newState);
      this.renderFinalScore();
    });

    resetButton?.addEventListener("click", () => {
      form?.reset();
      form?.classList.remove("is-answered");
      form?.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
        input.disabled = false;
      });
      feedbackRegion?.replaceChildren();
    });
  }

  private renderHud(state: ScoreState = this.scoreManager.getState()): void {
    const activeIndex = this.activeQuestion
      ? this.quiz.questions.findIndex((question) => question.id === this.activeQuestion?.id) + 1
      : Math.min(state.answered + 1, state.totalQuestions);

    this.hud.innerHTML = `
      <div>
        <span class="game-hud__label">Question</span>
        <strong>${activeIndex} / ${state.totalQuestions}</strong>
      </div>
      <div>
        <span class="game-hud__label">Score</span>
        <strong>${state.score.toLocaleString()}</strong>
      </div>
      <div>
        <span class="game-hud__label">Streak</span>
        <strong>${state.streak}</strong>
      </div>
      <div>
        <span class="game-hud__label">Accuracy</span>
        <strong>${state.answered === 0 ? "0%" : `${Math.round((state.correct / state.answered) * 100)}%`}</strong>
      </div>
    `;
  }

  private renderFinalScore(): void {
    if (!this.finalScore) {
      return;
    }

    const state = this.scoreManager.getState();
    this.finalScore.innerHTML = `
      <p class="final-score__label">Final Score</p>
      <p class="final-score__score">${state.score.toLocaleString()}</p>
      <p>${state.correct} correct out of ${state.totalQuestions} questions answered.</p>
    `;
  }
}

function getSlideKey(currentSlide: HTMLElement | undefined, activeQuestion: QuizQuestion | undefined): string {
  if (activeQuestion) {
    return `question:${activeQuestion.id}`;
  }

  if (currentSlide?.dataset.leaderboardSlide === "true") {
    return `leaderboard:${currentSlide.dataset.afterQuestionId ?? ""}`;
  }

  if (currentSlide?.querySelector("#final-score")) {
    return "final-results";
  }

  return "presentation";
}

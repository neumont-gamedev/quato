import type { Unsubscribe } from "firebase/firestore";
import { renderCharacterSprite } from "../classroom/CharacterSprites";
import { createLeaderboardEntries } from "../classroom/Leaderboard";
import type { ClassroomScoreAward } from "../classroom/ClassroomScoring";
import { ClassroomSessionService } from "../classroom/ClassroomSessionService";
import type { ClassroomAnswer, ClassroomPlayer, ClassroomSession } from "../classroom/types";
import type { QuizFile, QuizQuestion } from "../types/Question";

export class InstructorController {
  private readonly service = new ClassroomSessionService();
  private session: ClassroomSession | null = null;
  private activeQuestion: QuizQuestion | null = null;
  private activeQuestionIndex = 0;
  private players: ClassroomPlayer[] = [];
  private answers: ClassroomAnswer[] = [];
  private awards: ClassroomScoreAward[] = [];
  private unsubscribers: Unsubscribe[] = [];
  private slideChangeVersion = 0;
  private slideSync: Promise<void> = Promise.resolve();
  private currentSlideSync?: () => { question: QuizQuestion | undefined; questionIndex: number };
  private infoToggle?: HTMLButtonElement;
  private isPanelVisible = true;
  private readonly handleKeyboardLock = (event: KeyboardEvent): void => {
    const target = event.target as HTMLElement | null;
    const isEditable =
      target?.tagName === "INPUT" ||
      target?.tagName === "TEXTAREA" ||
      target?.tagName === "SELECT" ||
      target?.isContentEditable;

    if (isEditable || event.repeat || (event.key !== " " && event.key !== "Spacebar")) {
      return;
    }

    if (this.session?.status !== "question-open" || !this.activeQuestion) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    void this.revealQuestion();
  };

  constructor(
    private readonly quiz: QuizFile,
    private readonly panel: HTMLElement,
    private readonly quizId = "example"
  ) {}

  mount(): void {
    this.panel.hidden = false;
    this.createInfoToggle();
    window.addEventListener("keydown", this.handleKeyboardLock, { capture: true });
    this.render();
  }

  setCurrentSlideSync(syncCurrentSlide: () => { question: QuizQuestion | undefined; questionIndex: number }): void {
    this.currentSlideSync = syncCurrentSlide;
  }

  handleQuestionChanged(question: QuizQuestion | undefined, questionIndex: number, currentSlide?: HTMLElement): Promise<void> {
    const previousQuestion = this.activeQuestion;
    const previousQuestionIndex = this.activeQuestionIndex;
    const version = (this.slideChangeVersion += 1);
    this.activeQuestion = question ?? null;
    this.activeQuestionIndex = questionIndex;
    const isLeaderboardSlide = currentSlide?.dataset.leaderboardSlide === "true";
    const isFinalResultsSlide = !!currentSlide?.querySelector("#final-score");

    if (!this.session) {
      this.render();
      return Promise.resolve();
    }

    this.slideSync = this.slideSync.then(async () => {
      if (version !== this.slideChangeVersion) {
        return;
      }

      if (question && this.session) {
        if (
          (this.session.status === "revealed" || this.session.status === "leaderboard") &&
          this.session.revealedAnswer?.questionId === question.id
        ) {
          this.renderQuestionReveal(question);
          this.listenAnswers(question.id);
          this.render();
          return;
        }

        await this.service.publishQuestion(this.session.code, question, questionIndex, this.quiz.questions.length);
        if (version === this.slideChangeVersion) {
          this.awards = [];
          this.listenAnswers(question.id);
        }
        return;
      }

      if (this.session) {
        if (isFinalResultsSlide) {
          await this.service.endSession(this.session.code);
          this.renderFinalResultsStage(currentSlide);
          this.render();
          return;
        }

        if (isLeaderboardSlide && this.session.status === "question-open") {
          const questionToReveal =
            this.getQuestionForLeaderboardSlide(currentSlide) ??
            previousQuestion ??
            this.quiz.questions.find((candidate) => candidate.id === this.session?.currentQuestionId);

          if (!questionToReveal) {
            return;
          }

          window.RevealQuizDeck?.prev();
          this.activeQuestion = questionToReveal;
          this.activeQuestionIndex =
            this.quiz.questions.findIndex((candidate) => candidate.id === questionToReveal.id) + 1 || previousQuestionIndex;
          await this.revealSpecificQuestion(questionToReveal);
          return;
        }

        if (isLeaderboardSlide && (this.session.status === "revealed" || this.session.status === "leaderboard")) {
          if (this.session.status !== "leaderboard") {
            await this.service.setStatus(this.session.code, "leaderboard");
          }
          this.renderLeaderboardStage(currentSlide);
          this.render();
          return;
        }

        await this.service.markPresenting(this.session.code);
        if (version === this.slideChangeVersion) {
          this.answers = [];
          this.awards = [];
          this.render();
        }
      }
    });

    return this.slideSync;
  }

  private async startSession(): Promise<void> {
    this.syncActiveQuestionFromDeck();
    this.session = await this.service.createSession(this.quiz, this.quizId);
    this.listenSession(this.session.code);
    this.listenPlayers(this.session.code);

    if (this.activeQuestion) {
      await this.service.publishQuestion(
        this.session.code,
        this.activeQuestion,
        this.activeQuestionIndex,
        this.quiz.questions.length
      );
      this.listenAnswers(this.activeQuestion.id);
    } else {
      await this.service.markPresenting(this.session.code);
    }

    this.render();
  }

  private async syncQuestion(): Promise<void> {
    const current = this.syncActiveQuestionFromDeck();

    if (!this.session) {
      this.render();
      return;
    }

    if (current.question) {
      await this.service.publishQuestion(
        this.session.code,
        current.question,
        current.questionIndex,
        this.quiz.questions.length
      );
      this.listenAnswers(current.question.id);
      this.awards = [];
      return;
    }

    await this.service.markPresenting(this.session.code);
    this.answers = [];
    this.awards = [];
    this.render();
  }

  private async revealQuestion(): Promise<void> {
    if (!this.session) {
      return;
    }

    const current = this.syncActiveQuestionFromDeck();

    if (!current.question) {
      await this.service.setStatus(this.session.code, "revealed");
      return;
    }

    if (this.session.status === "revealed" && this.session.revealedAnswer?.questionId === current.question.id) {
      this.renderQuestionReveal(current.question);
      return;
    }

    this.awards = await this.service.scoreAndRevealQuestion(this.session.code, current.question.id);
    this.markQuestionRevealed(current.question);
    this.renderQuestionReveal(current.question);
    this.render();
  }

  private async revealSpecificQuestion(question: QuizQuestion): Promise<void> {
    if (!this.session) {
      return;
    }

    if (this.session.status === "revealed" && this.session.revealedAnswer?.questionId === question.id) {
      this.renderQuestionReveal(question);
      return;
    }

    this.awards = await this.service.scoreAndRevealQuestion(this.session.code, question.id);
    this.markQuestionRevealed(question);
    this.renderQuestionReveal(question);
    this.render();
  }

  private markQuestionRevealed(question: QuizQuestion): void {
    if (!this.session) {
      return;
    }

    this.session = {
      ...this.session,
      status: "revealed",
      revealedAnswer: {
        questionId: question.id,
        type: question.type,
        correctAnswer: getCorrectAnswerLabel(question),
        ...(question.explanation === undefined ? {} : { explanation: question.explanation })
      }
    };
  }

  private syncActiveQuestionFromDeck(): { question: QuizQuestion | undefined; questionIndex: number } {
    const current = this.currentSlideSync?.() ?? { question: this.activeQuestion ?? undefined, questionIndex: this.activeQuestionIndex };
    this.activeQuestion = current.question ?? null;
    this.activeQuestionIndex = current.questionIndex;
    return current;
  }

  private listenSession(code: string): void {
    this.unsubscribers.push(
      this.service.listenSession(code, (session) => {
        this.session = session;
        if (session?.status === "revealed" && this.activeQuestion) {
          this.renderQuestionReveal(this.activeQuestion);
        }
        this.render();
      })
    );
  }

  private renderQuestionReveal(question: QuizQuestion): void {
    const currentSlide =
      document.querySelector<HTMLElement>(`section.present[data-question-id="${cssEscape(question.id)}"]`) ??
      document.querySelector<HTMLElement>(`section[data-question-id="${cssEscape(question.id)}"]`);

    if (!currentSlide || currentSlide.dataset.questionId !== question.id) {
      return;
    }

    const explanationText = question.explanation ?? this.session?.revealedAnswer?.explanation ?? "";
    currentSlide.classList.add("quiz-slide--revealed");
    currentSlide.querySelectorAll<HTMLElement>(".answer-option--display").forEach((option) => {
      option.querySelector(".answer-option__explanation")?.remove();
      const isCorrect = option.dataset.answerIndex === getCorrectAnswerIndex(question);
      option.classList.toggle("is-correct-answer", isCorrect);
      option.classList.toggle("is-muted-answer", !isCorrect);

      if (isCorrect && explanationText) {
        option.append(createRevealDetails(explanationText));
      }
    });

    if (question.type === "fill-blank") {
      const answerBox = currentSlide.querySelector<HTMLElement>(".fill-blank--display");
      const blank = answerBox?.querySelector<HTMLElement>("span");
      answerBox?.querySelector(".answer-option__explanation")?.remove();

      if (answerBox && blank) {
        blank.textContent = question.answers.join(" / ");

        if (explanationText) {
          answerBox.append(createRevealDetails(explanationText));
        }
      }
    }
  }

  private getQuestionForLeaderboardSlide(slide?: HTMLElement): QuizQuestion | undefined {
    const questionId = slide?.dataset.afterQuestionId ?? this.session?.currentQuestionId ?? "";
    return this.quiz.questions.find((candidate) => candidate.id === questionId);
  }

  private listenPlayers(code: string): void {
    this.unsubscribers.push(
      this.service.listenPlayers(code, (players) => {
        this.players = players;
        if (this.session?.status === "revealed" || this.session?.status === "leaderboard") {
          this.renderLeaderboardStage();
        }
        if (this.session?.status === "ended") {
          this.renderFinalResultsStage();
        }
        this.render();
      })
    );
  }

  private listenAnswers(questionId: string): void {
    const code = this.session?.code;

    if (!code) {
      return;
    }

    this.unsubscribers = this.unsubscribers.filter((unsubscribe) => {
      unsubscribe();
      return false;
    });
    this.listenSession(code);
    this.listenPlayers(code);
    this.unsubscribers.push(
      this.service.listenAnswers(code, questionId, (answers) => {
        this.answers = answers;
        this.render();
      })
    );
  }

  private render(): void {
    if (!this.session) {
      this.panel.innerHTML = `
        <button class="classroom-primary" type="button" data-action="start">Start Live Session</button>
      `;
      this.bindPanelActions();
      this.applyPanelVisibility();
      return;
    }

    const joinUrl = `${location.origin}/?mode=student&code=${this.session.code}`;
    const leaderboard = this.createLeaderboard();
    this.panel.innerHTML = `
      <div class="classroom-code">
        <span>Join Code</span>
        <strong>${this.session.code}</strong>
      </div>
      <div class="classroom-stats">
        <span>${this.players.length} joined</span>
        <span>${this.answers.length} answered</span>
        <span>${this.session.status}</span>
      </div>
      ${leaderboard}
      <div class="classroom-actions">
        <button type="button" data-action="copy">Copy Link</button>
        <button type="button" data-action="sync">Sync Slide</button>
        <button type="button" data-action="lock" ${this.session.status !== "question-open" ? "disabled" : ""}>Lock</button>
        <button type="button" data-action="export" ${this.session.status !== "ended" ? "disabled" : ""}>Export CSV</button>
        <button type="button" data-action="end">End</button>
      </div>
      <p class="classroom-url">${joinUrl}</p>
    `;
    this.bindPanelActions();
    this.applyPanelVisibility();
  }

  private createInfoToggle(): void {
    if (this.infoToggle) {
      return;
    }

    this.infoToggle = document.createElement("button");
    this.infoToggle.className = "classroom-info-toggle";
    this.infoToggle.type = "button";
    this.infoToggle.textContent = "i";
    this.infoToggle.addEventListener("click", () => {
      this.isPanelVisible = !this.isPanelVisible;
      this.applyPanelVisibility();
    });
    document.body.append(this.infoToggle);
    this.applyPanelVisibility();
  }

  private applyPanelVisibility(): void {
    this.panel.classList.toggle("is-hidden", !this.isPanelVisible);
    this.infoToggle?.classList.toggle("is-active", this.isPanelVisible);
    this.infoToggle?.setAttribute("aria-label", `${this.isPanelVisible ? "Hide" : "Show"} instructor information panel`);
    this.infoToggle?.setAttribute("aria-expanded", String(this.isPanelVisible));
  }

  private createLeaderboard(): string {
    const rankedPlayers = createLeaderboardEntries(this.players);

    if (rankedPlayers.length === 0) {
      return "";
    }

    return `
      <ol class="classroom-leaderboard" aria-label="Leaderboard">
        ${rankedPlayers
          .map((player, index) => {
            const award = this.awards.find((candidate) => candidate.uid === player.uid);
            const points = award && award.points > 0 ? ` <span>+${award.points}</span>` : "";
            return `<li><strong>${renderCharacterSprite(player.characterIndex, "classroom-player-character")}${index + 1}. ${escapePanelText(player.name)}</strong><em>${player.score}${points}</em></li>`;
          })
          .join("")}
      </ol>
    `;
  }

  private renderLeaderboardStage(slide: HTMLElement | null = document.querySelector<HTMLElement>("section.present")): void {
    const currentSlide = slide;

    if (!currentSlide || currentSlide.dataset.questionId || currentSlide.dataset.leaderboardSlide !== "true") {
      return;
    }

    const rankedPlayers = createLeaderboardEntries(this.players);

    if (rankedPlayers.length === 0) {
      return;
    }

    currentSlide.classList.add("classroom-leaderboard-slide");
    currentSlide.innerHTML = `
      <div class="leaderboard-stage">
        <p>Leaderboard</p>
        <h2>Current Standings</h2>
        ${this.createQuestionResults()}
        <ol>
          ${rankedPlayers
            .map(
              (player, index) => `
                <li>
                  <span>${renderCharacterSprite(player.characterIndex, "leaderboard-stage-character")}</span>
                  <strong>${index + 1}. ${escapePanelText(player.name)}</strong>
                  <em>${player.score.toLocaleString()}</em>
                </li>
              `
            )
            .join("")}
        </ol>
      </div>
    `;
  }

  private createQuestionResults(): string {
    const questionId = this.session?.revealedAnswer?.questionId;
    const question = questionId ? this.quiz.questions.find((candidate) => candidate.id === questionId) : this.activeQuestion;

    if (!question) {
      return "";
    }

    const answered = this.answers.length;
    const correct = this.awards.filter((award) => award.isCorrect).length;
    const accuracy = answered === 0 ? 0 : Math.round((correct / answered) * 100);
    const distribution = createAnswerDistribution(question, this.answers);

    return `
      <div class="classroom-results-grid">
        <div><span>Answered</span><strong>${answered} / ${this.players.length}</strong></div>
        <div><span>Correct</span><strong>${correct}</strong></div>
        <div><span>Accuracy</span><strong>${accuracy}%</strong></div>
      </div>
      <div class="classroom-distribution">
        ${distribution
          .map(
            (entry) => `
              <div class="${entry.isCorrect ? "is-correct" : ""}">
                <span>${escapePanelText(entry.label)}</span>
                <strong>${entry.count}</strong>
                <em style="--result-width: ${entry.percent}%"></em>
              </div>
            `
          )
          .join("")}
      </div>
    `;
  }

  private renderFinalResultsStage(slide: HTMLElement | null = document.querySelector<HTMLElement>("section.present")): void {
    const currentSlide = slide;

    if (!currentSlide || !currentSlide.querySelector("#final-score")) {
      return;
    }

    const rankedPlayers = createLeaderboardEntries(this.players, 10);
    const totalScore = this.players.reduce((sum, player) => sum + player.score, 0);
    const averageScore = this.players.length === 0 ? 0 : Math.round(totalScore / this.players.length);

    currentSlide.classList.add("classroom-final-slide");
    currentSlide.innerHTML = `
      <div class="final-stage">
        <p>Final Results</p>
        <h2>${escapePanelText(this.quiz.title)}</h2>
        <div class="classroom-results-grid">
          <div><span>Players</span><strong>${this.players.length}</strong></div>
          <div><span>Questions</span><strong>${this.quiz.questions.length}</strong></div>
          <div><span>Avg Score</span><strong>${averageScore.toLocaleString()}</strong></div>
        </div>
        <ol>
          ${rankedPlayers
            .map(
              (player, index) => `
                <li>
                  <span>${renderCharacterSprite(player.characterIndex, "leaderboard-stage-character")}</span>
                  <strong>${index + 1}. ${escapePanelText(player.name)}</strong>
                  <em>${player.score.toLocaleString()}</em>
                </li>
              `
            )
            .join("")}
        </ol>
      </div>
    `;
  }

  private bindPanelActions(): void {
    this.panel.querySelector<HTMLElement>('[data-action="start"]')?.addEventListener("click", () => {
      void this.startSession();
    });
    this.panel.querySelector<HTMLElement>('[data-action="copy"]')?.addEventListener("click", async () => {
      if (this.session) {
        await navigator.clipboard.writeText(`${location.origin}/?mode=student&code=${this.session.code}`);
      }
    });
    this.panel.querySelector<HTMLElement>('[data-action="sync"]')?.addEventListener("click", () => {
      void this.syncQuestion();
    });
    this.panel.querySelector<HTMLElement>('[data-action="lock"]')?.addEventListener("click", () => {
      void this.revealQuestion();
    });
    this.panel.querySelector<HTMLElement>('[data-action="export"]')?.addEventListener("click", () => {
      void this.exportGradeCsv();
    });
    this.panel.querySelector<HTMLElement>('[data-action="end"]')?.addEventListener("click", () => {
      if (this.session) void this.endSession();
    });
  }

  private async endSession(): Promise<void> {
    if (!this.session) {
      return;
    }

    await this.service.endSession(this.session.code);
    this.renderFinalResultsStage();
    this.render();
  }

  private async exportGradeCsv(): Promise<void> {
    if (!this.session) {
      return;
    }

    const gradeExport = await this.service.getGradeExport(this.session.code);

    if (!gradeExport) {
      return;
    }

    const csv = [
      ["Rank", "Name", "Score", "Streak", "Session Code", "Quiz"].map(csvCell).join(","),
      ...gradeExport.rows.map((row) =>
        [row.rank, row.name, row.score, row.streak, gradeExport.code, gradeExport.title].map(csvCell).join(",")
      )
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${gradeExport.code}-${gradeExport.quizId}-grades.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}

function escapePanelText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function csvCell(value: string | number): string {
  const text = String(value).replace(/"/g, '""');
  return `"${text}"`;
}

function cssEscape(value: string): string {
  return globalThis.CSS?.escape ? globalThis.CSS.escape(value) : value.replace(/["\\]/g, "\\$&");
}

function createRevealDetails(text: string): HTMLElement {
  const detail = document.createElement("div");
  const label = document.createElement("strong");
  const body = document.createElement("span");
  detail.className = "answer-option__explanation";
  label.textContent = "Details";
  body.textContent = text;
  detail.append(label, body);
  return detail;
}

function getCorrectAnswerIndex(question: QuizQuestion): string {
  switch (question.type) {
    case "multiple-choice":
    case "code-question":
      return String(question.correct);
    case "true-false":
      return question.answer ? "0" : "1";
    case "fill-blank":
      return "";
  }
}

function getCorrectAnswerLabel(question: QuizQuestion): string {
  switch (question.type) {
    case "multiple-choice":
    case "code-question":
      return question.answers[question.correct] ?? `Choice ${question.correct + 1}`;
    case "true-false":
      return question.answer ? "True" : "False";
    case "fill-blank":
      return question.answers.join(" / ");
  }
}

function createAnswerDistribution(question: QuizQuestion, answers: ClassroomAnswer[]): Array<{
  label: string;
  count: number;
  percent: number;
  isCorrect: boolean;
}> {
  const buckets = getAnswerBuckets(question);
  const counts = new Map(buckets.map((bucket) => [bucket.key, 0]));

  answers.forEach((answer) => {
    const key = normalizeAnswerKey(question, answer.value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  if (question.type === "fill-blank") {
    counts.forEach((count, key) => {
      if (!buckets.some((bucket) => bucket.key === key)) {
        buckets.push({ key, label: key || "(blank)", isCorrect: false });
      }
    });
  }

  return buckets.map((bucket) => {
    const count = counts.get(bucket.key) ?? 0;
    return {
      label: bucket.label,
      count,
      percent: answers.length === 0 ? 0 : Math.round((count / answers.length) * 100),
      isCorrect: bucket.isCorrect
    };
  });
}

function getAnswerBuckets(question: QuizQuestion): Array<{ key: string; label: string; isCorrect: boolean }> {
  switch (question.type) {
    case "multiple-choice":
    case "code-question":
      return question.answers.map((answer, index) => ({
        key: String(index),
        label: `${String.fromCharCode(65 + index)}. ${answer}`,
        isCorrect: index === question.correct
      }));
    case "true-false":
      return [
        { key: "true", label: "True", isCorrect: question.answer },
        { key: "false", label: "False", isCorrect: !question.answer }
      ];
    case "fill-blank":
      return question.answers.map((answer) => ({
        key: question.caseSensitive ? answer : answer.toLowerCase(),
        label: answer,
        isCorrect: true
      }));
  }
}

function normalizeAnswerKey(question: QuizQuestion, value: ClassroomAnswer["value"]): string {
  switch (question.type) {
    case "multiple-choice":
    case "code-question":
      return String(Number(value));
    case "true-false":
      return String(value === true);
    case "fill-blank": {
      const answer = String(value).trim();
      return question.caseSensitive ? answer : answer.toLowerCase();
    }
  }
}

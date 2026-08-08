import type { Unsubscribe } from "firebase/firestore";
import { createLeaderboardEntries } from "../classroom/Leaderboard";
import { scoreQuestionForPlayers, type ClassroomScoreAward } from "../classroom/ClassroomScoring";
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

  constructor(
    private readonly quiz: QuizFile,
    private readonly panel: HTMLElement
  ) {}

  mount(): void {
    this.panel.hidden = false;
    this.render();
  }

  setCurrentSlideSync(syncCurrentSlide: () => { question: QuizQuestion | undefined; questionIndex: number }): void {
    this.currentSlideSync = syncCurrentSlide;
  }

  handleQuestionChanged(question: QuizQuestion | undefined, questionIndex: number, currentSlide?: HTMLElement): Promise<void> {
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
        await this.service.publishQuestion(this.session.code, question, questionIndex, this.quiz.questions.length);
        if (version === this.slideChangeVersion) {
          this.awards = [];
          this.listenAnswers(question.id);
        }
        return;
      }

      if (this.session) {
        if (isFinalResultsSlide) {
          await this.service.setStatus(this.session.code, "ended");
          this.renderFinalResultsStage(currentSlide);
          this.render();
          return;
        }

        if (isLeaderboardSlide && this.session.status === "revealed") {
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
    this.session = await this.service.createSession(this.quiz);
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
      return;
    }

    this.awards = scoreQuestionForPlayers({
      question: current.question,
      answers: this.answers,
      players: this.players,
      questionStartedAt: this.session.questionStartedAt
    });

    await Promise.all(
      this.awards.map((award) => {
        const player = this.players.find((candidate) => candidate.uid === award.uid);
        return player ? this.service.updatePlayerScore(this.session!.code, player, award.score, award.streak) : undefined;
      })
    );
    await this.service.revealQuestion(this.session.code, current.question);
    this.render();
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
        this.render();
      })
    );
  }

  private listenPlayers(code: string): void {
    this.unsubscribers.push(
      this.service.listenPlayers(code, (players) => {
        this.players = players;
        if (this.session?.status === "revealed") {
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
        <a class="classroom-link" href="/?mode=student" target="_blank" rel="noreferrer">Student View</a>
      `;
      this.bindPanelActions();
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
        <button type="button" data-action="reveal" ${this.session.status === "ended" ? "disabled" : ""}>Reveal</button>
        <button type="button" data-action="end">End</button>
      </div>
      <p class="classroom-url">${joinUrl}</p>
    `;
    this.bindPanelActions();
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
            return `<li><strong>${index + 1}. ${escapePanelText(player.name)}</strong><em>${player.score}${points}</em></li>`;
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
                  <span>${index + 1}</span>
                  <strong>${escapePanelText(player.name)}</strong>
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
                  <span>${index + 1}</span>
                  <strong>${escapePanelText(player.name)}</strong>
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
      if (this.session) void this.service.setStatus(this.session.code, "locked");
    });
    this.panel.querySelector<HTMLElement>('[data-action="reveal"]')?.addEventListener("click", () => {
      void this.revealQuestion();
    });
    this.panel.querySelector<HTMLElement>('[data-action="end"]')?.addEventListener("click", () => {
      if (this.session) void this.service.setStatus(this.session.code, "ended");
    });
  }
}

function escapePanelText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

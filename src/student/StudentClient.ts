import type { Unsubscribe } from "firebase/firestore";
import { createLeaderboardEntries } from "../classroom/Leaderboard";
import { ClassroomSessionService, normalizeCode, renderStudentAnswer } from "../classroom/ClassroomSessionService";
import type { ClassroomPlayer, ClassroomSession } from "../classroom/types";
import type { PublicQuestion } from "../types/Question";
import { escapeHtml } from "../questions/QuestionRenderer";

export class StudentClient {
  private readonly service = new ClassroomSessionService();
  private code = "";
  private player: ClassroomPlayer | null = null;
  private players: ClassroomPlayer[] = [];
  private session: ClassroomSession | null = null;
  private unsubscribe?: Unsubscribe;
  private unsubscribePlayer?: Unsubscribe;
  private unsubscribePlayers?: Unsubscribe;
  private timerId?: number;
  private submittedQuestionId: string | null = null;

  constructor(private readonly root: HTMLElement) {}

  mount(initialCode: string): void {
    this.root.className = "student-shell";
    this.code = normalizeCode(initialCode);
    this.renderJoin();
  }

  private renderJoin(): void {
    this.root.innerHTML = `
      <section class="student-card">
        <p class="student-eyebrow">RevealQuiz</p>
        <h1>Join Session</h1>
        <form id="student-join-form" class="student-form">
          <label>
            <span>Game Code</span>
            <input name="code" value="${escapeHtml(this.code)}" maxlength="6" required />
          </label>
          <label>
            <span>Your Name</span>
            <input name="name" maxlength="32" required />
          </label>
          <button type="submit">Join</button>
        </form>
      </section>
    `;

    this.root.querySelector<HTMLFormElement>("#student-join-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const formData = new FormData(form);
      this.code = normalizeCode(String(formData.get("code") ?? ""));
      this.player = await this.service.joinSession(this.code, String(formData.get("name") ?? "Player"));
      this.listenSession();
      this.listenPlayers();
      void this.listenCurrentPlayer();
      this.renderWaiting();
    });
  }

  private listenSession(): void {
    this.unsubscribe?.();
    this.unsubscribe = this.service.listenSession(this.code, (session) => {
      this.session = session;
      this.renderSession();
    });
  }

  private async listenCurrentPlayer(): Promise<void> {
    this.unsubscribePlayer?.();
    this.unsubscribePlayer = await this.service.listenCurrentPlayer(this.code, (player) => {
      this.player = player;

      if (this.session) {
        this.renderSession();
      }
    });
  }

  private listenPlayers(): void {
    this.unsubscribePlayers?.();
    this.unsubscribePlayers = this.service.listenPlayers(this.code, (players) => {
      this.players = players;

      if (this.session?.status === "revealed") {
        this.renderSession();
      }
    });
  }

  private renderSession(): void {
    if (!this.session) {
      this.clearTimer();
      this.root.innerHTML = `<section class="student-card"><h1>Session Not Found</h1><button id="try-again">Try Again</button></section>`;
      this.root.querySelector("#try-again")?.addEventListener("click", () => this.renderJoin());
      return;
    }

    if (this.session.status === "ended") {
      this.clearTimer();
      this.root.innerHTML = `
        <section class="student-card">
          <p class="student-eyebrow">${escapeHtml(this.code)}</p>
          <h1>Final Results</h1>
          <p>Thanks for playing, ${escapeHtml(this.player?.name ?? "player")}.</p>
          ${this.renderPlayerScore()}
          ${this.renderLeaderboard()}
        </section>
      `;
      return;
    }

    if (!this.session.activeQuestion || this.session.status === "lobby" || this.session.status === "presenting") {
      this.clearTimer();
      this.renderWaiting();
      return;
    }

    if (this.submittedQuestionId === this.session.currentQuestionId || this.session.status !== "question-open") {
      this.clearTimer();
      this.renderQuestionClosed();
      return;
    }

    this.renderQuestion(this.session.activeQuestion);
  }

  private renderWaiting(): void {
    const isPresenting = this.session?.status === "presenting";

    this.root.innerHTML = `
      <section class="student-card">
        <p class="student-eyebrow">${escapeHtml(this.code)}</p>
        <h1>${isPresenting ? "Session Started" : "You're In"}</h1>
        <p>${isPresenting ? "Follow along on the classroom screen." : "Waiting for the instructor."}</p>
      </section>
    `;
  }

  private renderQuestionClosed(): void {
    const isRevealed = this.session?.status === "revealed";
    const hasSubmitted = this.submittedQuestionId === this.session?.currentQuestionId;
    const revealedAnswer = this.session?.revealedAnswer;
    const heading = isRevealed ? "Answer Revealed" : hasSubmitted ? "Answer Submitted" : "Answer Locked";
    const statusText = isRevealed
      ? "Check the answer below."
      : hasSubmitted
        ? "Waiting for the class."
        : "Answering is closed.";

    this.root.innerHTML = `
      <section class="student-card">
        <p class="student-eyebrow">${escapeHtml(this.code)}</p>
        <h1>${heading}</h1>
        <p>${statusText}</p>
        ${this.renderPlayerScore()}
        ${
          isRevealed && revealedAnswer
            ? `
              <div class="student-revealed-answer">
                <span>Correct Answer</span>
                <strong>${escapeHtml(revealedAnswer.correctAnswer)}</strong>
                ${revealedAnswer.explanation ? `<p>${escapeHtml(revealedAnswer.explanation)}</p>` : ""}
              </div>
            `
            : ""
        }
        ${isRevealed ? this.renderLeaderboard() : ""}
      </section>
    `;
  }

  private renderQuestion(question: PublicQuestion): void {
    this.clearTimer();
    this.root.innerHTML = `
      <section class="student-card student-card--question">
        <p class="student-eyebrow">Question ${this.session?.currentQuestionIndex ?? ""}</p>
        <h1>${escapeHtml(question.question)}</h1>
        <div class="student-timer" aria-live="polite">
          <span>Time</span>
          <strong data-timer>--</strong>
        </div>
        ${this.renderPlayerScore()}
        <form id="answer-form" class="student-answer-form">
          ${renderQuestionInputs(question)}
          <button type="submit">Submit Answer</button>
        </form>
      </section>
    `;

    this.root.querySelector<HTMLFormElement>("#answer-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;

      if (!form.reportValidity()) {
        return;
      }

      await this.service.submitAnswer(this.code, {
        questionId: question.id,
        questionType: question.type,
        value: renderStudentAnswer(question, new FormData(form))
      });
      this.submittedQuestionId = question.id;
      this.clearTimer();
      this.renderQuestionClosed();
    });

    this.startTimer(question.timeLimit ?? 20);
  }

  private renderPlayerScore(): string {
    if (!this.player) {
      return "";
    }

    return `
      <div class="student-score-strip">
        <span>Score <strong>${this.player.score.toLocaleString()}</strong></span>
        <span>Streak <strong>${this.player.streak}</strong></span>
      </div>
    `;
  }

  private renderLeaderboard(): string {
    const rankedPlayers = createLeaderboardEntries(this.players);

    if (rankedPlayers.length === 0) {
      return "";
    }

    return `
      <div class="student-leaderboard">
        <span>Leaderboard</span>
        <ol>
          ${rankedPlayers
            .map(
              (player, index) => `
                <li class="${player.uid === this.player?.uid ? "is-current-player" : ""}">
                  <strong>${index + 1}. ${escapeHtml(player.name)}</strong>
                  <em>${player.score.toLocaleString()}</em>
                </li>
              `
            )
            .join("")}
        </ol>
      </div>
    `;
  }

  private startTimer(timeLimit: number): void {
    const timer = this.root.querySelector<HTMLElement>("[data-timer]");

    if (!timer || !this.session) {
      return;
    }

    const startedAt = readMillis(this.session.questionStartedAt) ?? Date.now();
    const tick = () => {
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      const remaining = Math.max(0, timeLimit - elapsedSeconds);
      timer.textContent = `${remaining}s`;

      if (remaining <= 0) {
        this.clearTimer();
      }
    };

    tick();
    this.timerId = window.setInterval(tick, 1000);
  }

  private clearTimer(): void {
    if (this.timerId !== undefined) {
      window.clearInterval(this.timerId);
      this.timerId = undefined;
    }
  }
}

function readMillis(value: unknown): number | null {
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (value && typeof value === "object" && "seconds" in value && typeof value.seconds === "number") {
    const nanoseconds = "nanoseconds" in value && typeof value.nanoseconds === "number" ? value.nanoseconds : 0;
    return value.seconds * 1000 + Math.floor(nanoseconds / 1_000_000);
  }

  return null;
}

function renderQuestionInputs(question: PublicQuestion): string {
  switch (question.type) {
    case "multiple-choice":
    case "code-question":
      return `
        ${question.type === "code-question" ? `<pre><code>${escapeHtml(question.code)}</code></pre>` : ""}
        ${question.answers
          .map(
            (answer, index) => `
              <label class="student-answer">
                <input type="radio" name="answer" value="${index}" required />
                <span>${String.fromCharCode(65 + index)}</span>
                <strong>${escapeHtml(answer)}</strong>
              </label>
            `
          )
          .join("")}
      `;
    case "true-false":
      return `
        <label class="student-answer"><input type="radio" name="answer" value="true" required /><span>T</span><strong>True</strong></label>
        <label class="student-answer"><input type="radio" name="answer" value="false" required /><span>F</span><strong>False</strong></label>
      `;
    case "fill-blank":
      return `<label class="student-fill"><span>Your answer</span><input name="answer" autocomplete="off" required /></label>`;
  }
}

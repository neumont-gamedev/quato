import type { Unsubscribe } from "firebase/firestore";
import { createLeaderboardEntries, createTeamLeaderboardEntries } from "../classroom/Leaderboard";
import {
  ClassroomSessionService,
  normalizeCharacterIndex,
  normalizeCode,
  renderStudentAnswer
} from "../classroom/ClassroomSessionService";
import { renderCharacterSprite, setCharacterSprite, wrapCharacterIndex } from "../classroom/CharacterSprites";
import { TEAM_OPTIONS, getAchievementById, getTeamById } from "../classroom/GameMeta";
import type { ClassroomAnswer, ClassroomPlayer, ClassroomSession } from "../classroom/types";
import type { PublicQuestion } from "../types/Question";
import { escapeHtml } from "../questions/QuestionRenderer";

export class StudentClient {
  private readonly service = new ClassroomSessionService();
  private code = "";
  private selectedCharacterIndex = 0;
  private player: ClassroomPlayer | null = null;
  private players: ClassroomPlayer[] = [];
  private session: ClassroomSession | null = null;
  private unsubscribe?: Unsubscribe;
  private unsubscribePlayer?: Unsubscribe;
  private unsubscribePlayers?: Unsubscribe;
  private timerId?: number;
  private characterRepeatTimerId?: number;
  private characterRepeatDelayTimerId?: number;
  private submittedQuestionId: string | null = null;
  private submittedAnswer: { questionId: string; value: ClassroomAnswer["value"] } | null = null;

  constructor(private readonly root: HTMLElement) {}

  mount(initialCode: string): void {
    this.root.className = "student-shell";
    this.code = normalizeCode(initialCode);
    this.renderJoin();
  }

  private renderJoin(): void {
    this.root.innerHTML = `
      <section class="student-card">
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
          <label>
            <span>Team</span>
            <select name="teamId" required>
              ${TEAM_OPTIONS.map((team) => `<option value="${team.id}">${escapeHtml(team.name)}</option>`).join("")}
            </select>
          </label>
          <div class="student-character-picker" aria-label="Choose your character">
            <button class="student-character-arrow" type="button" data-character-step="-1" aria-label="Previous character">
              <span aria-hidden="true">&lsaquo;</span>
            </button>
            <button class="student-character-select is-selected" type="button" aria-label="Select current character">
              ${renderCharacterSprite(this.selectedCharacterIndex, "student-character-preview")}
              <span>Selected</span>
            </button>
            <button class="student-character-arrow" type="button" data-character-step="1" aria-label="Next character">
              <span aria-hidden="true">&rsaquo;</span>
            </button>
          </div>
          <input type="hidden" name="characterIndex" value="${this.selectedCharacterIndex}" />
          <button type="submit">Join</button>
        </form>
      </section>
    `;

    this.bindCharacterPicker();

    this.root.querySelector<HTMLFormElement>("#student-join-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const formData = new FormData(form);
      this.code = normalizeCode(String(formData.get("code") ?? ""));
      const characterIndex = normalizeCharacterIndex(Number(formData.get("characterIndex")));
      this.player = await this.service.joinSession(
        this.code,
        String(formData.get("name") ?? "Player"),
        characterIndex,
        String(formData.get("teamId") ?? TEAM_OPTIONS[0].id)
      );
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

      if (this.session?.status === "revealed" || this.session?.status === "leaderboard") {
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
          ${this.renderAchievements()}
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

    if (this.session.status === "leaderboard") {
      this.clearTimer();
      this.renderLeaderboardScreen();
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
        ${isRevealed ? this.renderAnswerResult() : ""}
        ${isRevealed ? this.renderAchievements() : ""}
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

      const submittedValue = renderStudentAnswer(question, new FormData(form));
      await this.service.submitAnswer(this.code, {
        questionId: question.id,
        questionType: question.type,
        value: submittedValue
      });
      this.submittedQuestionId = question.id;
      this.submittedAnswer = {
        questionId: question.id,
        value: submittedValue
      };
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
        ${renderCharacterSprite(this.player.characterIndex, "student-score-character")}
        <span>Score <strong>${this.player.score.toLocaleString()}</strong></span>
        <span>Streak <strong>${this.player.streak}</strong></span>
        <span>Team <strong>${escapeHtml(getTeamById(this.player.teamId).name.replace(" Team", ""))}</strong></span>
      </div>
    `;
  }

  private renderLeaderboard(): string {
    const rankedPlayers = createLeaderboardEntries(this.players);
    const rankedTeams = createTeamLeaderboardEntries(this.players);

    if (rankedPlayers.length === 0 && rankedTeams.length === 0) {
      return "";
    }

    return `
      <div class="student-leaderboard">
        <span>Team Standings</span>
        <ol>
          ${rankedTeams
            .map(
              (team, index) => `
                <li class="${team.teamId === this.player?.teamId ? "is-current-player" : ""}">
                  <strong><span class="team-dot team-${team.teamId}" aria-hidden="true"></span>${index + 1}. ${escapeHtml(team.teamName)}</strong>
                  <em>${team.score.toLocaleString()}</em>
                </li>
              `
            )
            .join("")}
        </ol>
      </div>
      <div class="student-leaderboard">
        <span>Players</span>
        <ol>
          ${rankedPlayers
            .map(
              (player, index) => `
                <li class="${player.uid === this.player?.uid ? "is-current-player" : ""}">
                  <strong>${renderCharacterSprite(player.characterIndex, "student-leaderboard-character")}${index + 1}. ${escapeHtml(player.name)}</strong>
                  <em>${player.score.toLocaleString()}</em>
                </li>
              `
            )
            .join("")}
        </ol>
      </div>
    `;
  }

  private renderLeaderboardScreen(): void {
    this.root.innerHTML = `
      <section class="student-card">
        <p class="student-eyebrow">${escapeHtml(this.code)}</p>
        <h1>Leaderboard</h1>
        ${this.renderPlayerScore()}
        ${this.renderAchievements()}
        ${this.renderLeaderboard()}
      </section>
    `;
  }

  private renderAchievements(): string {
    const achievements = this.player?.achievements ?? [];

    if (achievements.length === 0) {
      return "";
    }

    return `
      <div class="student-achievements">
        <span>Achievements</span>
        <div>
          ${achievements
            .map((achievementId) => {
              const achievement = getAchievementById(achievementId);
              return `<strong title="${escapeHtml(achievement.description)}">${escapeHtml(achievement.name)}</strong>`;
            })
            .join("")}
        </div>
      </div>
    `;
  }

  private renderAnswerResult(): string {
    if (!this.session?.activeQuestion || !this.session.revealedAnswer) {
      return "";
    }

    if (this.submittedAnswer?.questionId !== this.session.currentQuestionId) {
      return `<div class="student-answer-result is-missed"><strong>No Answer</strong><span>Answer was not submitted before lock.</span></div>`;
    }

    const isCorrect = isSubmittedAnswerCorrect(
      this.session.activeQuestion,
      this.submittedAnswer.value,
      this.session.revealedAnswer.correctAnswer
    );

    return `
      <div class="student-answer-result ${isCorrect ? "is-correct" : "is-incorrect"}">
        <strong>${isCorrect ? "Correct" : "Not Quite"}</strong>
        <span>${isCorrect ? "Nice work." : "Check the correct answer below."}</span>
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

  private bindCharacterPicker(): void {
    const previewButton = this.root.querySelector<HTMLButtonElement>(".student-character-select");
    const hiddenInput = this.root.querySelector<HTMLInputElement>('input[name="characterIndex"]');
    const previewSprite = this.root.querySelector<HTMLElement>(".student-character-preview");

    const setCharacter = (nextIndex: number) => {
      this.selectedCharacterIndex = wrapCharacterIndex(nextIndex);
      if (hiddenInput) {
        hiddenInput.value = String(this.selectedCharacterIndex);
      }
      if (previewSprite) {
        setCharacterSprite(previewSprite, this.selectedCharacterIndex);
      }
      previewButton?.classList.add("is-selected");
    };

    const stopRepeating = () => {
      if (this.characterRepeatTimerId !== undefined) {
        window.clearInterval(this.characterRepeatTimerId);
        this.characterRepeatTimerId = undefined;
      }
      if (this.characterRepeatDelayTimerId !== undefined) {
        window.clearTimeout(this.characterRepeatDelayTimerId);
        this.characterRepeatDelayTimerId = undefined;
      }
    };

    this.root.querySelectorAll<HTMLButtonElement>("[data-character-step]").forEach((button) => {
      const step = Number(button.dataset.characterStep);
      const advance = () => setCharacter(this.selectedCharacterIndex + step);
      let skipNextClick = false;

      button.addEventListener("click", () => {
        if (skipNextClick) {
          skipNextClick = false;
          return;
        }
        advance();
      });
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        skipNextClick = true;
        button.setPointerCapture(event.pointerId);
        advance();
        stopRepeating();
        this.characterRepeatDelayTimerId = window.setTimeout(() => {
          this.characterRepeatTimerId = window.setInterval(advance, 70);
        }, 260);
      });
      button.addEventListener("pointerup", stopRepeating);
      button.addEventListener("pointercancel", stopRepeating);
      button.addEventListener("lostpointercapture", stopRepeating);
      button.addEventListener("mouseleave", stopRepeating);
    });

    previewButton?.addEventListener("click", () => {
      previewButton.classList.add("is-selected");
      previewButton.animate(
        [
          { transform: "scale(1)" },
          { transform: "scale(1.05)" },
          { transform: "scale(1)" }
        ],
        { duration: 180, easing: "ease-out" }
      );
    });
  }
}

function isSubmittedAnswerCorrect(question: PublicQuestion, value: ClassroomAnswer["value"], correctAnswer: string): boolean {
  switch (question.type) {
    case "multiple-choice":
    case "code-question":
      return question.answers[Number(value)] === correctAnswer;
    case "true-false":
      return (value === true ? "True" : "False") === correctAnswer;
    case "fill-blank":
      return correctAnswer
        .split(" / ")
        .some((answer) => answer.trim().toLowerCase() === String(value).trim().toLowerCase());
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

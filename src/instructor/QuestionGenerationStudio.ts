import { FirebaseAiQuestionProvider } from "../ai/FirebaseAiQuestionProvider";
import { LocalMockQuestionProvider } from "../ai/LocalMockQuestionProvider";
import type { AiQuestionProvider, QuestionGenerationRequest } from "../ai/types";
import { ACHIEVEMENTS } from "../classroom/GameMeta";
import { QuizLoader } from "../quiz/QuizLoader";
import type { QuestionType, QuizFile, QuizQuestion } from "../types/Question";
import { QuizBankService, type SavedQuizBankEntry } from "./QuizBankService";

const DRAFT_STORAGE_KEY = "revealquiz.generatedDraft";
const SAVED_DRAFTS_STORAGE_KEY = "revealquiz.savedDrafts";
const QUESTION_TYPES: QuestionType[] = ["multiple-choice", "true-false", "fill-blank", "code-question"];

export class QuestionGenerationStudio {
  private readonly validator = new QuizLoader();
  private readonly quizBank = new QuizBankService();
  private jsonEditor?: HTMLTextAreaElement;
  private validationPanel?: HTMLElement;
  private qualityPanel?: HTMLElement;
  private promptPanel?: HTMLTextAreaElement;
  private questionReviewPanel?: HTMLElement;
  private selectedQuestionId?: string;

  constructor(private readonly root: HTMLElement) {}

  mount(): void {
    this.root.className = "generator-shell";
    this.root.innerHTML = `
      <section class="generator-panel generator-panel--form">
        <div>
          <p class="generator-eyebrow">Phase 3</p>
          <h1>AI Question Drafts</h1>
          <p class="generator-copy">Create schema-compatible draft questions, review them, edit the JSON, then export or preview.</p>
        </div>

        <form id="generation-form" class="generation-form">
          <label class="generation-form__wide">
            <span>Provider</span>
            <select name="provider">
              <option value="firebase">Firebase AI Logic</option>
              <option value="local">Local Draft Generator</option>
            </select>
          </label>

          <label>
            <span>Topic</span>
            <input name="topic" value="C++ Smart Pointers" required />
          </label>

          <label>
            <span>Level</span>
            <select name="level">
              <option value="introductory">Introductory</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>

          <label class="generation-form__wide">
            <span>Instructor Notes</span>
            <textarea name="notes" rows="7">Focus on ownership, shared ownership, weak references, and make_unique.</textarea>
          </label>

          <label class="generation-form__wide">
            <span>Generate From Markdown, Notes, or JSON</span>
            <input name="sourceFile" type="file" accept=".txt,.md,.markdown,.json" />
          </label>

          <div class="generation-counts generation-form__wide">
            <label><span>Multiple Choice</span><input name="multiple-choice" type="number" min="0" max="20" value="3" /></label>
            <label><span>True/False</span><input name="true-false" type="number" min="0" max="20" value="2" /></label>
            <label><span>Fill Blank</span><input name="fill-blank" type="number" min="0" max="20" value="1" /></label>
            <label><span>Code</span><input name="code-question" type="number" min="0" max="20" value="1" /></label>
          </div>

          <div class="generation-options generation-form__wide">
            <label><span>Default Points</span><input name="defaultPoints" type="number" min="1" max="1000" value="100" /></label>
            <label class="generation-checkbox"><input name="includeExplanations" type="checkbox" checked /> Include explanations</label>
          </div>

          <fieldset class="generation-game generation-form__wide">
            <legend>Game Settings</legend>
            <label class="generation-checkbox"><input name="teamMode" type="checkbox" checked /> Team quiz</label>
            <label class="generation-checkbox"><input name="achievementsEnabled" type="checkbox" checked /> Achievements</label>
            <label><span>Boss Multiplier</span><input name="bossMultiplier" type="number" min="1" max="10" value="2" /></label>
            <div class="generation-achievements">
              ${ACHIEVEMENTS.map(
                (achievement) => `
                  <label class="generation-checkbox">
                    <input name="enabledAchievements" type="checkbox" value="${escapeHtml(achievement.id)}" checked />
                    ${escapeHtml(achievement.name)}
                  </label>
                `
              ).join("")}
            </div>
          </fieldset>

          <div class="generation-actions generation-form__wide">
            <button type="submit">Generate Draft</button>
            <a href="/">Back to Deck</a>
          </div>
        </form>
      </section>

      <section class="generator-panel generator-panel--review">
        <div class="review-header">
          <div>
            <p class="generator-eyebrow">Instructor Review Required</p>
            <h2>Draft Quiz JSON</h2>
          </div>
          <div class="review-actions">
            <button id="validate-draft" type="button">Validate</button>
            <button id="preview-draft" type="button">Preview Deck</button>
            <button id="save-draft" type="button">Save to Quiz Bank</button>
            <button id="download-draft" type="button">Download JSON</button>
          </div>
        </div>

        <div id="validation-panel" class="validation-panel is-empty">No draft generated yet.</div>
        <div id="quality-panel" class="quality-panel is-empty">Quality checks will appear after validation.</div>
        <div id="question-review-panel" class="question-review-panel is-empty">Generate or paste a valid draft to review questions here.</div>

        <details class="json-details" open>
          <summary>Draft JSON</summary>
          <textarea id="json-editor" class="json-editor" spellcheck="false"></textarea>
        </details>

        <details class="prompt-details">
          <summary>Provider Prompt</summary>
          <textarea id="prompt-panel" readonly></textarea>
        </details>
      </section>
    `;

    this.jsonEditor = this.root.querySelector("#json-editor") ?? undefined;
    this.validationPanel = this.root.querySelector("#validation-panel") ?? undefined;
    this.qualityPanel = this.root.querySelector("#quality-panel") ?? undefined;
    this.promptPanel = this.root.querySelector("#prompt-panel") ?? undefined;
    this.questionReviewPanel = this.root.querySelector("#question-review-panel") ?? undefined;

    this.bindEvents();
    void this.renderSavedDraftActions();
  }

  private bindEvents(): void {
    const form = this.root.querySelector<HTMLFormElement>("#generation-form");
    const validateButton = this.root.querySelector<HTMLButtonElement>("#validate-draft");
    const previewButton = this.root.querySelector<HTMLButtonElement>("#preview-draft");
    const downloadButton = this.root.querySelector<HTMLButtonElement>("#download-draft");
    const saveButton = this.root.querySelector<HTMLButtonElement>("#save-draft");
    const sourceFileInput = this.root.querySelector<HTMLInputElement>('input[name="sourceFile"]');
    const notesInput = this.root.querySelector<HTMLTextAreaElement>('textarea[name="notes"]');

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
      const request = this.readRequest(new FormData(form));
      const provider = this.createProvider(new FormData(form));

      try {
        submitButton?.setAttribute("disabled", "true");
        if (submitButton) {
          submitButton.textContent = "Generating...";
        }
        this.renderGenerationStatus(`Generating with ${provider.name}...`);
        const result = await provider.generateQuestions(request);
        this.setDraft(result.quiz);

        if (this.promptPanel) {
          this.promptPanel.value = result.prompt;
        }

        this.renderGenerationStatus(`Generated with ${result.providerName}. Review before using live.`, true);
      } catch (error) {
        this.renderValidationErrors([error instanceof Error ? error.message : String(error)]);
      } finally {
        submitButton?.removeAttribute("disabled");
        if (submitButton) {
          submitButton.textContent = "Generate Draft";
        }
      }
    });

    sourceFileInput?.addEventListener("change", async () => {
      const file = sourceFileInput.files?.[0];

      if (!file || !notesInput) {
        return;
      }

      notesInput.value = await file.text();
      this.renderGenerationStatus(`Imported ${file.name}. AI generation will use that content as source material.`);
    });

    this.jsonEditor?.addEventListener("input", () => {
      const draft = this.readDraftFromEditor(false);

      if (draft) {
        this.renderQuestionReview(draft);
      }
    });

    this.questionReviewPanel?.addEventListener("click", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-review-action]");

      if (!target) {
        return;
      }

      const action = target.dataset.reviewAction ?? "";
      const questionId = target.dataset.questionId ?? this.selectedQuestionId ?? "";

      if (action === "regenerate") {
        if (form) {
          void this.regenerateQuestion(questionId, new FormData(form));
        }
        return;
      }

      if (action === "revise") {
        if (form) {
          const instructions =
            this.questionReviewPanel?.querySelector<HTMLTextAreaElement>("[data-revision-instructions]")?.value ?? "";
          void this.regenerateQuestion(questionId, new FormData(form), instructions);
        }
        return;
      }

      this.applyQuestionAction(action, questionId);
    });

    validateButton?.addEventListener("click", () => {
      this.validateCurrentDraft();
    });

    previewButton?.addEventListener("click", () => {
      const draft = this.validateCurrentDraft();

      if (draft) {
        sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
        window.location.href = "/?mode=preview-generated&theme=signal";
      }
    });

    downloadButton?.addEventListener("click", () => {
      const draft = this.validateCurrentDraft();

      if (draft) {
        this.downloadDraft(draft);
      }
    });

    saveButton?.addEventListener("click", () => {
      const draft = this.validateCurrentDraft();

      if (draft) {
        void this.saveDraft(draft);
      }
    });
  }

  private readRequest(formData: FormData): QuestionGenerationRequest {
    const counts = QUESTION_TYPES.reduce(
      (memo, type) => {
        memo[type] = Math.max(0, Number(formData.get(type)) || 0);
        return memo;
      },
      {} as Record<QuestionType, number>
    );

    return {
      topic: String(formData.get("topic") ?? "Untitled Topic").trim(),
      level: readLevel(formData.get("level")),
      notes: String(formData.get("notes") ?? ""),
      counts,
      includeExplanations: formData.has("includeExplanations"),
      defaultPoints: Math.max(1, Number(formData.get("defaultPoints")) || 100),
      teamMode: formData.has("teamMode"),
      achievementsEnabled: formData.has("achievementsEnabled"),
      enabledAchievements: formData.getAll("enabledAchievements").map(String),
      bossMultiplier: Math.max(1, Math.min(10, Number(formData.get("bossMultiplier")) || 2))
    };
  }

  private createProvider(formData: FormData): AiQuestionProvider {
    return formData.get("provider") === "local" ? new LocalMockQuestionProvider() : new FirebaseAiQuestionProvider();
  }

  private setDraft(quiz: QuizFile): void {
    if (!this.jsonEditor) {
      return;
    }

    this.jsonEditor.value = `${JSON.stringify(quiz, null, 2)}\n`;
    this.selectedQuestionId = quiz.questions[0]?.id;
    this.renderQuestionReview(quiz);
    this.validateCurrentDraft();
  }

  private validateCurrentDraft(): QuizFile | undefined {
    if (!this.jsonEditor || !this.validationPanel) {
      return undefined;
    }

    return this.readDraftFromEditor(true);
  }

  private readDraftFromEditor(renderErrors: boolean): QuizFile | undefined {
    if (!this.jsonEditor || !this.validationPanel) {
      return undefined;
    }

    try {
      const validation = this.validator.validate(JSON.parse(this.jsonEditor.value) as unknown);

      if (!validation.data) {
        if (renderErrors) {
          this.renderValidationErrors(validation.errors);
        }
        return undefined;
      }

      this.selectedQuestionId =
        validation.data.questions.some((question) => question.id === this.selectedQuestionId)
          ? this.selectedQuestionId
          : validation.data.questions[0]?.id;
      this.renderQuestionReview(validation.data);
      this.validationPanel.className = "validation-panel is-valid";
      this.validationPanel.textContent = `${validation.data.questions.length} draft questions are valid. Review before using live.`;
      this.renderQualityReport(validation.data);
      return validation.data;
    } catch (error) {
      if (renderErrors) {
        this.renderValidationErrors([error instanceof Error ? error.message : String(error)]);
      }
      return undefined;
    }
  }

  private renderValidationErrors(errors: string[]): void {
    if (!this.validationPanel) {
      return;
    }

    this.validationPanel.className = "validation-panel is-invalid";
    this.validationPanel.innerHTML = `<strong>Validation failed</strong><ul>${errors
      .map((error) => `<li>${escapeHtml(error)}</li>`)
      .join("")}</ul>`;
    this.renderQualityReport();
  }

  private renderGenerationStatus(message: string, isValid = false): void {
    if (!this.validationPanel) {
      return;
    }

    this.validationPanel.className = `validation-panel ${isValid ? "is-valid" : "is-empty"}`;
    this.validationPanel.textContent = message;
  }

  private renderQualityReport(quiz?: QuizFile): void {
    if (!this.qualityPanel) {
      return;
    }

    if (!quiz) {
      this.qualityPanel.className = "quality-panel is-empty";
      this.qualityPanel.textContent = "Quality checks will appear after validation.";
      return;
    }

    const warnings = createQualityWarnings(quiz);

    if (warnings.length === 0) {
      this.qualityPanel.className = "quality-panel is-valid";
      this.qualityPanel.textContent = "Quality checks passed: explanations, timing, answer variety, and draft balance look ready for review.";
      return;
    }

    this.qualityPanel.className = "quality-panel is-warning";
    this.qualityPanel.innerHTML = `<strong>Quality checks</strong><ul>${warnings
      .map((warning) => `<li>${escapeHtml(warning)}</li>`)
      .join("")}</ul>`;
  }

  private renderQuestionReview(quiz: QuizFile): void {
    if (!this.questionReviewPanel) {
      return;
    }

    if (quiz.questions.length === 0) {
      this.questionReviewPanel.className = "question-review-panel is-empty";
      this.questionReviewPanel.textContent = "This draft has no questions yet.";
      return;
    }

    const selectedQuestion = quiz.questions.find((question) => question.id === this.selectedQuestionId) ?? quiz.questions[0];
    this.selectedQuestionId = selectedQuestion.id;
    this.questionReviewPanel.className = "question-review-panel";
    this.questionReviewPanel.innerHTML = `
      <div class="question-review-list">
        ${quiz.questions.map((question, index) => this.renderQuestionListItem(question, index)).join("")}
      </div>
      <article class="question-review-detail">
        <div>
          <p class="generator-eyebrow">${escapeHtml(selectedQuestion.type)} ${isBossQuestion(selectedQuestion) ? " - Boss" : ""}</p>
          <h3>${escapeHtml(selectedQuestion.question)}</h3>
        </div>
        <dl>
          <div><dt>Points</dt><dd>${selectedQuestion.points ?? 100}</dd></div>
          <div><dt>Time</dt><dd>${selectedQuestion.timeLimit ?? 20}s</dd></div>
          <div><dt>ID</dt><dd>${escapeHtml(selectedQuestion.id)}</dd></div>
        </dl>
        ${this.renderQuestionAnswers(selectedQuestion)}
        ${
          selectedQuestion.explanation
            ? `<p class="question-review-explanation">${escapeHtml(selectedQuestion.explanation)}</p>`
            : `<p class="question-review-explanation is-missing">No explanation yet.</p>`
        }
        <div class="question-review-actions">
          <button type="button" data-review-action="regenerate" data-question-id="${escapeHtml(selectedQuestion.id)}">Regenerate This</button>
          <button type="button" data-review-action="easier" data-question-id="${escapeHtml(selectedQuestion.id)}">Make Easier</button>
          <button type="button" data-review-action="harder" data-question-id="${escapeHtml(selectedQuestion.id)}">Make Harder</button>
          <button type="button" data-review-action="explain" data-question-id="${escapeHtml(selectedQuestion.id)}">Add Explanation</button>
          <button type="button" data-review-action="boss" data-question-id="${escapeHtml(selectedQuestion.id)}">${isBossQuestion(selectedQuestion) ? "Remove Boss" : "Mark Boss"}</button>
          <button type="button" data-review-action="duplicate" data-question-id="${escapeHtml(selectedQuestion.id)}">Duplicate</button>
          <button type="button" data-review-action="remove" data-question-id="${escapeHtml(selectedQuestion.id)}">Remove</button>
        </div>
        <div class="question-revision-box">
          <label>
            <span>Revision Instructions</span>
            <textarea data-revision-instructions rows="3" placeholder="Example: make this focus on constructor syntax and include one tricky distractor."></textarea>
          </label>
          <button type="button" data-review-action="revise" data-question-id="${escapeHtml(selectedQuestion.id)}">Revise With AI</button>
        </div>
      </article>
    `;
  }

  private renderQuestionListItem(question: QuizQuestion, index: number): string {
    const isSelected = question.id === this.selectedQuestionId;

    return `
      <button type="button" class="${isSelected ? "is-selected" : ""}" data-review-action="select" data-question-id="${escapeHtml(question.id)}">
        <strong>${index + 1}. ${escapeHtml(question.question)}</strong>
        <span>${escapeHtml(question.type)}${isBossQuestion(question) ? " - Boss" : ""}</span>
      </button>
    `;
  }

  private renderQuestionAnswers(question: QuizQuestion): string {
    switch (question.type) {
      case "multiple-choice":
      case "code-question":
        return `
          ${question.type === "code-question" ? `<pre><code>${escapeHtml(question.code)}</code></pre>` : ""}
          <ol class="question-review-answers">
            ${question.answers
              .map(
                (answer, index) => `
                  <li class="${index === question.correct ? "is-correct" : ""}">
                    <span>${String.fromCharCode(65 + index)}</span>
                    <strong>${escapeHtml(answer)}</strong>
                  </li>
                `
              )
              .join("")}
          </ol>
        `;
      case "true-false":
        return `<p class="question-review-answer">Correct answer: <strong>${question.answer ? "True" : "False"}</strong></p>`;
      case "fill-blank":
        return `<p class="question-review-answer">Accepted: <strong>${question.answers.map(escapeHtml).join(" / ")}</strong></p>`;
    }
  }

  private applyQuestionAction(action: string, questionId: string): void {
    const draft = this.validateCurrentDraft();

    if (!draft) {
      return;
    }

    const index = draft.questions.findIndex((question) => question.id === questionId);

    if (index < 0) {
      return;
    }

    if (action === "select") {
      this.selectedQuestionId = questionId;
      this.renderQuestionReview(draft);
      return;
    }

    const nextQuestions = [...draft.questions];
    const question = nextQuestions[index];

    switch (action) {
      case "remove":
        nextQuestions.splice(index, 1);
        this.selectedQuestionId = nextQuestions[Math.min(index, nextQuestions.length - 1)]?.id;
        break;
      case "duplicate": {
        const copy = { ...question, id: createUniqueQuestionId(draft, `${question.id}-copy`) } as QuizQuestion;
        nextQuestions.splice(index + 1, 0, copy);
        this.selectedQuestionId = copy.id;
        break;
      }
      case "easier":
        nextQuestions[index] = {
          ...question,
          points: Math.max(50, Math.round((question.points ?? 100) * 0.75)),
          timeLimit: Math.min(120, (question.timeLimit ?? 20) + 10)
        };
        break;
      case "harder":
        nextQuestions[index] = {
          ...question,
          points: Math.min(1000, Math.round((question.points ?? 100) * 1.25)),
          timeLimit: Math.max(5, (question.timeLimit ?? 20) - 5)
        };
        break;
      case "explain":
        nextQuestions[index] = {
          ...question,
          explanation: question.explanation ?? createExplanationPlaceholder(question)
        };
        break;
      case "boss":
        nextQuestions[index] = toggleBossTag(question);
        break;
    }

    this.setDraft({ ...draft, questions: nextQuestions });
  }

  private async regenerateQuestion(questionId: string, formData: FormData, instructions = ""): Promise<void> {
    const draft = this.validateCurrentDraft();

    if (!draft) {
      return;
    }

    const index = draft.questions.findIndex((question) => question.id === questionId);
    const current = draft.questions[index];

    if (!current) {
      return;
    }

    const request = this.readRequest(formData);
    const provider = this.createProvider(formData);
    const counts = QUESTION_TYPES.reduce(
      (memo, type) => {
        memo[type] = type === current.type ? 1 : 0;
        return memo;
      },
      {} as Record<QuestionType, number>
    );

    try {
      this.renderGenerationStatus(`Regenerating question with ${provider.name}...`);
      const result = await provider.generateQuestions({
        ...request,
        counts,
        notes: [
          request.notes,
          "",
          "Regenerate this question as a stronger replacement:",
          JSON.stringify(current, null, 2),
          instructions.trim() ? `\nInstructor revision instructions:\n${instructions.trim()}` : ""
        ].join("\n")
      });
      const replacement = result.quiz.questions[0];

      if (!replacement) {
        this.renderValidationErrors(["The provider did not return a replacement question."]);
        return;
      }

      const nextQuestions = [...draft.questions];
      nextQuestions[index] = { ...replacement, id: current.id };
      this.setDraft({ ...draft, questions: nextQuestions });

      if (this.promptPanel) {
        this.promptPanel.value = result.prompt;
      }

      this.renderGenerationStatus(`Regenerated "${current.id}" with ${result.providerName}.`, true);
    } catch (error) {
      this.renderValidationErrors([error instanceof Error ? error.message : String(error)]);
    }
  }

  private downloadDraft(quiz: QuizFile): void {
    const blob = new Blob([`${JSON.stringify(quiz, null, 2)}\n`], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${slugify(quiz.title)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  private async saveDraft(quiz: QuizFile): Promise<void> {
    const savedDrafts = readSavedDrafts();
    const key = slugify(quiz.title);
    savedDrafts[key] = {
      title: quiz.title,
      savedAt: new Date().toISOString(),
      quiz
    };
    localStorage.setItem(SAVED_DRAFTS_STORAGE_KEY, JSON.stringify(savedDrafts));

    try {
      await this.quizBank.saveQuiz(quiz);
      await this.renderSavedDraftActions();
      this.renderGenerationStatus(`Saved "${quiz.title}" to Firebase and the browser quiz bank.`, true);
    } catch (error) {
      await this.renderSavedDraftActions();
      const message = error instanceof Error ? error.message : String(error);
      this.renderGenerationStatus(`Saved "${quiz.title}" to the browser quiz bank. Firebase save failed: ${message}`, true);
    }
  }

  private async renderSavedDraftActions(): Promise<void> {
    const form = this.root.querySelector<HTMLFormElement>("#generation-form");

    if (!form) {
      return;
    }

    form.querySelector(".saved-drafts")?.remove();
    const localEntries = Object.entries(readSavedDrafts()).map(
      ([key, value]): SavedDraftOption => ({
        key: `local:${key}`,
        title: value.title,
        savedAt: value.savedAt,
        quiz: value.quiz,
        source: "Browser"
      })
    );
    let firebaseEntries: SavedDraftOption[] = [];

    try {
      firebaseEntries = (await this.quizBank.listQuizzes()).map(
        (entry): SavedDraftOption => ({
          key: `firebase:${entry.id}`,
          title: entry.title,
          savedAt: readSavedAt(entry),
          quiz: entry.quiz,
          source: "Firebase"
        })
      );
    } catch {
      firebaseEntries = [];
    }

    const entries = [...firebaseEntries, ...localEntries];

    if (entries.length === 0) {
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "saved-drafts generation-form__wide";
    wrapper.innerHTML = `
      <label>
        <span>Quiz Bank</span>
        <select name="savedDraft">
          ${entries
            .map(
              (entry) =>
                `<option value="${escapeHtml(entry.key)}">${escapeHtml(entry.title)} - ${entry.source} - ${new Date(entry.savedAt).toLocaleDateString()}</option>`
            )
            .join("")}
        </select>
      </label>
      <button type="button">Load Quiz</button>
    `;
    wrapper.querySelector("button")?.addEventListener("click", () => {
      const key = wrapper.querySelector<HTMLSelectElement>('select[name="savedDraft"]')?.value ?? "";
      const saved = entries.find((entry) => entry.key === key);

      if (saved) {
        this.setDraft(saved.quiz);
        this.renderGenerationStatus(`Loaded saved draft "${saved.title}".`, true);
      }
    });
    form.querySelector(".generation-actions")?.before(wrapper);
  }
}

interface SavedDraftRecord {
  title: string;
  savedAt: string;
  quiz: QuizFile;
}

interface SavedDraftOption extends SavedDraftRecord {
  key: string;
  source: "Browser" | "Firebase";
}

export function readGeneratedDraft(): QuizFile | undefined {
  const draft = sessionStorage.getItem(DRAFT_STORAGE_KEY);

  if (!draft) {
    return undefined;
  }

  try {
    const validator = new QuizLoader();
    return validator.validate(JSON.parse(draft) as unknown).data;
  } catch {
    return undefined;
  }
}

export function createGeneratedPresentation(quiz: QuizFile): string {
  const questionSlides = quiz.questions.map((question) => `@question ${question.id}`).join("\n\n---\n\n");

  return [`# ${quiz.title}`, quiz.description ?? "Generated draft quiz preview.", "---", questionSlides, "---", "@results"].join(
    "\n\n"
  );
}

function readLevel(value: FormDataEntryValue | null): QuestionGenerationRequest["level"] {
  return value === "intermediate" || value === "advanced" ? value : "introductory";
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "revealquiz-draft";
}

function readSavedDrafts(): Record<string, SavedDraftRecord> {
  try {
    const value = localStorage.getItem(SAVED_DRAFTS_STORAGE_KEY);
    return value ? (JSON.parse(value) as Record<string, SavedDraftRecord>) : {};
  } catch {
    return {};
  }
}

function readSavedAt(entry: SavedQuizBankEntry): string {
  const value = entry.savedAt;

  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (value && typeof value === "object" && "seconds" in value && typeof value.seconds === "number") {
    const milliseconds = value.seconds * 1000;
    return new Date(milliseconds).toISOString();
  }

  return new Date().toISOString();
}

function createQualityWarnings(quiz: QuizFile): string[] {
  const warnings: string[] = [];
  const seenQuestions = new Map<string, string>();
  const typeCounts = new Map<QuestionType, number>();
  let missingExplanationCount = 0;
  let untimedCount = 0;
  let trueFalseCount = 0;
  let duplicateAnswerCount = 0;
  let weakCodeQuestionCount = 0;

  for (const question of quiz.questions) {
    const normalizedQuestion = question.question.trim().toLowerCase().replace(/\s+/g, " ");
    const previousId = seenQuestions.get(normalizedQuestion);

    if (previousId) {
      warnings.push(`"${question.id}" duplicates the wording of "${previousId}".`);
    } else {
      seenQuestions.set(normalizedQuestion, question.id);
    }

    if (question.question.trim().length < 12) {
      warnings.push(`"${question.id}" has very short question text.`);
    }

    if (!question.explanation?.trim()) {
      missingExplanationCount += 1;
    }

    if (!question.timeLimit) {
      untimedCount += 1;
    }

    typeCounts.set(question.type, (typeCounts.get(question.type) ?? 0) + 1);

    if (question.type === "true-false") {
      trueFalseCount += 1;
    }

    if (question.type === "multiple-choice" || question.type === "code-question") {
      const normalizedAnswers = question.answers.map((answer) => answer.trim().toLowerCase());
      const uniqueAnswers = new Set(normalizedAnswers);

      if (uniqueAnswers.size !== normalizedAnswers.length) {
        duplicateAnswerCount += 1;
      }
    }

    if (question.type === "code-question" && question.code.trim().length < 20) {
      weakCodeQuestionCount += 1;
    }
  }

  if (missingExplanationCount > 0) {
    warnings.push(`${missingExplanationCount} question${missingExplanationCount === 1 ? "" : "s"} need explanations before class.`);
  }

  if (untimedCount > 0) {
    warnings.push(`${untimedCount} question${untimedCount === 1 ? "" : "s"} use the default timer instead of an explicit time limit.`);
  }

  if (trueFalseCount > Math.ceil(quiz.questions.length / 2)) {
    warnings.push("More than half of the draft is true/false; consider adding more applied question types.");
  }

  if (duplicateAnswerCount > 0) {
    warnings.push(`${duplicateAnswerCount} question${duplicateAnswerCount === 1 ? " has" : "s have"} duplicate answer choices.`);
  }

  if (weakCodeQuestionCount > 0) {
    warnings.push(`${weakCodeQuestionCount} code question${weakCodeQuestionCount === 1 ? " has" : "s have"} very short code snippets.`);
  }

  if ((typeCounts.get("multiple-choice") ?? 0) === quiz.questions.length && quiz.questions.length > 4) {
    warnings.push("All questions are multiple choice; consider adding a mix of true/false, fill blank, or code questions.");
  }

  return warnings;
}

function createUniqueQuestionId(quiz: QuizFile, baseId: string): string {
  const existingIds = new Set(quiz.questions.map((question) => question.id));
  const safeBase = baseId.replace(/[^A-Za-z0-9_-]/g, "-") || "question";
  let candidate = safeBase;
  let suffix = 2;

  while (existingIds.has(candidate)) {
    candidate = `${safeBase}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function isBossQuestion(question: QuizQuestion): boolean {
  return question.tags?.includes("boss") ?? false;
}

function toggleBossTag(question: QuizQuestion): QuizQuestion {
  const tags = new Set(question.tags ?? []);

  if (tags.has("boss")) {
    tags.delete("boss");
  } else {
    tags.add("boss");
  }

  return {
    ...question,
    tags: tags.size > 0 ? [...tags] : undefined
  };
}

function createExplanationPlaceholder(question: QuizQuestion): string {
  switch (question.type) {
    case "multiple-choice":
    case "code-question":
      return `The correct answer is "${question.answers[question.correct]}" because it best matches the concept being tested.`;
    case "true-false":
      return `The statement is ${question.answer ? "true" : "false"} based on the concept being tested.`;
    case "fill-blank":
      return `Accepted answers include ${question.answers.join(" / ")}.`;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

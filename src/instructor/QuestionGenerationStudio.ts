import { LocalMockQuestionProvider } from "../ai/LocalMockQuestionProvider";
import type { QuestionGenerationRequest } from "../ai/types";
import { QuizLoader } from "../quiz/QuizLoader";
import type { QuestionType, QuizFile } from "../types/Question";

const DRAFT_STORAGE_KEY = "revealquiz.generatedDraft";
const QUESTION_TYPES: QuestionType[] = ["multiple-choice", "true-false", "fill-blank", "code-question"];

export class QuestionGenerationStudio {
  private readonly provider = new LocalMockQuestionProvider();
  private readonly validator = new QuizLoader();
  private jsonEditor?: HTMLTextAreaElement;
  private validationPanel?: HTMLElement;
  private promptPanel?: HTMLTextAreaElement;

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
            <button id="download-draft" type="button">Download JSON</button>
          </div>
        </div>

        <div id="validation-panel" class="validation-panel is-empty">No draft generated yet.</div>
        <textarea id="json-editor" class="json-editor" spellcheck="false"></textarea>

        <details class="prompt-details">
          <summary>Provider Prompt</summary>
          <textarea id="prompt-panel" readonly></textarea>
        </details>
      </section>
    `;

    this.jsonEditor = this.root.querySelector("#json-editor") ?? undefined;
    this.validationPanel = this.root.querySelector("#validation-panel") ?? undefined;
    this.promptPanel = this.root.querySelector("#prompt-panel") ?? undefined;

    this.bindEvents();
  }

  private bindEvents(): void {
    const form = this.root.querySelector<HTMLFormElement>("#generation-form");
    const validateButton = this.root.querySelector<HTMLButtonElement>("#validate-draft");
    const previewButton = this.root.querySelector<HTMLButtonElement>("#preview-draft");
    const downloadButton = this.root.querySelector<HTMLButtonElement>("#download-draft");

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const request = this.readRequest(new FormData(form));
      const result = await this.provider.generateQuestions(request);
      this.setDraft(result.quiz);

      if (this.promptPanel) {
        this.promptPanel.value = result.prompt;
      }
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
      defaultPoints: Math.max(1, Number(formData.get("defaultPoints")) || 100)
    };
  }

  private setDraft(quiz: QuizFile): void {
    if (!this.jsonEditor) {
      return;
    }

    this.jsonEditor.value = `${JSON.stringify(quiz, null, 2)}\n`;
    this.validateCurrentDraft();
  }

  private validateCurrentDraft(): QuizFile | undefined {
    if (!this.jsonEditor || !this.validationPanel) {
      return undefined;
    }

    try {
      const rawDraft = JSON.parse(this.jsonEditor.value) as unknown;
      const validation = this.validator.validate(rawDraft);

      if (!validation.data) {
        this.renderValidationErrors(validation.errors);
        return undefined;
      }

      this.validationPanel.className = "validation-panel is-valid";
      this.validationPanel.textContent = `${validation.data.questions.length} draft questions are valid. Review before using live.`;
      return validation.data;
    } catch (error) {
      this.renderValidationErrors([error instanceof Error ? error.message : String(error)]);
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
  }

  private downloadDraft(quiz: QuizFile): void {
    const blob = new Blob([`${JSON.stringify(quiz, null, 2)}\n`], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${slugify(quiz.title)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

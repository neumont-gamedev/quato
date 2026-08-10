import { escapeHtml } from "../questions/QuestionRenderer";
import { readBrowserQuizBankEntries, writeQuizBankHandoff } from "./QuizBankHandoff";
import { QuizBankService, type SavedQuizBankEntry } from "./QuizBankService";

interface SetupOption {
  value: string;
  label: string;
  source?: "built-in" | "quiz-bank";
}

const ACTIVITY_OPTIONS: SetupOption[] = [
  { value: "example", label: "Smart Pointers", source: "built-in" },
  { value: "cpp-random", label: "C++ Random Numbers", source: "built-in" }
];

const THEME_OPTIONS: SetupOption[] = [
  { value: "signal", label: "Signal" },
  { value: "midnight", label: "Midnight" }
];

export class InstructorSetup {
  private readonly quizBank = new QuizBankService();
  private savedQuizzes: SavedQuizBankEntry[] = [];

  constructor(private readonly root: HTMLElement) {}

  mount(): void {
    this.root.className = "instructor-setup-shell";
    this.root.innerHTML = `
      <section class="instructor-setup-card" aria-labelledby="instructor-setup-title">
        <h1 id="instructor-setup-title">Instructor Setup</h1>
        <p class="instructor-setup-copy">Choose the classroom activity. The matching presentation, quiz questions, and game settings load together.</p>
        <form class="instructor-setup-form" id="instructor-setup-form">
          <label>
            <span>Activity</span>
            <select name="activity">
              ${this.renderActivityOptions("cpp-random")}
            </select>
          </label>
          <label>
            <span>Theme</span>
            <select name="theme">
              ${this.renderOptions(THEME_OPTIONS, "signal")}
            </select>
          </label>
          <button type="submit">Open Instructor Deck</button>
        </form>
        <p class="instructor-setup-status" id="quiz-bank-status">Loading saved quizzes...</p>
      </section>
      <a class="instructor-setup-generator" href="/?mode=generator&theme=signal">Question Generator</a>
    `;

    this.root.querySelector<HTMLFormElement>("#instructor-setup-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const formData = new FormData(form);
      const activity = String(formData.get("activity") ?? "cpp-random");
      const savedQuizId = activity.startsWith("bank:") ? activity.slice("bank:".length) : "";
      const savedQuiz = savedQuizId ? this.savedQuizzes.find((entry) => entry.id === savedQuizId) : undefined;
      const quizId = savedQuiz ? savedQuiz.id : activity;

      if (savedQuizId && !savedQuiz) {
        this.renderStatus("That saved quiz is not available yet. Reload setup and try again.", true);
        return;
      }

      if (savedQuiz) {
        writeQuizBankHandoff(savedQuiz);
      }

      const params = new URLSearchParams({
        mode: "deck",
        presentation: savedQuiz ? "generated" : activity,
        quiz: quizId,
        theme: String(formData.get("theme") ?? "signal"),
        autoStart: "1"
      });

      if (savedQuiz) {
        params.set("quizBank", "1");
      }

      window.location.assign(`/?${params.toString()}#/0`);
    });

    void this.loadSavedQuizzes();
  }

  private async loadSavedQuizzes(): Promise<void> {
    const browserQuizzes = readBrowserQuizBankEntries();

    try {
      const firebaseQuizzes = await this.quizBank.listQuizzes();
      this.savedQuizzes = mergeSavedQuizzes(firebaseQuizzes, browserQuizzes);
      const select = this.root.querySelector<HTMLSelectElement>('select[name="activity"]');

      if (select) {
        const selectedValue = select.value;
        select.innerHTML = this.renderActivityOptions(selectedValue);
      }

      this.renderStatus(
        this.savedQuizzes.length > 0
          ? `${this.savedQuizzes.length} saved quiz${this.savedQuizzes.length === 1 ? "" : "zes"} ready.`
          : "No saved quizzes yet. Use Question Generator to create one."
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.savedQuizzes = browserQuizzes;
      const select = this.root.querySelector<HTMLSelectElement>('select[name="activity"]');

      if (select) {
        const selectedValue = select.value;
        select.innerHTML = this.renderActivityOptions(selectedValue);
      }

      this.renderStatus(
        browserQuizzes.length > 0
          ? `${browserQuizzes.length} browser-saved quiz${browserQuizzes.length === 1 ? "" : "zes"} ready. Firebase quiz bank could not be loaded: ${message}`
          : `Saved quizzes could not be loaded: ${message}`,
        browserQuizzes.length === 0
      );
    }
  }

  private renderActivityOptions(selectedValue: string): string {
    const savedOptions = this.savedQuizzes.map(
      (entry): SetupOption => ({
        value: `bank:${entry.id}`,
        label: entry.title,
        source: "quiz-bank"
      })
    );

    return [
      `<optgroup label="Built-in Activities">${this.renderOptions(ACTIVITY_OPTIONS, selectedValue)}</optgroup>`,
      savedOptions.length > 0
        ? `<optgroup label="Saved Quiz Bank">${this.renderOptions(savedOptions, selectedValue)}</optgroup>`
        : ""
    ].join("");
  }

  private renderStatus(message: string, isError = false): void {
    const status = this.root.querySelector<HTMLElement>("#quiz-bank-status");

    if (!status) {
      return;
    }

    status.classList.toggle("is-error", isError);
    status.textContent = message;
  }

  private renderOptions(options: SetupOption[], selectedValue: string): string {
    return options
      .map((option) => {
        const selected = option.value === selectedValue ? " selected" : "";
        const prefix = option.source === "quiz-bank" ? "Saved: " : "";
        return `<option value="${escapeHtml(option.value)}"${selected}>${prefix}${escapeHtml(option.label)}</option>`;
      })
      .join("");
  }
}

function mergeSavedQuizzes(firebaseQuizzes: SavedQuizBankEntry[], browserQuizzes: SavedQuizBankEntry[]): SavedQuizBankEntry[] {
  const firebaseTitles = new Set(firebaseQuizzes.map((entry) => entry.title.trim().toLowerCase()));
  const uniqueBrowserQuizzes = browserQuizzes.filter((entry) => !firebaseTitles.has(entry.title.trim().toLowerCase()));
  return [...firebaseQuizzes, ...uniqueBrowserQuizzes];
}

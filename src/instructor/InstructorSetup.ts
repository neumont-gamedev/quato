import { escapeHtml } from "../questions/QuestionRenderer";

interface SetupOption {
  value: string;
  label: string;
}

const PRESENTATION_OPTIONS: SetupOption[] = [
  { value: "example", label: "Smart Pointers" },
  { value: "cpp-random", label: "C++ Random Numbers" }
];

const QUIZ_OPTIONS: SetupOption[] = [
  { value: "example", label: "Smart Pointers" },
  { value: "cpp-random", label: "C++ Random Numbers" }
];

const THEME_OPTIONS: SetupOption[] = [
  { value: "signal", label: "Signal" },
  { value: "midnight", label: "Midnight" }
];

export class InstructorSetup {
  constructor(private readonly root: HTMLElement) {}

  mount(): void {
    this.root.className = "instructor-setup-shell";
    this.root.innerHTML = `
      <section class="instructor-setup-card" aria-labelledby="instructor-setup-title">
        <p class="student-eyebrow">RevealQuiz</p>
        <h1 id="instructor-setup-title">Instructor Setup</h1>
        <form class="instructor-setup-form" id="instructor-setup-form">
          <label>
            <span>Presentation</span>
            <select name="presentation">
              ${this.renderOptions(PRESENTATION_OPTIONS, "cpp-random")}
            </select>
          </label>
          <label>
            <span>Quiz</span>
            <select name="quiz">
              ${this.renderOptions(QUIZ_OPTIONS, "cpp-random")}
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
        <a class="instructor-setup-generator" href="/?mode=generator&theme=signal">Question Generator</a>
      </section>
    `;

    this.root.querySelector<HTMLFormElement>("#instructor-setup-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const formData = new FormData(form);
      const params = new URLSearchParams({
        mode: "deck",
        presentation: String(formData.get("presentation") ?? "cpp-random"),
        quiz: String(formData.get("quiz") ?? "cpp-random"),
        theme: String(formData.get("theme") ?? "signal")
      });

      window.location.assign(`/?${params.toString()}`);
    });
  }

  private renderOptions(options: SetupOption[], selectedValue: string): string {
    return options
      .map((option) => {
        const selected = option.value === selectedValue ? " selected" : "";
        return `<option value="${escapeHtml(option.value)}"${selected}>${escapeHtml(option.label)}</option>`;
      })
      .join("");
  }
}

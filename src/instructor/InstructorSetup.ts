import { escapeHtml } from "../questions/QuestionRenderer";

interface SetupOption {
  value: string;
  label: string;
}

const ACTIVITY_OPTIONS: SetupOption[] = [
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
        <h1 id="instructor-setup-title">Instructor Setup</h1>
        <p class="instructor-setup-copy">Choose the classroom activity. The matching presentation, quiz questions, and game settings load together.</p>
        <form class="instructor-setup-form" id="instructor-setup-form">
          <label>
            <span>Activity</span>
            <select name="activity">
              ${this.renderOptions(ACTIVITY_OPTIONS, "cpp-random")}
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
      </section>
      <a class="instructor-setup-generator" href="/?mode=generator&theme=signal">Question Generator</a>
    `;

    this.root.querySelector<HTMLFormElement>("#instructor-setup-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const formData = new FormData(form);
      const activity = String(formData.get("activity") ?? "cpp-random");
      const params = new URLSearchParams({
        mode: "deck",
        presentation: activity,
        quiz: activity,
        theme: String(formData.get("theme") ?? "signal")
      });

      window.location.assign(`/?${params.toString()}#/0`);
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

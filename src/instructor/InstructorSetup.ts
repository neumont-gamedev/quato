import { escapeHtml } from "../questions/QuestionRenderer";
import { ACHIEVEMENTS } from "../classroom/GameMeta";

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
          <fieldset class="instructor-setup-options">
            <legend>Game Options</legend>
            <label class="instructor-setup-checkbox">
              <input name="teamMode" type="checkbox" checked />
              <span>Team quiz</span>
            </label>
            <label class="instructor-setup-checkbox">
              <input name="achievementsEnabled" type="checkbox" checked />
              <span>Achievements</span>
            </label>
            <label>
              <span>Boss Multiplier</span>
              <input name="bossMultiplier" type="number" min="1" max="10" value="2" />
            </label>
            <div class="instructor-setup-achievements">
              ${ACHIEVEMENTS.map(
                (achievement) => `
                  <label class="instructor-setup-checkbox">
                    <input name="enabledAchievements" type="checkbox" value="${escapeHtml(achievement.id)}" checked />
                    <span>${escapeHtml(achievement.name)}</span>
                  </label>
                `
              ).join("")}
            </div>
          </fieldset>
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
        theme: String(formData.get("theme") ?? "signal"),
        teamMode: formData.has("teamMode") ? "1" : "0",
        achievementsEnabled: formData.has("achievementsEnabled") ? "1" : "0",
        bossMultiplier: String(formData.get("bossMultiplier") ?? "2")
      });
      const enabledAchievements = formData.getAll("enabledAchievements").map(String).join(",");

      params.set("enabledAchievements", enabledAchievements);

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

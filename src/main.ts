import "reveal.js/dist/reveal.css";
import "reveal.js/dist/theme/black.css";
import "reveal.js/plugin/highlight/monokai.css";
import "../styles/quiz.css";
import "../styles/game-hud.css";
import "../styles/generator.css";
import "../styles/classroom.css";

import { RevealIntegration } from "./presentation/RevealIntegration";
import { firebaseApp } from "./firebase";
import { MarkdownPresentationLoader } from "./presentation/MarkdownPresentationLoader";
import { QuizEngine } from "./quiz/QuizEngine";
import { QuizLoader } from "./quiz/QuizLoader";
import {
  createGeneratedPresentation,
  QuestionGenerationStudio,
  readGeneratedDraft
} from "./instructor/QuestionGenerationStudio";
import { InstructorController } from "./instructor/InstructorController";
import { InstructorSetup } from "./instructor/InstructorSetup";
import { StudentClient } from "./student/StudentClient";

async function bootstrap() {
  void firebaseApp;

  const hud = document.querySelector<HTMLElement>("#game-hud");
  const slides = document.querySelector<HTMLElement>("#slides");
  const classroomPanel = document.querySelector<HTMLElement>("#classroom-panel");

  if (!hud || !slides || !classroomPanel) {
    throw new Error("Application shell is missing required elements.");
  }

  const options = readAuthoringOptions();
  document.body.dataset.theme = options.theme;

  if (options.mode === "setup") {
    hud.remove();
    classroomPanel.remove();
    document.querySelector(".reveal")?.remove();
    const setupRoot = document.createElement("main");
    document.body.append(setupRoot);
    new InstructorSetup(setupRoot).mount();
    return;
  }

  if (options.mode === "generator") {
    hud.remove();
    classroomPanel.remove();
    document.querySelector(".reveal")?.remove();
    const generatorRoot = document.createElement("main");
    document.body.append(generatorRoot);
    new QuestionGenerationStudio(generatorRoot).mount();
    return;
  }

  if (options.mode === "student") {
    hud.remove();
    classroomPanel.remove();
    document.querySelector(".reveal")?.remove();
    const studentRoot = document.createElement("main");
    document.body.append(studentRoot);
    new StudentClient(studentRoot).mount(options.code);
    return;
  }

  const loader = new QuizLoader();
  const result =
    options.mode === "preview-generated"
      ? { data: readGeneratedDraft(), errors: ["No reviewed generated draft is available."] }
      : await loader.loadFromUrl(options.quizUrl);

  if (!result.data) {
    renderFatalError(result.errors);
    return;
  }

  const presentationLoader = new MarkdownPresentationLoader();
  const presentation =
    options.mode === "preview-generated"
      ? { markdown: createGeneratedPresentation(result.data), errors: [] }
      : await presentationLoader.loadFromUrl(options.presentationUrl);

  if (!presentation.markdown) {
    renderFatalError(presentation.errors);
    return;
  }

  const renderedPresentation = presentationLoader.renderInto(presentation.markdown, slides, result.data);

  if (renderedPresentation.errors.length > 0) {
    renderFatalError(renderedPresentation.errors);
    return;
  }

  const instructor = new InstructorController(result.data, classroomPanel, options.quizId);
  instructor.mount();

  const engine = new QuizEngine(result.data, hud, document.querySelector("#final-score"), {
    onActiveQuestionChange: (question, questionIndex, currentSlide) => {
      void instructor.handleQuestionChanged(question, questionIndex, currentSlide);
    }
  });
  engine.mount();
  instructor.setCurrentSlideSync(() => engine.syncCurrentSlideFromDocument());

  const reveal = new RevealIntegration(engine);
  await reveal.initialize();
}

function readAuthoringOptions() {
  const params = new URLSearchParams(window.location.search);
  const presentation = params.get("presentation") ?? "example";
  const quiz = params.get("quiz") ?? "example";
  const theme = params.get("theme") ?? "signal";
  const mode = params.get("mode") ?? (params.has("presentation") || params.has("quiz") ? "deck" : "setup");
  const code = params.get("code") ?? "";

  return {
    presentationUrl: `/presentations/${sanitizeSlug(presentation)}.md`,
    quizUrl: `/quizzes/${sanitizeSlug(quiz)}.json`,
    quizId: sanitizeSlug(quiz),
    theme: sanitizeSlug(theme),
    mode: sanitizeSlug(mode),
    code: sanitizeSlug(code)
  };
}

function sanitizeSlug(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "") || "example";
}

function renderFatalError(errors: string[]): void {
  const slides = document.querySelector<HTMLElement>("#slides");
  const formattedErrors = errors.map((error) => `<li>${error}</li>`).join("");

  if (slides) {
    slides.innerHTML = `
      <section>
        <h1>Quiz Load Error</h1>
        <ul class="load-errors">${formattedErrors}</ul>
      </section>
    `;
  }
}

bootstrap().catch((error) => {
  renderFatalError([error instanceof Error ? error.message : String(error)]);
});

import "reveal.js/dist/reveal.css";
import "reveal.js/dist/theme/black.css";
import "reveal.js/plugin/highlight/monokai.css";
import "../styles/quiz.css";
import "../styles/game-hud.css";
import "../styles/generator.css";

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

async function bootstrap() {
  void firebaseApp;

  const hud = document.querySelector<HTMLElement>("#game-hud");
  const slides = document.querySelector<HTMLElement>("#slides");

  if (!hud || !slides) {
    throw new Error("Application shell is missing required elements.");
  }

  const options = readAuthoringOptions();
  document.body.dataset.theme = options.theme;

  if (options.mode === "generator") {
    hud.remove();
    document.querySelector(".reveal")?.remove();
    const generatorRoot = document.createElement("main");
    document.body.append(generatorRoot);
    new QuestionGenerationStudio(generatorRoot).mount();
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

  const engine = new QuizEngine(result.data, hud, document.querySelector("#final-score"));
  engine.mount();

  const reveal = new RevealIntegration(engine);
  await reveal.initialize();
}

function readAuthoringOptions() {
  const params = new URLSearchParams(window.location.search);
  const presentation = params.get("presentation") ?? "example";
  const quiz = params.get("quiz") ?? "example";
  const theme = params.get("theme") ?? "midnight";
  const mode = params.get("mode") ?? "deck";

  return {
    presentationUrl: `/presentations/${sanitizeSlug(presentation)}.md`,
    quizUrl: `/quizzes/${sanitizeSlug(quiz)}.json`,
    theme: sanitizeSlug(theme),
    mode: sanitizeSlug(mode)
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

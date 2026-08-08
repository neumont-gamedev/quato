import Reveal from "reveal.js";
import Markdown from "reveal.js/plugin/markdown/markdown.esm.js";
import Highlight from "reveal.js/plugin/highlight/highlight.esm.js";
import Notes from "reveal.js/plugin/notes/notes.esm.js";
import type { QuizEngine } from "../quiz/QuizEngine";

export class RevealIntegration {
  private deck?: Reveal;

  constructor(private readonly quizEngine: QuizEngine) {}

  async initialize(): Promise<void> {
    const revealRoot = document.querySelector<HTMLElement>(".reveal");

    if (!revealRoot) {
      throw new Error("Reveal.js root element was not found.");
    }

    this.deck = new Reveal(revealRoot, {
      hash: true,
      controls: true,
      progress: true,
      center: true,
      minScale: 0.2,
      maxScale: 1,
      transition: "slide",
      plugins: [Markdown, Highlight, Notes]
    });

    window.RevealQuizDeck = this.deck;

    this.deck.on("slidechanged", (event) => {
      const currentSlide = event.currentSlide as HTMLElement | undefined;
      this.quizEngine.handleSlideChanged(currentSlide);
      window.setTimeout(() => {
        this.quizEngine.handleSlideChanged(this.deck?.getCurrentSlide() as HTMLElement | undefined);
      }, 250);
    });

    await this.deck.initialize();
    this.quizEngine.handleSlideChanged(this.deck.getCurrentSlide() as HTMLElement | undefined);
  }
}

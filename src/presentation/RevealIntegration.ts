import Reveal from "reveal.js";
import Markdown from "reveal.js/plugin/markdown/markdown.esm.js";
import Highlight from "reveal.js/plugin/highlight/highlight.esm.js";
import Notes from "reveal.js/plugin/notes/notes.esm.js";
import type { QuizEngine } from "../quiz/QuizEngine";

export class RevealIntegration {
  private deck?: Reveal;

  constructor(private readonly quizEngine: QuizEngine) {}

  async initialize(): Promise<void> {
    this.deck = new Reveal({
      hash: true,
      controls: true,
      progress: true,
      center: true,
      minScale: 0.2,
      maxScale: 1,
      transition: "slide",
      plugins: [Markdown, Highlight, Notes]
    });

    await this.deck.initialize();

    this.deck.on("slidechanged", (event) => {
      const currentSlide = event.currentSlide as HTMLElement | undefined;
      this.quizEngine.handleSlideChanged(currentSlide);
    });

    this.quizEngine.handleSlideChanged(this.deck.getCurrentSlide() as HTMLElement | undefined);
  }
}

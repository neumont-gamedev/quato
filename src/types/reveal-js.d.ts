declare module "reveal.js" {
  export interface RevealSlideEvent {
    currentSlide?: Element;
  }

  export interface RevealApi {
    initialize(): Promise<void>;
    on(eventName: "slidechanged", callback: (event: RevealSlideEvent) => void): void;
    getCurrentSlide(): Element;
    prev(): void;
  }

  export interface RevealOptions {
    width?: number | string;
    height?: number | string;
    margin?: number;
    minScale?: number;
    maxScale?: number;
    hash?: boolean;
    controls?: boolean;
    progress?: boolean;
    center?: boolean;
    transition?: string;
    plugins?: unknown[];
  }

  export default class Reveal {
    constructor(revealElement?: Element, options?: RevealOptions);
    initialize(): Promise<void>;
    on(eventName: "slidechanged", callback: (event: RevealSlideEvent) => void): void;
    getCurrentSlide(): Element;
    prev(): void;
  }
}

declare module "reveal.js/plugin/markdown/markdown.esm.js" {
  const Markdown: unknown;
  export default Markdown;
}

declare module "reveal.js/plugin/highlight/highlight.esm.js" {
  const Highlight: unknown;
  export default Highlight;
}

declare module "reveal.js/plugin/notes/notes.esm.js" {
  const Notes: unknown;
  export default Notes;
}

interface Window {
  RevealQuizDeck?: import("reveal.js").default;
}

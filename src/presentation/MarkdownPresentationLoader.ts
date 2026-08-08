import { escapeHtml } from "../questions/QuestionRenderer";
import type { QuizFile } from "../types/Question";

export interface PresentationLoadResult {
  errors: string[];
  markdown?: string;
}

export interface PresentationRenderResult {
  errors: string[];
  questionIds: string[];
}

export class MarkdownPresentationLoader {
  async loadFromUrl(url: string): Promise<PresentationLoadResult> {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        return { errors: [`Unable to load presentation: ${response.status} ${response.statusText}`] };
      }

      return { markdown: await response.text(), errors: [] };
    } catch (error) {
      return {
        errors: [`Unable to load presentation: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  renderInto(markdown: string, slides: HTMLElement, quiz: QuizFile): PresentationRenderResult {
    const questionIds: string[] = [];
    const errors: string[] = [];
    const knownQuestions = new Set(quiz.questions.map((question) => question.id));
    const sections = markdown
      .split(/\r?\n---+\r?\n/g)
      .map((section) => section.trim())
      .filter(Boolean);

    slides.replaceChildren();

    sections.forEach((sectionMarkdown) => {
      const questionReference = sectionMarkdown.match(/^@question\s+([A-Za-z0-9_-]+)$/m);
      const resultsReference = sectionMarkdown.match(/^@results$/m);
      const section = document.createElement("section");

      if (questionReference) {
        const questionId = questionReference[1];
        section.dataset.questionId = questionId;
        questionIds.push(questionId);

        if (!knownQuestions.has(questionId)) {
          errors.push(`Presentation references missing question "${questionId}".`);
        }
      } else if (resultsReference) {
        section.innerHTML = `<h2>Results</h2><div id="final-score" class="final-score"></div>`;
      } else {
        section.innerHTML = renderMarkdownSection(sectionMarkdown);
      }

      slides.append(section);
    });

    if (!slides.querySelector("#final-score")) {
      const finalSection = document.createElement("section");
      finalSection.innerHTML = `<h2>Results</h2><div id="final-score" class="final-score"></div>`;
      slides.append(finalSection);
    }

    return { errors, questionIds };
  }
}

function renderMarkdownSection(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const html: string[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let codeLines: string[] = [];
  let codeLanguage = "";
  let inCodeBlock = false;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      html.push(`<p>${renderInlineMarkdown(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };

  const flushList = () => {
    if (list.length > 0) {
      html.push(`<ul>${list.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ul>`);
      list = [];
    }
  };

  lines.forEach((line) => {
    const codeFence = line.match(/^```([A-Za-z0-9_-]*)\s*$/);

    if (codeFence && !inCodeBlock) {
      flushParagraph();
      flushList();
      inCodeBlock = true;
      codeLanguage = codeFence[1] ? ` language-${codeFence[1]}` : "";
      codeLines = [];
      return;
    }

    if (codeFence && inCodeBlock) {
      html.push(`<pre><code class="${codeLanguage.trim()}">${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      inCodeBlock = false;
      codeLanguage = "";
      codeLines = [];
      return;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      return;
    }

    if (line.trim().length === 0) {
      flushParagraph();
      flushList();
      return;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      return;
    }

    const listItem = line.match(/^-\s+(.+)$/);
    if (listItem) {
      flushParagraph();
      list.push(listItem[1]);
      return;
    }

    flushList();
    paragraph.push(line.trim());
  });

  flushParagraph();
  flushList();

  if (inCodeBlock) {
    html.push(`<pre><code class="${codeLanguage.trim()}">${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }

  return html.join("\n");
}

function renderInlineMarkdown(value: string): string {
  return escapeHtml(value).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

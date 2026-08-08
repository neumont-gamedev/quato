import { FillBlankRenderer } from "../questions/FillBlank";
import { CodeQuestionRenderer } from "../questions/CodeQuestion";
import { MultipleChoiceRenderer } from "../questions/MultipleChoice";
import type { QuestionRenderer } from "../questions/QuestionRenderer";
import { TrueFalseRenderer } from "../questions/TrueFalse";
import type { QuestionType } from "../types/Question";

export class QuestionFactory {
  private readonly renderers: Record<QuestionType, QuestionRenderer> = {
    "multiple-choice": new MultipleChoiceRenderer(),
    "true-false": new TrueFalseRenderer(),
    "fill-blank": new FillBlankRenderer(),
    "code-question": new CodeQuestionRenderer()
  };

  getRenderer(type: QuestionType): QuestionRenderer {
    return this.renderers[type];
  }
}

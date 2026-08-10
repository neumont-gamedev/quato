import { QuizLoader } from "../quiz/QuizLoader";
import type { QuizFile } from "../types/Question";
import type { SavedQuizBankEntry } from "./QuizBankService";

const QUIZ_BANK_HANDOFF_STORAGE_KEY = "revealquiz.quizBankHandoff";
const SAVED_DRAFTS_STORAGE_KEY = "revealquiz.savedDrafts";

interface QuizBankHandoff {
  id: string;
  title: string;
  quiz: QuizFile;
}

export function writeQuizBankHandoff(entry: SavedQuizBankEntry): void {
  const storage = getHandoffStorage();

  if (!storage) {
    return;
  }

  const handoff: QuizBankHandoff = {
    id: entry.id,
    title: entry.title,
    quiz: entry.quiz
  };
  storage.setItem(QUIZ_BANK_HANDOFF_STORAGE_KEY, JSON.stringify(handoff));
}

export function readQuizBankHandoff(expectedId: string): QuizFile | undefined {
  const rawHandoff = getHandoffStorage()?.getItem(QUIZ_BANK_HANDOFF_STORAGE_KEY);

  if (!rawHandoff) {
    return undefined;
  }

  try {
    const handoff = JSON.parse(rawHandoff) as Partial<QuizBankHandoff>;

    if (handoff.id !== expectedId || !handoff.quiz) {
      return undefined;
    }

    return new QuizLoader().validate(handoff.quiz).data;
  } catch {
    return undefined;
  }
}

export function readBrowserQuizBankEntries(): SavedQuizBankEntry[] {
  try {
    const value = window.localStorage?.getItem(SAVED_DRAFTS_STORAGE_KEY);

    if (!value) {
      return [];
    }

    const savedDrafts = JSON.parse(value) as Record<string, { title: string; savedAt?: string; quiz: QuizFile }>;
    return Object.entries(savedDrafts).map(([key, saved]) => ({
      id: `browser-${key}`,
      title: saved.title,
      savedAt: saved.savedAt,
      quiz: saved.quiz
    }));
  } catch {
    return [];
  }
}

function getHandoffStorage(): Storage | undefined {
  try {
    return window.sessionStorage ?? window.localStorage ?? undefined;
  } catch {
    return undefined;
  }
}

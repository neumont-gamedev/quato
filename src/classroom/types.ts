import type { PublicQuestion, QuestionType, RevealedAnswer } from "../types/Question";

export type SessionStatus = "lobby" | "presenting" | "question-open" | "locked" | "revealed" | "ended";

export interface ClassroomSession {
  code: string;
  title: string;
  instructorUid: string;
  status: SessionStatus;
  currentQuestionId: string | null;
  currentQuestionIndex: number;
  totalQuestions: number;
  activeQuestion: PublicQuestion | null;
  revealedAnswer: RevealedAnswer | null;
  questionStartedAt?: unknown;
  playerCount: number;
  answeredCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ClassroomPlayer {
  uid: string;
  name: string;
  score: number;
  streak: number;
  joinedAt?: unknown;
  lastSeenAt?: unknown;
}

export interface ClassroomAnswer {
  uid: string;
  questionId: string;
  questionType: QuestionType;
  value: string | number | boolean | string[] | number[];
  submittedAt?: unknown;
}

export interface LeaderboardEntry {
  uid: string;
  name: string;
  score: number;
  streak: number;
}

import type { PublicQuestion, QuestionType, RevealedAnswer } from "../types/Question";

export type SessionStatus = "lobby" | "presenting" | "question-open" | "locked" | "revealed" | "leaderboard" | "ended";

export interface ClassroomSession {
  code: string;
  title: string;
  quizId: string;
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
  characterIndex: number;
  teamId: string;
  teamName: string;
  achievements: string[];
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
  characterIndex: number;
  teamId: string;
  teamName: string;
  achievements: string[];
  score: number;
  streak: number;
}

export interface TeamLeaderboardEntry {
  teamId: string;
  teamName: string;
  score: number;
  playerCount: number;
  averageScore: number;
}

export interface GradeExportRow {
  rank: number;
  uid: string;
  name: string;
  teamName: string;
  achievements: string[];
  score: number;
  streak: number;
}

export interface GradeExport {
  code: string;
  title: string;
  quizId: string;
  instructorUid: string;
  playerCount: number;
  rows: GradeExportRow[];
  createdAt?: unknown;
  endedAt?: unknown;
}

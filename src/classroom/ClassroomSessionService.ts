import { signInAnonymously, type User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "../firebase";
import type { PublicQuestion, QuizFile, QuizQuestion } from "../types/Question";
import { toPublicQuestion } from "../types/Question";
import type { ClassroomAnswer, ClassroomPlayer, ClassroomSession, SessionStatus } from "./types";
import type { ClassroomScoreAward } from "./ClassroomScoring";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export class ClassroomSessionService {
  async ensureAnonymousUser(): Promise<User> {
    if (auth.currentUser) {
      return auth.currentUser;
    }

    const credential = await signInAnonymously(auth);
    return credential.user;
  }

  async createSession(quiz: QuizFile, quizId = "example"): Promise<ClassroomSession> {
    const user = await this.ensureAnonymousUser();
    const code = await this.createUniqueCode();
    const session: ClassroomSession = {
      code,
      title: quiz.title,
      quizId,
      instructorUid: user.uid,
      status: "lobby",
      currentQuestionId: null,
      currentQuestionIndex: 0,
      totalQuestions: quiz.questions.length,
      activeQuestion: null,
      revealedAnswer: null,
      questionStartedAt: null,
      playerCount: 0,
      answeredCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(db, "sessions", code), session);
    return { ...session, createdAt: undefined, updatedAt: undefined };
  }

  listenSession(code: string, onChange: (session: ClassroomSession | null) => void): Unsubscribe {
    return onSnapshot(doc(db, "sessions", code), (snapshot) => {
      onChange(snapshot.exists() ? (snapshot.data() as ClassroomSession) : null);
    });
  }

  listenPlayers(code: string, onChange: (players: ClassroomPlayer[]) => void): Unsubscribe {
    return onSnapshot(collection(db, "sessions", code, "players"), (snapshot) => {
      onChange(snapshot.docs.map((player) => player.data() as ClassroomPlayer));
    });
  }

  async listenCurrentPlayer(code: string, onChange: (player: ClassroomPlayer | null) => void): Promise<Unsubscribe> {
    const user = await this.ensureAnonymousUser();
    return onSnapshot(doc(db, "sessions", normalizeCode(code), "players", user.uid), (snapshot) => {
      onChange(snapshot.exists() ? (snapshot.data() as ClassroomPlayer) : null);
    });
  }

  listenAnswers(code: string, questionId: string, onChange: (answers: ClassroomAnswer[]) => void): Unsubscribe {
    const answersQuery = query(collection(db, "sessions", code, "answers"), where("questionId", "==", questionId));
    return onSnapshot(answersQuery, (snapshot) => {
      onChange(snapshot.docs.map((answer) => answer.data() as ClassroomAnswer));
    });
  }

  async publishQuestion(code: string, question: QuizQuestion, questionIndex: number, totalQuestions: number): Promise<void> {
    await updateDoc(doc(db, "sessions", code), {
      status: "question-open" satisfies SessionStatus,
      currentQuestionId: question.id,
      currentQuestionIndex: questionIndex,
      totalQuestions,
      activeQuestion: toPublicQuestion(question),
      revealedAnswer: null,
      questionStartedAt: serverTimestamp(),
      answeredCount: 0,
      updatedAt: serverTimestamp()
    });
  }

  async markPresenting(code: string): Promise<void> {
    await updateDoc(doc(db, "sessions", code), {
      status: "presenting" satisfies SessionStatus,
      currentQuestionId: null,
      currentQuestionIndex: 0,
      activeQuestion: null,
      revealedAnswer: null,
      questionStartedAt: null,
      answeredCount: 0,
      updatedAt: serverTimestamp()
    });
  }

  async scoreAndRevealQuestion(code: string, questionId: string): Promise<ClassroomScoreAward[]> {
    const reveal = httpsCallable<
      { code: string; questionId: string },
      { awards?: ClassroomScoreAward[] }
    >(functions, "revealQuestion");
    const result = await reveal({ code: normalizeCode(code), questionId });
    return result.data.awards ?? [];
  }

  async setStatus(code: string, status: SessionStatus): Promise<void> {
    await updateDoc(doc(db, "sessions", code), {
      status,
      updatedAt: serverTimestamp()
    });
  }

  async updatePlayerScore(
    code: string,
    player: ClassroomPlayer,
    score: number,
    streak: number
  ): Promise<void> {
    await updateDoc(doc(db, "sessions", normalizeCode(code), "players", player.uid), {
      score,
      streak
    });
  }

  async joinSession(code: string, displayName: string): Promise<ClassroomPlayer> {
    const user = await this.ensureAnonymousUser();
    const normalizedCode = normalizeCode(code);
    const player: ClassroomPlayer = {
      uid: user.uid,
      name: displayName.trim().slice(0, 32),
      score: 0,
      streak: 0,
      joinedAt: serverTimestamp(),
      lastSeenAt: serverTimestamp()
    };

    await setDoc(doc(db, "sessions", normalizedCode, "players", user.uid), player);

    return { ...player, joinedAt: undefined, lastSeenAt: undefined };
  }

  async submitAnswer(code: string, answer: Omit<ClassroomAnswer, "uid" | "submittedAt">): Promise<void> {
    const user = await this.ensureAnonymousUser();
    const normalizedCode = normalizeCode(code);
    await setDoc(doc(db, "sessions", normalizedCode, "answers", `${answer.questionId}_${user.uid}`), {
      ...answer,
      uid: user.uid,
      submittedAt: serverTimestamp()
    });
  }

  async leaveSession(code: string): Promise<void> {
    const user = auth.currentUser;

    if (!user) {
      return;
    }

    await deleteDoc(doc(db, "sessions", normalizeCode(code), "players", user.uid));
  }

  private async createUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = createCode();
      const snapshot = await getDoc(doc(db, "sessions", code));

      if (!snapshot.exists()) {
        return code;
      }
    }

    throw new Error("Unable to create a unique classroom code.");
  }
}

export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export function renderStudentAnswer(question: PublicQuestion, formData: FormData): ClassroomAnswer["value"] {
  switch (question.type) {
    case "multiple-choice":
    case "code-question":
      return Number(formData.get("answer"));
    case "true-false":
      return formData.get("answer") === "true";
    case "fill-blank":
      return String(formData.get("answer") ?? "").trim().slice(0, 160);
  }
}

function createCode(): string {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");
}

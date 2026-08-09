import { signInAnonymously } from "firebase/auth";
import { addDoc, collection, getDocs, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import type { QuizFile } from "../types/Question";

export interface SavedQuizBankEntry {
  id: string;
  title: string;
  savedAt?: unknown;
  quiz: QuizFile;
}

export class QuizBankService {
  async listQuizzes(): Promise<SavedQuizBankEntry[]> {
    const uid = await this.ensureUid();
    const snapshot = await getDocs(collection(db, "users", uid, "quizBank"));

    return snapshot.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<SavedQuizBankEntry, "id">) }))
      .sort((left, right) => readMillis(right.savedAt) - readMillis(left.savedAt));
  }

  async saveQuiz(quiz: QuizFile): Promise<void> {
    const uid = await this.ensureUid();
    await addDoc(collection(db, "users", uid, "quizBank"), {
      title: quiz.title,
      description: quiz.description ?? "",
      questionCount: quiz.questions.length,
      quiz,
      savedAt: serverTimestamp()
    });
  }

  private async ensureUid(): Promise<string> {
    if (auth.currentUser) {
      return auth.currentUser.uid;
    }

    const credential = await signInAnonymously(auth);
    return credential.user.uid;
  }
}

function readMillis(value: unknown): number {
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (value && typeof value === "object" && "seconds" in value && typeof value.seconds === "number") {
    const nanoseconds = "nanoseconds" in value && typeof value.nanoseconds === "number" ? value.nanoseconds : 0;
    return value.seconds * 1000 + Math.floor(nanoseconds / 1_000_000);
  }

  return 0;
}

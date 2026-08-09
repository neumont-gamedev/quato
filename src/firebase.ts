import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from "firebase/app-check";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAjDrIPpp9ecHtff4dGW0nzLtxgjdhs3I8",
  authDomain: "quato-1512c.firebaseapp.com",
  projectId: "quato-1512c",
  storageBucket: "quato-1512c.firebasestorage.app",
  messagingSenderId: "853332649791",
  appId: "1:853332649791:web:8609fd02dff86afd8bd58a",
  measurementId: "G-4QL58QWVMB"
};

export const firebaseApp: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const appCheck = initializeRevealQuizAppCheck(firebaseApp);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const functions = getFunctions(firebaseApp, "us-central1");

function initializeRevealQuizAppCheck(app: FirebaseApp): AppCheck | null {
  const siteKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY as string | undefined;

  if (!siteKey) {
    console.warn("Firebase App Check is not initialized. Set VITE_RECAPTCHA_ENTERPRISE_SITE_KEY for Firebase AI Logic.");
    return null;
  }

  if (isLocalDevelopment()) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN || true;
  }

  return initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true
  });
}

function isLocalDevelopment(): boolean {
  return location.hostname === "localhost" || location.hostname === "127.0.0.1";
}

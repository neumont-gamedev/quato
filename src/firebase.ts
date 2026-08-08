import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
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
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

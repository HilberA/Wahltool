// Einziger Ort im Projekt, der die Firebase-SDK direkt importiert.
// Bei einem späteren Wechsel auf einen eigenen Server wird NUR diese Datei
// (und die Implementierungen in src/services/) ersetzt – der UI-Code bleibt unberührt.

import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)

// Admin-Aktionen (Umfrage erstellen, Tokens generieren, Ergebnisse einsehen)
// benötigen eine Identität, damit die Security Rules "wem gehört diese Umfrage"
// prüfen können. Dafür reicht anonyme Auth – kein Login-Formular nötig.
// Das bindet die Admin-Rechte an dieses Browser-Profil (siehe README, Abschnitt
// "Grenzen des MVP").
export function ensureAdminSession() {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe()
        if (user) {
          resolve(user)
        } else {
          signInAnonymously(auth).then((cred) => resolve(cred.user)).catch(reject)
        }
      },
      reject
    )
  })
}

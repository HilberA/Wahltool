// Einziger Ort im Projekt, der die Firebase-SDK direkt importiert.
// Bei einem späteren Wechsel auf einen eigenen Server wird NUR diese Datei
// (und die Implementierungen in src/services/) ersetzt – der UI-Code bleibt unberührt.

import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import { getFirestore } from 'firebase/firestore'
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from 'firebase/auth'

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

// App Check ist optional: nur aktiv, wenn eine reCAPTCHA-Site-Key-Umgebungsvariable
// gesetzt ist. Ohne Key läuft die App ganz normal weiter (kein Zwang, das sofort
// einzurichten). Siehe README, Abschnitt "App Check aktivieren".
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY
if (recaptchaSiteKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true
  })
}

// Echtes Admin-Login (E-Mail/Passwort) statt anonymer Auth. Dadurch funktioniert
// der Admin-Zugriff konto-, nicht browserbasiert – das Konto "kennt" seine Umfragen
// unabhängig davon, von welchem Gerät/Browser aus man sich anmeldet.
export function subscribeToAdminUser(callback) {
  return onAuthStateChanged(auth, callback)
}

export function adminSignIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password)
}

export function adminSignUp(email, password) {
  return createUserWithEmailAndPassword(auth, email, password)
}

export function adminSignOut() {
  return signOut(auth)
}

import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore'
import { getStorage, connectStorageEmulator, type FirebaseStorage } from 'firebase/storage'
import { getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import { Capacitor } from '@capacitor/core'

/**
 * Inicialização do Firebase. A config vem de variáveis VITE_* (.env.local).
 * Valores ausentes geram um app "stub" que não conecta — o app ainda roda
 * (telas/navegação) para desenvolvimento do front sem backend (Sprint 0).
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

let app: FirebaseApp | undefined
let authInstance: Auth | undefined
let dbInstance: Firestore | undefined
let storageInstance: FirebaseStorage | undefined
let functionsInstance: Functions | undefined

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig)

  // App Check (B1) — reCAPTCHA v3 SÓ funciona em navegador com domínio
  // autorizado. No app nativo (WKWebView em capacitor://localhost) o reCAPTCHA
  // não gera token; se o App Check estiver *enforced*, isso derruba Auth/
  // Firestore e QUEBRA o cadastro/login. Por isso inicializamos apenas na web.
  // Para proteger o app nativo, configure App Check nativo (DeviceCheck/App
  // Attest no iOS, Play Integrity no Android) — não via este SDK web.
  const siteKey = import.meta.env.VITE_RECAPTCHA_V3_SITE_KEY
  if (siteKey && Capacitor.getPlatform() === 'web') {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    })
  }

  authInstance = getAuth(app)
  dbInstance = getFirestore(app)
  storageInstance = getStorage(app)
  functionsInstance = getFunctions(app, 'southamerica-east1')

  if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
    connectAuthEmulator(authInstance, 'http://localhost:9099', { disableWarnings: true })
    connectFirestoreEmulator(dbInstance, 'localhost', 8080)
    connectStorageEmulator(storageInstance, 'localhost', 9199)
    connectFunctionsEmulator(functionsInstance, 'localhost', 5001)
  }
} else {
  console.warn(
    '[Sabido] Firebase não configurado (faltam VITE_FIREBASE_*). ' +
      'O app roda em modo offline/stub. Copie .env.example para .env.local.',
  )
}

export const auth = authInstance
export const db = dbInstance
export const storage = storageInstance
export const functions = functionsInstance
export { app }

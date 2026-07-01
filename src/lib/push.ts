import { Capacitor } from '@capacitor/core'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { app, db, auth, isFirebaseConfigured } from '@/lib/firebase'

/**
 * Registro do token FCM para push "sua vez" (desafios/amizades).
 * - NATIVO (iOS/Android): chega na v1.1 (requer GoogleService-Info.plist + APNs).
 * - WEB: firebase/messaging com VAPID + service worker.
 * Tudo best-effort e guardado: sem Firebase/login/permissão, vira no-op.
 * O envio é feito pela Cloud Function notify() (functions/src/index.ts).
 */
async function storeToken(token: string, platform: string): Promise<void> {
  const uid = auth?.currentUser?.uid
  if (!db || !uid || !token) return
  await setDoc(doc(db, 'users', uid, 'tokens', token), { createdAt: serverTimestamp(), platform })
}

export async function registerForPush(): Promise<void> {
  if (!isFirebaseConfigured || !app || !db || !auth?.currentUser) return

  try {
    if (Capacitor.isNativePlatform()) {
      // Push NATIVO (APNs/FCM) chega na v1.1: requer GoogleService-Info.plist no
      // bundle iOS + capability de Push Notifications. Não usamos o plugin nativo
      // de Firebase no v1 para NÃO inicializar o Firebase nativo no launch (o que
      // crasha o app quando o plist não está presente). No-op por enquanto.
      return
    }

    // Web (PWA)
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
    if (!vapidKey || !('serviceWorker' in navigator) || !('Notification' in window)) return
    const { getMessaging, getToken, isSupported } = await import('firebase/messaging')
    if (!(await isSupported().catch(() => false))) return
    if ((await Notification.requestPermission()) !== 'granted') return
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    const token = await getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration: registration })
    await storeToken(token, 'web')
  } catch {
    /* push é best-effort — nunca quebra o login */
  }
}

import { Capacitor } from '@capacitor/core'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { app, db, auth, isFirebaseConfigured } from '@/lib/firebase'

/**
 * Registro do token FCM para push "sua vez" (desafios/amizades).
 * - NATIVO (iOS/Android): @capacitor-firebase/messaging → token FCM real (APNs por baixo no iOS).
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
      const { FirebaseMessaging } = await import('@capacitor-firebase/messaging')
      const perm = await FirebaseMessaging.requestPermissions()
      if (perm.receive !== 'granted') return
      const { token } = await FirebaseMessaging.getToken()
      await storeToken(token, Capacitor.getPlatform())
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

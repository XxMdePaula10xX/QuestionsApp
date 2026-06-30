import { getMessaging, getToken, isSupported } from 'firebase/messaging'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { app, db, auth, isFirebaseConfigured } from '@/lib/firebase'

/**
 * Registro do token FCM para push "sua vez" (Sprint 4). Best-effort e totalmente
 * guardado: sem Firebase, sem VAPID key, sem suporte do browser ou sem permissão,
 * vira no-op. O envio é feito pela Cloud Function notify() (functions/src/index.ts).
 */
export async function registerForPush(): Promise<void> {
  if (!isFirebaseConfigured || !app || !db) return
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
  if (!vapidKey) return
  const uid = auth?.currentUser?.uid
  if (!uid) return
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return
  if (!(await isSupported().catch(() => false))) return

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    const token = await getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration: registration })
    if (token) {
      await setDoc(doc(db, 'users', uid, 'tokens', token), {
        createdAt: serverTimestamp(),
        platform: 'web',
      })
    }
  } catch {
    /* push é best-effort — nunca quebra o login */
  }
}

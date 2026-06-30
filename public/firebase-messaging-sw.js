/* Service Worker do Firebase Cloud Messaging (push "sua vez").
 * Preencha firebaseConfig com os mesmos valores do .env.local (o SW não acessa
 * import.meta.env). Sem isso, o push web fica inativo — o app funciona normalmente.
 */
importScripts('https://www.gstatic.com/firebasejs/10.13.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.13.1/firebase-messaging-compat.js')

const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
}

if (firebaseConfig.apiKey) {
  firebase.initializeApp(firebaseConfig)
  const messaging = firebase.messaging()
  messaging.onBackgroundMessage((payload) => {
    const { title, body } = payload.notification || {}
    self.registration.showNotification(title || 'Sabido', { body: body || '', icon: '/icon-192.png', badge: '/icon-192.png' })
  })
}

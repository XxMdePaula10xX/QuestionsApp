import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
// Carimbo de versão: usa o commit do Codemagic (CM_COMMIT) quando disponível,
// para conferir NA TELA qual build está rodando no dispositivo.
const BUILD_ID = (process.env.CM_COMMIT || process.env.BUILD_ID || 'dev').slice(0, 7)

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/functions'],
          'firebase-extra': ['firebase/messaging', 'firebase/app-check'],
          motion: ['framer-motion'],
        },
      },
    },
  },
})

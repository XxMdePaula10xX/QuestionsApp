import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.sabido.app',
  appName: 'Sabido',
  webDir: 'dist',
  // Android-first (decisão da revisão). iOS adicionado em sprint posterior.
  server: {
    androidScheme: 'https',
  },
}

export default config

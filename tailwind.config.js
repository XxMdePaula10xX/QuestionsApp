/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta provisória do Sabido — ajustar no design.
        brand: {
          50: '#eef6ff',
          100: '#d9eaff',
          200: '#bcdcff',
          300: '#8ec6ff',
          400: '#59a6ff',
          500: '#3385fb',
          600: '#1f66f0',
          700: '#1850dd',
          800: '#1a43b3',
          900: '#1b3c8d',
        },
        // Cores por categoria (estilo roleta Perguntados).
        cat: {
          geografia: '#1f9d55',
          historia: '#a05a2c',
          ciencias: '#2b6cb0',
          esporte: '#dd6b20',
          arte: '#9b2c8a',
          entretenimento: '#e53e3e',
          brasil: '#d69e2e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

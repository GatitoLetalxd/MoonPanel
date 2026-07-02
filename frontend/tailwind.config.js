/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        moon: {
          bg: '#050508',
          surface: '#0d0e15',
          accent: '#2563eb',
          hover: '#1d4ed8',
          text: '#ffffff',
          border: 'rgba(255,255,255,0.08)',
          card: '#121420'
        },
        neon: {
          red: '#dc2626',
          blue: '#2563eb',
          green: '#22c55e',
          pink: '#ec4899',
          cyan: '#06b6d4',
          yellow: '#eab308'
        }
      },
      fontFamily: {
        sans: ['Orbitron', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}

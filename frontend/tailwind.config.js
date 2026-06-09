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
          bg: '#0a0a0f',
          surface: '#13131a',
          accent: '#7c6af7',
          hover: '#634ef5',
          text: '#e2e2f0',
          border: '#1e1e2e',
          card: '#0d0d14'
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}

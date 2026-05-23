/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,js}",
  ],
  theme: {
    extend: {
      colors: {
        'ag-black': '#050505',
        'ag-dark': '#0a0a0f',
        'ag-card': '#111118',
        'ag-border': '#1e1e2e',
        'ag-blue': '#4f46e5',
        'ag-purple': '#7c3aed',
        'ag-cyan': '#06b6d4',
        'ag-pink': '#ec4899',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'bounce-slow': 'bounce 2s infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}


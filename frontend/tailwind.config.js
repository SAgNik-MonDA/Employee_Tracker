/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50: 'rgb(var(--primary-50) / <alpha-value>)',
          100: 'rgb(var(--primary-100) / <alpha-value>)',
          200: 'rgb(var(--primary-200) / <alpha-value>)',
          300: 'rgb(var(--primary-300) / <alpha-value>)',
          400: 'rgb(var(--primary-400) / <alpha-value>)',
          500: 'rgb(var(--primary-500) / <alpha-value>)',
          600: 'rgb(var(--primary-600) / <alpha-value>)',
          700: 'rgb(var(--primary-700) / <alpha-value>)',
          800: 'rgb(var(--primary-800) / <alpha-value>)',
          900: 'rgb(var(--primary-900) / <alpha-value>)',
          950: 'rgb(var(--primary-950) / <alpha-value>)',
        },
        surface: {
          50: 'rgb(var(--surface-50) / <alpha-value>)',
          100: 'rgb(var(--surface-100) / <alpha-value>)',
          200: 'rgb(var(--surface-200) / <alpha-value>)',
          300: 'rgb(var(--surface-300) / <alpha-value>)',
          400: 'rgb(var(--surface-400) / <alpha-value>)',
          500: 'rgb(var(--surface-500) / <alpha-value>)',
          600: 'rgb(var(--surface-600) / <alpha-value>)',
          700: 'rgb(var(--surface-700) / <alpha-value>)',
          800: 'rgb(var(--surface-800) / <alpha-value>)',
          900: 'rgb(var(--surface-900) / <alpha-value>)',
          950: 'rgb(var(--surface-950) / <alpha-value>)',
        },
        amber: { 50: 'rgb(var(--amber-50) / <alpha-value>)', 100: 'rgb(var(--amber-100) / <alpha-value>)', 200: 'rgb(var(--amber-200) / <alpha-value>)', 300: 'rgb(var(--amber-300) / <alpha-value>)', 400: 'rgb(var(--amber-400) / <alpha-value>)', 500: 'rgb(var(--amber-500) / <alpha-value>)', 600: 'rgb(var(--amber-600) / <alpha-value>)', 700: 'rgb(var(--amber-700) / <alpha-value>)', 800: 'rgb(var(--amber-800) / <alpha-value>)', 900: 'rgb(var(--amber-900) / <alpha-value>)', 950: 'rgb(var(--amber-950) / <alpha-value>)' },
        emerald: { 50: 'rgb(var(--emerald-50) / <alpha-value>)', 100: 'rgb(var(--emerald-100) / <alpha-value>)', 200: 'rgb(var(--emerald-200) / <alpha-value>)', 300: 'rgb(var(--emerald-300) / <alpha-value>)', 400: 'rgb(var(--emerald-400) / <alpha-value>)', 500: 'rgb(var(--emerald-500) / <alpha-value>)', 600: 'rgb(var(--emerald-600) / <alpha-value>)', 700: 'rgb(var(--emerald-700) / <alpha-value>)', 800: 'rgb(var(--emerald-800) / <alpha-value>)', 900: 'rgb(var(--emerald-900) / <alpha-value>)', 950: 'rgb(var(--emerald-950) / <alpha-value>)' },
        rose: { 50: 'rgb(var(--rose-50) / <alpha-value>)', 100: 'rgb(var(--rose-100) / <alpha-value>)', 200: 'rgb(var(--rose-200) / <alpha-value>)', 300: 'rgb(var(--rose-300) / <alpha-value>)', 400: 'rgb(var(--rose-400) / <alpha-value>)', 500: 'rgb(var(--rose-500) / <alpha-value>)', 600: 'rgb(var(--rose-600) / <alpha-value>)', 700: 'rgb(var(--rose-700) / <alpha-value>)', 800: 'rgb(var(--rose-800) / <alpha-value>)', 900: 'rgb(var(--rose-900) / <alpha-value>)', 950: 'rgb(var(--rose-950) / <alpha-value>)' },
        violet: { 50: 'rgb(var(--violet-50) / <alpha-value>)', 100: 'rgb(var(--violet-100) / <alpha-value>)', 200: 'rgb(var(--violet-200) / <alpha-value>)', 300: 'rgb(var(--violet-300) / <alpha-value>)', 400: 'rgb(var(--violet-400) / <alpha-value>)', 500: 'rgb(var(--violet-500) / <alpha-value>)', 600: 'rgb(var(--violet-600) / <alpha-value>)', 700: 'rgb(var(--violet-700) / <alpha-value>)', 800: 'rgb(var(--violet-800) / <alpha-value>)', 900: 'rgb(var(--violet-900) / <alpha-value>)', 950: 'rgb(var(--violet-950) / <alpha-value>)' },
        blue: { 50: 'rgb(var(--blue-50) / <alpha-value>)', 100: 'rgb(var(--blue-100) / <alpha-value>)', 200: 'rgb(var(--blue-200) / <alpha-value>)', 300: 'rgb(var(--blue-300) / <alpha-value>)', 400: 'rgb(var(--blue-400) / <alpha-value>)', 500: 'rgb(var(--blue-500) / <alpha-value>)', 600: 'rgb(var(--blue-600) / <alpha-value>)', 700: 'rgb(var(--blue-700) / <alpha-value>)', 800: 'rgb(var(--blue-800) / <alpha-value>)', 900: 'rgb(var(--blue-900) / <alpha-value>)', 950: 'rgb(var(--blue-950) / <alpha-value>)' },
        slate: { 50: 'rgb(var(--slate-50) / <alpha-value>)', 100: 'rgb(var(--slate-100) / <alpha-value>)', 200: 'rgb(var(--slate-200) / <alpha-value>)', 300: 'rgb(var(--slate-300) / <alpha-value>)', 400: 'rgb(var(--slate-400) / <alpha-value>)', 500: 'rgb(var(--slate-500) / <alpha-value>)', 600: 'rgb(var(--slate-600) / <alpha-value>)', 700: 'rgb(var(--slate-700) / <alpha-value>)', 800: 'rgb(var(--slate-800) / <alpha-value>)', 900: 'rgb(var(--slate-900) / <alpha-value>)', 950: 'rgb(var(--slate-950) / <alpha-value>)' },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};

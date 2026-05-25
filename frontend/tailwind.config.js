import containerQueries from '@tailwindcss/container-queries'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        xs: '360px',
      },
      colors: {
        primary: {
          50:  '#f0faf3',
          100: '#ddf3e5',
          200: '#b8e5c8',
          300: '#87d0a5',
          400: '#51b47e',
          500: '#2d9760',
          600: '#1f7a4d',
          700: '#1a623e',
          800: '#174f33',
          900: '#14402b',
        },
        neutral: {
          50:  '#fafaf9',
          100: '#f4f4f3',
          200: '#e8ece9',
          300: '#d1d8d3',
          400: '#9aa39d',
          500: '#6c756f',
          600: '#5a655e',
          700: '#404a44',
          800: '#262c28',
          900: '#1a201c',
        },
        warning: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
        },
        danger: {
          50:  '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
        },
        success: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
        },
        info: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        display:    ['2rem',     { lineHeight: '2.5rem',  letterSpacing: '-0.02em', fontWeight: '600' }],
        headline:   ['1.5rem',   { lineHeight: '2rem',    letterSpacing: '-0.01em', fontWeight: '600' }],
        title:      ['1.125rem', { lineHeight: '1.625rem' }],
        body:       ['0.9375rem',{ lineHeight: '1.375rem' }],
        'body-sm':  ['0.8125rem',{ lineHeight: '1.25rem' }],
        label:      ['0.8125rem',{ lineHeight: '1rem',    fontWeight: '500' }],
        caption:    ['0.6875rem',{ lineHeight: '0.875rem' }],
      },
      spacing: {
        'safe-t': 'env(safe-area-inset-top)',
        'safe-b': 'env(safe-area-inset-bottom)',
        'safe-l': 'env(safe-area-inset-left)',
        'safe-r': 'env(safe-area-inset-right)',
      },
      borderRadius: {
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(26 32 28 / 0.04)',
        sm: '0 1px 3px 0 rgb(26 32 28 / 0.06), 0 1px 2px -1px rgb(26 32 28 / 0.04)',
        md: '0 4px 8px -2px rgb(26 32 28 / 0.08), 0 2px 4px -2px rgb(26 32 28 / 0.04)',
        lg: '0 12px 24px -6px rgb(26 32 28 / 0.12), 0 4px 8px -4px rgb(26 32 28 / 0.06)',
      },
      transitionTimingFunction: {
        'out-quint': 'cubic-bezier(0.2, 0, 0, 1)',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        slideUp: {
          from: { transform: 'translateY(100%)' },
          to:   { transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.8s linear infinite',
        'slide-up': 'slideUp 0.2s cubic-bezier(0.2, 0, 0, 1)',
        'fade-in': 'fadeIn 0.18s ease-out',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.2, 0, 0, 1)',
      },
    },
  },
  plugins: [
    containerQueries,
  ],
}

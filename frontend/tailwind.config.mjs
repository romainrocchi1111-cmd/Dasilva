import plugin from 'tailwindcss/plugin';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#f8f9fb',
          surface: '#ffffff',
          surface2: '#f1f4f8',
        },
        border: {
          subtle: '#e2e8f0',
        },
        primary: {
          DEFAULT: '#2563eb',
          hover: '#1d4ed8',
        },
        secondary: {
          DEFAULT: '#6366f1',
        },
        accent: {
          DEFAULT: '#0891b2',
        },
        success: '#059669',
        warning: '#d97706',
        error: '#dc2626',
        text: {
          primary: '#0f172a',
          secondary: '#475569',
          muted: '#94a3b8',
        },
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [
    plugin(function ({ addUtilities }) {
      addUtilities({
        '.card': {
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          transition: 'box-shadow 0.2s, border-color 0.2s',
        },
        '.card:hover': {
          'box-shadow': '0 4px 12px rgba(0,0,0,0.08)',
        },
      });
    }),
  ],
};

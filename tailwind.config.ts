import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/hooks/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Deep night blues — the base of the SolStreak dark aesthetic.
        night: {
          950: '#050510',
          900: '#0A0A1A',
          800: '#101024',
          700: '#181836',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-inter)', 'sans-serif'],
      },
      boxShadow: {
        'glow-violet': '0 0 40px -8px rgba(139, 92, 246, 0.45)',
        'glow-amber': '0 0 40px -8px rgba(251, 146, 60, 0.5)',
        'glow-emerald': '0 0 40px -10px rgba(16, 185, 129, 0.45)',
        card: '0 0 0 1px rgba(255, 255, 255, 0.04), 0 24px 60px -24px rgba(0, 0, 0, 0.85)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        float: 'float 7s ease-in-out infinite',
        'scale-in': 'scaleIn 0.25s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.85)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;

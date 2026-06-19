import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    colors: {
      background: 'var(--background)',
      foreground: 'var(--foreground)',
      accent: 'var(--accent)',
      card: 'var(--card)',
      'card-foreground': 'var(--card-foreground)',
      'accept-bg': 'var(--accept-bg)',
      'accept-fg': 'var(--accept-fg)',
      'hold-bg': 'var(--hold-bg)',
      'hold-fg': 'var(--hold-fg)',
      'reject-bg': 'var(--reject-bg)',
      'reject-fg': 'var(--reject-fg)',
      muted: 'var(--muted)',
      'muted-foreground': 'var(--muted-foreground)',
      white: '#ffffff',
      transparent: 'transparent',
    },
    borderRadius: {
      lg: '1rem',
      xl: '0.75rem',
      full: '9999px',
    },
    boxShadow: {
      sm: '0 2px 8px rgba(0, 0, 0, 0.08)',
      md: '0 4px 16px rgba(0, 0, 0, 0.12)',
      lg: '0 8px 24px rgba(232, 67, 42, 0.12)',
    },
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      devanagari: ['Noto Sans Devanagari', 'system-ui', 'sans-serif'],
    },
  },
  plugins: [],
}

export default config

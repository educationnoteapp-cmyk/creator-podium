import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#4F46E5',
        secondary: '#7C3AED',
        success: '#059669',
        background: '#0A0A0F',
        surface: '#13131A',
        border: '#24242F',
        'text-main': '#F1F0FF',
        muted: '#6B6B8A',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'pulse': 'pulse-dot 1.5s ease-in-out infinite',
      },
      backdropBlur: {
        xl: '20px',
      }
    },
  },
  plugins: [],
}
export default config

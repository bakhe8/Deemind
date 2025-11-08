import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#0046ff',
        accent: '#35b9a6',
        surface: '#f5f7fb',
        slate: {
          950: '#020617'
        }
      }
    }
  },
  plugins: []
} satisfies Config;

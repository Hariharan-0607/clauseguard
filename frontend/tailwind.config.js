/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // map utility classes to the Slate Mono CSS variables so they follow the theme
        navy: 'var(--text)',
        ink: 'var(--text)',
        mute: 'var(--text-3)',
        brand: {
          DEFAULT: 'var(--primary)',
          600: 'var(--secondary)',
          50: 'var(--highlight)'
        },
        teal: 'var(--accent)',
        line: 'var(--border)',
        surface: 'var(--surface)',
        card: 'var(--card)'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif']
      }
    }
  },
  plugins: []
}

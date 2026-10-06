import type { Config } from 'tailwindcss';

// Colors map to the theme CSS variables (defined in src/themes/*/palette.css),
// so no hex lives here. A different theme swaps the variables, not this file.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        panel: 'var(--panel)',
        divider: 'var(--divider)',
        ink: 'var(--text)',
        'ink-dim': 'var(--text-secondary)',
        accent: 'var(--accent)',
        'accent-ink': 'var(--accent-text)',
        bone: 'var(--bone)',
        'card-face': 'var(--card-face)',
        'peg-a': 'var(--peg-a)',
        'peg-b': 'var(--peg-b)',
        'peg-c': 'var(--peg-c)',
      },
      fontFamily: {
        title: ['"Alfa Slab One"', 'serif'],
        body: ['Barlow', 'system-ui', 'sans-serif'],
        num: ['"Barlow Condensed"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;

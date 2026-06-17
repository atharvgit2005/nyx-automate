import type { Config } from 'tailwindcss';
const config: Config = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        "surface-container-lowest": "#08080a",
        "surface-container-low": "#121214",
        "surface-container": "#161619",
        "surface-container-high": "#1d1d22",
        "surface-dim": "#0e0e10",
        "surface": "#08080a",
        "primary": "#ff5c33",
        "primary-container": "#e8431a",
        "on-primary": "#ffffff",
        "on-primary-fixed": "#2a0d04",
        "secondary": "#ff8a4c",
        "secondary-container": "#c2330f",
        "on-secondary": "#2a0d04",
        "tertiary": "#76dc83",
        "tertiary-container": "#3da452",
        "on-surface": "#fafafa",
        "on-surface-variant": "#a1a1aa",
        "outline": "#3f3f46",
        "outline-variant": "#27272a",
        "editorial-pink": "#F2A7C3",
        "ink-black": "#000000",
        "ember": "#ff5c33",
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        sm: "0.375rem",
        md: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
        full: "9999px",
      },
      fontFamily: {
        headline: ["Space Grotesk", "sans-serif"],
        body: ["Work Sans", "sans-serif"],
        label: ["Space Grotesk", "sans-serif"],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
};
export default config;

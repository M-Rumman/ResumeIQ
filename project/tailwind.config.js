/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Montserrat', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Overlock', 'ui-serif', 'Georgia', 'serif'],
      },
      colors: {
        base: '#DDE1E7',
        accent: '#a0aeca',
        cta: '#b97a88',
        'btn-primary': '#8495b8',
        ink: {
          DEFAULT: '#1A2035',
          secondary: '#2c333d',
          muted: '#6d7988',
        },
      },
      borderRadius: {
        neu: '10px',
        glass: '16px',
        modal: '24px',
      },
    },
  },
  plugins: [],
};

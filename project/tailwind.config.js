/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'Montserrat', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        base: '#FFFFFF',
        accent: '#FF6B00',
        'accent-orange': '#FF6B00',
        'accent-orange-hover': '#E66000',
        'accent-orange-light': '#FFF0E6',
        cta: '#FF6B00',
        'btn-primary': '#FF6B00',
        ink: {
          DEFAULT: '#1A1C20',
          secondary: '#2c333d',
          muted: '#6B7280',
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

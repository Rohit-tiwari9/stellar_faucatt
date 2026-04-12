/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
        body: ['var(--font-body)', 'sans-serif'],
      },
      colors: {
        stellar: {
          50:  '#f0f4ff',
          100: '#dde6ff',
          200: '#b3caff',
          300: '#80a8ff',
          400: '#5482ff',
          500: '#3461f5',
          600: '#1f43e8',
          700: '#1832cc',
          800: '#1629a5',
          900: '#172682',
        },
        cosmic: {
          900: '#07081a',
          800: '#0d1030',
          700: '#111647',
          600: '#1a2060',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-stellar': 'linear-gradient(135deg, #07081a 0%, #0d1447 50%, #07081a 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s infinite linear',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'spin-slow': 'spin 8s linear infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px #3461f5, 0 0 10px #3461f5' },
          '100%': { boxShadow: '0 0 20px #3461f5, 0 0 40px #3461f5, 0 0 60px #1f43e8' },
        },
      },
      boxShadow: {
        'glow-blue': '0 0 20px rgba(52, 97, 245, 0.4), 0 0 40px rgba(52, 97, 245, 0.2)',
        'glow-green': '0 0 20px rgba(16, 185, 129, 0.4)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.4)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

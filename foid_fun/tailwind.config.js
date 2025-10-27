/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        fluent: {
          purple: '#a960ee',
          pink:   '#ff4ecd',
          blue:   '#00d4ff',
        },
      },
      backgroundImage: {
        // solid gradient utility if you want to use it directly
        'gradient-fluent':
          'linear-gradient(135deg, #a960ee 0%, #ff4ecd 50%, #00d4ff 100%)',
        noise: 'url("/noise.png")',
        // optional subtle neon radials (matches globals.css var look)
        'fluent-neon':
          'radial-gradient(60% 80% at 10% 0%, rgba(169,96,238,0.25) 0%, rgba(169,96,238,0) 60%), radial-gradient(70% 80% at 90% 10%, rgba(255,78,205,0.22) 0%, rgba(255,78,205,0) 60%), radial-gradient(80% 80% at 50% 100%, rgba(0,212,255,0.18) 0%, rgba(0,212,255,0) 60%)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['Menlo', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        // use with `shadow-card`
        card:
          '0 1px 2px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03) inset',
      },
      borderRadius: {
        '2xl': '1rem',
      },
      // optional: gentle ribbon animation you can apply to gradient elements
      keyframes: {
        ribbon: {
          '0%, 100%': { transform: 'translateY(0) scale(1)' },
          '50%': { transform: 'translateY(-2%) scale(1.01)' },
        },
      },
      animation: {
        ribbon: 'ribbon 8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

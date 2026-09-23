/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        'temple': {
          'gold': '#D4AF37',
          'gold-light': '#F3E5AB',
          'gold-dark': '#996515',
          'maroon': '#800000',
          'maroon-light': '#A52A2A',
          'cream': '#FFFDD0',
          'saffron': '#FF9933',
        }
      }
    },
  },
  plugins: [],
}

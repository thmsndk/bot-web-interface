/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "selector",
  content: ["./public/index.html", "./public/**/*.{html,js}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"IBM Plex Sans"',
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

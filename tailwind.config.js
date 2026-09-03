/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        accent: "#e07c30",
        background: {
          light: "#171717",
          dark: "#0a0a0a",
          pure: "#000000"
        }
      },
      fontFamily: {
        satoshi: ["Satoshi-Regular"],
        satoshiMedium: ["Satoshi-Medium"],
        satoshiBold: ["Satoshi-Bold"],
      }
    },
  },
  plugins: [],
}
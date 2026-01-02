/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // جعلنا خط Cairo هو الخط الافتراضي (sans)
        sans: ['Cairo', 'sans-serif'],
        // خط إضافي احتياطي
        ibm: ['IBM Plex Sans Arabic', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
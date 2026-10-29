import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves the site from /aakaar-studio/ (the deploy workflow sets GITHUB_PAGES);
// everywhere else (dev, Vercel) it lives at the domain root.
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES ? '/aakaar-studio/' : '/',
})

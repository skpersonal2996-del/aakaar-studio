import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // The 3D scene (three.js and friends) is one lazy chunk of about 1.1 MB, loaded behind the intro; that's expected.
  build: { chunkSizeWarningLimit: 1200 },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Production builds are served from github.io/aakaar-studio/; dev stays at /.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/aakaar-studio/' : '/',
}))

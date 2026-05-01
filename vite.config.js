import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Use relative asset paths so the built app works
  // when hosted under a subpath (e.g., GitHub Pages).
  base: './',
  plugins: [react(), tailwindcss()],
})

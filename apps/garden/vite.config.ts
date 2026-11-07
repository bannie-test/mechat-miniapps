import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base './' so the bundle works from any host path (Pages, VPS sub-folder, object storage).
export default defineConfig({
  base: './',
  plugins: [vue()],
  server: { port: 5174 },
})

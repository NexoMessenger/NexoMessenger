import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' keeps the build portable for GitHub Pages (future deployment)
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: '0.0.0.0', port: 5173, allowedHosts: true,
    // Dev only: proxy API/WS to the own-server backend (node server/index.mjs).
    proxy: { '/api': 'http://localhost:8080', '/ws': { target: 'ws://localhost:8080', ws: true } },
  },
  preview: { host: '0.0.0.0', port: 5173, allowedHosts: true },
})

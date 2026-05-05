import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// COOP/COEP headers required so the OHIF iframe can use SharedArrayBuffer
// (cornerstone3D's streaming volume loader needs SAB for MPR/3D rendering).
// Without these, MPR/3D viewports silently fall back to stack and look 2D.
const crossOriginIsolationHeaders = {
  name: 'cross-origin-isolation-headers',
  configureServer(server) {
    server.middlewares.use((_req, res, next) => {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
      next()
    })
  },
  configurePreviewServer(server) {
    server.middlewares.use((_req, res, next) => {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
      next()
    })
  },
}

export default defineConfig({
  plugins: [react(), crossOriginIsolationHeaders],
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
})

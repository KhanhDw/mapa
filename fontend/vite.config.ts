import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    allowedHosts: ['.ngrok-free.app', '.ngrok.app'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/panoramas': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/tileserver': {
        target: 'http://127.0.0.1:7800',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tileserver/, ''),
      },
      '/satellite/tiles': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(/^\/satellite\/tiles/, '/tiles/satellite'),
      },
      '/tiles': {
        target: 'http://127.0.0.1:8088',
        changeOrigin: true,
      },
    },
  },
})
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const backend = env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'
  const useNgrok = env.VITE_USE_NGROK === 'true'

  return {
    plugins: [react()],

    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,

      allowedHosts: [
        '.ngrok-free.app',
        '.ngrok.app',
        '.ngrok-free.dev',
        '.ngrok.dev',
      ],

      ...(useNgrok && {
        hmr: {
          protocol: 'wss',
          clientPort: 443,
        },
      }),

      proxy: {
        '/api': {
          target: backend,
          changeOrigin: true,
        },

        '/health': {
          target: backend,
          changeOrigin: true,
        },

        '/panoramas': {
          target: backend,
          changeOrigin: true,
        },

        '/user-media': {
          target: backend,
          changeOrigin: true,
        },

        '/basemap': {
          target: backend,
          changeOrigin: true,
        },

        '/mvt': {
          target: backend,
          changeOrigin: true,
        },

        '/tiles': {
          target: backend,
          changeOrigin: true,
        },
      },
    },
  }
})
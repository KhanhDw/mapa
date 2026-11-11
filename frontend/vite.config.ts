import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load các biến môi trường từ file .env[cite: 5]
  const env = loadEnv(mode, process.cwd(), '')

  let backend = env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';

  return {
    plugins: [react()],

    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,

      // Hệ thống Proxy trung chuyển
      proxy: {
        '/api': { target: backend, changeOrigin: true, secure: false },
        '/health': { target: backend, changeOrigin: true, secure: false },
        '/panoramas': { target: backend, changeOrigin: true, secure: false },
        '/user-media': { target: backend, changeOrigin: true, secure: false },
        '/basemap': { target: backend, changeOrigin: true, secure: false },
        '/mvt': { target: backend, changeOrigin: true, secure: false },
        '/tiles': { target: backend, changeOrigin: true, secure: false },
        '/streetview': { target: backend, changeOrigin: true, secure: false },
        '/point_info': { target: backend, changeOrigin: true, secure: false },
        '/search': { target: backend, changeOrigin: true, secure: false },
        '/contribute': { target: backend, changeOrigin: true, secure: false },
        '/electric_poles': { target: backend, changeOrigin: true, secure: false },
      },
    },
  }
})
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load các biến môi trường từ file .env[cite: 3]
  const env = loadEnv(mode, process.cwd(), '')

  const backend = env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';

  return {
    plugins: [react()],

    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,

      // Hệ thống Proxy trung chuyển
      proxy: {
        // Gom tất cả các gọi API qua prefix /api (bao gồm /api/mvt, /api/tiles, /api/search,...)
        '/api': { 
          target: backend, 
          changeOrigin: true, 
          secure: false 
        },
        // Health check endpoint
        '/health': { 
          target: backend, 
          changeOrigin: true, 
          secure: false 
        },
        // Static assets từ backend
        '/panoramas': { 
          target: backend, 
          changeOrigin: true, 
          secure: false 
        },
        '/user-media': { 
          target: backend, 
          changeOrigin: true, 
          secure: false 
        },
      },
    },
  }
})
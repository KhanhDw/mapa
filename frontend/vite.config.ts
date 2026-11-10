import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load các biến môi trường từ file .env
  const env = loadEnv(mode, process.cwd(), '')

  // 1. Tự động xác định backend: 
  // Ưu tiên 1: Biến môi trường VITE_BACKEND_URL
  // Ưu tiên 2: Nếu có VITE_NGROK_URL hoặc dùng ngrok
  // Mặc định cuối cùng: http://127.0.0.1:8000 (Localhost)
  let backend = env.VITE_BACKEND_URL || env.VITE_NGROK_URL || 'http://127.0.0.1:8000';
  const useNgrok = env.VITE_USE_NGROK === 'true' || backend.includes('ngrok');

  // Tự động bypass trang cảnh báo Ngrok nếu URL là domain ngrok
  const proxyHeaders = backend.includes('ngrok')
    ? { 'ngrok-skip-browser-warning': 'true' }
    : {}

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

      ...(useNgrok
        ? {
          hmr: {
            protocol: 'wss',
            clientPort: 443,
          },
        }
        : {}),

      // Giữ nguyên hệ thống Proxy trung chuyển
      proxy: {
        '/api': { target: backend, changeOrigin: true, secure: false, headers: proxyHeaders },
        '/health': { target: backend, changeOrigin: true, secure: false, headers: proxyHeaders },
        '/panoramas': { target: backend, changeOrigin: true, secure: false, headers: proxyHeaders },
        '/user-media': { target: backend, changeOrigin: true, secure: false, headers: proxyHeaders },
        '/basemap': { target: backend, changeOrigin: true, secure: false, headers: proxyHeaders },
        '/mvt': { target: backend, changeOrigin: true, secure: false, headers: proxyHeaders },
        '/tiles': { target: backend, changeOrigin: true, secure: false, headers: proxyHeaders },
        '/streetview': { target: backend, changeOrigin: true, secure: false, headers: proxyHeaders },
        '/point_info': { target: backend, changeOrigin: true, secure: false, headers: proxyHeaders },
        '/search': { target: backend, changeOrigin: true, secure: false, headers: proxyHeaders },
        '/contribute': { target: backend, changeOrigin: true, secure: false, headers: proxyHeaders },
        '/electric_poles': { target: backend, changeOrigin: true, secure: false, headers: proxyHeaders },
      },
    },
  }
})
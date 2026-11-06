import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load các biến môi trường từ file .env
  const env = loadEnv(mode, process.cwd(), '')

  // Backend ngrok hoặc localhost
  const backend = env.VITE_BACKEND_URL;// || 'http://127.0.0.1:8000'
  const useNgrok = env.VITE_USE_NGROK === 'true'

  // Tự động bypass trang cảnh báo Ngrok nếu backend là domain ngrok
  const proxyHeaders = backend.includes('ngrok')
    ? { 'ngrok-skip-browser-warning': 'true' }
    : {}

  return {
    plugins: [react()],

    server: {
      host: '0.0.0.0', // Mở cổng để truy cập được từ điện thoại/máy khác qua LAN hoặc Ngrok
      port: 5173,
      strictPort: true,

      // Cho phép các domain ngrok truy cập vào Vite Dev Server (bắt buộc từ Vite 6+)
      allowedHosts: [
        '.ngrok-free.app',
        '.ngrok.app',
        '.ngrok-free.dev',
        '.ngrok.dev',
      ],

      // Cấu hình WebSocket (HMR) giữ kết nối live-reload khi mở FE qua HTTPS Ngrok
      ...(useNgrok
        ? {
          hmr: {
            protocol: 'wss',
            clientPort: 443,
          },
        }
        : {}),

      // Hệ thống Proxy trung chuyển về Backend
      proxy: {
        // 1. API chung (tự động gọt tiền tố /api khi đẩy sang FastAPI)
        '/api': {
          target: backend,
          changeOrigin: true,
          secure: false,
          headers: proxyHeaders,
          // rewrite: (path) => path.replace(/^\/api/, ''),
        },

        // 2. Health check
        '/health': {
          target: backend,
          changeOrigin: true,
          secure: false,
          headers: proxyHeaders,
        },

        // 3. Static Media (Ảnh 360 Panoramas & Ảnh người dùng upload)
        '/panoramas': {
          target: backend,
          changeOrigin: true,
          secure: false,
          headers: proxyHeaders,
        },
        '/user-media': {
          target: backend,
          changeOrigin: true,
          secure: false,
          headers: proxyHeaders,
        },

        // 4. Map Tiles từ Versatiles & pg_tileserv
        '/basemap': {
          target: backend,
          changeOrigin: true,
          secure: false,
          headers: proxyHeaders,
        },
        '/mvt': {
          target: backend,
          changeOrigin: true,
          secure: false,
          headers: proxyHeaders,
        },
        '/tiles': {
          target: backend,
          changeOrigin: true,
          secure: false,
          headers: proxyHeaders,
        },

        // 5. Các router nghiệp vụ nếu gọi trực tiếp
        '/streetview': { target: backend, changeOrigin: true, secure: false, headers: proxyHeaders },
        '/point_info': { target: backend, changeOrigin: true, secure: false, headers: proxyHeaders },
        '/search': { target: backend, changeOrigin: true, secure: false, headers: proxyHeaders },
        '/contribute': { target: backend, changeOrigin: true, secure: false, headers: proxyHeaders },
        '/electric_poles': { target: backend, changeOrigin: true, secure: false, headers: proxyHeaders },
      },
    },
  }
})
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const backend = 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react()],

  server: {
    host: '127.0.0.1',

    allowedHosts: [
      '.ngrok-free.app',
      '.ngrok.app',
      '.ngrok-free.dev',
      '.ngrok.dev',
    ],

    // Dùng khi truy cập frontend qua ngrok HTTPS.
    // Nếu chỉ chạy localhost, hãy bỏ cấu hình hmr này.
    hmr: {
      protocol: 'wss',
      clientPort: 443,
    },

    proxy: {
      // FastAPI
      '/api': {
        target: backend,
        changeOrigin: true,
      },

      // Ảnh panorama
      '/panoramas': {
        target: backend,
        changeOrigin: true,
      },

      // Ảnh POI do người dùng tải lên
      '/user-media': {
        target: backend,
        changeOrigin: true,
      },

      // pg_tileserv
      '/tileserver': {
        target: 'http://127.0.0.1:7800',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tileserver/, ''),
      },

      // Versatiles: satellite
      '/satellite/tiles': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(/^\/satellite\/tiles/, '/tiles/satellite'),
      },

      // Giữ nếu dự án còn sử dụng dịch vụ tile ở cổng 8088
      '/tiles': {
        target: 'http://127.0.0.1:8088',
        changeOrigin: true,
      },
    },
  },
})
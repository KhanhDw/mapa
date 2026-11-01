import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const backend = 'http://127.0.0.1:8000'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const useNgrok = env.VITE_USE_NGROK === 'true'

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      allowedHosts: [
        '.ngrok-free.app',
        '.ngrok.app',
        '.ngrok-free.dev',
        '.ngrok.dev',
      ],
      ...(useNgrok && {
        hmr: { protocol: 'wss', clientPort: 443 },
      }),
      proxy: {
        '/api': { target: backend, changeOrigin: true },
        '/health': { target: backend, changeOrigin: true },
        '/panoramas': { target: backend, changeOrigin: true },
        '/user-media': { target: backend, changeOrigin: true },
        '/basemap': { target: backend, changeOrigin: true },
        '/mvt': { target: backend, changeOrigin: true },

        // Chọn 1 trong 2:
        // A) Đi qua backend (đúng spec §8)
        '/tiles': { target: backend, changeOrigin: true },
        // B) Shortcut pg_tileserv (nhanh hơn, dev-only)
        // '/tiles': {
        //   target: 'http://127.0.0.1:7800',
        //   changeOrigin: true,
        //   rewrite: (path) => path.replace(/^\/tiles/, ''),
        // },
      },
    },
  }
})
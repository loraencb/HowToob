import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget =
    env.VITE_BACKEND_PROXY_TARGET ||
    env.VITE_API_BASE_URL ||
    'http://localhost:5000'

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/auth': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/videos': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/social': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/users': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/admin': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: true,
    },
  }
})

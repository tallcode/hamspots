import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/sse': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // SSE 需要禁用缓冲和超时
        timeout: 0,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq) => {
            // 设置不缓冲的请求头
            proxyReq.setHeader('Connection', 'keep-alive')
            proxyReq.setHeader('Cache-Control', 'no-cache')
          })
          proxy.on('proxyRes', (proxyRes, req, res) => {
            // 确保响应头正确设置
            proxyRes.headers['cache-control'] = 'no-cache'
            proxyRes.headers['content-type'] = 'text/event-stream'
            proxyRes.headers.connection = 'keep-alive'
            proxyRes.headers['x-accel-buffering'] = 'no'
            // 立即将头部发送到客户端
            if (!res.headersSent) {
              res.writeHead(proxyRes.statusCode || 200, proxyRes.headers)
            }
          })
          proxy.on('proxyReqWs', (proxyReq, req, socket) => {
            socket.on('error', console.error)
          })
        },
      },
    },
  },
})

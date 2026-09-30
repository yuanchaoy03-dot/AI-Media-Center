import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // 插件让 Vite 能处理 .vue 文件。
  plugins: [vue()],
  // 开发时：AuthForm.vue → auth Store → authService.ts → http.ts → Axios → /api → Vite proxy → Spring Boot。
  // 浏览器先请求 Vite 的 /api/auth/login；proxy 转发到 http://127.0.0.1:8080/api/auth/login，保留 /api。
  // 这是开发服务器的代理配置；打包后的部署环境需要另外把 /api 路由到后端。
  server: { proxy: { '/api': 'http://127.0.0.1:8080' } },
})

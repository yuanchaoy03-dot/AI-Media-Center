import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'

// 前端从这里启动：创建 App，装上路由，再挂到 index.html 中 id 为 app 的元素里。
createApp(App).use(router).mount('#app')

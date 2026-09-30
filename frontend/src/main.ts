import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import { pinia } from './stores/index'

// 先注册共享 Pinia，再注册 Router（会触发首次导航），最后挂载页面。
createApp(App).use(pinia).use(router).mount('#app')

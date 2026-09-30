import { createPinia } from 'pinia'

// 应用只创建这一份 Pinia。Router / service 在组件外显式传入它，
// 不依赖 main.ts 是否已经执行 app.use(pinia)，也不会误用其他 active Pinia。
export const pinia = createPinia()

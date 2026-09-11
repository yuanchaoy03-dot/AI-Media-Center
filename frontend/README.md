# Vue 3 + TypeScript + Vite

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about the recommended Project Setup and IDE Support in the [Vue Docs TypeScript Guide](https://vuejs.org/guide/typescript/overview.html#project-setup).

## 页面与路由

- `src/router/index.ts` 使用 Vue Router 4 与 `createWebHistory` 定义路由，页面按需加载。
- `src/views/` 存放完整页面；`App.vue` 只保留布局与 `RouterView`。
- 新增页面时，在 `views/` 创建页面并在路由表注册；需要侧栏入口时再更新 `AppSidebar.vue` 的菜单数据。
- 侧栏按路由记录高亮，嵌套子路由会保留父级入口的选中态。未来独立的电影、合集详情路由应在实现时明确所属导航，不依靠路径字符串前缀猜测。
- 用户入口目前仅显示未实现提示，不代表登录或账号功能。

开发运行 `npm run dev`，构建运行 `npm run build`，本地查看构建结果运行 `npm run preview`。

使用 History 模式部署时，静态服务器需要将非静态资源的前端路径回退到 `index.html`，使 `/library` 等地址支持直接访问和刷新；业务 API 不应走此回退。本次未添加部署配置。参见 [Vue Router History 模式说明](https://router.vuejs.org/guide/essentials/history-mode.html)。

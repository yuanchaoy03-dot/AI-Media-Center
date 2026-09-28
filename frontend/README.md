# Vue 3 + TypeScript + Vite

项目正式前端入口。文档职责与按需导航见 [项目文档索引](../docs/README.md)。

Learn more about the recommended Project Setup and IDE Support in the [Vue Docs TypeScript Guide](https://vuejs.org/guide/typescript/overview.html#project-setup).

## 页面与路由

- `src/router/index.ts` 使用 Vue Router 4 与 `createWebHistory` 定义路由，页面按需加载。
- `src/views/` 存放完整页面；`App.vue` 只保留布局与 `RouterView`。
- 新增页面时，在 `views/` 创建页面并在路由表注册；需要侧栏入口时再更新 `AppSidebar.vue` 的菜单数据。
- 侧栏按路由记录高亮，嵌套子路由会保留父级入口的选中态。电影、合集等详情路由应明确所属导航，不依靠路径字符串前缀猜测。
- `/login`、`/register` 共用 `AuthForm.vue`，默认接入真实注册/登录。受保护路由验证身份后才展示个人页面；侧栏展示当前用户名，退出清除当前标签页登录态。
- Token 仅保存在 `sessionStorage`。刷新先调用 `/api/auth/me`；网络失败保留 Token 并允许重试，401/账号禁用清除身份。未完成旧请求在退出、账号切换后不能回填数据。
- `/media-sources` 接入本人空来源查询，区分加载、失败和成功空状态。添加来源、非空来源 DTO 及其他个人页面尚未接入；正常运行不显示示例收藏。

开发运行 `npm run dev`，构建运行 `npm run build`。Vite 开发服务器将 `/api` 代理到 `http://127.0.0.1:8080`；正式部署与构建预览需要提供同源 `/api` 反向代理。

已有片库/电影/合集/搜索和媒体来源完整 Mock 页面保留为显式开发预览。在 PowerShell 中执行 `$env:VITE_MOCK_PREVIEW = 'true'` 后运行 `npm run dev`；关闭预览需移除该环境变量并重启 Vite。此开关仅在开发模式生效，生产始终走真实路径。预览不调用认证接口、不创建登录态；媒体来源列表实现保存在 `MediaSourcesPreviewView.vue`。Mock 的刷新重置、模拟连接和扫描规则保持不变，预览中不要输入真实凭据。

前端回归：在本目录使用 Node.js 24 运行 `node --test tests/authService.test.mjs tests/mediaSourceService.test.mjs tests/mediaSourcesView.test.mjs`，覆盖会话恢复/失效/竞态、错误与空状态区分及原有 Mock 目录扫描规则。单独类型检查使用 `npx vue-tsc -b`；当前未配置独立 lint 脚本。

## 本地后端与集成测试

Spring Boot 需要 `DB_URL`、`DB_USERNAME`、`DB_PASSWORD` 和 `JWT_SECRET`，示例见 [backend/.env.example](../backend/.env.example)。JWT_SECRET 必须是至少 32 字节安全随机数的 Base64 文本；实际值只放在被忽略的本地配置或部署环境中，轮换会使旧 Token 失效。本机已配置的 PowerShell 启动方式：

```powershell
Set-Location E:\AI-Media-Center\backend
. .\.env.local.ps1
.\mvnw.cmd spring-boot:run
```

`AuthHttpIntegrationTest` 使用真实 MySQL 和随机 HTTP 端口。运行前准备独立、可丢弃且名称以 `_auth_test` 结尾的数据库，设置 `AUTH_TEST_DB_URL`、`AUTH_TEST_DB_USERNAME`、`AUTH_TEST_DB_PASSWORD` 后执行 `.\mvnw.cmd test`；测试自行生成临时签名密钥，清理该测试库的用户和来源。未设置测试 URL 时明确跳过，不能把普通 package 成功视为已执行集成测试。不要指向开发库或生产库。

使用 History 模式部署时，静态服务器需要将非静态资源的前端路径回退到 `index.html`，使 `/library` 等地址支持直接访问和刷新；业务 API 不应走此回退。本次未添加部署配置。参见 [Vue Router History 模式说明](https://router.vuejs.org/guide/essentials/history-mode.html)。

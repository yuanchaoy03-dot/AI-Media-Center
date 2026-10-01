# Personal Cinema 前端

项目正式前端入口。文档职责与按需导航见 [项目文档索引](../docs/README.md)。

当前基础技术栈：Vue 3、TypeScript、Vue Router、Pinia、Axios、Vite、ESLint、Prettier 和原生 CSS。ESLint 用于代码质量检查，Prettier 用于代码格式统一；两者仅为开发辅助工具，现有 Pinia 认证 Store、Router、Service 和 Axios 分层保持不变。

Learn more about the recommended Project Setup and IDE Support in the [Vue Docs TypeScript Guide](https://vuejs.org/guide/typescript/overview.html#project-setup).

## 开发命令与检查

使用 Node.js 24，在 `frontend` 目录执行 `npm ci` 安装 lockfile 中的依赖，再按需运行下列独立命令：

| 命令                   | 职责                                            |
| ---------------------- | ----------------------------------------------- |
| `npm run dev`          | 启动 Vite 开发服务器                            |
| `npm run build`        | 先执行 `vue-tsc -b`，再执行 Vite 生产构建       |
| `npm run preview`      | 预览已有生产构建                                |
| `npm test`             | 使用 Node 内建测试运行器执行现有前端回归        |
| `npx vue-tsc -b`       | 单独执行 Vue / TypeScript 类型检查              |
| `npm run lint`         | 检查 JavaScript、TypeScript 和 Vue 代码质量     |
| `npm run lint:fix`     | 执行 ESLint 支持的自动修复；完成后仍需审查 diff |
| `npm run format`       | 使用 Prettier 格式化本目录内支持的文件          |
| `npm run format:check` | 只检查格式，不写入文件                          |

### ESLint 与 Prettier

- [eslint.config.js](eslint.config.js) 是唯一 ESLint 配置，采用 Flat Config。使用 JavaScript / TypeScript 推荐基础规则和 Vue 3 essential 规则，支持 `.ts`、`.vue` 和 `<script setup lang="ts">`；浏览器源码与 Vite / Node 配置、现有 `.mjs` 测试分别使用对应 globals。基于现有 tsconfig 的 `projectService` 额外检查未处理的 Promise、Promise 误用和无效 `await`，不启用整套严格或风格规则。
- [.prettierrc.json](.prettierrc.json) 是唯一 Prettier 配置，保持无分号、单引号和 100 字符目标行宽。[.prettierignore](.prettierignore) 排除 `node_modules`、`dist`、`dist-ssr`、`coverage`、`.vite`、类型构建缓存及自动生成的 `package-lock.json`；根目录文档、后端和 HTML 原型不属于本目录格式化命令的范围。
- `eslint-config-prettier` 放在 ESLint 配置末尾关闭冲突的格式规则；Prettier 使用独立命令，不通过 ESLint 插件执行。参考 [Vue 插件 Flat Config 指引](https://eslint.vuejs.org/user-guide/)与 [Prettier 集成说明](https://prettier.io/docs/integrating-with-linters)。
- Vue 模板事件连续执行多条语句时，使用明确的函数块，例如 `() => { ... }`，或已有命名处理函数；避免内联语句的分号被格式化移除后，Vue 编译器将其当作单个表达式解析。本次仅在电影详情和来源详情的 3 处事件采用函数块，动作与执行顺序保持一致。

### 本次验证（2026-10-01）

| 检查                   | 实际结果                  |
| ---------------------- | ------------------------- |
| `npm run lint`         | 通过，0 错误、0 警告      |
| `npm run format:check` | 通过                      |
| `npm test`             | 56 项通过，0 失败、0 跳过 |
| `npm run build`        | 类型检查与生产构建通过    |
| `npx vue-tsc -b`       | 通过                      |

ESLint 首轮未发现需修复的业务代码问题，未添加 `eslint-disable`。格式变化覆盖已有 Vue、TypeScript、CSS、测试和 `tsconfig.json`；除上述 3 处等价事件语法调整外，源码及测试均与原文件的 Prettier 输出一致。规则探针与 ESLint / Prettier 冲突检查通过；现有依赖版本、认证生命周期、HTTP 配置与业务行为保持不变。未运行新的浏览器验收或后端集成测试；完整进度与验证限制见 [PROJECT_STATUS.md](../PROJECT_STATUS.md)。

## 页面与路由

- `src/router/index.ts` 使用 Vue Router 4 与 `createWebHistory` 定义路由，页面按需加载。
- `src/views/` 存放完整页面；`App.vue` 只保留布局与 `RouterView`。
- 新增页面时，在 `views/` 创建页面并在路由表注册；需要侧栏入口时再更新 `AppSidebar.vue` 的菜单数据。
- 侧栏按路由记录高亮，嵌套子路由会保留父级入口的选中态。电影、合集等详情路由应明确所属导航，不依靠路径字符串前缀猜测。
- `/login`、`/register` 共用 `AuthForm.vue`，默认接入真实注册/登录。受保护路由验证身份后才展示个人页面；侧栏展示当前用户名，退出清除当前标签页登录态。
- Token 仅保存在 `sessionStorage`。刷新先调用 `/api/auth/me`；网络失败保留 Token 并允许重试，401/账号禁用清除身份。未完成旧请求在退出、账号切换后不能回填数据。
- `/media-sources` 接入本人空来源查询，区分加载、失败和成功空状态。添加来源、非空来源 DTO 及其他个人页面尚未接入；正常运行不显示示例收藏。

开发运行 `npm run dev`，构建运行 `npm run build`。Vite 开发服务器将 `/api` 代理到 `http://127.0.0.1:8080`；正式部署与构建预览需要提供同源 `/api` 反向代理。

真实请求统一由 `src/services/http.ts` 的 `request<T>(path, options)` 调用 Axios instance：`baseURL: '/api'`、15 秒超时、`withCredentials: false`，原生 `signal` 透传。业务层只接收响应包裹的 `data` 或项目 `ApiError`；非 2xx 保留后端状态、错误码与字段错误，网络/超时/协议异常转换为 `REQUEST_FAILED`。Token 由认证 Store 按请求传入，公开注册/登录不注入旧身份；受保护请求经 Store 的 `authenticatedRequest` Action 处理退出取消与账号切换竞态。后端响应的 `Cache-Control: no-store` 继续负责禁止缓存，开发代理保持同源，无需新增 CORS。

已有片库/电影/合集/搜索和媒体来源完整 Mock 页面保留为显式开发预览。在 PowerShell 中执行 `$env:VITE_MOCK_PREVIEW = 'true'` 后运行 `npm run dev`；关闭预览需移除该环境变量并重启 Vite。此开关仅在开发模式生效，生产始终走真实路径。预览不调用认证接口、不创建登录态；媒体来源列表实现保存在 `MediaSourcesPreviewView.vue`。Mock 的刷新重置、模拟连接和扫描规则保持不变，预览中不要输入真实凭据。

前端回归：在本目录使用 Node.js 24 运行 `npm test`（`node --test tests/*.test.mjs`），覆盖会话恢复/失效/竞态、错误与空状态区分及原有 Mock 目录扫描规则。`authStore.test.mjs` 执行真实 Pinia Action 与 App/AuthForm/正式来源页 setup，仅替换 Axios adapter、DOM 生命周期和导航；`authRouting.test.mjs` 执行真实路由守卫、会话监听及 main 插件注册，使用 memory history 检查初始化、刷新和 Mock Preview。`httpTransport.test.mjs` 使用本机随机端口与真实 Axios HTTP adapter，检查 URL、错误解析、取消和实际 15 秒超时，因此整套测试约需 15 秒。这些前端测试不访问 MySQL，不替代下面的 Spring Boot 集成测试。单独类型检查使用 `npx vue-tsc -b`；代码质量与格式检查使用上方独立脚本，不替代回归测试。

## 共享状态与请求分工

- `src/stores/index.ts` 创建应用唯一的 Pinia instance；`main.ts` 先 `.use(pinia)` 再 `.use(router)`。组件在 setup 中调用 `useAuthStore()`；Router 和业务 service 在组件外显式调用 `useAuthStore(pinia)`，不依赖 active Pinia 的时机。
- 当前只有 `src/stores/auth.ts` 的 `auth` Setup Store。返回的 ref 是 State，函数是 Action，后续确需派生值时使用 computed 作为 Getter。当前用户、epoch、验证状态、Token 存在标记及认证提示均由此 Store 管理；JWT、并发恢复 Promise 和 AbortController 集合属于该实例的运行时细节。
- Store 负责登录/注册/恢复/退出的会话生命周期与受保护请求的身份隔离；`src/services/authService.ts` 只负责三个认证 API 和关键响应校验，不保存全局状态、不导入 Store；`http.ts` 负责 Axios 传输与统一错误。`ownedSourceService.ts` 经认证 Store 调用 HTTP，再校验来源列表。
- JWT 只写入 `sessionStorage`，没有持久化插件；刷新只恢复 Token 存在标记，通过 `/auth/me` 后才设置可信用户。退出/账号切换取消认证及受保护业务请求；网络失败保留 Token，明确未认证或账号禁用才清会话，epoch 防止旧响应影响新身份。
- 表单、页面加载状态保持局部；Mock Preview 的演示状态和行为保持原样。后续媒体源、片库、收藏或播放器出现实际跨页面共享需求时再新增 Store，不预建空壳。

## 本地后端与集成测试

Spring Boot 需要 `DB_URL`、`DB_USERNAME`、`DB_PASSWORD` 和 `JWT_SECRET`，示例见 [backend/.env.example](../backend/.env.example)。JWT_SECRET 必须是至少 32 字节安全随机数的 Base64 文本；实际值只放在被忽略的本地配置或部署环境中，轮换会使旧 Token 失效。本机已配置的 PowerShell 启动方式：

```powershell
Set-Location E:\AI-Media-Center\backend
. .\.env.local.ps1
.\mvnw.cmd spring-boot:run
```

`AuthHttpIntegrationTest` 使用真实 MySQL 和随机 HTTP 端口。运行前准备独立、可丢弃且名称以 `_auth_test` 结尾的数据库，设置 `AUTH_TEST_DB_URL`、`AUTH_TEST_DB_USERNAME`、`AUTH_TEST_DB_PASSWORD` 后执行 `.\mvnw.cmd test`；测试自行生成临时签名密钥，清理该测试库的用户和来源。未设置测试 URL 时明确跳过，不能把普通 package 成功视为已执行集成测试。不要指向开发库或生产库。

使用 History 模式部署时，静态服务器需要将非静态资源的前端路径回退到 `index.html`，使 `/library` 等地址支持直接访问和刷新；业务 API 不应走此回退。本次未添加部署配置。参见 [Vue Router History 模式说明](https://router.vuejs.org/guide/essentials/history-mode.html)。

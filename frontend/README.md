# Personal Cinema 前端

项目正式前端入口。文档职责与按需导航见 [项目文档索引](../docs/README.md)。

当前基础技术栈：Vue 3、TypeScript、Vue Router、Pinia、Axios、Vite、ESLint、Prettier 和原生 CSS。ESLint 用于代码质量检查，Prettier 用于代码格式统一；两者仅为开发辅助工具，现有 Pinia 认证 Store、Router、Service 和 Axios 分层保持不变。

TypeScript 工程与 IDE 配置可参考 [Vue 官方指南](https://vuejs.org/guide/typescript/overview.html#project-setup)。

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

- [eslint.config.js](eslint.config.js) 是唯一 ESLint 配置，采用 Flat Config。使用 JavaScript / TypeScript 推荐基础规则和 Vue 3 essential 规则，支持 `.ts`、`.vue` 和 `<script setup lang="ts">`；TypeScript 推荐配置的各子配置统一匹配 `.ts` / `.vue`，避免合法声明被 JavaScript 核心规则误报。浏览器源码与 Vite / Node 配置、现有 `.mjs` 测试分别使用对应 globals。基于现有 tsconfig 的 `projectService` 额外检查未处理的 Promise、Promise 误用和无效 `await`，不启用整套严格或风格规则。
- [.prettierrc.json](.prettierrc.json) 是唯一 Prettier 配置，保持无分号、单引号和 100 字符目标行宽。[.prettierignore](.prettierignore) 排除 `node_modules`、`dist`、`dist-ssr`、`coverage`、`.vite`、类型构建缓存及自动生成的 `package-lock.json`；根目录文档、后端和 HTML 原型不属于本目录格式化命令的范围。
- `eslint-config-prettier` 放在 ESLint 配置末尾关闭冲突的格式规则；Prettier 使用独立命令，不通过 ESLint 插件执行。参考 [Vue 插件 Flat Config 指引](https://eslint.vuejs.org/user-guide/)与 [Prettier 集成说明](https://prettier.io/docs/integrating-with-linters)。
- Vue 模板事件连续执行多条语句时，使用明确的函数块，例如 `() => { ... }`，或已有命名处理函数；避免内联语句的分号被格式化移除后，Vue 编译器将其当作单个表达式解析。

已执行的验证结果、日期与验收限制统一见 [PROJECT_STATUS.md](../PROJECT_STATUS.md)。本文件维护命令与使用说明，不重复记录每轮迁移或清理过程。

## 页面与路由

- `src/router/index.ts` 使用 Vue Router 4 与 `createWebHistory` 定义路由，页面按需加载。
- `src/views/` 存放完整页面；`App.vue` 只保留布局与 `RouterView`。
- 新增页面时，在 `views/` 创建页面并在路由表注册；需要侧栏入口时再更新 `AppSidebar.vue` 的菜单数据。
- 侧栏按路由记录高亮，嵌套子路由会保留父级入口的选中态。电影、合集等详情路由应明确所属导航，不依靠路径字符串前缀猜测。
- `/login`、`/register` 共用 `AuthForm.vue`，默认接入真实注册/登录。受保护路由验证身份后才展示个人页面；侧栏展示当前用户名，退出清除当前标签页登录态。
- Token 仅保存在 `sessionStorage`。刷新先调用 `/api/auth/me`；网络失败保留 Token 并允许重试，401/账号禁用清除身份。未完成旧请求在退出、账号切换后不能回填数据。
- `/media-sources` 接入本人空/非空来源查询、真实 WebDAV 连接测试、首次新增、已保存来源只读目录浏览及影片文件夹选择 / 整批保存；区分加载、失败、成功空状态与列表。新增加密保存后留在列表，刷新仍可见；“浏览目录”弹窗支持逐层查看目录和文件、返回上级及失败重试。“选择 / 修改影片文件夹”复用同一目录布局，草稿取消不写入，保存后刷新仍保留，根查询失败不显示为未配置。关闭 / 导航 / 会话变化取消旧请求；来源页可主动扫描、查询持久任务与分页未识别资源，刷新回读；扫描根独立启停、编辑删除、影片识别和其他个人页面尚未接入，正常运行不显示示例收藏。

Vite 开发服务器将 `/api` 代理到 `http://127.0.0.1:8080`；正式部署与构建预览需要提供同源 `/api` 反向代理。

真实请求统一由 `src/services/http.ts` 的 `request<T>(path, options)` 调用 Axios instance：`baseURL: '/api'`、15 秒超时、`withCredentials: false`，原生 `signal` 透传。可选 `method` 支持扫描范围的 PUT；未指定时保留无正文 GET / 有正文 POST 的既有行为。业务层只接收响应包裹的 `data` 或项目 `ApiError`；非 2xx 保留后端状态、错误码与字段错误，网络/超时/协议异常转换为 `REQUEST_FAILED`。Token 由认证 Store 按请求传入，公开注册/登录不注入旧身份；受保护请求经 Store 的 `authenticatedRequest` Action 处理退出取消与账号切换竞态。后端响应的 `Cache-Control: no-store` 继续负责禁止缓存，开发代理保持同源，无需新增 CORS。

已有片库/电影/合集/搜索和媒体来源完整 Mock 页面保留为显式开发预览。在 PowerShell 中执行 `$env:VITE_MOCK_PREVIEW = 'true'` 后运行 `npm run dev`；关闭预览需移除该环境变量并重启 Vite。此开关仅在开发模式生效，生产始终走真实路径。预览不调用认证接口、不创建登录态；即使 sessionStorage 留有 Token，也不展示身份恢复入口或调用 `/api/auth/me`，保留 Token 供切回正常模式后重新验证。媒体来源列表实现保存在 `MediaSourcesPreviewView.vue`。Mock 的刷新重置、模拟连接和扫描规则保持不变，预览中不要输入真实凭据。

前端回归：在本目录使用 Node.js 24 运行 `npm test`（`node --test tests/*.test.mjs`），覆盖会话恢复/失效/竞态、错误与空状态区分、真实扫描传输 / 轮询 / 资源分页 / 取消隔离及原有 Mock 目录扫描规则。`authStore.test.mjs` 执行真实 Pinia Action 与 App/AuthForm/正式来源页 setup，仅替换 Axios adapter、DOM 生命周期和导航；`authRouting.test.mjs` 执行真实路由守卫、会话监听及 main 插件注册，使用 memory history 检查初始化、刷新和 Mock Preview。`httpTransport.test.mjs` 使用本机随机端口与真实 Axios HTTP adapter，检查 URL、错误解析、取消和实际 15 秒超时，因此整套测试约需 15 秒。组件 setup 回归不渲染 DOM；这些前端测试不访问 MySQL，不替代浏览器验收或下面的 Spring Boot 集成测试。单独类型检查使用 `npx vue-tsc -b`；代码质量与格式检查使用上方独立脚本，不替代回归测试。

## 共享状态与请求分工

- [stores/index.ts](src/stores/index.ts) 创建共享 Pinia instance；`main.ts` 先注册 Pinia 再注册 Router，组件外显式传入同一实例。
- [stores/auth.ts](src/stores/auth.ts) 管理会话、受保护请求、取消与旧响应隔离；表单及页面加载状态保持局部。学习 Setup Store 的阅读顺序见 [前端学习资料](../docs/learning/前端学习顺序.md#六pinia先学当前认证-store-用到的内容)。
- [authService.ts](src/services/authService.ts) 负责认证 API 和响应校验，[http.ts](src/services/http.ts) 负责传输与统一错误，[ownedSourceService.ts](src/services/ownedSourceService.ts) 校验本人来源响应；接口与 JWT 规则见 [API.md](../docs/API.md#身份与-jwt-生命周期)，长期模块职责见 [开发规范](../docs/开发规范与模块边界.md#30-vue-3--vite--typescript开发规范)。

## 本地后端与集成测试

准备 JDK 21 与 MySQL 数据库，按 [backend/.env.example](../backend/.env.example) 设置 `DB_URL`、`DB_USERNAME`、`DB_PASSWORD`、`JWT_SECRET` 与 `MEDIA_SOURCE_ENCRYPTION_KEY`；示例文件不会被 Spring Boot 自动加载。JWT_SECRET 为至少 32 字节安全随机数的 Base64，来源加密密钥为独立的、恰好 32 字节随机数的 Base64；实际值只放在被忽略的本地配置或部署环境中。JWT 密钥轮换会使旧 Token 失效；来源密钥须与数据库备份一起安全保存，丢失或直接替换会使已保存来源不可读，当前未实现在线轮换。缺少来源密钥不阻止认证或空列表，但新增和非空列表返回 `503 SOURCE_CONFIG_UNAVAILABLE`。配置完成后，从仓库根目录执行：

```powershell
Set-Location backend
.\mvnw.cmd spring-boot:run
```

本机凭据保存在被 Git 忽略的 `backend/.env.local.ps1`，包含开发环境变量和 `AUTH_TEST_DB_*` 测试凭据。该文件只存在于本地，不随 Git 克隆；在本机启动后端或进行数据库测试前，从仓库根目录执行以下命令加载到当前 PowerShell 会话，实际密码和密钥不要打印或复制到提交内容中：

```powershell
. ./backend/.env.local.ps1
```

可选的私人 WebDAV 长期联调配置也放在同一本地文件中，变量为 `WEBDAV_DEV_ADDRESS`、`WEBDAV_DEV_USERNAME`、`WEBDAV_DEV_PASSWORD`。后续真实来源联调先加载该文件，从环境变量读取连接，检查时只报告变量是否存在，不输出实际值；真实地址、账号和密码不写入代码、fixture 或文档。这些变量仅供显式联调使用，当前应用不会自动读取它们或创建媒体来源，默认自动回归仍使用下述临时服务与独立测试库。

用户确认的真实测试目录清单保存在本地 `test-data/webdav/movie-directories.json`，已被 Git 忽略，不随仓库克隆提供。该文件按网盘记录来源内父路径、保留的一级目录名、排除相对路径和扫描根展开规则；核对日期与验证范围以本地文件为准。清单只供显式真实联调参考，不自动创建来源、配置扫描范围或执行扫描，也不作为默认自动回归的远程依赖。它记录目录存在与用户选择，不代表目录内视频已经识别或可播放；网盘内容变化后需重新核对。

使用时，普通扫描根为 `basePath + '/' + includedDirectoryNames` 中的对应名称；某名称存在于 `scanRootExpansions` 时，须改用 `basePath + '/' + 名称 + '/' + 子目录名`，不选择该父目录。例如“蜘蛛侠”展开为 11 个子目录，以避开“暗影蜘蛛侠”。`excludedRelativePaths` 相对于 `basePath`，仅记录本清单的选择规则；当前扫描递归遍历所选根，不支持提交排除路径，不能直接扫描两处“影视资源”父目录来实现排除。

展开后共 40 个候选扫描根（百度网盘 34 个、迅雷云盘 6 个）。实际扫描经正式页面 / Spring Boot 执行；同一来源最多 32 个根，需按测试目的选择子集或分批。保存范围是整批替换，上一批任务结束后再保存下一批，不把后续保存当作增量追加；契约见 [API 扫描范围](../docs/API.md#查询--整批保存本人来源的扫描范围)。

`AuthHttpIntegrationTest` 使用真实 MySQL 和随机 HTTP 端口，同时启动本机临时 WebDAV HTTP 服务验证首次新增。运行前准备独立、可丢弃且名称以 `_auth_test` 结尾的数据库，设置 `AUTH_TEST_DB_URL`、`AUTH_TEST_DB_USERNAME`、`AUTH_TEST_DB_PASSWORD` 后执行 `.\mvnw.cmd test`；测试自行生成临时签名与加密密钥，清理该测试库的用户和来源。未设置测试 URL 时明确跳过，不能把普通 package 成功视为已执行集成测试。不要指向开发库或生产库。

来源测试支持匿名 / Basic 认证、HTTP(S) 与地址自身目录验证，不跟随重定向；请填写最终 WebDAV 目录地址。默认总时限 8000ms，可用 `MEDIA_SOURCE_CONNECTION_TIMEOUT_MS` 设置 100–15000ms；完整认证兼容范围和限制见 [API.md](../docs/API.md#测试未保存的-webdav-连接--新增本人来源)。

已保存来源的目录浏览也只经过 Spring Boot，使用 `Depth:1` 读取直接子项；目录 XML 上限 1 MiB、子项上限 2000，超限明确报错，不递归或截断成完整列表。浏览不会保存扫描范围或创建资源，真实来源目录不能通过开发 Mock 预览验收；契约见 [API 目录浏览](../docs/API.md#浏览本人已保存来源的目录)。扫描范围另经 GET / PUT 查询与整批保存，保存时用有界 `Depth:0` 验证目标目录，刷新后回读 MySQL；取消不写入、保存不自动扫描，见 [API 扫描范围](../docs/API.md#查询--整批保存本人来源的扫描范围)。

使用 History 模式部署时，静态服务器需要将非静态资源的前端路径回退到 `index.html`，使 `/library` 等地址支持直接访问和刷新；业务 API 不应走此回退。参见 [Vue Router History 模式说明](https://router.vuejs.org/guide/essentials/history-mode.html)。

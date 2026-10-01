# PROJECT STATUS

- 最后更新时间：2026-10-01

## 当前状态

- 前端 ESLint / Prettier 已接入：当前基础技术栈为 Vue 3、TypeScript、Vue Router、Pinia、Axios、Vite、ESLint、Prettier 与原生 CSS。唯一配置为 `frontend/eslint.config.js`（Flat Config）、`.prettierrc.json` 与 `.prettierignore`；新增独立 `npm run lint`、`npm run lint:fix`、`npm run format`、`npm run format:check`。ESLint 检查代码质量，Prettier 统一格式，工具仅作为 devDependencies，不改变 Pinia / Service / Axios / Router 业务架构；原有 dev、build、preview、test 脚本及已安装依赖版本保持不变。复审已统一 TypeScript 推荐配置各子块的 `.ts` / `.vue` 匹配范围，避免合法 Vue TypeScript 重载及类型 / 值同名声明被核心规则误报。
- 本次代码审查：ESLint 首轮无需修复真实业务问题，未添加 disable；47 个已有源码、测试及类型配置文件只有 Prettier 格式变化和 3 处等价事件语法调整。电影详情与来源详情的多语句内联事件改为明确函数块，解决无分号格式下的 Vue 编译解析问题，已验证动作、顺序和返回值一致。JWT sessionStorage、`/auth/me` 恢复、epoch stale 防护、AbortController、并发恢复、Axios `/api` / 15 秒 timeout、Router 守卫、Mock Preview 与正式来源请求语义保持不变；后端、HTML 原型、API 契约及数据库未修改。
- 本次最终验证：`npm run lint` 0 错误 / 0 警告，`npm run format:check` 通过，`npm test` 56 项通过 / 0 失败 / 0 跳过，`npm run build` 与 `npx vue-tsc -b` 通过；Vue / TypeScript / Node 规则探针与 ESLint / Prettier 冲突检查通过。相关技术栈、命令和规范文档已同步；本轮未运行浏览器验收或后端集成测试，未执行 Git commit / push。
- Pinia 认证迁移完成：仅新增 `auth` Setup Store 与应用共享 Pinia instance，认证状态、JWT 生命周期、epoch、取消与并发恢复均归 Store；`authService.ts` 改为无状态认证 API/响应校验。App、认证表单、Router 和本人来源 service 已迁移；组件外显式传入 Pinia，main 先注册 Pinia 再注册 Router。登录/注册也纳入会话取消集合，取消的注册不会触发旧表单跳转；未预建其他业务 Store。
- Pinia 迁移验证（上一轮）：`npm test` 56 项通过、0 跳过，`npm run build` 与 `npx vue-tsc -b` 通过。保留全部原有回归，新增 Store 状态归属、并发恢复、Token 保留/失效、账号切换与旧请求取消/竞态，以及真实组件 setup、路由守卫、首次插件注册和 Mock Preview 回归。静态依赖及遗留认证状态检查通过；该轮未运行后端集成测试或浏览器实测，HTTP 配置、Vite 代理、API/数据库与后端实现未改。
- Axios 传输层保持现有契约：`request<T>` 使用统一 instance 的 `/api`、15 秒超时和原生 AbortSignal；保留 API 包裹解析、ApiError、按请求传入 Bearer Token。受保护请求现经 auth Store 的 `authenticatedRequest<T>`，公开认证不带旧 Token，退出/切换账号保留 stale 防护。后端源码、Vite 代理、API 契约与数据库 migration 均未改动；Mock 模块仅统一格式，数据与行为保持不变。
- Axios 迁移验证（上一轮）：`npm run build`、36 项前端 Node 测试通过（含真实 Axios HTTP 传输、15 秒超时与取消）；最初无测试环境变量时 Maven test/package 的 2 项集成测试跳过。随后使用本次新建的独立 `axios_20260929_auth_test` MySQL 8.4.8 库运行 `.\mvnw.cmd clean package`，重新编译、打包成功，`AuthHttpIntegrationTest` 2 项实际通过、0 跳过。真实 `request → Axios → Vite /api → Spring Boot → MySQL` 验证注册/登录/me/来源及 201/200/400/401/403/409/500/501；内置 Chromium 完成 Vue 注册、登录、刷新身份恢复、空来源及退出检查，无捕获 error/warn。故障注入仅发生在专用测试库；普通开发库未用于本次验证。未测试生产反向代理或分别复测 Edge/Chrome；现有 Flyway MySQL 版本提示保留。
- 注册 → 登录 → CurrentUser → 本人空来源的真实联调已完成。默认 Vue 运行使用 Spring Boot HTTP；下列目录管理、影片及扫描 Mock 记录仅适用于显式开发预览，未接入的正式个人页面显示尚未开放。
- “选择影片文件夹”弹窗改用 `+` / check-circle / caret-right 表达可选、已选或已包含、可进入；上级包含使用淡化勾选与 title / aria-label，取消常驻重复说明，部分选择简化为“已选其中 N 个”。ScanRoot、enabled、保存及扫描规则未变；Edge 已核对直接/部分选择、上级覆盖后进入、末级文件与父目录替换确认。
- 媒体来源列表的“立即扫描”现原地启动 Mock 扫描，不先进入来源详情；运行时卡片显示“扫描中”，再次打开菜单显示“查看扫描”，点击后进入详情并定位最近扫描。未选择影片文件夹或全部暂停时，相应菜单入口进入详情并定位影片文件夹区域。
- 影片文件夹浏览现使用显式 `directory` / `file` Mock 条目，所有文件夹仍可逐层进入；末级可只读显示 Mock 目录中的视频、图片等文件，使用 video / file 图标。文件不能进入、不能选为 ScanRoot，也不参与路径规则；ScanRoot 互斥、enabled、保存 reconciliation 和 ScanTask rootPaths 快照未变，仍无真实 WebDAV / 后端接入。
- 影片文件夹选择 UX 已去技术化：详情与各选择入口改为“选择/更改影片文件夹”，弹窗区分“当前文件夹”整体选择和“里面的文件夹”局部选择；随上级选中、整体替换确认、暂停/恢复扫描均改为普通用户文案。仅改展示文案与轻量层级，不改变 ScanRoot 路径规则、草稿保存、启停或 ScanTask。类型检查、构建、16 项相关回归通过；Edge 检查进入/选择分离、整体替换确认和上级覆盖状态，900×500 CSS 视口核对弹窗边界和页面无横向溢出，未做系统级 Windows scaling 验证。
- 媒体来源目录管理更新：目录行内选择与进入分离，草稿包含已有根（含停用根），取消不写入；保存按 membership 保留既有 id / enabled。MediaScanRoot 禁止重复及祖先/后代重叠，父目录经确认替换全部已选下级，兄弟目录可并存；扫描启动防御校验并保持 rootPaths 快照。仍为 Frontend Mock，无真实 WebDAV / HTTP。
- 上一轮目录管理验证：类型检查、构建、16 项 Node 服务/路径/组件回归及 diff 检查通过；现有 Edge 实测进入与选择分离、兄弟并存、父目录确认替换、覆盖子目录浏览、取消不保存、保存更新及停用根仍选中。实测 CSS 视口 900×500、1366/1440/1600/1920×900 无弹窗横向溢出且底部可达，检查短窗口和1440px截图；未捕获 error/warn。未单独验证 Chrome 或改变系统级 Windows scaling，无项目依赖变更。

- 透明度规则统一：账号菜单取消系统减少透明度自动降级；搜索、筛选/排序、影片菜单、海报按钮及详情操作补齐显式减少透明度和无滤镜回退，默认材质与业务逻辑不变。内置 Chromium 实测系统减少透明度为true时仍保留默认玻璃；显式属性测试发现并修正Vue scoped全局选择器写法，认证、片库组件及详情操作均成功关闭模糊，清除测试属性后恢复。类型检查、构建及diff检查通过，未捕获浏览器error日志；无滤镜能力分支仅源码审查，未在不支持滤镜的浏览器实测。

仅在恢复任务、判断下一步或核对实现程度时读取。项目范围和工作规则见 [AGENTS.md](AGENTS.md)，契约状态见 [API.md](docs/API.md)；本文件不定义新的产品决策。

- 当前阶段：Spring Boot 真实认证与新用户空来源查询已联调；`users` V1、`media_source` V2 已在开发库执行。真实 WebDAV、个人片库、FastAPI 和播放器尚未接入。
- 当前前端切片状态：登录/注册及媒体来源空列表使用真实 HTTP；片库、筛选排序、合集、搜索、电影详情和完整来源操作保留在显式开发 Mock 预览。默认个人路径不注入 fixture，未接入页面显示尚未开放；主页等未完整迁移页面不能按 HTML 原型完成度计为 Vue 完成。
- 数据库迁移：`V2__create_media_source.sql` 已落实最小来源字段、非空用户归属、限制删除外键和非唯一用户索引；独立 MySQL 8.4.8 实测全新库迁移与 V1 升级通过。开发库已升级至 V2 并复检，认证联调结束时 `users` 与 `media_source` 仍均为 0 行。
- 后端实现：Java 21、Spring Boot 4.0.8、MyBatis、MySQL 与 Flyway；已实现四个认证/本人来源接口及统一错误包裹。Spring Security 验证 JWT 后每次读取账号状态与角色，禁用返回 403。新增 `JWT_SECRET` 环境配置，本机安全随机签名密钥保存在被 Git 忽略的 `backend/.env.local.ps1`；未新增依赖。运行和测试方式见 frontend/README.md。
- 数据库与契约：注册使用 PBKDF2-HMAC-SHA256 完整密码散列，账号时间以 UTC 写入；V1/V2 无需修改。认证三个接口与来源空列表已为 implemented；非空来源暂返回 `501 SOURCE_LIST_NOT_READY`，不伪装空列表。来源保存、密文格式、密钥管理及其他 WebDAV DTO 仍待下一切片落实。
- ID 规范：注册已接入统一 `BusinessIds.next()` 生成小写标准 UUIDv7，`users.id` 保持 `CHAR(36)`；API ID 仍是不透明字符串。
- 迁移验证：在 `backend` 目录运行 `.\mvnw.cmd -q package` 通过；Spring Boot 首次启动执行 V1，第二次启动校验通过且无重复迁移。MySQL 8.4 实测默认 `USER` / `ACTIVE`，重复用户名及非法用户名、角色、状态被拒绝；验证插入均已回滚，表仍为空。Flyway 启动时提示当前 MySQL 8.4 高于其已验证的 8.1 版本，但迁移和复检成功。
- V2 验证：后端 package 通过；独立 MySQL 8.4.8 使用项目依赖中的 Flyway 完成 30 项迁移/约束检查，覆盖全新 V1+V2、已有 V1 升级且保留用户、重复执行无新增迁移、两种路径表结构一致、无默认数据、一用户多来源/同名来源、按用户筛选、外键/删除限制及非法类型/启用值/空配置拒绝。约束测试数据已回滚；这些 SQL 检查不代表 HTTP 身份隔离已实现。现有 Flyway 的 MySQL 版本提示及 `TINYINT(1)` 显示宽度弃用提示不影响本次验证，字段沿用已确定设计。
- 媒体来源 Vue：正式 `/media-sources` 通过可信当前用户加载空列表，区分加载、失败和空状态，最近扫描/入库不回退 Mock；添加来源暂显示未开放。完整原型迁移保留为 `MediaSourcesPreviewView.vue` 与来源详情 Mock，通过开发模式的 `VITE_MOCK_PREVIEW=true` 显式启用，生产不启用预览。
- 媒体来源验证：内置 Chromium 完成 1366/1440/1600/1920px 与 900×500 的同内容 HTML/Vue 几何对照，检查列表、详情及短窗口弹窗截图；覆盖添加/必填/测试失败与成功/修改失效、0/1/多根、全停用/部分启用、目录取消/保存/移除、扫描运行/完成、删除/空列表、非法 ID/返回及菜单外部/滚动/resize 关闭。服务回归覆盖范围快照、扫描门槛、删除取消任务与连接中断 failed；failed 的浏览器展示及显式减少透明度/减少动效分支仅源码检查，未单独验证 Edge 或系统级 Windows scaling。
- 媒体来源原切片检查：`npx vue-tsc -b`、`npm run build`、7 项 Node 服务回归和 tracked/untracked diff whitespace 检查通过；未捕获浏览器 error/warn。该切片未新增依赖；当前 lint / format 能力及最新验证见本节开头。原型 `confirm()` 改为原生 `<dialog>` 二次确认；播放反馈沿用“未接入”，未迁移移动 Action Sheet 或自定义焦点代码。
- 登录 / 注册：`/login`、`/register` 已接入真实 HTTP。注册密码下限为 12 个 Unicode 码点，页面在输入前提示 12–128 个字符；注册成功清空密码并回到登录页。登录后保存当前标签页 Token，验证 me 再加载来源。刷新身份失败可重试；401/账号禁用清理并返回登录；退出和账号切换取消旧请求、卸载个人页面，阻止旧响应回填。密码不持久化，侧栏显示真实用户名。
- 登录 / 注册视觉：沿用私人电影收藏背景与深色磨砂认证窗口，参数见 DESIGN 第31节；新增注册成功中性提示和身份验证重试入口。沿用显式减少透明度、无滤镜回退和减少动效，不因系统减少透明度自动降级。
- 认证验证：独立 MySQL 8.4 的两项 HTTP 集成场景通过，覆盖并发重复注册、完整 Unicode 密码、额外输入拒绝、Token 篡改/过期/缺失声明、当前角色复核、禁用账号、本人/他人来源、非空 501 和数据库故障 500。前端 26 项 Node 回归通过（含 7 项认证/请求竞态）；类型检查和构建通过。Edge 完成注册/校验/登录/刷新、来源失败重试、身份恢复重试、禁用跳转、退出及后退检查；1440×900 与 900×500 无横向溢出，截图已检查，无 pageerror。修复了身份清除后旧路由重新挂载覆盖禁用提示的问题。浏览器连接工具启动失败后使用本机 Edge 自动化；未验证系统级 scaling 或真实密码管理器。
- 密码下限调整验证：前端构建和 36 项 Node 回归通过；独立 `_auth_test` MySQL 8.4 库中，后端 3 项 HTTP 集成测试和 1 项长度边界单元测试通过，新增 HTTP 用例覆盖 11 位拒绝、12 位注册及登录。未将测试凭据或测试数据写入开发库。
- 下一步：结合媒体来源 UI draft 确认非空来源 DTO，接入保存/测试本人 WebDAV（含连接配置加密）→ 只读目录浏览 → MediaScanRoot 保存，再接主动扫描；继续 Desktop + Mouse。
- 已知问题 / 限制：仅完成真实认证与空来源闭环；真实来源保存、非空列表、个人片库、播放、版本选择及 AI 尚未接入。开发库未注入测试账号或来源；验收数据使用独立临时 MySQL。公共 Movie 尚未建表，本轮隔离测试未构造公共 Movie 数据。
- 阻塞问题：无。

## 历史里程碑与验证记录

以下保留各切片完成时的记录，**不是现状或下一步指令**。“详情未开放”、早期 Mock 数量、占位路由及“未提交”等描述只代表当时状态；现状以上节及源码为准，提交状态查 Git。无需为恢复当前任务通读历史。

- 最近媒体来源范围决策：WebDAV MediaSource与扫描目录正式分离。添加WebDAV只建立连接，不自动扫描，也不默认选择根目录`/`；连接成功后可浏览来源当前可见的完整目录结构，并选择一个或多个MediaScanRoot。ScanTask只处理本人已启用来源下已配置、已启用的扫描根，目录浏览本身不产生MediaResource。用户后续可随时继续浏览、新增或移除MediaScanRoot，无需重建来源。当前只是产品/架构基线确认，尚未实现Vue、API、数据库或Spring Boot；MediaSourcesView仍为占位页，既有HTML / Mock不代表该规则已实现。
- 最近详情图片 Mock 修正：15 部电影全部配置独立 backdropUrl，与竖版 posterUrl 分离；复用仓库已有横图并补齐 6 部 TMDB 横图，奥本海默改用真正横版素材。取消详情以竖图回退的行为，缺失 / 失败保留深色背景。浏览器逐片验证横图尺寸、与海报的内容哈希差异及横图失败不影响卡片；仍为本地 Mock。
- 最近详情滚动条补齐：按 HTML 原型隐藏电影详情页的文档滚动条，保留鼠标滚轮滚动；使用页面存在条件限定样式，离页自动恢复。Chrome 验证隐藏 / 滚动 / 返回片库恢复通过，build 通过。
- 最近电影详情验证：npm run build 与 git diff --check 通过；Chrome 完成 1366 / 1440 / 1600 / 1920px 同内容原型几何对照及整页截图检查，15 部电影、500px 短窗口、内容架箭头、三个入口、收藏 / 观看状态、简介展开、剧透确认与未接入提示、空片库访问限制、请求失败、非法 ID、缺图、无资源、减少动效 / 透明度和离页背景 / 侧栏材质清理检查通过。未单独验证 Edge 或系统级 Windows scaling；未提交 Git。
- 最近电影详情迁移：新增 `/library/movies/:movieId`，接通片库卡片 / 菜单、合集成员及全局搜索；按 HTML 保留居中首屏、评分、AI 助手、演职员、系列与媒体信息。复用 MovieCard / MovieContextMenu，通过薄 movieDetailService 检查本人 Mock 片库关联，沿用 15 部电影原型元数据及来源对应资源摘要。收藏 / 已看为页面副本状态，播放 / 版本选择 / AI 明确提示未接入；支持加载、失败、无效 ID、缺图与无资源。详情侧栏按对应原型使用独立材质参数，继续保留用户确认的系统减少透明度例外。
- 最近侧栏透明度修正：按用户确认，Vue 侧栏及其搜索 / 选中态不再因系统 prefers-reduced-transparency 自动切为实色，保持 HTML 原型材质；提高对比度、显式减少透明属性、无滤镜回退及账号浮层降级保留。Chrome 模拟普通 / 减少透明两种偏好，侧栏计算背景与模糊参数均与 HTML 一致。
- 范围调整说明：本轮 Windows Desktop + Mouse 确定项收敛已完成，已清理 MovieContextMenu、MovieCard、AppSidebar 和 App 的 Touch / 自定义键盘 / 手动焦点实现；保留桌面窗口适配、原生 HTML 行为、基础 aria、简单 focus-visible 和 reduced-motion。历史审计与原型中的跨端状态仅作为后续参考。
- 已完成：P0范围；服务与模块边界；Redis非P0；公共Movie复用与并发语义；TMDB图片OSS链路；Vue/Mock/配置规范；动态文档治理。
- 最近原型优化：扫描完成态进一步统一首页/电影页的横向内容宽度，提高宽屏空间利用率；保留新增影片海报网格及桌面待处理/异常双列布局。当前仍为前端原型 / Mock阶段，尚未接入真实后端扫描功能。
- 最近电影片库迁移：LibraryView 保存 filters / sort，通过 computed 派生筛选排序结果，复用 MovieCard 和页面级单实例 MovieContextMenu；已补齐筛选无结果与空片库展示分支、清除筛选及结果移除时关闭相关菜单，保留 genre URL 初始化语义。播放、详情和媒体版本操作仍仅记录 intent；未实现真实 API、详情页面或播放器，当前用户片库最小契约仍为 docs/API.md 中的 draft。
- 最近 LibraryToolbar 迁移：仅包含左侧筛选和右侧排序；筛选浮层为 390px 两列，排序浮层为 188px，支持鼠标开关、互斥、外部点击关闭及滚动 / resize 关闭，浮层内部可滚动。类型与来源多选且组内 OR，年份与状态单选，组间 AND；未看严格匹配 unwatched，清除筛选保留排序。默认最近添加降序，支持片名 localeCompare(..., 'zh-CN')、年份降序、最近观看降序和时长降序。Toolbar 仅接收状态 / 选项并发出事件，不读取 Mock 或过滤电影；Vue Shell 使用文档滚动，本次采用普通布局而非 sticky，未修改 Shell。筛选与排序浮层透明样式沿用 HTML 原型，已移除额外实色覆盖；未新增 Mobile / Touch / 自定义 Keyboard、Store 或第三方依赖。
- 最近片库 Mock 补齐：沿用原型扩展至 15 部电影与 15 张本地海报；保留原有 genreLabel 等卡片字段，仅补充 genres、sourceIds、addedAt、lastPlayedAt、runtimeMinutes 及三个本人 WebDAV 来源实例选项。时间为固定 Mock 毫秒时间戳，无播放记录时 lastPlayedAt 为 null；不含播放地址、凭据或后端字段。MovieCard 与 MovieContextMenu 源文件和接口保持不变，现阶段由 movieService 统一提供 Mock 数据，LibraryView 不再直接读取 Mock。
- 最近片库验证：Toolbar 阶段通过 git diff --check、vue-tsc 和 build；Windows Chrome 自动化覆盖浮层开关 / 互斥 / 外部关闭、即时筛选排序、清除保留排序、年份与严格观看状态、菜单状态联动及 genre 初始化。1366 / 1440 / 1600 / 1920 同内容原型几何对照通过，500px 窗口高度下浮层内部滚动正常。海报补齐后再次通过构建、15 张图片加载及四档桌面宽度无横向溢出检查；未单独验证 Edge 或系统级 Windows scaling。相关实现已提交至 d6a00bf、b2c096b。
- 最近 MovieContextMenu 迁移：已删除 Mobile Action Sheet、scrim、safe-area、body scroll lock、matchMedia / sheet、自定义 ArrowUp/ArrowDown/Home/End/Tab/Shift+Tab/Escape、manual focus / focus restore 与 focusin。保留通过 Teleport 渲染的 Desktop 168px anchor flyout、锚点定位与防溢出、pointer outside close、resize / scroll close、菜单自身内部滚动、同一 … toggle、不同电影 … 切换和 reduced-motion；语义收敛为普通 action group + native buttons。LibraryView 继续使用页面级单实例；favorite/watchStatus 为 Mock 切换，播放/查看详情/查看媒体版本仅记录 intent，无后端持久化。
- 最近 Vue 侧栏迁移：已删除 pointer:coarse、touch-action、自定义方向键/Home/End/Tab/Shift+Tab/Escape、manual focus / focus restore 和 focusin；账号浮层收敛为普通 action group，保留 inert、aria-hidden、aria-expanded、aria-controls 和简单 focus-visible。保留品牌非交互展示、搜索、九个 named routes、路由高亮、账号 Mouse open/close / outside click、现有 notice、桌面滚动和 reduced-motion；≤900px 顶部导航、≤680px 图标导航及 compact navigation 均保留。220px 栏宽、8px inset、236px Main 偏移及账号菜单视觉/过渡不变；无使用方的 --control-height-touch 已删除。
- 最近 App Shell 收尾：App.vue 已删除 shell notice 的 noticeTrigger、document.activeElement 和关闭后手动 focus restoration，并将 safe-area 定位改为普通桌面 bottom；showNotice / dismissNotice 仅设置/清空提示。保留 notice UI、role=status、鼠标关闭、简单 focus-visible 及 ≤900px Desktop responsive shell；AppSidebar 仅修正账号浮层关闭态注释。
- 最近 Vue Router 接入：已安装 Vue Router 4，新增 router/index.ts 和九个独立占位 View；main.ts 注册 Router，App.vue 仅保留布局与 RouterView，删除 currentView 等临时切页状态。侧栏通过命名 RouterLink 跳转和高亮，用户按钮仅显示未实现提示。类型检查、构建、开发服务启动、九页跳转/刷新/直接访问、前进后退、查询参数、键盘焦点及临时子路由高亮检查通过，桌面侧栏与 Main 尺寸保持不变，无浏览器运行错误；未接用户系统或后端，未提交 Git。生产部署需配置 History 回退，说明已补充至 frontend/README.md。
- 最近工作流 UI 优化：影片识别增加确认队列概览，媒体来源统一宽内容布局与卡片间距；扫描和最近入库复用从首页/电影页抽取的公共海报表面样式，保留既有遮罩与无缩放行为。未改变 Mock 数据结构或扫描/确认流程。
- 最近资料库原型：补齐最近添加、收藏、未看、已看四个筛选视图，与电影页共用布局样式、交互和 Mock 卡片；已接通现有页面的资料库导航。四种宽度、分类筛选、菜单操作及原电影页像素对比检查通过；仍为 HTML / Mock 阶段，无后端接入。
- 最近片库加载状态：新增薄 movieService，复用 LibraryMovie 类型，350ms 异步获取独立 Mock 副本及来源选项；首次显示 12 个同尺寸骨架，loadingMore 默认关闭、开启后在网格尾部显示 6 个骨架，未实现分页或无限滚动。保持空片库、筛选无结果与既有卡片布局；未修改 Sidebar、MovieCard、LibraryToolbar 或 DESIGN.md。Chrome 自动化通过正常 15 部电影、首次 / 追加加载、空片库 / 无结果、卡片尺寸一致、四档桌面宽度和 reduced-motion 检查，npm run build 通过。追加 / 空片库通过自动化设置页面状态验收，无测试按钮；当前仍为演示 Mock，尚无真实登录接入。
- 最近合集与搜索迁移：新增 CollectionCard、合集详情路由与薄 collectionService；15 部电影默认聚合为 13 张单片卡 + 1 张合集卡，有筛选时恢复单片，合集菜单只提供查看合集。详情仅展示本人拥有成员，支持非法 ID、空成员和图片降级；仍为本地 Mock，不扩展后端 P0 Collection 业务。Shell 搜索通过 movieService 查询片名、原片名、导演 / 演员（兼容年份 / 类型），保留原型浮层、最近 5 部内容、清空 / 无结果与关闭反馈，处理旧请求覆盖；电影结果仍记录 detail intent 并提示详情尚未开放。复用原生 dialog 行为，未新增自定义键盘或移动端交互。保留前次加载结束不覆盖用户筛选的修复。验证通过 npm run build、合集四档桌面宽度原型几何对照、搜索浮层原型几何对照、聚合 / 筛选 / 单成员 / 空成员 / 缺图 / 菜单、搜索最近内容 / 人员 / 原片名 / 无结果 / 连续输入 / 重新打开 / 空片库 / 短窗口滚动，以及加载筛选回归；本轮按用户要求未提交 Git。
- 最近合集背景调整：按用户设计变更，Vue 与 HTML 合集页同步采用独立全宽首屏背景，延伸至侧栏背后，复用电影详情的渐变遮罩；保留标题、海报与成员网格布局。四档桌面宽度、路由离开背景清理与 build 验证通过，未提交。
- 最近图片规则决策：TMDB主Poster / 主Backdrop的P0选图规则已确定，直接使用Movie Details默认`poster_path` / `backdrop_path`，不再执行自定义图片语言优先级；中文片名和中文简介仍保持中文本地化优先。
- 最近关键决策：前端优先、垂直切片、尽早联调；`UNIQUE(tmdb_id)`保证公共Movie唯一；TMDB负责图片来源、OSS负责长期存储与日常展示；管理员预建档为非P0。
- 最近主页原型：按“最近观看 → 电影类型 → 最近添加 → 未看”重排；最近观看使用大幅剧照和最近播放顺序 Mock，电影类型通过 genre URL 参数复用电影页筛选；最近添加及未看复用公共 Movie Card 横向内容架。移除首页 Feature、为你推荐及最近添加列表。3840、2560、1920、1366、899、390 宽度与类型跳转、横向滚动、菜单状态检查通过；仍为 HTML / Mock，无真实播放或后端接入。
- 最近主页数据收尾：最近添加及未看从公共 library-mock 派生单片预览，按 added 倒序固定最多 8 部；主页与完整未看页共用 matchesLibraryView，未看统一定义为从未开始播放（status === 'unwatched'），watching 不属于未看。删除电影类型多余的查看全部，不改变 Collection、Genre 筛选及内容架溢出箭头规则。
- 最近 Mock 数据整理：首页最近观看、各页搜索、扫描成功电影与媒体来源最近入库预览复用公共 library-mock，补齐稳定 Movie ID；来源与扫描任务 Mock 分离，任务通过 movie/source 引用派生成功数量与来源统计，候选和媒体版本信息保留在各自业务 Mock 中。
- 最近扫描布局收尾：扫描运行态沿用媒体来源 / 最近扫描实际工作区规则（100% 内容宽度、桌面左右 40px），移除 1240px 限制并统一标题与 section 间距；运行态和完成态外层宽度保持稳定，保留 mini movie 尺寸、完成态结果网格及全部 Mock 逻辑。3840、2560、1920、1366、899、390 六档运行态、完成态和详情展开检查通过，无页面级横向溢出。
- 最近媒体来源详情原型：来源卡片和菜单查看详情已统一接入单一 Source Detail 页面，通过 sourceId 复用 MediaSource / Movie / Scan Mock 派生来源概览、单片电影和扫描记录，沿用 workflow / movie-card 样式；立即扫描共用 URL helper，编辑来源返回列表并打开对应弹窗。三个来源入口、非法参数、内容空状态、file:// 直开和六档响应式检查通过，无新增网络 JSON 请求；仍为前端 Mock 原型。
- 最近电影详情统一：电影详情统一为 movieId 驱动的单一详情页；主页、资料库、AI、媒体来源详情和搜索统一使用公共 Movie Detail URL，旧独立详情页仅保留兼容跳转。播放 / 媒体版本仍为 Mock 占位。
- 最近详情数据补齐：公共 Movie 详情 Mock 已补齐现有 15 部电影的简介与演职员预览；统一 Movie Detail 继续复用单一 detailMetadata，人物图片优先复用现有本地 assets，详情页架构与视觉未改。
- 最近电影详情媒体摘要增强：复用现有媒体信息区域，按来源、完整文件名、两行规格摘要展示；七个成功 Scan Mock 资源补充结构化文件大小、视频编码、分辨率/HDR、视频码率、帧率、位深及多音轨/字幕信息，摘要优先默认音轨，否则按固定规格顺序选择。quality / filename、来源关联与扫描数量保持兼容，媒体技术数据继续与公共 Movie 元数据分离；六档响应式、无资源降级及 file:// 直开检查通过，无新增网络请求或 JS 异常（浏览器原有 file:// prefetch 提示仍保留），仍为 HTML / Mock 原型。
- 最近主页 Shelf 交互优化：四类横向内容架继续使用鼠标纵向滚轮进行横向浏览；只要 Shelf 存在横向溢出且鼠标仍位于该区域，普通纵向 wheel 始终由 Shelf 消费，即使到达首尾边界也不会自动切换为页面滚动。只有鼠标移出 Shelf，或该 Shelf 本身无横向溢出时，页面才继续纵向滚动。Ctrl / Shift + Wheel、触控板与触屏原生横向操作保持不变。主页四类横向内容架采用自由横向滚动，不再启用自动 scroll snap；鼠标滚轮、触控板或触摸滚到的位置都会原样保留，指针离开 Shelf 不再触发卡片吸附或位置回跳；继续取消右上角箭头，保持 file:// Mock，无新增依赖或网络请求。
- 最近电影合集原型：电影合集已从特殊 Movie Card 语义整理为独立 Collection 概念，保存公共系列元数据并仅通过 Movie ID 关联成员；用户拥有的是 Movie，合集展示由当前片库成员派生，不建立 user_collection。主资料库在用户拥有同一合集至少两部电影时聚合展示，筛选及收藏 / 未看 / 已看 / 最近添加视图显示具体 Movie，收藏和观看状态仍属于 Movie。合集卡片进入独立 Collection Detail，电影详情系列区域通过共享 Collection Mock 派生并可返回合集详情；仍为 HTML / Mock，不实现用户自定义 List 或合集级播放 / 状态。

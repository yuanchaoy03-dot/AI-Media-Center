# PROJECT STATUS

- 最后更新时间：2026-10-02

## 当前阶段

项目处于前端切片向真实业务联调推进的阶段。Spring Boot 认证、本人来源空/非空查询、首次新增 WebDAV（测试 → 加密保存 → 刷新列表）及已保存来源只读目录浏览已打通；扫描根保存、扫描、个人片库、AI 和播放尚未接入。

默认 Vue 运行使用真实 HTTP 和身份守卫，不注入示例片库。片库、合集、搜索、电影详情及来源编辑/扫描根选择/扫描等完整操作保留为显式开发 Mock 预览，不计为正式业务完成。

## 当前已完成

| 模块 | 当前具备的能力 |
|---|---|
| 前端基础工程 | Vue 路由与 Shell、TypeScript、Pinia auth Store、Axios 传输层；ESLint / Prettier 与 Node 回归检查。运行细节见 [前端 README](frontend/README.md)。 |
| 注册 / 登录 / JWT | 真实注册、登录、当前用户查询；密码默认使用 Argon2id。sessionStorage 保存当前标签页 Token，刷新经 me 恢复可信身份。支持失败重试、禁用 / 失效清理、退出与账号切换请求取消及旧响应隔离。 |
| HTTP 错误与诊断日志 | 已收口 MVC 协议错误语义、Preview 身份恢复隔离、异常与认证失败日志三个 P2。MVC 已知 4xx 保留状态与协议头，继续统一 JSON / requestId；未预期异常保留脱敏原因链与代码位置，登录失败记录统一脱敏 WARN。 |
| 本人媒体来源 | 正式页支持空/非空列表、首次新增真实 WebDAV 测试与保存，刷新后可见；按可信用户归属隔离。保存时服务端重新测试；列表展示历史测试成功，不推断实时在线。“浏览目录”可逐层查看目录与文件、返回上级、空目录与失败重试；编辑删除、扫描范围及扫描仍未开放。 |
| WebDAV 与配置加密 | 仅 WebDavMediaSourceAdapter；匿名 / Basic、HTTP(S)、Depth:0 连接验证与 Depth:1 单层浏览、不跟随重定向、有界响应与总时限、禁 XML 外部实体。目录请求及 href 受同源、连接根与直接子项边界约束，归属检查在上游访问前执行。完整连接配置 AES-256-GCM 加密，附加认证数据绑定用户与来源；主密钥仅由后端安全配置提供。 |
| 数据库迁移 | Flyway V1 `users`、V2 `media_source`，V3 增加最近成功连接测试 UTC 时间；V1/V2 保持不变。来源归属、外键与约束保持，新建不建立扫描根或任务。 |
| 开发 Mock 预览 | 片库筛选排序、合集聚合 / 详情、全局搜索、电影详情；来源模拟连接 / 编辑、目录选择与扫描根管理、模拟扫描。数据仅在内存，刷新恢复 fixture；遗留 Token 保留但不请求真实认证或恢复身份，切回正常模式再验证。播放和 AI 仍提示未接入。 |

## 当前真实链路

- 注册 / 登录：Vue 表单 → Pinia auth Store → authService → Axios → Spring Boot / Spring Security → AuthService → MyBatis → MySQL。
- 身份恢复：当前标签页 Token → auth Store → me → JWT 校验与账号状态 / 角色复核 → 可信 CurrentUser → Router 放行。
- 本人来源：MediaSourcesView → ownedSourceService → auth Store 受保护请求 → Axios → Spring Boot → CurrentUser → MyBatis 按 user_id 查询 → MySQL。
- 首次新增：SourceDialog → ownedSourceService → 受会话保护的 POST → Spring Boot → MediaSourceAdapter → WebDAV；保存时重新测试，再加密配置及 INSERT，返回脱敏 DTO 后刷新本人列表。
- 只读目录：正式来源列表 → DirectoryBrowser → ownedSourceService → 受会话保护的 GET → Spring Boot → CurrentUser + sourceId 本人查询 → 解密连接 → MediaSourceAdapter Depth:1 → 直接子项 DTO；不写数据库。

已打通的业务闭环是：注册 → 登录 → 验证当前用户 → 本人来源页 → 测试并新增第一条 WebDAV → 刷新仍可见 → 逐层浏览真实目录与文件；目录导航、关闭、离页、退出或账号切换后旧请求不能回填。新增与浏览均不会自动扫描，来源以外的个人页面仍未开放。接口状态与细节由 [API.md](docs/API.md)维护。

## 尚未完成

- 真实来源编辑 / 删除 / 启停、已保存连接重测及其凭据更新语义。
- MediaScanRoot 持久化、主动扫描及 MediaResource 入库。
- TMDB 刮削、公共 Movie / Collection 建档、图片存储及真实个人片库。
- 收藏、观看记录与播放进度持久化，媒体版本选择及本机 mpv 播放。
- FastAPI、LLM / RAG、AI 发现与助手。
- 首页、资料库分类页、AI 发现和设置等 Vue 页面完整迁移；HTML 原型完成度不等于 Vue 或后端完成度。

## 下一步

1. 接入 MediaScanRoot 保存 / 启停，复用已接通的目录浏览，保持来源连接与扫描范围分离。
2. 接入主动扫描与资源入库，再衔接识别、刮削和个人片库。
3. 按真实页面补齐来源编辑 / 删除 / 启停与凭据更新语义。

## 已知限制

- 当前真实闭环到已保存来源的只读目录浏览；用户尚不能保存扫描范围或扫描入库，其他个人页面仍显示尚未开放。目录响应限制为 1 MiB / 2000 个直接子项，超限报错，不支持分页或部分结果；危险编码名称限制见 API。
- Mock 连接、目录、收藏和扫描不发送真实业务请求，也不证明 WebDAV / 云端文件访问或用户数据持久化可用；主页等部分预览仍是占位。
- 来源加密主密钥须与数据库备份一起保护，缺失或非法时新增/非空查询明确失败；丢失或直接替换无法读取旧配置，在线密钥轮换未实现。公共 Movie 等表尚无 migration，隔离测试未构造公共 Movie。
- WebDAV 已用本机协议服务自动回归，并用用户提供的一条私人 HTTP / Basic 来源验收根目录与子目录浏览；这不代表全部 AList / NAS / Nextcloud 或 HTTPS 证书场景兼容。P0 当前支持匿名/Basic且不跟随重定向；生产目标网络约束及 DNS 重绑定防护仍需部署验证，不宣称完整 SSRF 防护。
- 已有浏览器记录不能视为当前所有页面重新验收；系统级 Windows scaling、完整 Edge / Chrome 双浏览器覆盖及生产反向代理未验证。
- 本机 MySQL 8.4.8 的全新库迁移中，既有 V2 仍有 `TINYINT(1)` 显示宽度弃用提示；迁移与认证测试通过。

## 当前验证

2026-10-02 已保存来源只读目录浏览切片完成后，实际执行以下前端检查：

| 检查 | 最近记录 |
|---|---|
| `npm run lint` | 通过，0 错误 / 0 警告 |
| `npm run format:check` | 通过 |
| `npm test` | 72 项通过，0 失败 / 0 跳过；含目录 GET / DTO 校验、导航 / 关闭 / 卸载 / 来源与账号切换竞态，以及既有认证、来源新增和 Mock 选择回归 |
| `npm run build` | 通过 |
| `vue-tsc -b` | 随 `npm run build` 通过 |

2026-10-02 后端：编译及完整 `mvn -B -ntp test` 通过，69 项测试通过（61 项非数据库回归、8 项真实 HTTP + MySQL 的 `AuthHttpIntegrationTest`），0 失败 / 0 错误 / 0 跳过。已从被忽略的 `backend/.env.local.ps1` 加载现有配置，集成测试实际执行于独立 `_auth_test` 库，未使用开发库；测试签名/加密密钥随机生成，WebDAV 使用本机临时 HTTP 服务。

- 目录回归覆盖 Depth:1、直接目录 / 文件 / 空列表、USER / ADMIN 归属在网络前拒绝、停用来源仍可浏览、成功失败均不写库；协议覆盖中文 / 空格 / `% # ? +`、严格 UTF-8、同源与连接根边界、点段 / 编码分隔符 / 嵌套编码、相对与绝对 href、无路径根地址、不完整 / 重复项、1 MiB / 2000 项上限、慢正文、DTD、重定向及认证错误。既有新增二次测试、AES / AAD、128 KiB 连接测试回归继续通过。
- 浏览器在正式模式、真实 Spring Boot 与独立测试库验证来源列表 / 菜单入口、逐层目录与文件、中文路径、空目录、失败重试、返回上级和关闭。私人 HTTP / Basic 来源根目录返回 2 个目录，进入一个后为 40 个目录与 1 个文件；账号 B 无来源，访问 A 来源为 404。页面控制台无 error/warn，后端日志未匹配本地密码、JWT / 来源密钥或私人来源地址。
- 1280×720 对照 HTML / Vue 同一 Mock 根目录的 5 个子项、路径与导航结构，沿用既有 680px 深色 Dialog 和 Vue 目录行样式；只读状态不显示选择 / 保存控件。Mock 选择祖先的确认与取消保持可用；960×560 的真实目录弹窗无横向溢出，列表可滚动，返回上级及关闭可用。完整 Edge / Chrome 双浏览器与系统级 scaling 仍未验证。

- MVC 回归实际覆盖 405 / 406 / 415 / 404、框架参数 400、统一错误体和 requestId；普通异常及框架 500 仍为 `INTERNAL_ERROR`。真实 HTTP 在有效 JWT 下复核这些协议错误，并验证缺失 Token 时仍先返回 401。
- 日志回归实际覆盖 MVC 与外层过滤器的异常类型、原因链和代码位置、循环与截断，以及真实 AuthService 的用户不存在 / 密码错误 / 禁用账号统一脱敏日志。敏感哨兵不进入日志或错误体；本轮测试及浏览器后端日志检查未匹配数据库密码、JWT / 来源加密主密钥或验收凭据。
- 既有 Argon2id 随机盐、完整长密码与 Unicode、dummyHash、注册 / 登录 / JWT / me、角色与禁用状态复核、非法或缺失 Token、本人来源隔离、并发注册及数据库错误响应全部重跑通过。测试入口见 [前端 README](frontend/README.md#本地后端与集成测试)。
- Spring Boot 保持 4.0.8，Flyway core / mysql 统一为 11.20.3，MySQL 8.4 版本提示已消除；独立既有测试库的 V1–V3 校验通过，另在临时空库实际执行 V1–V3 并通过注册 / 登录 HTTP 验证，临时库已清理。迁移脚本保持原样，未新增数据库迁移。
- `git diff --check` 通过；API、DESIGN、状态、运行与迁移说明已同步。本地私人联调配置保持 Git 忽略，代码与文档不包含实际地址或凭据。生产部署未验证。

## 历史说明

历史实现过程请查看 Git 历史或 [docs/history](docs/history/)。

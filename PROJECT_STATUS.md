# PROJECT STATUS

- 最后更新时间：2026-10-02

## 当前阶段

项目处于前端切片向真实业务联调推进的阶段。Spring Boot 认证、本人来源空/非空查询及首次新增 WebDAV（测试 → 加密保存 → 刷新列表）已打通；目录、扫描、个人片库、AI 和播放尚未接入。

默认 Vue 运行使用真实 HTTP 和身份守卫，不注入示例片库。片库、合集、搜索、电影详情及来源编辑/目录/扫描等完整操作保留为显式开发 Mock 预览，不计为正式业务完成。

## 当前已完成

| 模块 | 当前具备的能力 |
|---|---|
| 前端基础工程 | Vue 路由与 Shell、TypeScript、Pinia auth Store、Axios 传输层；ESLint / Prettier 与 Node 回归检查。运行细节见 [前端 README](frontend/README.md)。 |
| 注册 / 登录 / JWT | 真实注册、登录、当前用户查询；密码默认使用 Argon2id。sessionStorage 保存当前标签页 Token，刷新经 me 恢复可信身份。支持失败重试、禁用 / 失效清理、退出与账号切换请求取消及旧响应隔离。 |
| HTTP 错误与诊断日志 | 已收口 MVC 协议错误语义、Preview 身份恢复隔离、异常与认证失败日志三个 P2。MVC 已知 4xx 保留状态与协议头，继续统一 JSON / requestId；未预期异常保留脱敏原因链与代码位置，登录失败记录统一脱敏 WARN。 |
| 本人媒体来源 | 正式页支持空/非空列表、首次新增真实 WebDAV 测试与保存，刷新后可见；按可信用户归属隔离。保存时服务端重新测试；列表展示历史测试成功，不推断实时在线。编辑删除、目录及扫描入口明确提示尚未开放。 |
| WebDAV 与配置加密 | 仅 WebDavMediaSourceAdapter；匿名 / Basic、HTTP(S)、Depth:0 目录验证、不跟随重定向、有界响应与总时限、禁 XML 外部实体。完整连接配置 AES-256-GCM 加密，附加认证数据绑定用户与来源；主密钥仅由后端安全配置提供。 |
| 数据库迁移 | Flyway V1 `users`、V2 `media_source`，V3 增加最近成功连接测试 UTC 时间；V1/V2 保持不变。来源归属、外键与约束保持，新建不建立扫描根或任务。 |
| 开发 Mock 预览 | 片库筛选排序、合集聚合 / 详情、全局搜索、电影详情；来源模拟连接 / 编辑、目录选择与扫描根管理、模拟扫描。数据仅在内存，刷新恢复 fixture；遗留 Token 保留但不请求真实认证或恢复身份，切回正常模式再验证。播放和 AI 仍提示未接入。 |

## 当前真实链路

- 注册 / 登录：Vue 表单 → Pinia auth Store → authService → Axios → Spring Boot / Spring Security → AuthService → MyBatis → MySQL。
- 身份恢复：当前标签页 Token → auth Store → me → JWT 校验与账号状态 / 角色复核 → 可信 CurrentUser → Router 放行。
- 本人来源：MediaSourcesView → ownedSourceService → auth Store 受保护请求 → Axios → Spring Boot → CurrentUser → MyBatis 按 user_id 查询 → MySQL。
- 首次新增：SourceDialog → ownedSourceService → 受会话保护的 POST → Spring Boot → MediaSourceAdapter → WebDAV；保存时重新测试，再加密配置及 INSERT，返回脱敏 DTO 后刷新本人列表。

已打通的业务闭环是：注册 → 登录 → 验证当前用户 → 本人来源页 → 测试并新增第一条 WebDAV → 刷新仍可见；退出或账号切换后旧请求不能回填。新增不会自动扫描，来源以外的个人页面仍未开放。接口状态与细节由 [API.md](docs/API.md)维护。

## 尚未完成

- 真实来源编辑 / 删除 / 启停、已保存连接重测及其凭据更新语义。
- 只读目录浏览、MediaScanRoot 持久化、主动扫描及 MediaResource 入库。
- TMDB 刮削、公共 Movie / Collection 建档、图片存储及真实个人片库。
- 收藏、观看记录与播放进度持久化，媒体版本选择及本机 mpv 播放。
- FastAPI、LLM / RAG、AI 发现与助手。
- 首页、资料库分类页、AI 发现和设置等 Vue 页面完整迁移；HTML 原型完成度不等于 Vue 或后端完成度。

## 下一步

1. 接入本人已保存来源的只读目录浏览，再落实 MediaScanRoot 保存 / 启停，保持来源连接与扫描范围分离。
2. 接入主动扫描与资源入库，再衔接识别、刮削和个人片库。
3. 按真实页面补齐来源编辑 / 删除 / 启停与凭据更新语义。

## 已知限制

- 当前真实闭环止于已保存来源；用户尚不能选择影片文件夹或扫描入库，其他个人页面仍显示尚未开放。
- Mock 连接、目录、收藏和扫描不发送真实业务请求，也不证明 WebDAV / 云端文件访问或用户数据持久化可用；主页等部分预览仍是占位。
- 来源加密主密钥须与数据库备份一起保护，缺失或非法时新增/非空查询明确失败；丢失或直接替换无法读取旧配置，在线密钥轮换未实现。公共 Movie 等表尚无 migration，隔离测试未构造公共 Movie。
- WebDAV 首次切片验证本机协议测试服务；真实 AList / NAS / Nextcloud 兼容性与证书场景尚未验收。P0 当前支持匿名/Basic且不跟随重定向；生产目标网络约束及 DNS 重绑定防护仍需部署验证，不宣称完整 SSRF 防护。
- 已有浏览器记录不能视为当前所有页面重新验收；系统级 Windows scaling、完整 Edge / Chrome 双浏览器覆盖及生产反向代理未验证。
- 本机 MySQL 8.4.8 验证仍有 Flyway 已验证版本提示及 `TINYINT(1)` 显示宽度弃用提示；迁移与认证测试通过。

## 当前验证

2026-10-02 首次新增 WebDAV 切片完成后，实际执行以下前端检查：

| 检查 | 最近记录 |
|---|---|
| `npm run lint` | 通过，0 错误 / 0 警告 |
| `npm run format:check` | 通过 |
| `npm test` | 67 项通过，0 失败 / 0 跳过；含真实来源 POST、非空 DTO、保存刷新、修改输入失效、离页/会话取消、旧响应隔离及 Mock 弹窗保持 |
| `npm run build` | 通过 |
| `npx --no-install vue-tsc -b` | 通过 |

2026-10-02 后端：编译及完整 `mvn -B -ntp test` 通过，51 项测试通过（45 项非数据库回归、6 项真实 HTTP + MySQL 的 `AuthHttpIntegrationTest`），0 失败 / 0 错误 / 0 跳过。已从被忽略的 `backend/.env.local.ps1` 加载现有配置，集成测试实际执行于独立 `_auth_test` 库，未使用开发库；测试签名/加密密钥随机生成，WebDAV 使用本机临时 HTTP 服务。

- 新增媒体回归覆盖真实测试与保存二次验证、失败不写库、本人空/非空列表、USER/ADMIN 归属隔离、密文不含地址/凭据、AES 随机 nonce / 篡改 / 跨行 AAD、缺失密钥、严格输入；协议覆盖认证失败、非 DAV、不同目标 href、重定向不转发凭据、慢正文总时限、128 KiB 上限、DTD 拒绝与 URL 未保留字符的规范化兼容。
- 浏览器在正式模式、真实 Spring Boot 与独立测试库验证注册登录、错误凭据阻止保存、修改字段使测试失效、重测后保存、刷新保留及账号 B 空列表；未开放菜单保留原页并给提示，控制台无 error/warn。添加弹窗在 1280×720 与 HTML 原型空表单对照，均为 560×590.8px；960×560 窗口无横向溢出，弹窗高 516px 且内容可滚动。完整 Edge/Chrome 双浏览器、系统级 scaling 与真实 Provider 尚未验证。

- MVC 回归实际覆盖 405 / 406 / 415 / 404、框架参数 400、统一错误体和 requestId；普通异常及框架 500 仍为 `INTERNAL_ERROR`。真实 HTTP 在有效 JWT 下复核这些协议错误，并验证缺失 Token 时仍先返回 401。
- 日志回归实际覆盖 MVC 与外层过滤器的异常类型、原因链和代码位置、循环与截断，以及真实 AuthService 的用户不存在 / 密码错误 / 禁用账号统一脱敏日志。敏感哨兵不进入日志或错误体；本轮测试及浏览器后端日志检查未匹配数据库密码、JWT / 来源加密主密钥或验收凭据。
- 既有 Argon2id 随机盐、完整长密码与 Unicode、dummyHash、注册 / 登录 / JWT / me、角色与禁用状态复核、非法或缺失 Token、本人来源隔离、并发注册及数据库错误响应全部重跑通过。测试入口见 [前端 README](frontend/README.md#本地后端与集成测试)。
- 沿用 Spring Boot 4.0.8 / Spring Framework 7.0.9 / Spring Security 7.0.7 与 Password4j 1.8.4，本切片使用 JDK HTTP/XML/加密能力，未新增依赖。Flyway V3 在独立测试库从 V2 升级成功，V1/V2 不变；本机 MySQL / Flyway 已知版本提示仍存在，本轮未重新验收全新库迁移。
- `git diff --check` 通过；API、数据库设计、DESIGN、运行说明与迁移说明已同步。生产部署未验证。

## 历史说明

历史实现过程请查看 Git 历史或 [docs/history](docs/history/)。

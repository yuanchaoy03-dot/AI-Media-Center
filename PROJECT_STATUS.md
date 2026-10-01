# PROJECT STATUS

- 最后更新时间：2026-10-01

## 当前阶段

项目处于前端切片向真实业务联调推进的阶段。Spring Boot 认证与新用户本人空来源查询已打通；真实 WebDAV、个人片库、AI 和播放尚未接入。

默认 Vue 运行使用真实 HTTP 和身份守卫，不注入示例片库。片库、合集、搜索、电影详情及完整来源操作保留为显式开发 Mock 预览，不计为正式业务完成。

## 当前已完成

| 模块 | 当前具备的能力 |
|---|---|
| 前端基础工程 | Vue 路由与 Shell、TypeScript、Pinia auth Store、Axios 传输层；ESLint / Prettier 与 Node 回归检查。运行细节见 [前端 README](frontend/README.md)。 |
| 注册 / 登录 / JWT | 真实注册、登录、当前用户查询；sessionStorage 保存当前标签页 Token，刷新经 me 恢复可信身份。支持失败重试、禁用 / 失效清理、退出与账号切换请求取消及旧响应隔离。 |
| 本人媒体来源 | 正式来源页按可信当前用户请求空列表，区分加载、失败和成功空状态。后端按用户归属查询；本人已有来源时明确返回 `501 SOURCE_LIST_NOT_READY`，非空 DTO 尚未实现。 |
| 数据库迁移 | 已有 Flyway V1 `users`、V2 `media_source` 脚本及 MySQL 迁移验证记录。来源表含用户归属、外键及约束；表结构不代表 WebDAV 保存或配置加密已实现。 |
| 开发 Mock 预览 | 片库筛选排序、合集聚合 / 详情、全局搜索、电影详情；来源模拟连接 / 编辑、目录选择与扫描根管理、模拟扫描。数据仅在内存，刷新恢复 fixture；播放和 AI 仍提示未接入。 |

## 当前真实链路

- 注册 / 登录：Vue 表单 → Pinia auth Store → authService → Axios → Spring Boot / Spring Security → AuthService → MyBatis → MySQL。
- 身份恢复：当前标签页 Token → auth Store → me → JWT 校验与账号状态 / 角色复核 → 可信 CurrentUser → Router 放行。
- 本人来源：MediaSourcesView → ownedSourceService → auth Store 受保护请求 → Axios → Spring Boot → CurrentUser → MyBatis 按 user_id 查询 → MySQL。

已打通的业务闭环是：注册 → 登录 → 验证当前用户 → 本人空来源页；刷新恢复身份后再加载，退出或账号切换后旧请求不能回填。接口状态与细节由 [API.md](docs/API.md)维护。

## 尚未完成

- 真实 WebDAV 来源新增 / 编辑 / 删除、配置加密、连接测试与非空来源响应。
- 只读目录浏览、MediaScanRoot 持久化、主动扫描及 MediaResource 入库。
- TMDB 刮削、公共 Movie / Collection 建档、图片存储及真实个人片库。
- 收藏、观看记录与播放进度持久化，媒体版本选择及本机 mpv 播放。
- FastAPI、LLM / RAG、AI 发现与助手。
- 首页、资料库分类页、AI 发现和设置等 Vue 页面完整迁移；HTML 原型完成度不等于 Vue 或后端完成度。

## 下一步

1. 结合来源 UI draft 确认非空 DTO，落实连接配置加密，接入本人 WebDAV 保存 / 测试与来源列表。
2. 接入只读目录浏览及 MediaScanRoot 保存 / 启停，保持来源连接与扫描范围分离。
3. 接入主动扫描与资源入库，再衔接识别、刮削和个人片库。

## 已知限制

- 新用户尚不能通过正式页面添加来源；未接入的个人页面显示尚未开放，当前真实闭环止于空来源。
- Mock 连接、目录、收藏和扫描不发送真实业务请求，也不证明 WebDAV / 云端文件访问或用户数据持久化可用；主页等部分预览仍是占位。
- 来源配置加密与密钥管理尚未落地；公共 Movie 等业务表尚无 migration。现有 HTTP 隔离测试只构造另一用户来源，未构造公共 Movie。
- 已有浏览器记录不能视为当前所有页面重新验收；系统级 Windows scaling、完整 Edge / Chrome 双浏览器覆盖及生产反向代理未验证。
- 既有 MySQL 8.4 验证有 Flyway 已验证版本提示及 `TINYINT(1)` 显示宽度弃用提示；本轮未重新连接数据库。

## 当前验证

以下前端结果保留自整理前状态文档最近的 2026-10-01 记录；本轮只整理文档，未重新执行代码检查。

| 检查 | 最近记录 |
|---|---|
| `npm run lint` | 通过，0 错误 / 0 警告 |
| `npm run format:check` | 通过 |
| `npm test` | 56 项通过，0 失败 / 0 跳过 |
| `npm run build` | 通过 |
| `npx vue-tsc -b` | 通过 |

最近可查的本机后端报告为 2026-09-29：3 项 HTTP 集成场景与 1 项密码长度单元测试通过，均为 0 失败 / 0 跳过。本轮未重跑后端测试、迁移或浏览器验收；未配置测试数据库时集成测试会跳过，不能用普通 package 成功替代。测试运行入口见 [前端 README](frontend/README.md#本地后端与集成测试)。

本轮文档验证：`git diff --check` 与前端 README 单文件 Prettier 检查通过；16 份项目 Markdown 的 121 个仓库内路径 / 标题锚点通过，代码围栏成对，旧路径引用已清除；Git 工作区改动均为文档。外部链接未联网核验。

## 历史说明

历史实现过程请查看 Git 历史或 [docs/history](docs/history/)。

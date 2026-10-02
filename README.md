# AI Media Center

基于大语言模型的个人智能影音平台，面向个人媒体资源管理与 AI 辅助发现。

## 项目定位

这是一个类 Infuse + AI 的本科毕业设计项目：用户自行添加媒体来源，系统不提供公共可播放影视资源。每个用户拥有独立的个人影音空间；公共电影元数据可以复用，个人片库只展示本人可访问的媒体。

## 当前技术栈

| 层次 | 技术 |
|---|---|
| 前端 | Vue 3 + TypeScript + Vue Router + Pinia + Axios + Vite + 原生 CSS；ESLint / Prettier 辅助开发 |
| 后端 | Java 21 + Spring Boot 4.0.8 + Spring Security / JWT + MyBatis + Maven |
| 数据库 | MySQL 8.x + Flyway 版本迁移 |
| AI | FastAPI + LLM / RAG（规划中，尚未实现） |

## 当前实现状态

- ✅ 前端基础工程、路由、认证会话管理与开发检查工具。
- ✅ 真实注册 / 登录、JWT 身份验证、刷新恢复身份、WebDAV 测试与首次新增、本人空/非空来源查询及只读目录浏览。
- ✅ `users`、`media_source` 及最近连接测试时间的 V1 / V2 / V3 数据库迁移。
- 🚧 片库、筛选排序、合集、搜索和完整来源操作目前仅有开发 Mock 预览；默认运行不展示示例片库。
- 🚧 扫描范围配置与扫描、刮削、个人片库持久化、AI / RAG 和 mpv 播放尚未完成。

详细完成度、近期任务和验证结果统一见 [PROJECT_STATUS.md](PROJECT_STATUS.md)。

## 项目结构

| 目录 | 用途 |
|---|---|
| `frontend/` | Vue 正式前端与独立的开发 Mock 预览 |
| `backend/` | Spring Boot 业务后端、认证与数据库迁移 |
| `docs/` | 正式设计、接口契约、学习资料及历史审计 |
| `html/` | 页面视觉原型与本地演示资源 |

## 开发与运行

- [前端安装、开发命令与 Mock 预览](frontend/README.md)
- [后端环境配置、启动与集成测试](frontend/README.md#本地后端与集成测试)
- [数据库迁移说明](backend/src/main/resources/db/migration/README.md)

## 文档导航

- [完整文档索引](docs/README.md)：按职责查找资料。
- [当前项目状态](PROJECT_STATUS.md)：完成度、下一步、限制与最近验证。
- [UI 设计规范](DESIGN.md)：视觉、组件与动效；已有页面以 HTML 原型为视觉基准。
- [Agent 工作规则](AGENTS.md)：Codex 行为约束与上下文路由。

## 当前阶段

正在从前端 Mock 切片推进到真实业务联调，已打通认证、WebDAV 测试与加密保存后刷新本人列表及逐层只读目录浏览，下一阶段接入扫描范围配置。

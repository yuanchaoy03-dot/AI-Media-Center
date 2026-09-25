# 项目工作规则

## 产品与架构边界

- 本项目是“基于大语言模型的个人智能影音平台”，定位为类 Infuse + AI 的个人影音资源管理与辅助工具，不提供公共可播放影视资源。
- 新用户默认空片库，用户自行添加媒体来源；个人资源与数据严格隔离。公共 Movie 元数据可复用，但只有关联本人可访问 MediaResource 的影片才进入个人片库。
- P0 只实现 `WebDavMediaSourceAdapter`，默认播放器为 Windows 本机 mpv；FileSystem、SMB、Local Agent、Redis 非 P0。不引入微服务、消息队列、复杂 RBAC、内容运营后台、自研播放器/launcher 等未批准范围。
- Spring Boot 是唯一公共业务后端和业务事实源；Vue 业务请求只访问 Spring Boot。FastAPI 只负责 AI 增强，不直连核心 MySQL、不绕过 Spring Boot 权限；两者均不代理视频流。

## Context Routing / 文档导航

按任务选择上下文，可以先读相关源码；无需固定顺序或默认全文读取文档。优先定位相关章节，只有证据不足或影响跨边界时才扩大阅读。下表也是事实的维护归属，摘要和历史记录不替代正式基线。

| 任务 / 信息 | 读取位置 |
|---|---|
| 普通 Vue Bug、局部逻辑、文案 | 相关源码；不自动加载状态、设计文档或 Skill |
| 当前进度、继续任务、判断下一步 | [PROJECT_STATUS.md](PROJECT_STATUS.md) |
| 产品范围、P0、验收标准 | [需求文档](docs/01-项目需求文档.md)相关章节 |
| 服务边界、数据流、架构决策 | [架构文档](docs/02-系统架构设计文档.md)相关章节 |
| 模块职责、长期工程规范 | [开发规范与模块边界](docs/开发规范与模块边界.md)相关章节 |
| 接口设计、修改或联调 | [API.md](docs/API.md)对应契约与相关实现 |
| UI Token、样式、视觉和动效规范 | [DESIGN.md](DESIGN.md)对应章节 |
| 已有页面 Vue 迁移、视觉对照 | DESIGN 的视觉基准与对应组件章节、[html/](html/) 对应原型及实际引用的 CSS/资源/脚本、相关 Vue |
| Apple 风格交互、动效、材质或排版精修 | [Apple Design Skill](.agents/skills/apple-design/SKILL.md)及其中匹配任务的 reference |
| 查找正式资料或历史审计 | [docs/README.md](docs/README.md)；不把索引中的全部文件作为必读清单 |

代码任务若改变当前已实现能力、主要用户流程或交互行为、当前阶段完成度、下一步建议或已知限制，完成前须检查 [PROJECT_STATUS.md](PROJECT_STATUS.md) 的当前状态相关部分并做最小同步，无需通读历史里程碑。接入真实后端、WebDAV、登录等阶段变化也须同步。纯 hover / 颜色等样式微调、文案修正、无行为变化的局部 Bug 不因此读取或修改状态文档。

## 前端边界

- Vue 3 + Vite + TypeScript + Vue Router；`frontend/src/views/` 承担路由页面，`components/` 承担真实复用模块，`router/` 管理导航，`App.vue` 仅负责 Shell 与 RouterView。不得用 `currentView` 模拟路由或将多个页面堆入一个组件。
- 已有 HTML Prototype 是对应页面完整视觉 Source of Truth：**Componentize the prototype, not redesign the prototype.** 保留布局、信息架构、模块/导航顺序、密度及各状态视觉终点；占位或未迁移 Vue 不能成为删减原型内容的依据。Apple Design Skill 只辅助交互体验，无权重设计。无原型的新页面按 DESIGN 与已有视觉语言设计。
- 当前验收为 **Windows 11 + Desktop Chromium（Edge / Chrome）+ Mouse**，Desktop-first / Mouse-first；覆盖桌面窗口宽高变化、非最大化及高 DPI / Windows scaling，保证 hover、点击、菜单、滚动和 resize 可用。
- Mobile / Touch、完整 Keyboard / focus management / 高级 Accessibility 延后至桌面核心闭环后的增强阶段。当前不新增移动专用布局/Action Sheet/safe-area/触摸专用分支，或方向键、Home/End、roving focus、自定义 Tab、手动焦点归还等键盘代码；保留语义 HTML、必要基础 aria、原生 Enter/Space/Tab、焦点可见性与 reduced-motion。
- 桌面 Grid、minmax、clamp、media query 等窗口适配仍有效；不能将窄窗口等同手机。HTML 跨端状态保留作未来参考，已有跨端/键盘代码不自动删除，清理须有专项任务范围。

## 工作方式与完成标准

- 前端优先、垂直切片、尽早联调；Mock 与页面解耦，契约随真实页面确认。实现以简洁、可维护为准，不为展示技术增加抽象、组件或依赖。
- 用户明确任务优先于 Skill 通用建议。在已授权范围内自主完成安全、可逆的本地读取、修改、检查与修复，不因第一轮修改完成就停下等待确认；只有影响结果的必要信息缺失或超出授权时才询问。
- 若 Skill 导致额外确认、停工或偏离任务，指出并链接具体 SKILL.md，引用对应规则，区分规则原文与自己的解释；不要把通用建议推断成审批要求。
- 完成意味着任务范围内问题已处理、改动经过审查与相称验证、必要文档已更新，结果和未验证限制如实报告。纯文档修改检查路径、引用、结构、Skill front matter 与 diff；仅代码改动运行对应检查，不机械执行全量构建/测试。
- 代码任务结束前做一次文档影响检查，按 Context Routing 的事实归属判断 DESIGN.md、API.md、PROJECT_STATUS.md 等是否受影响；受影响则最小更新，不受影响无需读取或修改，不因此将所有文档设为默认必读。
- Vue 视觉迁移需在相同视口、内容和状态下对照 HTML/Vue；构建通过不等于迁移验收完成。
- 按上表职责更新受影响文档。需求、架构、开发规范是正式毕业设计稳定基线，不因普通 UI/Bug/单个接口修改重写；DESIGN 保管设计值，API 保管契约，状态保管进度，数据库事实留给未来 03。不创建零散任务 Markdown 或平行事实源。

## Windows Shell / 命令执行环境

- 默认开发环境为 Windows 11 + PowerShell 7，终端命令默认使用 `pwsh`，优先且默认采用 PowerShell 7 兼容语法。
- 除非用户明确要求，不主动切换到 Bash、Git Bash、WSL 或 CMD。
- 不生成 Bash 专属 Shell 语法，包括 `export VAR=value`、`source xxx`、`<<EOF` / heredoc、`VAR=value command` 式环境变量赋值后直接执行命令，以及依赖 Bash 的管道、重定向或条件语法。
- 命令因 Shell 语法不兼容而失败时，优先改写为 PowerShell 7 等价写法，不通过切换 Git Bash、WSL 等 Shell 规避。
- `git`、`npm`、`pnpm`、`node`、`java`、`javac`、`mvn`、`python`、`pip`、`curl` 等跨平台命令可正常使用。PowerShell 有原生、清晰且稳定的实现时优先采用，但不为形式统一将常见跨平台命令强行改写为 cmdlet。
- 本规则旨在减少 Windows 环境下误用 Bash / Git Bash 语法导致的失败与重试，降低无效工具调用、时间和上下文消耗。

## Git 与安全

- 不提交 `.env`、密码、Token、API Key、AccessKey、JWT Secret、WebDAV 密码等 secret。
- 未获明确授权，不执行 push / force push，不添加或修改 remote、不创建远程仓库，不 reset / rebase / 改写历史，不撤销、覆盖或丢弃用户已有修改；其他危险或不可逆操作同样需要明确授权。
- 提交前检查 `git status` 与相关 `git diff`，只包含当前任务改动；按完整切片形成有意义的提交，默认中文提交信息，可保留 `feat:` / `fix:` / `docs:` 等前缀。

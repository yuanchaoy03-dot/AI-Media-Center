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
| 项目对外概览、当前技术栈、核心能力和高层实现状态 | 根 [README.md](README.md)只保持简洁摘要；详细开发进度、测试结果、已知限制和下一步以 [PROJECT_STATUS.md](PROJECT_STATUS.md)为准，不形成两个平行的详细事实源 |
| 当前进度、继续任务、判断下一步 | [PROJECT_STATUS.md](PROJECT_STATUS.md) |
| 产品范围、P0、验收标准 | [需求文档](docs/01-项目需求文档.md)相关章节 |
| 服务边界、数据流、架构决策 | [架构文档](docs/02-系统架构设计文档.md)相关章节 |
| MySQL 表、字段、约束与关系 | [数据库设计文档](docs/03-数据库设计文档.md)相关章节 |
| 模块职责、长期工程规范 | [开发规范与模块边界](docs/开发规范与模块边界.md)相关章节 |
| 接口设计、修改或联调 | [API.md](docs/API.md)对应契约与相关实现 |
| UI Token、样式、视觉和动效规范 | [DESIGN.md](DESIGN.md)对应章节 |
| 已有页面 Vue 迁移、视觉对照 | DESIGN 的视觉基准与对应组件章节、[html/](html/) 对应原型及实际引用的 CSS/资源/脚本、相关 Vue |
| Apple 风格交互、动效、材质或排版精修 | [Apple Design Skill](.agents/skills/apple-design/SKILL.md)及其中匹配任务的 reference |
| 查找正式资料或历史审计 | [docs/README.md](docs/README.md)；不把索引中的全部文件作为必读清单 |

代码任务若改变当前已实现能力、主要用户流程或交互行为、当前阶段完成度、下一步建议或已知限制，完成前须检查 [PROJECT_STATUS.md](PROJECT_STATUS.md) 的相关部分并做最小同步；实现过程留在 Git 历史或 docs/history，不写入状态正文。接入真实后端、WebDAV、登录等阶段变化也须同步。纯 hover / 颜色等样式微调、文案修正、无行为变化的局部 Bug 不因此读取或修改状态文档。

核心技术栈发生变化、新增或删除主要基础设施 / 框架、Flyway 当前迁移阶段明显变化（如新增核心业务表）、新的核心真实业务闭环完成、模块从 Mock / 未实现进入真实业务可用状态，或“当前阶段”明显变化时，结束任务前须检查根 [README.md](README.md) 是否过时；需要同步时只更新高层摘要，不复制 PROJECT_STATUS 中的测试数量、浏览器验收记录或实现细节。普通 Bug 修复、样式微调、内部实现细节、单纯测试补充不因此要求修改 README。

## 前端边界

- 当前前端基础技术栈为 Vue 3 + TypeScript + Vue Router + Pinia + Axios + Vite + ESLint + Prettier + 原生 CSS；`frontend/src/views/` 承担路由页面，`components/` 承担真实复用模块，`router/` 管理导航，`App.vue` 仅负责 Shell 与 RouterView。不得用 `currentView` 模拟路由或将多个页面堆入一个组件。
- Pinia `auth` Store 管理认证状态与会话生命周期，`authService.ts` 负责认证 API 和响应校验，`http.ts` 负责 Axios 传输和统一错误，Router 负责导航与守卫。ESLint / Prettier 仅为开发辅助工具，不改变这些业务职责，不以接入工具为由重构分层。
- ESLint / Prettier 的命令、唯一配置与忽略范围由 [frontend/README.md](frontend/README.md#开发命令与检查)维护；格式规则交给 Prettier，不添加重复配置或以大量 disable 掩盖问题。运行、测试、构建及类型检查也按该文档执行。
- 已有 HTML Prototype 是对应页面完整视觉 Source of Truth：**Componentize the prototype, not redesign the prototype.** 保留布局、信息架构、模块/导航顺序、密度及各状态视觉终点；占位或未迁移 Vue 不能成为删减原型内容的依据。Apple Design Skill 只辅助交互体验，无权重设计。无原型的新页面按 DESIGN 与已有视觉语言设计。
- 当前验收为 **Windows 11 + Desktop Chromium（Edge / Chrome）+ Mouse**，Desktop-first / Mouse-first；覆盖桌面窗口宽高变化、非最大化及高 DPI / Windows scaling，保证 hover、点击、菜单、滚动和 resize 可用。
- Mobile / Touch、完整 Keyboard / focus management / 高级 Accessibility 延后至桌面核心闭环后的增强阶段。当前不新增移动专用布局/Action Sheet/safe-area/触摸专用分支，或方向键、Home/End、roving focus、自定义 Tab、手动焦点归还等键盘代码；保留语义 HTML、必要基础 aria、原生 Enter/Space/Tab、焦点可见性与 reduced-motion。
- 桌面 Grid、minmax、clamp、media query 等窗口适配仍有效；不能将窄窗口等同手机。HTML 跨端状态保留作未来参考，已有跨端/键盘代码不自动删除，清理须有专项任务范围。

## 简单优先与复杂度控制

- 本项目是本科毕业设计，目标是完成**功能完整、结构清晰、作者本人能够理解、维护和答辩说明**的系统；不以代码量、抽象层级、边界覆盖数量或“企业级复杂度”为目标。
- 同样满足当前明确需求时，优先选择更少代码、更少状态、更少分支、更少抽象层和更短调用链的方案。能够删除代码解决的问题，不优先通过新增模式、接口、Manager / Handler / Strategy / Factory 等层级解决。
- 不为尚未提出的未来功能、极低概率理论边界、假设中的高并发 / 分布式场景或当前部署规模不需要的容错机制增加生产代码。新增明显复杂度前必须能回答：它解决哪个当前真实需求；不实现会造成什么实际问题；是否存在更简单方案。
- P0 / P1（安全、越权、数据损坏、核心正常流程阻断、常见输入明显错误）优先修复。P2 / P3 若不影响安全、数据正确性和当前主流程，优先记录而不是继续扩大生产代码和测试矩阵。
- 测试用于证明当前需求正确，不得反过来扩大产品需求。需求明确收缩或取消时，应同步删除 / 改写对应实现和测试；不得为了让旧测试继续通过而保留无业务价值的逻辑。
- 完成当前需求及相称回归后停止扩展测试，不主动进入“继续造极端输入 → 发现低优先级边界 → 扩代码 → 再扩测试”的循环。真实外部协议只覆盖标准行为、常见失败、安全边界和已经出现的重要兼容问题，不追求穷举所有 Provider / release naming convention。
- 单文件行数只作为复杂度信号，不作机械限制：核心 Java / TypeScript 约 300 行、Vue 页面约 500 行、测试文件约 1000 行以上时，应先检查是否职责过多；只有拆分能降低理解成本才拆分。
- Vue 对本项目 Spring Boot 响应只做必要的类型 / 状态 / 用户体验检查；权限、URI 安全、持久化完整性和核心数据约束以后端为最终边界，不在前端重复实现一套同等复杂的安全规则。
- **文件名解析的正式职责仅是为 TMDB 搜索生成候选：主要输出电影名 `title`，年份 `year` 可选。** 不把它做成完整 release-name parser；Edition / Cut / IMAX / Uncut / Unrated 等版本语义不属于当前 P0 文件名解析目标。HDR、Dolby Vision、HEVC/H.264/AV1、分辨率、码率、帧率、音轨、字幕等媒体技术事实后续以 ffprobe / 实际媒体内容为准，不从文件名猜测。
- TMDB 负责最终影片身份确认；文件名候选不等于 Movie 事实。解析失败或罕见命名允许进入人工确认 / 未识别流程，不能为追求 100% 命名覆盖持续堆叠启发式规则。
- 重构目标是**降低实际认知复杂度**，不是把同样复杂的逻辑拆成更多文件。一个职责单一、容易阅读的普通类优于多层无替换价值的抽象。
- 复杂度优化任务结束时除测试结果外，还应报告：删除了什么、为何可删除、主要生产代码增减、是否新增抽象、调用链是否变短、仍保留哪些非阻断边界。

## 工作方式与完成标准

- 前端优先、垂直切片、尽早联调；Mock 与页面解耦，契约随真实页面确认。实现以简洁、可维护为准，不为展示技术增加抽象、组件或依赖。
- 本机 MySQL 测试或验证前，先检查 [backend/.env.local.ps1](backend/.env.local.ps1)；存在时从仓库根目录执行 `. ./backend/.env.local.ps1` 加载凭据。`DB_*` 用于开发库，`AUTH_TEST_DB_*` 用于独立、可丢弃的 `_auth_test` 测试库；集成测试会清理测试库数据。该文件已被 Git 忽略，禁止打印、提交或复制其中的真实密码及密钥到文档；缺少环境变量时先加载此文件，再判断能否运行数据库测试。
- 用户明确任务优先于 Skill 通用建议。在已授权范围内自主完成安全、可逆的本地读取、修改、检查与修复，不因第一轮修改完成就停下等待确认；只有影响结果的必要信息缺失或超出授权时才询问。
- 若 Skill 导致额外确认、停工或偏离任务，指出并链接具体 SKILL.md，引用对应规则，区分规则原文与自己的解释；不要把通用建议推断成审批要求。
- 完成意味着任务范围内问题已处理、改动经过审查与相称验证、必要文档已更新，结果和未验证限制如实报告。纯文档修改检查路径、引用、结构、Skill front matter 与 diff；仅代码改动运行对应检查，不机械执行全量构建/测试。
- 代码任务结束前须按 Context Routing 的事实归属做一次文档影响检查，至少考虑根 [README.md](README.md)、[DESIGN.md](DESIGN.md)、[API.md](docs/API.md)、[PROJECT_STATUS.md](PROJECT_STATUS.md) 及对应的数据库、架构、需求文档；只有事实确实受影响时才最小更新，不要求每次任务读取或修改全部文档，不将所有文档设为默认必读。
- Vue 视觉迁移需在相同视口、内容和状态下对照 HTML/Vue；构建通过不等于迁移验收完成。
- 按上表职责更新受影响文档。需求、架构、开发规范是正式毕业设计稳定基线，不因普通 UI/Bug/单个接口修改重写；根 README 保管项目高层摘要，DESIGN 保管设计值，API 保管契约，状态保管进度，数据库事实由 03 数据库设计文档维护。不创建零散任务 Markdown 或平行事实源。

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

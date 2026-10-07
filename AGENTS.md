# 项目工作规则

## 产品与架构边界

- 本项目是“基于大语言模型的个人智能影音平台”，定位为类 Infuse + AI 的个人影音资源管理与辅助工具，不提供公共可播放影视资源。
- 新用户默认空片库，用户自行添加媒体来源；个人资源与数据严格隔离。公共 Movie 元数据可复用，但只有关联本人可访问 MediaResource 的影片才进入个人片库。
- P0 只实现 `WebDavMediaSourceAdapter`，默认播放器为 Windows 本机 mpv；FileSystem、SMB、Local Agent、Redis 非 P0。不引入微服务、消息队列、复杂 RBAC、内容运营后台、自研播放器/launcher 等未批准范围。
- Spring Boot 是唯一公共业务后端和业务事实源；Vue 业务请求只访问 Spring Boot。FastAPI 只负责 AI 增强，不直连核心 MySQL、不绕过 Spring Boot 权限；两者均不代理视频流。

## 简单优先与复杂度控制

本项目是本科毕业设计。开发目标是 **功能完整、结构清晰、正常真实场景可靠、作者本人能解释和维护**；简单、够用优先于极端边界覆盖和企业级复杂度。以下规则适用于新增功能、Bug 修复、重构与测试，不能削弱安全、用户隔离或数据正确性。

1. **同一需求优先简单方案**：满足当前需求时，选择更少代码、状态、分支和抽象、更短调用链、更容易解释的实现；不得因为“架构更高级”而增加无必要复杂度。
2. **不提前解决不存在的问题**：不主动为尚未提出的功能、极低概率理论边界、当前真实使用没有出现的问题、假设的大规模并发或分布式环境、个人项目规模不需要的复杂容错增加生产代码；不得仅为提高测试覆盖率创造问题和需求。
3. **按影响处理 Bug / 边界**：安全、越权、数据泄露或损坏、核心业务不可用、常见真实输入明显错误等 P0 / P1 问题优先修复。P2 / P3 若不影响安全、数据正确性、正常真实使用和毕设核心业务闭环，默认记录到现有问题位置，不立即扩展生产代码，不另建零散审计文件。这是问题优先级，不改变正式功能的 P0 范围。
4. **测试证明需求，不定义需求**：旧测试存在不代表对应功能必须永久维护。需求取消或收缩后，后续代码任务可以删除对应生产逻辑，并删除或改写失去业务意义的测试；不得为了让旧测试全部通过而保留无实际价值的复杂规则。
5. **验证完成后停止**：当前需求、核心正常路径、重要失败路径、安全和数据正确性验证完成后结束任务。禁止自动循环“寻找极端输入 → 发现低优先级边界 → 扩展生产代码 → 再找极端输入”；不主动扩大测试矩阵。新变化、失败或尚未解决的重要风险才是追加验证的理由。
6. **重构先考虑删除**：先删已取消规则、重复校验、重复状态、无用 DTO 字段、无业务意义测试和提前设计的未来能力；只有确实降低理解成本时才增加类或抽象。必要的外部协议与权限边界仍保留。
7. **不机械拆文件**：优化目标是降低认知复杂度，不是把一个复杂的 300 行类拆成十个互相跳转的 30 行类。职责明确的普通类优于没有实际替换价值的 Manager、Handler、Strategy、Factory、Coordinator、Executor 或 Wrapper；文件长度本身不是拆分理由。
8. **作者可理解**：作者应能较容易地解释模块主要流程、关键状态和失败处理。如果模块已只有 AI 才能继续维护，应优先简化实现或收缩需求，再推进开发。

正式产品范围以[需求文档](docs/01-项目需求文档.md)为准，长期工程约束以[开发规范与模块边界](docs/开发规范与模块边界.md)为准。正式基线变更不等于代码已完成调整；当前行为、待调整差距分别由 API 与 PROJECT_STATUS 如实维护，不提前改写为已实现。

## Context Routing / 文档导航

按任务选择上下文，可以先读相关源码；无需固定顺序或默认全文读取文档。优先定位相关章节，只有证据不足或影响跨边界时才扩大阅读。下表也是事实的维护归属，摘要和历史记录不替代正式基线。

| 任务 / 信息 | 读取位置 |
|---|---|
| 普通 Vue Bug、局部逻辑、文案 | 相关源码；不自动加载状态、设计文档或 Skill |
| 项目对外概览、当前技术栈、核心能力和高层实现状态 | 根 [README.md](README.md)只保持简洁摘要；详细开发进度、测试结果、已知限制和下一步以 [PROJECT_STATUS.md](PROJECT_STATUS.md)为准，不形成两个平行的详细事实源 |
| 当前进度、继续任务、判断下一步 | [PROJECT_STATUS.md](PROJECT_STATUS.md)：阶段、已完成、未完成、下一步、重要限制、最近必要验证摘要 |
| 产品范围、P0、验收标准 | [需求文档](docs/01-项目需求文档.md)相关章节 |
| 服务边界、数据流、架构决策 | [架构文档](docs/02-系统架构设计文档.md)相关章节 |
| MySQL 表、字段、约束与关系 | [数据库设计文档](docs/03-数据库设计文档.md)相关章节 |
| 模块职责、长期工程规范 | [开发规范与模块边界](docs/开发规范与模块边界.md)相关章节 |
| 接口设计、修改或联调 | [API.md](docs/API.md)对应契约与真实实现状态；规划保留 draft / confirmed 标识，不用未来设计覆盖当前行为 |
| UI Token、样式、视觉和动效规范 | [DESIGN.md](DESIGN.md)对应章节 |
| 已有页面 Vue 迁移、视觉对照 | DESIGN 的视觉基准与对应组件章节、[html/](html/) 对应原型及实际引用的 CSS/资源/脚本、相关 Vue |
| Apple 风格交互、动效、材质或排版精修 | [Apple Design Skill](.agents/skills/apple-design/SKILL.md)及其中匹配任务的 reference |
| 查找正式资料或历史审计 | [docs/README.md](docs/README.md)；不把索引中的全部文件作为必读清单 |

代码任务若改变当前已实现能力、主要用户流程或交互行为、当前阶段完成度、下一步建议或已知限制，完成前须检查 [PROJECT_STATUS.md](PROJECT_STATUS.md) 的相关部分并做最小同步；状态正文只保留当前事实和最近必要验证摘要，不累积目录/文件数量、视口/DPR、commit 或低优先级问题复现流水账。实现过程留在 Git 历史；确需长期保存的审计或设计决策才放入 docs/history，不为整理状态创建大量历史文件。接入真实后端、WebDAV、登录等阶段变化也须同步。纯 hover / 颜色等样式微调、文案修正、无行为变化的局部 Bug 不因此读取或修改状态文档。

核心技术栈发生变化、新增或删除主要基础设施 / 框架、Flyway 当前迁移阶段明显变化（如新增核心业务表）、新的核心真实业务闭环完成、模块从 Mock / 未实现进入真实业务可用状态，或“当前阶段”明显变化时，结束任务前须检查根 [README.md](README.md) 是否过时；需要同步时只更新高层摘要，不复制 PROJECT_STATUS 中的测试数量、浏览器验收记录或实现细节。普通 Bug 修复、样式微调、内部实现细节、单纯测试补充不因此要求修改 README。

## 前端边界

- 当前前端基础技术栈为 Vue 3 + TypeScript + Vue Router + Pinia + Axios + Vite + ESLint + Prettier + 原生 CSS；`frontend/src/views/` 承担路由页面，`components/` 承担真实复用模块，`router/` 管理导航，`App.vue` 仅负责 Shell 与 RouterView。不得用 `currentView` 模拟路由或将多个页面堆入一个组件。
- Pinia `auth` Store 管理认证状态与会话生命周期，`authService.ts` 负责认证 API 和响应校验，`http.ts` 负责 Axios 传输和统一错误，Router 负责导航与守卫。ESLint / Prettier 仅为开发辅助工具，不改变这些业务职责，不以接入工具为由重构分层。
- ESLint / Prettier 的命令、唯一配置与忽略范围由 [frontend/README.md](frontend/README.md#开发命令与检查)维护；格式规则交给 Prettier，不添加重复配置或以大量 disable 掩盖问题。运行、测试、构建及类型检查也按该文档执行。
- 已有 HTML Prototype 是对应页面完整视觉 Source of Truth：**Componentize the prototype, not redesign the prototype.** 保留布局、信息架构、模块/导航顺序、密度及各状态视觉终点；占位或未迁移 Vue 不能成为删减原型内容的依据。Apple Design Skill 只辅助交互体验，无权重设计。无原型的新页面按 DESIGN 与已有视觉语言设计。
- 当前验收为 **Windows 11 + Desktop Chromium（Edge / Chrome）+ Mouse**，Desktop-first / Mouse-first；覆盖桌面窗口宽高变化、非最大化及高 DPI / Windows scaling，保证 hover、点击、菜单、滚动和 resize 可用。
- Mobile / Touch、完整 Keyboard / focus management / 高级 Accessibility 延后至桌面核心闭环后的增强阶段。当前不新增移动专用布局/Action Sheet/safe-area/触摸专用分支，或方向键、Home/End、roving focus、自定义 Tab、手动焦点归还等键盘代码；保留语义 HTML、必要基础 aria、原生 Enter/Space/Tab、焦点可见性与 reduced-motion。
- 桌面 Grid、minmax、clamp、media query 等窗口适配仍有效；不能将窄窗口等同手机。HTML 跨端状态保留作未来参考，已有跨端/键盘代码不自动删除，清理须有专项任务范围。

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

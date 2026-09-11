# 项目工作规则

## 项目定位

本项目是“基于大语言模型的个人智能影音平台”，定位为类Infuse + AI的个人工具，不提供公共可播放影视资源。Spring Boot是唯一公共业务后端和事实源，FastAPI只负责AI增强，P0媒体来源仅为WebDAV，默认播放器为本机mpv。

## 新任务阅读顺序

1. 本文件。
2. `PROJECT_STATUS.md`。
3. 当前任务需要的稳定基线：`docs/01-项目需求文档.md`、`docs/02-系统架构设计文档.md`、`docs/开发规范与模块边界.md`。
4. `docs/API.md`中当前功能相关部分。
5. 当前功能相关源码。

小任务不必无条件全文重读稳定文档；涉及需求、架构或模块边界判断时必须回查对应基线。

## P0与开发方式

- 新用户默认空片库；公共Movie元数据可复用，但只有用户本人可访问的MediaResource关联后才进入个人片库。
- P0只实现`WebDavMediaSourceAdapter`；FileSystem、SMB、Local Agent和Redis均非P0。
- Vue只访问Spring Boot业务接口；FastAPI不直连核心MySQL；Spring Boot/FastAPI不代理视频流。
- 采用前端优先、垂直切片、尽早联调；Frontend Mock与页面解耦，接口随真实页面逐步确认。
- 不引入微服务、消息队列、复杂RBAC、内容运营后台、自研播放器/launcher或其他未批准范围。

## Frontend UI Development Rules

- 当前前端采用 Vue 3 + Vite + TypeScript + Vue Router。
- 页面开发遵循：`HTML Prototype → Vue Component Implementation → Design System Refinement → Interaction Enhancement`。设计系统细化与交互增强必须在原型结构内进行。
- 前端 UI 任务开始前，阅读 `DESIGN.md`、对应 HTML 原型及其引用的共享样式、资源和交互脚本，再核对 `frontend/src/` 的相关实现；使用 Apple Design Skill 时阅读 `.agents/skills/apple-design/SKILL.md`。
- 已有 HTML 原型页面是已有页面的视觉 Source of Truth。**Componentize the prototype, not redesign the prototype.** Vue 的职责是将 HTML 原型组件化，而不是重新设计 HTML 原型。
- Vue 实现必须优先保持页面布局、信息架构、模块顺序、视觉层级、内容组织方式和主要组件关系；不得因为 Vue 组件化、工程优化或设计建议改变已有页面结构。
- 当前占位 View 或尚未完整迁移的组件不构成新的视觉基准；原型已有但 Vue 尚缺的区域属于待迁移内容，不能据此删除原型入口或模块。没有 HTML 原型的全新页面按 `DESIGN.md` 和已有项目视觉语言设计。
- 迁移完成前，在相同视口、内容和对应状态下对照 HTML 与 Vue，检查布局、区域完整性、层级及交互；构建通过不等于视觉迁移完成。HTML 的视觉基准地位不覆盖正式业务事实、用户隔离和 P0 约束。

## Vue Architecture Rules

以下路径均相对于 `frontend/src/`：

| 路径 | 职责 |
|---|---|
| `views/` | 路由级页面与完整页面入口 |
| `components/` | 可复用 UI 组件与页面内部公共模块；优先演进已有组件 |
| `router/` | 路由定义与页面路径映射 |
| `App.vue` | 应用级 Shell、全局布局与 `RouterView` 容器 |

- 禁止在 `App.vue` 中实现具体业务页面。
- 禁止使用 `currentView` 等本地状态模拟路由；页面导航使用 Vue Router。
- 禁止把多个页面逻辑堆积到一个组件中。
- 禁止在没有真实复用需求时过度拆分组件。

## Design Skill Usage Rules

项目鼓励在相关 UI 开发中积极使用 Apple Design Skill。目标不是简单模仿 Apple 外观，而是提升 Apple 风格的底层交互体验：不仅看起来像 Apple，而且使用感觉接近 Apple。

允许在保留原型结构并遵守 `DESIGN.md` 的前提下优化：

- 点击反馈、pointer interaction、hover、pressed state、active state。
- focus-visible、keyboard interaction、accessibility。
- transition、motion、animation easing。
- perceived performance、loading feedback。
- reduced motion、responsive interaction。

尤其关注快速反馈、连续交互、自然过渡、克制动画和物理感；需要动画时保持可中断、可反向操作，不以动画阻塞输入。按实际交互需求选用 Skill 能力，不为展示 Skill 强加效果或依赖；具体动效规范遵守 `DESIGN.md`。

**Apple Design Skill 不拥有重新设计已有页面的权限。** 对于已有 HTML Prototype：

- HTML 决定页面外观、布局、信息架构、组件位置、视觉密度和静止状态表现。
- Design Skill 在上述边界内决定状态变化如何发生、动画如何表现、交互如何反馈。

**HTML decides what it looks like. Design Skill decides how it feels.** 即：HTML 决定长什么样，Design Skill 决定怎么动、怎么交互。

Design Skill 不得因为 Apple 风格建议、最佳实践、AI 自己判断或 UI 趋势而主动：

- 修改 Sidebar 结构、删除已有入口或改变导航顺序。
- 修改页面信息架构或改变 HTML 已确定的布局。
- 将影音应用改造成 Dashboard 风格。
- 随意改变卡片、海报墙或内容架结构。

如果 Design Skill 建议与 HTML Prototype 冲突，优先遵守 HTML Prototype；通用 Token、状态、无障碍与动效实现遵守 `DESIGN.md`，Skill 示例不能覆盖项目规范。改变已有页面设计需要用户明确的设计变更要求，不能把交互增强视为重设计授权。

## Engineering Preference

- 项目开发优先简洁、可维护、易理解，符合毕业设计实际需求。
- 避免过早抽象、为了展示技术而增加技术、不必要组件拆分、不必要依赖和不必要架构复杂化。
- 实现应服务产品，而不是服务技术堆叠。

## 文档与完成检查

- `docs/01-项目需求文档.md`、`docs/02-系统架构设计文档.md`、`docs/开发规范与模块边界.md`是当前冻结的正式稳定基线；普通页面、组件、样式、Bug或单个接口实现变化不得修改它们。
- 按实际影响更新文档：产品需求/P0范围/验收标准→`docs/01-项目需求文档.md`，架构/ADR→`docs/02-系统架构设计文档.md`，长期开发规则→`docs/开发规范与模块边界.md`，接口→`docs/API.md`，进度→`PROJECT_STATUS.md`，工作规则→`AGENTS.md`；数据库事实留给未来03。
- 不因小型UI或组件改动重写稳定基线，不创建零散任务Markdown。
- 文档职责保持分离：`AGENTS.md` 负责 AI 行为规则、项目纪律、架构边界和开发流程；`DESIGN.md` 负责 Design Token、视觉规范、动效规范和 UI 设计原则；`docs/` 负责需求、架构、模块设计、API 及既有正式开发规范。`AGENTS.md` 不承担 `DESIGN.md` 的职责，不复制具体颜色、尺寸、圆角或布局参数；本文件的行为约束不替代正式基线。
- 每个切片结束前完成相应测试、Code Review、必要文档更新和Git提交检查，并确认用户隔离、secret、模块边界及P0范围未被破坏。

## Git工作规则

- Git提交信息默认使用中文描述，可保留`feat:`、`fix:`、`docs:`、`design:`、`refactor:`、`chore:`等类型前缀。
- 每次提交前检查`git status`和必要的`git diff`，只提交当前任务相关修改，不混入无关文件。
- 不得提交`.env`、密码、Token、API Key、AccessKey、JWT Secret、WebDAV密码等敏感信息。
- 不得擅自执行`push`、`force push`、添加或修改remote、创建远程仓库；只有用户明确要求时才能进行远程操作。
- 不得擅自撤销、覆盖、reset或丢弃用户已有的未提交修改。
- 一个完整功能切片或明确阶段完成后再形成有意义的提交，不因每个微小修改机械创建commit。
- 修改历史提交、rebase、reset、force push等可能改写Git历史的操作，必须在用户明确要求后执行。

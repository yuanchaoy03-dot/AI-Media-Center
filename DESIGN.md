# AI-Media-Center Design System

> 项目级主要设计事实源 · 中文 Web 应用 · Desktop First · Dark First  
> 建立日期：2026-09-11。本文规定今后的实现，不表示现有 HTML 已全部迁移。产品范围、权限、接口和后端事实仍由正式基线决定。

## 1. Design Vision

AI-Media-Center 是个人智能影音平台。以现代 Apple 产品的克制为视觉基线，以深色电影内容为主体，以成熟桌面工具交互组织来源、检索和扫描，用少量 Floating Glass Surface 表达临时覆盖层。最终只有一套 AI-Media-Center 设计语言。

用户首先回答“我现在想看什么”，需要时再进入“我的资源怎样接入、识别和管理”。Movie Artwork 的视觉优先级高于 UI Decoration。海报、剧照和背景图承担色彩与情绪，软件控件保持安静。

### 1.1 事实优先级

冲突时严格按以下顺序判断：

1. 本项目真实产品需求、用户隔离、安全和业务约束。
2. 当前已经验证成熟、合理的 UI 和组件。
3. 本文明确的设计规范。
4. `awesome-design-md` 研究参考。
5. `apple-design` 的交互、动效和 Material 辅助原则。
6. Agent 自由判断。

“已存在”不等于“已验证”。第 4 节记录保留项与需要调整项；列为 Normalize / Improve / Replace 的旧实现不能以此优先级为由永久豁免。新发现的成熟行为与本文冲突时，先说明证据和影响，保留业务行为，再作最小设计决策；不得悄悄重做整页。

### 1.2 业务对 UI 的硬约束

- 新用户默认空片库。公共 Movie 元数据不等于个人拥有；必须有关联到本人可访问来源的 MediaResource。不得用热门公共影片填充真实空片库。
- P0 只提供 WebDAV 来源。不得把 FileSystem、SMB、Local Agent、Redis、资源分享或公共播放入口包装为已支持能力。
- Vue 只访问 Spring Boot 业务接口；FastAPI 只增强 AI。页面不持有 TMDB/WebDAV 服务密钥，不代理视频流，不以浏览器 Mock 推断正式业务事实。
- 默认 Windows 本机 mpv；P0 不承诺 PotPlayer。按钮使用“使用 mpv 播放”或上下文明确的“播放”。获得受控播放信息后才发起外部协议；只能反馈“已发起播放”，不能据此宣布播放成功、自动标记看过或生成精确进度。
- 精确 Watch Progress 是有可靠进度数据后的组件能力。P0 无反馈时用观看状态和最近播放时间；不显示虚构百分比、“继续至 01:23:00”或内嵌播放器。
- 技术字段未知显示“未知”或 `—` 并解释原因；不根据海报、文件名或 AI 猜测 HDR、码率、语言。Movie.runtime 与 MediaResource.duration 分开标注。
- AI 搜索、推荐和 Agent 主结果只来自本人片库；硬条件不能自动放宽。RAG 默认无剧透，剧透需明确许可。AI 生成内容与影片/文件事实分开呈现。
- 正式需求允许同一应用内受保护的轻量 ADMIN 管理区。个人首页禁止统计大盘不等于删除该需求；管理区沿用工具组件，只展示获准聚合数据、脱敏审计和账号启停，不做内容运营后台，不暴露用户私人影片、路径、对话或凭据。

## 2. Product Personality

| 特征 | 可执行表现 |
|---|---|
| 私人 | “我的片库”“添加媒体来源”；空状态引导接入本人来源，不出现公共资源榜单 |
| 沉浸 | 浏览区域以海报和 Backdrop 为主体；工具进入二级层次 |
| 克制 | 一组中性色、一种功能性 Accent；默认静态、不发光、不嵌套卡片 |
| 精密 | 同一高度的控件、稳定网格、可读技术字段、明确状态与恢复动作 |
| 自然 | 操作立即反馈；浮层与触发器相连；动画中可反向操作 |
| 可信 | 无资源、未知、失败、部分成功都有真实表达；AI 解释有依据 |

## 3. Product Design Principles

1. **Artwork First**：能用海报说明的内容不再用彩色装饰图形；电影卡片无彩色底板。
2. **Quiet Chrome**：优先通过间距、字号、字重、Surface 亮度分层；普通区域不必加边框或阴影。
3. **One Product**：浏览页与工具页改变密度，不改变字体、颜色、控件和反馈语法。
4. **Progressive Disclosure**：先选电影，再看版本，再查技术属性；常用动作可见，低频操作放更多菜单。
5. **State Before Decoration**：先实现真实 Empty / Loading / Error、焦点、禁用与恢复，再增加 Material 或 Motion。
6. **Familiar Interaction**：链接负责导航，按钮负责动作；原生滚动、输入、选择、复制优先，不自造手势要求。
7. **Bounded Variation**：只使用本文有限 Token；个别 Artwork 裁切位置可以随图片调整，不形成新主题。

## 4. Reference Strategy 与现有 UI 审计

### 4.1 本地事实来源与覆盖范围

已审计 [AGENTS.md](AGENTS.md)、[PROJECT_STATUS.md](PROJECT_STATUS.md)、[需求](docs/01-项目需求文档.md)、[架构](docs/02-系统架构设计文档.md)、[开发规范](docs/开发规范与模块边界.md)、[API](docs/API.md)。当前正式前端尚未建立 Vue/Vite 页面、路由、组件或 Composable；设计输入是 HTML Mock，不能将原型接口注释升级成契约。

以下页面均位于 `html/`，文件名前缀为 `personal-cinema-`：

| 页面文件 | 已有设计输入 |
|---|---|
| `app-shell-v2.html` | Sidebar、全局搜索、账号菜单、首页媒体 Shelf、最近观看/类型/最近添加/未看 |
| `movie-library.html` | Movie Grid、筛选、排序、合集聚合、批次加载、上下文菜单、空状态 |
| `recently-added.html`、`favorites.html`、`unwatched.html`、`watched.html` | 同一片库结构的个人视图；筛选/排序和状态差异 |
| `movie-detail.html` | 统一 movieId 详情、全宽 Backdrop、居中标题与动作、版本和技术信息 |
| `movie-detail-dune-part-two.html`、`movie-detail-interstellar.html`、`movie-detail-oppenheimer.html` | 三个旧详情重定向入口；不作为三套详情设计 |
| `collection-detail.html` | 系列背景、合集海报、已拥有成员及返回入口 |
| `ai-discovery.html` | 自然语言输入、建议、结果、解释和继续提问 |
| `media-sources.html` | 来源卡片、添加/编辑 WebDAV、连接测试、状态 |
| `media-source-detail.html` | sourceId 上下文、来源摘要、影片、扫描记录、无效 ID 状态 |
| `scan-task.html` | 运行阶段、进度、成功结果、待匹配与失败队列 |
| `movie-matching.html` | 原文件/候选对照、人工匹配、稍后处理、非影片 |

共 16 个 HTML（含 3 个重定向）。读取 `html/assets/css/` 全部 6 份样式：`personal-cinema-base.css`、`personal-cinema-movie-card.css`、`personal-cinema-library-view.css`、`personal-cinema-workflow.css`、`personal-cinema-ingest.css`、`personal-cinema-collection-detail.css`。同时核对 `html/assets/js/` 的 shell、library-view/library-mock、collection-detail/collection-mock、movie-detail、source-workflow、media-source-detail/media-source-mock、scan-task/scan-mock、movie-matching 的状态与导航模式，以及 `personal-cinema-icons.svg` 的图标语法。

### 4.2 提取事实：不能把重复次数当作设计正确性

统计口径：16 个 HTML 的内联样式与 6 份 CSS 中的静态声明；不含 SVG 图形颜色、JS 动态渲染和浏览器计算样式。重复 Shell 会增加计数，数值是源码分布而非屏幕视觉占比；font shorthand 未计入独立 `font-size` 频次。

| 类别 | 现有事实 | 收敛判断 |
|---|---|---|
| 色彩骨架 | `#0a0a0b / #141416 / #1c1c1e`；`#f5f5f7 / #a1a1a6`；Accent `#73a9b7` | 保留底色与青灰 Accent；补齐 Elevated、Floating 与语义状态 |
| 透明白 | `.055` 28 次、`.1` 25 次、`.035` 与 `.07` 各 23 次；另有 `.025/.045/.06/.075/.08/.09/.11/.12/.16/.2` 等 | 只保留具明确用途的 Hover/Pressed/Selected/Hairline，禁止逐页调 alpha |
| 文字色 | `#f5f5f7` 18 次，`#d7d7dc` 9 次；还并存 white `.92/.62/.46` 与 `#6e6e73` | 固定文本 Token，弱色不承担关键小字；玻璃中收紧为两层文字 |
| 字号 | `12px` 89 次、`13px` 80 次、`11px` 39 次、`14px` 26 次、`15px` 13 次、`17px` 10 次 | 保留 12 元数据、13 紧凑控件/片名、15 正文的不同职责；10–11 提升至 12；17 收敛到 18 |
| 字重/行高/字距 | 600 为主（69 次），650 有 17 次；正文常见 1.45/1.6，标题负字距混杂 | 字重 400/500/600/700；中文正文 1.6，标题适度收紧而不压字 |
| 标题 | Page 约 32；Section 18；详情与合集可到 56；海报标题 13/16、元数据 12/15 | 页面 32，电影/合集上限 48；海报文字增大行高，防中文裁切 |
| 间距 | 单值 12（32 次）、10（28）、9（26）、20（24）、7/8（各22）、16（17）、24（16）；存在 5/6/11/18/22/28 等 | 40px 桌面内容边距已稳定；12/20/24 保留职责，其余按语义归并 |
| 圆角 | sm 12、xs 8、md 16、lg 20；nav/poster 10；editorial 14；另有 24、5 和 pill/circle | 保留 8/10/12/16/20；14→16、24→20，几何圆形专用 |
| 海报 | 2:3、cover、10px；Hover 黑 Scrim `.38`，110ms；本体不缩放、不滤色 | Preserve；微阴影与辅助按钮材质需统一 |
| Shell / Layout | Sidebar 220，外距 8，Main 左偏移 236；桌面内容左右 40；全宽网格 | Preserve 几何；取消全 Sidebar 默认玻璃 |
| 浮层 | 搜索 blur26、账号18、详情侧栏20；阴影可达 `0 32px 90px`；alpha `.76/.82/.88/.92` | Normalize 为单套 Floating Material；不迁移高成本阴影/模糊 |

### 4.3 Preserve / Normalize / Improve / Replace

| 判断 | 具体对象与理由 | 今后实现动作 |
|---|---|---|
| Preserve | 深色背景、青灰 Accent、白色 Primary Button；已有内容优先方向合理 | 沿用语义并映射 Token，不换品牌色 |
| Preserve | 220px Sidebar、40px 内容边距、全宽片库/扫描结果、统一电影详情 | 保留阅读路径与空间骨架 |
| Preserve | 2:3/10px Poster、无缩放 Hover、轻 Scrim、播放/更多分离 | 复用共享 Movie Card，不让每页重写 |
| Preserve | 首页媒体 Shelf、最近观看→类型→最近添加→未看；合集仅聚合拥有成员 | 不重新加入营销 Hero 或统计卡片 |
| Preserve | 来源→扫描→待匹配→结果→片库闭环；错误分队列 | 不用单一转圈遮盖全部进度 |
| Normalize | 透明白、文本灰、650 字重、随机间距、14/24 圆角、不同浮层阴影 | 随相关组件迁移到统一 Token，不做全仓机械替换 |
| Improve | 10–11px 技术小字、超长中文片名、详情 56px 紧行高 | 提升最小字号与换行，电影标题上限 48，内容可自然增高 |
| Improve | 搜索/AI 输入焦点、触摸更多入口、错误恢复和键盘菜单 | 补齐 focus-visible、可达操作、语义属性与焦点归还 |
| Improve | Source Card 常驻边框、详情技术密度、玻璃背景上的小字 | 普通来源卡用 Surface；技术字段渐进展开；浮层使用高对比文字 |
| Replace | 常驻 Sidebar 玻璃、静态 AI 输入的 blur、过大浮层阴影 | 后续相应切片改成实色或本文临时材质 |
| Replace | 原型计时器制造的业务百分比、示例进度或假播放成功（若沿用至正式产品） | 必须接真实状态；未知总量使用不定进度；不得迁移 Mock 假事实 |

这是一份迁移判断，不授权本轮修改任何现有 UI。尚未存在的设置、登录注册、专属 RAG/Agent 完整页面按后文组件组合，不声明它们已经实现或验证。

### 4.4 外部研究及吸收边界

2026-09-11 成功读取远程 `main` 上指定五份文件。它们是第三方设计分析，不是品牌官方设计规范，也不保证描述当前产品应用内部行为。尤其 Apple、Raycast、Linear、PlayStation 含大量官网/营销页面分析。下表是研究结论；后文具体 Token 和交互是结合本仓库作出的项目决策，不是照抄参考值。

| 来源 | 解决的本项目问题 | 吸收 / 不采用 |
|---|---|---|
| [Apple](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/apple/DESIGN.md) | 整体层级与克制 | 图像、文字与留白建立主次；不采用官网双导航、购买 CTA、整屏产品营销、56/80px 营销字号及品牌字体 |
| [Spotify](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/spotify/DESIGN.md) | 深色媒体组织 | 用中性深色托住 Artwork，复用片库分区与次级元数据思路；不采用绿色、音乐播放条、全 Pill 和专有字体 |
| [Raycast](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/raycast/DESIGN.md) | 紧凑工具区的边界和秩序 | 参考近黑层级、控件与细线，转译为表单/搜索/菜单；不把官网内容当作已验证桌面交互，不采用红色斜纹与开发者营销风格 |
| [Linear](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/linear.app/DESIGN.md) | 高密度状态与技术信息 | 用 Surface 与 Hairline 校准扫描/设置，细分正文与辅助信息；不采用紫色、项目管理结构和大型营销标题 |
| [PlayStation](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/playstation/DESIGN.md) | Backdrop 氛围 | 借鉴大图承担主体、文案与动作节制；不采用蓝色品牌、商店/游戏机导航、购买布局 |
| Infuse 产品逻辑 | 私人来源与片库关系 | 仅取本项目需求已有的个人片库定位；本次未另外审计 Infuse 网站或复制其 UI |
| [apple-design Skill](.agents/skills/apple-design/SKILL.md) | Interaction / Motion / Material | 即时反馈、可打断、空间连续、直接操作、有限 Spring、速度承接、降低动效/透明度；舍弃全局玻璃、无差别 Spring 及不适用示例 |

不是五个品牌平均混合。Apple 是整体参考，媒体组织、Artwork、桌面控件和密集状态各解决专项问题，最后都服从项目事实和统一 Token。

## 5. Color System

以下 CSS 是规范值，可迁入未来唯一全局 Token 文件。现有 `--bg/--surface/--panel/--fg/--muted/--accent` 分别映射 `--color-background/--color-surface/--color-surface-2/--color-text-primary/--color-text-secondary/--color-accent`；过渡期允许别名，不保留两组不同值。

```css
:root {
  color-scheme: dark;
  --color-background: #0a0a0b;
  --color-surface: #141416;
  --color-surface-2: #1c1c1e;
  --color-surface-elevated: #242427;
  --color-surface-floating: #2c2c30;
  --color-text-primary: #f5f5f7;
  --color-text-secondary: #a1a1a6;
  --color-text-tertiary: #94949b;
  --color-text-disabled: #6e6e73;
  --color-text-on-primary: #0a0a0b;
  --color-text-on-floating: #b8b8be;
  --color-icon: #afafb6;
  --color-icon-hover: #d7d7dc;
  --color-accent: #73a9b7;
  --color-accent-hover: #8ebbc6;
  --color-accent-pressed: #6598a5;
  --color-focus: #73a9b7;
  --color-success: #83b99a;
  --color-warning: #d6b47b;
  --color-error: #e39393;
  --color-info: #94b5cf;
  --color-primary: #f5f5f7;
  --color-primary-hover: #d7d7dc;
  --color-primary-pressed: #c4c4ca;
  --color-hover: rgb(255 255 255 / 6%);
  --color-pressed: rgb(255 255 255 / 10%);
  --color-selected: rgb(115 169 183 / 14%);
  --color-hairline: rgb(245 245 247 / 7%);
  --color-border: rgb(245 245 247 / 13%);
  --color-control-border: #77777f;
  --color-overlay: rgb(0 0 0 / 48%);
  --color-poster-scrim: rgb(0 0 0 / 38%);
}
```

Accent 沿用仓库青灰色；用于链接、键盘焦点、选中标记和必要强调，不铺满大块背景。Primary 默认白底黑字，保留现有成熟动作语言；不要为了“单一 Accent”强行将所有主按钮染色。状态色只出现在图标、短标签、局部进度上，必须同时有文字。

Secondary/tertiary 不靠父容器 opacity 叠加；重要说明与可操作 Label 至少用 Secondary。Disabled 不是普通辅助文字色。Overlay 是遮罩，不是可直接写字的 Surface。

## 6. Typography

系统字体随设备可用字体选择，不下载/提交 SF Pro，也不以字体缺失阻断显示。中文优先检查 Windows 实际显示，正文不全局负字距；数字统计/进度可使用 `font-variant-numeric: tabular-nums`。

```css
:root {
  --font-ui: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Microsoft YaHei", system-ui, sans-serif;
  --font-mono: ui-monospace, "SFMono-Regular", Consolas, monospace;
  --type-hero: 700 3rem/1.15 var(--font-ui);
  --type-page: 700 2rem/1.2 var(--font-ui);
  --type-dialog: 600 1.5rem/1.3 var(--font-ui);
  --type-section: 600 1.125rem/1.4 var(--font-ui);
  --type-body: 400 .9375rem/1.6 var(--font-ui);
  --type-input: 400 .9375rem/1.5 var(--font-ui);
  --type-label: 500 .875rem/1.5 var(--font-ui);
  --type-card: 500 .8125rem/1.4 var(--font-ui);
  --type-control: 600 .8125rem/1.4 var(--font-ui);
  --type-navigation: 500 .8125rem/1.4 var(--font-ui);
  --type-meta: 400 .75rem/1.5 var(--font-ui);
  --type-badge: 600 .75rem/1.5 var(--font-ui);
  --type-technical: 400 .75rem/1.5 var(--font-mono);
  --tracking-title: -.02em;
  --tracking-body: 0;
}
```

以浏览器默认 16px 为换算基准，不强制重置用户根字号：Scale 为 12 / 13 / 14 / 15 / 18 / 24 / 32 / 48。保留 13 与 15 是紧凑片库控件和中文正文的明确分工，不额外添加 17/19/21/23。Hero 仅电影/合集标题；Page 用于普通页面与 AI；Section 用于内容组；Caption/Metadata 用 meta；Button 用 control；技术字段名称用 label、技术值才用 mono。

长片名：卡片默认一行省略，完整标题必须可通过焦点/详情读取；详情标题自然换行，禁止省略。简介默认 3–4 行可展开；展开不覆盖播放操作。正文阅读宽度不超过 65ch，中文长说明目标 28–40 字/行。移动表单输入提升至 16px，避免过小输入体验；它是明确响应式例外，不新增桌面字号。

## 7. Spacing

```css
:root {
  --space-micro: 2px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
}
```

| 关系 | 间距 |
|---|---|
| 桌面页面左右 / 页面顶部 | 40 / 32px；全宽 Artwork 不受内容 padding 限制 |
| Section 之间 / Section Header 到内容 | 32 / 16px；影视大区块可 40 |
| Poster Grid 横 / 纵 | 20 / 24px；移动 12 / 20 |
| 海报到标题 / 标题到元数据 | 8 / 2px |
| 表单字段组 / Label 到 Input / Input 到 Helper | 20 / 8 / 4px |
| Dialog 内边距 / Footer 与正文 | 24 / 24px |
| 图标到文字 / 同组按钮 | 8 / 8px |
| Artwork 与信息列 | 24px；工具型文件对照 20 |
| Sidebar Nav 项间 / 导航分组 | 4 / 24px |

2px 只用于文字微间隔或光学修正；不成为页面网格。控件高度、图片比例、描边宽度和拖拽位移不是 Spacing Scale，不用机械四舍五入。

## 8. Radius

```css
:root {
  --radius-checkbox: 4px;
  --radius-backdrop: 0;
  --radius-small: 8px;
  --radius-control: 10px;
  --radius-poster: 10px;
  --radius-card: 12px;
  --radius-floating: 16px;
  --radius-dialog: 20px;
  --radius-pill: 9999px;
  --radius-circle: 50%;
}
```

Poster 和 Movie Card 图片用 10；外层 Movie Card 不再套圆角容器。Input/Search/Button/Nav 用 10；Source Card/一般承载卡用 12；Popover/Dropdown/临时面板与编辑性 Artwork 用 16；Modal/Sheet/Drawer 用 20（贴屏边不圆）。Tag/Chip/Badge 用 8；头像圆形；Full-bleed Backdrop 为 0。Pill 只给 Toggle 轨道、进度轨道和确有胶囊语义的分段选择，不能成为所有按钮默认值。

## 9. Layout / Breakpoints / Z-index

```css
:root {
  --layout-sidebar: 220px;
  --layout-sidebar-compact: 72px;
  --layout-shell-inset: 8px;
  --layout-main-offset: 236px;
  --layout-page-padding: 40px;
  --layout-topbar-height: 64px;
  --layout-tool-max: 960px;
  --layout-form-max: 640px;
  --layout-search-max: 760px;
  --layout-ai-max: 960px;
  --layout-dialog-max: 560px;
  --layout-matching-max: 960px;
  --layout-drawer-width: 440px;
  --control-height-small: 32px;
  --control-height: 40px;
  --control-height-touch: 44px;
  --z-content: 0;
  --z-sticky: 10;
  --z-navigation: 20;
  --z-floating: 40;
  --z-modal-backdrop: 60;
  --z-modal: 70;
  --z-modal-floating: 80;
  --z-toast: 90;
  --z-tooltip: 100;
}
```

四个断点常量：`640 / 900 / 1200 / 1600px`；用于 CSS media query 的字面值（不要用 CSS 自定义变量替代 media 条件）。五个区间行为见第 35 节。当前 900px 附近菜单变 Sheet 的逻辑保留语义；散落 1000/1100 等临界点在对应迁移时向此体系校准，并检查容纳能力。

Main 使用剩余空间，全宽片库、来源详情和扫描结果不统一套 960px；只有表单、文本与 AI 对话限制阅读宽度。高度基于内容和可用视口，滚动容器用 `min-height: 0`，浮层最大高 `calc(100dvh - 32px)`。Header 不覆盖内容首行；安全区使用 `env(safe-area-inset-bottom)`。

Z-index 只表达层次：页内 sticky < 导航 < 非模态浮层 < 模态遮罩 < 模态内容 < 模态内部菜单。打开 Modal 后，背景所有入口 inert，Toast 不得给背景动作越过模态焦点。使用浏览器 top layer 时以其实际层级为准，将子浮层渲染在同一顶层上下文；不得用 99999 修补 stacking context。

## 10. Surface Hierarchy

| 层 | Token / 值 | 适用 |
|---|---|---|
| Canvas | background `#0a0a0b` | 页面、海报墙、电影详情底色 |
| Surface 1 | surface `#141416` | Sidebar、设置组和来源卡必要承载面 |
| Surface 2 | surface-2 `#1c1c1e` | Input、嵌入工具区域、选项承载 |
| Elevated | surface-elevated `#242427` | 实色 Dialog/Drawer、临时面板基础 |
| Floating | surface-floating `#2c2c30` | 浮层无透明回退、Tooltip |
| Overlay | overlay 黑 48% | 模态遮罩；不用于普通 Card |

每加一层必须有分组或覆盖理由。不要 Canvas→Card→Card→Card 连续嵌套。Hover 在当前 Surface 加一层 `color-hover`，Pressed 用 `color-pressed`；不得叠多层 alpha 导致颜色不可预测。

## 11. Liquid Glass / Floating Material

**允许少量有语义的 Floating Glass Surface。它表达临时覆盖内容的空间层级，不是全局主题。**

允许：搜索建议/展开搜索、Dropdown、Popover、Context Menu、临时工具条、Filter、AI Suggestions/临时动作、Backdrop 上临时操作、Sheet/Drawer 局部覆盖区域。现有全局搜索 Modal 可沿用材质，长表单 Modal/Drawer 主体默认实色。

禁止：Poster、Movie Card 本体、Page Background、所有 Section、整页 Settings、Source Main Card、每组表单、普通正文、每个按钮/Input、整个 Sidebar。不得同时叠两层实时 backdrop blur；父层已玻璃时，子菜单用 Floating 实色。

```css
:root {
  --material-floating-background: rgb(28 28 30 / 88%);
  --material-floating-background-busy: rgb(28 28 30 / 96%);
  --material-floating-blur: 20px;
  --material-floating-saturation: 115%;
  --material-floating-border: rgb(255 255 255 / 12%);
  --material-floating-highlight: inset 0 1px 0 rgb(255 255 255 / 6%);
  --material-floating-fallback: #2c2c30;
}
.floating-glass {
  background: var(--material-floating-fallback);
  color: var(--color-text-primary);
  border: var(--border-width) solid var(--material-floating-border);
  border-radius: var(--radius-floating);
  box-shadow: var(--material-floating-highlight), var(--shadow-floating);
}
@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .floating-glass {
    background: var(--material-floating-background);
    -webkit-backdrop-filter: blur(var(--material-floating-blur)) saturate(var(--material-floating-saturation));
    backdrop-filter: blur(var(--material-floating-blur)) saturate(var(--material-floating-saturation));
  }
  .floating-glass[data-backdrop="busy"] {
    background: var(--material-floating-background-busy);
  }
}
@media (prefers-reduced-transparency: reduce) {
  .floating-glass, .floating-glass[data-backdrop="busy"] {
    background: var(--material-floating-fallback);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}
html[data-transparency="reduced"] .floating-glass {
  background: var(--material-floating-fallback);
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}
```

Reduced Transparency 查询是渐进增强，不能假定每个浏览器都支持；页面级“减少透明效果”偏好通过明确属性实现，未知支持时默认实色依然完整。Material 只定义深色，不在浅色系统偏好下自动反转一半 UI。暗色背景不降低到 `.5` 以追求玻璃感。

浮层文字只用 Primary / `color-text-on-floating`；禁用除外。亮白、高对比海报背景仍需逐帧可读，必要时 `data-backdrop="busy"` 或直接实色。Hover/Selected 改菜单行，不改变整个玻璃透明度；Focus 用统一焦点环，不用彩色 Glow。小尺寸 Poster 更多按钮优先半透明深色实底，不为每张海报开一个 blur。

这组参数是基于现有 18–26px blur 与 `.76–.92` alpha 收敛的规范默认值，**尚未在本轮进行新材质的浏览器视觉/性能验收**。首个落地切片必须在亮/暗/高频 Artwork 后景、无滤镜、减少透明度和目标 Windows 浏览器检查；只可依据可读性/性能提升 alpha 或退回实色，不以个人喜好逐页换参数。

## 12. Border & Hairline

```css
:root {
  --border-width: 1px;
  --border-hairline: 1px solid var(--color-hairline);
  --border-subtle: 1px solid var(--color-border);
  --border-control: 1px solid var(--color-control-border);
  --border-selected: 2px solid var(--color-accent);
  --focus-width: 2px;
  --focus-offset: 3px;
}
```

Hairline 是装饰分隔，不足以独立说明输入框边界。Input/Checkbox/Toggle 等必须识别的轮廓用 control-border 或等效达到对比的边界；焦点和选中不能用 7% Hairline。普通 Source Card/Section 不默认描边；技术信息、输入、危险操作区、浮层可用。选中边框用 inset 或预留尺寸，避免布局跳动。

## 13. Elevation

```css
:root {
  --shadow-none: none;
  --shadow-poster: 0 2px 8px rgb(0 0 0 / 20%);
  --shadow-floating: 0 8px 24px rgb(0 0 0 / 32%);
  --shadow-dialog: 0 12px 32px rgb(0 0 0 / 40%);
}
```

海报暗图无需阴影也可；普通卡片无阴影；浮层/Modal 才提升。禁止用 `0 20px 60px`、多重 Glow 或加厚黑影代替分层。Artwork 的可读 Scrim 渐变是功能处理，不受“禁装饰渐变”误伤。

## 14. Iconography

沿用 `personal-cinema-icons.svg` 的 Phosphor 风格同源 SVG 语法，`currentColor`；不得混 Emoji、线性图标、彩色品牌图标和另一套粗填充图标。复用已有符号，缺图标再从同源体系补充，不临摹新风格。

Small 16px（元信息）、Normal 20px（导航/按钮）、Large 24px（状态）；空状态可 32px，禁止巨大装饰图标。Nav 现有 17px 在迁移时归一 20px；保留正常线框、明确 active 可用同源填充变体，不能因选中改变图标尺寸。描边沿用源 SVG 比例，不统一覆盖其 path stroke-width。默认 icon，Hover icon-hover，Active primary，Disabled text-disabled；图标仅为状态第二通道，文字仍存在。

## 15. Motion

```css
:root {
  --motion-feedback: 80ms;
  --motion-fast: 120ms;
  --motion-standard: 180ms;
  --motion-panel: 240ms;
  --motion-ease: cubic-bezier(.2, .8, .2, 1);
  --motion-exit: cubic-bezier(.4, 0, 1, 1);
  --motion-popover-offset: 4px;
  --motion-card-lift: 0px;
}
```

| 交互 | 规范 |
|---|---|
| Button Press | pointerdown/键盘按下立即改变 Pressed 颜色；不等待请求；实际动作在合法 click/键盘激活提交，拖出取消仍有效 |
| Poster Hover / 控件显隐 | 120ms opacity；卡片本体不 scale、不滤色、不位移，保留当前成熟行为 |
| Suggestion / Popover | 180ms opacity + 最多 4px 位移；transform-origin 对准触发器，关闭回到相同来源 |
| Modal | 180ms 淡入；内容最多 4px，不从屏幕外飞入；遮罩同步，无 blur 动画 |
| Drawer / Sheet | 240ms transform；从右侧/底部进入；可交互拖动时才考虑下述 Spring |
| 路由 / 列表更新 | 默认不整页过场；保持滚动与返回位置；不整墙 stagger、不为文字逐字 bounce |
| Loading | 使用真实状态；持续动画仅限小 spinner 或局部 Skeleton；不让扫描页全屏运动 |

**Interruptibility**：开合状态变化可随时接收；Drawer 打开中再次关闭，从当前呈现位置反向，而非跳到目标再关闭。不得以 `isAnimating` 屏蔽用户、排队等待动画结束或锁死整个表单。业务防重复提交与动画锁分开实现。

**Spring 只用于需要物理连续性的组件**：可拖拽 Sheet/Drawer、交互式临时面板、确有空间变化的搜索展开。普通 Hover、按钮、文字、列表无需 Spring，不为此引入整套物理引擎。

可执行参考：支持物理参数的库使用 `mass: 1, stiffness: 400, damping: 40`，临界阻尼起点；支持响应参数的实现以 response 约 0.35s、dampingRatio 1 为校准目标，二者不冒充跨库等价 API。只有实际抛掷手势可以降低阻尼至 0.9；默认无过冲。CSS fallback 用 panel/ease，不伪造动画锁。

**Direct Manipulation / Velocity Handoff / Momentum**：按下后立即反馈，实际拖动跟随指针 1:1，保存起点偏移并 pointer capture；释放时把当前坐标、近期实际速度交给同一动画实例，速度单位转换按选用库文档执行。中途抓住时接当前视觉位置，不能跳回初始点。取消 pointer、失焦和系统手势要安全收束。目标吸附按方向/速度与边界判断，但不能覆盖原生页面滚动，也不为了展示该原则新增拖拽。

**Spatial Consistency / Causality**：Search Suggestions 锚定输入框；Movie 更多菜单靠近当前按钮；边缘碰撞可翻转并保持 8px 安全距；Sheet 表示同一菜单在窄屏重新布局。页面返回恢复原卡片焦点与滚动，不凭空回到顶部。

只动画 transform/opacity 和轻量颜色状态；避免持续动画 backdrop-filter、大面积 box-shadow、布局尺寸。Reduced Motion 时移除位移、Spring、视差、自动平滑滚动和闪动；保留即时状态或最多 80ms 淡入，加载用静态占位与文字。不要用全局极短 animation-duration 技巧破坏依赖事件的逻辑。

## 16. Artwork

图片来自当前影片/合集的可靠元数据和本人资源关联。正式图片定位消费 Spring Boot 契约的 OSS/CDN 地址；原型本地 `tmdb-*` 资源只是展示输入。缺图不生成伪海报、不借别片图片、不用彩色随机渐变。

Poster 2:3；Backdrop/Still 优先 16:9 原图；演员头像 1:1；Logo Artwork 用 contain 并限制高度 80px，必须有可访问电影标题，缺 Logo 用文本标题。明确 width/height 或 aspect-ratio 保留空间；首屏主要图及时加载，屏外 lazy；解码完成再替换占位，不等待全页图片。提供适当尺寸资源，不把多 MB 原图用于小卡片。

## 17. Poster

| 属性 | 规范 |
|---|---|
| 比例/裁切 | `aspect-ratio: 2 / 3; object-fit: cover; object-position: center`；不拉伸 |
| 外形 | radius-poster 10px，overflow 裁图；焦点环放不被裁剪的外层 |
| Loading / Skeleton | Surface 2 同尺寸占位；局部静态/轻脉冲，加载不改变卡片高度 |
| No Poster / Error | 同比例中性底、同源电影图标、可读片名；错误只替换图片，不将影片从片库移除；无无限重试 |
| Hover / Focus | 黑 38% Scrim 只在海报上，显示操作；Focus 必须与 Hover 等效，边框清楚，不 scale |
| Favorite / Watched | 小同源状态图标附可访问文本；有色标记不能替代文案；操作在更多菜单同样可达 |
| Progress | 仅真实数据可在海报底部 3px 轨道显示，另有可访问进度文本；无精确数据隐藏轨道 |
| Version / Technical Badge | 多版本以一个“2 个版本”提示；最多一个额外必要格式标签；不同时堆 4K/HDR/HEVC/音轨等 |

角标最多两处：左上状态、右上数量；Hover 操作置底部，避免抢位。底部进度可独立；文本长时先隐藏技术角标，保留标题与状态的可访问说明。

## 18. Backdrop

详情保留当前**全视口背景图、内容位于 Main 内、居中标题与动作**的结构；不因参考品牌改为左侧营销海报。侧栏保持自身不透明承载，文字不能漂在图上无保护。

```css
.movie-backdrop {
  height: clamp(480px, 58vh, 620px);
  background-size: cover;
  background-position: center 42%;
  border-radius: 0;
}
.movie-backdrop::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(to bottom, rgb(10 10 11 / 12%) 0%,
      rgb(10 10 11 / 40%) 45%, rgb(10 10 11 / 80%) 78%,
      var(--color-background) 100%),
    linear-gradient(to right, rgb(10 10 11 / 40%), transparent 70%);
}
```

图层容器实现时需相对定位/独立 stacking context，装饰伪元素 `pointer-events: none`。620px 是图片氛围层上限，不是标题、简介、操作总高度限制。内容超过时向正常文档流伸展，不能裁掉文字。文本区宽不超过 720px、距两边至少页面 padding；图片太亮则给文字区域增加固定深色 Scrim，直到满足对比，不能仅依赖字影。

默认电影详情不另加与 Backdrop 重叠的大 Poster，避免重复抢占画面；合集保留侧海报，桌面 160px、大屏 190px、手机 104px，标题到图间距 24px。未来新增叠放版本需真实内容验证，不作为默认。

背景随页面自然滚走，无固定视差、自动缩放或滚动 blur。滚动后 Top Bar 用实色承载返回与短片名；需要常驻播放时复用紧凑动作，不重复 Hero。Hero 只含电影身份、简介和少量动作，不写购买/推广口号。没有背景图时缩短空白，用 Canvas 上的标题和正文，不保留空巨幅 Hero。

## 19. App Shell

App Shell = Sidebar + Main + 必要 Top Bar + 全局浮层宿主。Sidebar 220px，距视口 8px，Main 偏移 236px；保持已验证的桌面空间。Sidebar 用 Surface 1，无全栏 blur，不放常驻大阴影。低高度视口导航可纵向滚动，账号入口可达。

Top Bar 默认 64px，用于返回、当前位置、搜索和页级动作；Home/Library 不叠两组重复 Page Title。Section Header 使用 section 字体，右侧只有必要“查看全部”/动作；数量是辅助信息，不做 KPI 卡片。Shell/Section Header 是结构容器，没有 Hover/Active/Selected，内部控件独立处理状态。加载时导航仍可用，不用整页 Skeleton 替掉 Shell。

## 20. Navigation

沿用当前主入口：我的片库、AI 发现、媒体来源；最近添加、收藏、未看、已看等个人视图沿用现有分组，设置/账号保留辅助位置。观看记录以真实需求入口承接，不能把“已看”与“播放启动历史”当成一个状态。合集默认从片库进入，不擅增一级“合集管理”。

Navigation Item 高 40px（当前约 38px 归一），左右 12px，图标20px、间距8px、圆角10。Default 次级文字，Hover 白6%，Pressed 白10%，当前项用 Selected 底+Primary 文字+同源 active 图标，`aria-current="page"`；需要强调时加小 Accent 标记，不铺大色块。Focus 用统一环，不能只用当前项底色。

折叠栏每个图标有 aria-label 和焦点 Tooltip；禁用入口给原因，未实现功能不展示可点击假入口。导航异步加载只影响 Main；保留当前项与返回上下文。

## 21. Buttons 与共用状态契约

按钮默认高40、左右16、图文距8、radius-control、type-control；紧凑工具32px；触摸44px。文字超长可增宽/换行，不裁成无意义缩写。Icon Button 可视方形32或40，触摸有效区44；Poster 快捷圆按钮沿用视觉30px，但扩大到不与邻居重叠的44px点击区。

| Variant | Default | Hover / Active |
|---|---|---|
| Primary Button | primary 白底、text-on-primary 黑字；一组只一个主要提交动作 | primary-hover / primary-pressed；不缩放 |
| Secondary Button | Surface 2、Primary 字，可选 subtle 边 | 加 hover / pressed 层 |
| Tertiary Button | 透明、Secondary 字；局部次要动作 | Primary 字 + hover / pressed 层 |
| Ghost Button | 透明、Primary 字；低 Chrome 的明确动作 | hover / pressed 层；图上必须有足够底色 |
| Icon Button | 透明或 Surface 2，icon 色 | icon-hover / Primary，底色同 Ghost |
| Destructive Button | Error 字/图标，默认非大红块；确认 Dialog 内可 Error 底+黑字 | 不改变语义，hover/pressed 用局部状态层 |

所有交互组件继承以下七态契约；后文只有差异，不重复发明状态。未适用状态明确为 N/A，不能为静态容器补 Hover：

| 状态 | 共同规则 |
|---|---|
| Default | 本组件 Surface、字体、尺寸；语义正确的元素 |
| Hover | 仅可操作目标加 hover；触摸不依赖 Hover 才发现入口 |
| Active / Pressed | 输入发生立即反馈，使用 pressed；离开/取消可恢复 |
| Focus | `:focus-visible` 2px Accent，offset3px；白按钮/图上叠深色隔离环，避免焦点淹没 |
| Selected | 持续状态用 selected+勾/文字/对应 aria 属性；与临时 Pressed、Keyboard Focus 区分 |
| Disabled | 原生 disabled 或正确 aria-disabled 并阻止动作；disabled 色，不仅 cursor；原因在旁边可读，不能只靠不可聚焦 Tooltip |
| Loading | 固定原控件尺寸，小 spinner+动作文字、aria-busy；防重复提交但保留必要取消/关闭；无接口取消能力不可伪称取消任务 |

Selected 对普通提交按钮 N/A；收藏按钮用 `aria-pressed`；Checkbox/Toggle 用 checked；Option 用 aria-selected/checked；不要把所有控件都套 aria-selected。Disabled 与 Loading 不等同：请求中保留可读说明，避免全容器降至低透明度。

## 22. Forms

| Component / 用途 | 尺寸与 Default | 状态差异（其余继承七态契约） |
|---|---|---|
| Text Input | 高40，左右12，Surface2，control-border，radius10，type-input；独立 Label | Hover 边界清楚；Active 原生编辑；Focus 环；Selected 为原生文字选择；Disabled 不可编辑；Loading 不盖住已输入内容 |
| Password Input | 同 Text Input，默认遮掩；显示密码按钮有明确名称 | Reveal 保持输入焦点；离开/关闭按组件策略恢复遮掩；不得从已保存来源回填真实密码 |
| Select | 同 Input；优先可靠原生语义或统一可访问 Listbox | Selected 显示当前值；方向键/Enter/Escape；异步选项 Loading 保留当前值，失败可重试 |
| Toggle | 40×24轨道、18px拇指，Pill；有文本 Label 与高对比边界 | checked Accent+拇指位置；Hover 不变值；Space 切换；保存中可禁用单控件，失败恢复并显示原因 |
| Checkbox | 18px可视、44px触摸标签区；8px图文距；radius-checkbox 4px仅此几何例外 | checked Accent底+深色勾，mixed短横；Focus 在框外；加载不能让勾先假成功 |
| Chip | 高28视觉、左右8、radius8，type-meta；可交互版本有32/44有效区 | 选择型用 selected+勾；移除按钮独立名称；普通信息 Chip 不套按钮语义 |
| Tag | radius8，type-meta，描述类型/AI语义 | 纯信息无 Hover/Active/Focus/Selected/Disabled；可删除时删除控件继承七态 |
| Badge | type-badge，水平8垂直2；表达状态/数量 | 非交互七态除 Default 均 N/A；状态变化更新文字，不能只变色 |

表单列宽最多640；Label 使用14px，Helper/Error 至少12px，紧邻字段并用 `aria-describedby`；Error 同时 `aria-invalid`，颜色+文字，聚焦首个错误并保留已输入值。Placeholder 不替代 Label。必填标记解释一次，字段顺序符合接入流程。

### WebDAV 添加 / 编辑

字段按当前 API 契约配置：来源名称、服务地址、访问路径、认证信息等；不得因设计文档自造字段或固定认证方式。一个表单即可，不一字段一张 Card。编辑使用“密码已保存；留空是否保持不变以契约为准”的明确语义，不返回密码字符串。

“测试连接”为醒目的 Secondary，“保存/添加”为 Primary；测试成功只证明当次配置的连接结果，不等于完成扫描或所有文件可播放。配置变化后旧测试结果失效；测试中显示“正在测试连接”；错误就地显示认证失败/地址不可达等脱敏原因。保存后给进入来源/开始扫描入口，不未经业务授权自动扫描。Password、Token、完整敏感地址不进入 Toast、日志、DOM data 属性或持久化 Mock。

## 23. Search

区分两种共享内容模型的容器：

- **现有全局搜索**：保留 Sidebar/快捷入口触发的 Modal，宽最多760px，距顶部约10dvh、最大高74dvh且不越安全区；有模态遮罩、焦点圈定与关闭归还。
- **页面内 Search Input**：稳定40px实色输入；聚焦后 Suggestion Panel 锚定其下方8px、与输入等宽、最大高 `min(480px, 60dvh)`；采用 Floating Glass，不加全页 Scrim、不抢走输入焦点。窄屏按第35节重新布局。

建议分组只显示当前真实可用项：历史、影片、类型、演员、最近访问、明确标识的 AI 搜索入口。历史/建议按当前账号隔离，不能泄露上个用户。输入为空展示少量历史/快捷项，输入后显示匹配；传统搜索与 AI 自然语言入口文案区分，不静默把每次输入都发给模型。

使用 combobox/listbox 合理组合，维护 `aria-expanded`、`aria-controls`、`aria-activedescendant`；上下移动建议、Enter 确认、Escape 先关建议、Tab 正常离开；中文 composition 未结束不提交。导航建议和动作项混合时按实际语义分组，不把任意复杂按钮嵌入 option。

请求可防抖约200ms，但本地焦点反馈立即发生；过期响应按请求序号/取消控制丢弃，不回盖新词。Loading 是列表局部状态、保留输入；Error 给重试；No Result 与空片库分开；滚动页面或锚点消失时关闭/重定位，不让面板悬空。Search Input 七态继承 Input；Suggestion Selected 是当前键盘选项，Hover 不擅自提交。

## 24. Movie Card

组成固定：Poster → 8px → Title → 2px → 一行必要 Metadata。Title 用13px，元数据12px，默认年份/少量状态；电影与资源版本不是两张重复卡。电影卡本体无背景框、无大阴影，最小宽度按网格规则决定。

| 状态 | 行为 |
|---|---|
| Default | 点击海报/标题进入该 movieId 详情；原生链接可新标签打开 |
| Hover | 只 Poster Scrim 与播放/更多淡入；不 scale，不整卡 brightness，不推挤相邻卡 |
| Active | 被按下的具体按钮/链接即时反馈，不把所有子动作变成整卡点击 |
| Focus | 主链接有清楚外环；focus-within 展示与 Hover 相同动作；隐藏动作不可残留不可见焦点 |
| Selected | 仅实际多选模式用选中框/勾，默认浏览不创建“选中电影”持久状态 |
| Disabled | 无可播放版本只禁用播放并说明，详情仍可查看（以权限为前提）；失去权限后移出当前结果 |
| Loading | 同比例 Skeleton+文字占位，保留占位网格；收藏/标记请求仅忙于该动作 |
| Favorite / Watched | 小标记+菜单可撤销的准确文案；失败回滚状态并局部提示 |
| Error / No Poster | 图片失败保留文字/动作；影片数据失败才显示对应 Error；不整墙置灰 |

最多两个即时图上操作：播放、更多；收藏、标记看过、版本入口收口更多菜单。不要嵌套 `<button>` 到 `<a>`；用同级交互元素，避免播放同时导航。Tab 按自然顺序访问，Enter 打开链接，Space 激活按钮；Shift+F10/菜单键可打开聚焦影片菜单。普通 CSS Grid 不冒充 ARIA Grid；需要方向键网格时才完整实现 roving focus，分页/虚拟化不得丢失焦点。

## 25. Movie Library / Home / Personal Views

片库全宽 Grid：桌面基准 `repeat(auto-fill, minmax(160px, 1fr))`，横20纵24；大屏可将最小值增到180以维持海报可读，而不是不断放大到广告牌。移动2列，平板按可用宽度3–4列。行内卡片同宽，不为了填最后一行拉伸最后几张。

标题+工具条+网格，不加统计卡片；筛选/排序在统一 Popover，选中条件可清除。改变筛选重置分页；首批加载替内容为 Skeleton，追加加载保留原网格；追加失败提供尾部重试。不能用“全部加载成功”遮蔽请求失败。

收藏、已看、未看、最近添加共享 Card 和 Layout，仅筛选语义不同。“未看”当前原型只含 unwatched，不含 watching；“已看”不由播放器唤起自动决定。删收藏后可保留短暂原位置反馈再移除，避免焦点突然丢失。

首页保留当前顺序：最近观看 → 电影类型 → 最近添加 → 未看。最近添加和未看预览最多8项；有对应查看全部入口。没有数据的组隐藏或显示针对性引导；新用户只出现接入来源的真实 Empty State，不堆四组空占位。未来 Featured/Personal Picks/AI Recommendations 只有在有真实数据且有明确页面任务时引入，不自动覆盖已验证首页。

Shelf 保留已验证行为：鼠标普通纵向滚轮在可横滚 Shelf 内映射横滚并消费事件，包括到边界；无溢出或离开 Shelf 才滚页面。Ctrl/Shift+wheel、触控板/触摸原生横滚保持其原语义；不在 pointerleave 吸附，不新增强制吸附/右箭头。该规则是当前局部 Shelf 例外，不推广到整页滚动劫持；必须保留键盘与触摸浏览能力。

## 26. Movie Detail

| 层级 | 内容与排序 |
|---|---|
| 第一层 | Backdrop、电影标题、简介、播放、收藏、观看状态；真实进度可用时才出现 Watch Progress |
| 第二层 | 年份、Genre、时长、评分来源、主演/导演、基本格式概况 |
| 第三层 | 当前版本的分辨率、Codec、码率、帧率、HDR、音轨、字幕、文件大小、来源、Version/Edition、路径 |

第一层内容居中，title最多48px，简介正文15px；最多一个Primary播放和少量Secondary。第三层在“媒体版本/文件信息”中展开，字段按 Video / Audio / Subtitle / Source 分组，Label与值对齐，长路径可换行/受控复制；不让 HEVC、75 Mbps、TrueHD、PGS、83GB 成为大号首屏标题。

多个版本先选可用版本再播放；Selected 明确，来源失效/认证失败与格式未知区分。不在页面中长期显示签名地址或密码；复制当前播放定位是明确用户操作，需说明其临时性/敏感性。外部播放器无法可靠检测时提示“若未打开，请检查 mpv 与协议注册”，不要根据计时器武断宣称未安装。

版本详情、演员区和 RAG 助手使用同一 Surface/文字层级。RAG 是当前影片上下文入口，不挤掉电影简介，也不把详情变成聊天页。

## 27. Collections

保留当前原型语义：公共系列元数据 + 用户已拥有的 Movie 成员；不是公共可播放合集、用户自建 Playlist 或独立用户收藏实体。主片库无筛选时拥有至少两部才聚合；筛选视图/收藏/已看/未看/最近添加显示电影，不沿用合集级个人状态。此规则是现有原型行为，正式接口落地仍需与 API 确认，不能凭本文新增数据表。

Collection Card 复用2:3图形与标题，元数据“已拥有 N 部”；无整个合集播放/收藏/已看按钮。Hover/Focus 使用 Movie Card 的视觉反馈但动作是进入合集；Active 链接响应；Selected 多选不适用；Loading 同比例占位；Disabled 仅真实不可访问情况。没有合集图时可用统一已有成员拼图规则或中性占位，不随机变换形状。

Collection Detail 保留 Backdrop+左海报+介绍+已拥有成员 Grid。缺失系列成员若作为元数据出现，标识“未加入片库”，不提供假播放、不混入本人结果。长标题允许换行；Hero 不固定巨大高度。

## 28. Media Sources / Source Detail

Source Card 用 Surface1、radius12、padding24、gap20，网格最小260px；名称18px，协议/最近扫描12px，当前状态图标+文字。Default 无常驻 Accent 边框；Hover/Focus 只对详情入口和按钮反馈；非整卡动作区不强制可点。Active 为正在按下动作；Selected 仅来源筛选等真选择场景；Disabled 来源明确显示“已停用”，保留编辑；Loading 只限测试/扫描动作，不抹掉来源身份。

Source Detail 使用当前 sourceId：名称→连接/启用状态→主要动作→资源/影片→最近扫描。显示必要状态与少量事实，不能做十几张统计卡。返回来源列表保留位置；无效/无权限 ID 展示对应状态，不以第一个 Mock 来源兜底。

连通、扫描完成、资源可播放是不同结论。来源页面不直接展示原始凭据/完整敏感 Endpoint；失败给可执行恢复动作。删除/停用影响通过 Confirm Dialog 说明，以真实业务契约决定影响范围，不擅自描述会删除云端文件。

## 29. Scan & Ingest / Matching / Result

任务状态与处理阶段分开表达；下表是 UI 语义，不是新增后端枚举。按真实 API 状态适配，未返回阶段不得模拟执行。

| 状态 / 阶段 | 画面与动作 |
|---|---|
| Idle | 来源/范围摘要、“开始扫描”，没有自动转动的进度 |
| Scanning | 当前阶段、已发现数量/已处理数量；总量未知用不定进度 |
| Matching | 自动匹配进行中；需人工确认的条目进入待处理队列 |
| Scraping | “正在获取影片资料”；与文件识别分开，显示真实完成计数 |
| Uploading Artwork | 仅服务端确有该阶段时显示“正在保存海报与背景图”；不要展示内部存储实现 |
| Completed | 成功结果海报网格 + 简短摘要 + “查看片库/返回来源” |
| Partial Success | 已入库结果保留；待匹配/失败各自队列，有重试/人工处理入口 |
| Failed | 明确失败阶段、脱敏原因、重试/返回；不假装一切从零、也不隐藏已成功项 |

当前原型还包含连接检查、目录扫描、文件名解析、TMDB 匹配、ffprobe、入库等阶段，按业务返回保留有用细节。ffprobe best-effort 失败可产生未知技术信息，不等于整批入库失败。不同阶段计数分母不可混用；无总量不得用定时器制造0–99%。取消/暂停仅在契约支持时出现。

运行页以进度+阶段文字+少量正在处理的海报为主，完成页全宽 Grid，与片库视觉一致。待匹配/失败桌面可两列，窄屏单列；不要将成功、待确认、失败混成一个红表格。Progress 条默认4px，任务摘要可8px；有 label 与可访问值，未知总量不设置伪 `aria-valuenow`。

Matching：原文件信息与候选电影并列，文件名可换行，候选图96px、间距20；选中用 Accent 边界+勾，键盘可选择，主动作“确认匹配”。宽面板最多960，窄屏上下排列；Footer 保留“非影片/稍后处理/确认”等已有动作，但危险或业务含义必须准确。Loading 不清掉原文件，候选加载失败可重试；不自动选中低置信度候选并提交。

## 30. AI Experience

AI Discovery、自然语言检索、推荐、RAG 与智能选片 Agent 都属于同一影音软件。默认 Canvas、统一字体、普通 Input 和 Movie Card；不引入第二侧栏会话产品、紫色主题、Neon、Sparkle 边框或巨型“AI”营销头图。

| Component / 模式 | 规范与状态 |
|---|---|
| AI Discovery | 输入当前需求→可解释条件→少量电影结果；入口Page Title32；内容最多960px，输入最多800px；空片库优先接入引导 |
| AI Recommendation Card | 海报+片名+一到两行理由+少量可解释标签+观看/资源状态；与普通 Movie Card 同图形语法，详情导航同七态；仅操作按钮可忙/禁用 |
| AI Chat Surface | 正文15、行高1.6、实色/Canvas文字组；角色用轻标签区分；Static 无容器 Hover/Focus/Selected；流式 Loading 用阶段文字，旧回答保留 |
| AI Suggestion Surface | 只在当前输入/影片附近展示建议；临时覆盖可用 Glass，正文中的建议列表用实色；选项继承菜单七态 |
| RAG 影片助手 | 当前电影名/缩略图明确绑定；默认“无剧透”，显示资料依据/信息不足；剧透许可显式确认，不能用 Hover 泄露内容 |
| 智能选片 Agent | 显示正在筛选/查询版本/检查资源等实际任务阶段，最终列条件、检查结果、理由；不展示内部推理链或密钥/工具原始响应 |

AI 生成理由/标签以12px标识“AI 生成”；Genre、评分、码率等仍是业务事实，不写进同一模糊标签组。资源未经检查显示“尚未检查”；未知不得显示绿色“可播放”。硬条件不足展示真实数量和可选修改建议，用户确认后才放宽；不会自动转互联网推荐。

流式回答不每个 token 自动滚动；用户在底部才跟随，向上阅读后保留位置并给“查看新内容”。支持中止展示与重试的真实语义；若后端未支持取消，不宣称任务已停止。失败保留输入与已生成片段并标“回答未完成”；AI 不可用时传统搜索、片库、来源和播放仍可用。内部术语（Embedding、向量库、模型调用次数）不成为普通选片过程必读信息。

## 31. Settings / Authentication

Settings 最大阅读宽960，具体表单640；标题32、分组标题18、设置项Label14、Helper12。用“分组标题+设置行+必要Hairline”，一组最多一个Surface；Toggle/Select/Input按第22节复用。无Hero、Artwork、全页Glass或多层Card。

个人资料、观看偏好、播放器说明、显示偏好按正式需求组织；只显示已支持选项，不给P0用户提供假PotPlayer/本地扫描开关。“减少动效/透明效果”跟随系统并允许用户明确减少；偏好属于当前用户/本地显示层，不泄露跨账号信息。

保存方式每组一致：要么立即保存并局部反馈/失败回滚，要么显式保存；不能同一组无提示混用。需要离开提示时只针对尚未保存真实改动。危险区使用轻边界、准确影响文案和Destructive动作。

Login / Register 使用同一Canvas与字体，单列最大400px，Label清楚、密码遮掩、登录Primary、切换注册文本链接；支持密码管理器、正确 autocomplete、键盘提交、局部Loading/Error。注册字段与规则以契约为准，不擅增邀请码/第三方登录；不放公共可播放影片墙。登录后空片库引导添加WebDAV。401说明重新登录且不泄露之前数据；403说明无权限，不假装空结果。

## 32. Floating Components

所有浮层用统一宿主/定位能力；非模态锚定内容，模态圈定焦点并 inert 背景；Escape 关闭最上层，关闭还焦点给触发器（若已移除则给合理邻近位置）。不得把所有面板都从中央弹出。

| Component / 用途 | Default 几何与材质 | 七态应用/交互差异 |
|---|---|---|
| Tooltip / 简短解释 | Floating实色，radius8，padding8，最大240px，meta；Hover/Focus约400ms出现，blur/离开消失 | 非交互，Active/Selected/Disabled/Loading N/A；不含必要唯一信息，不放按钮，Escape可关 |
| Dropdown / 单一选择或动作 | 宽至少触发器且常规≥180px；padding8；行高36；Glass/实色Floating | 行继承七态；选择型勾选当前值；Loading在列表内；键盘方向/Home/End/Enter/Escape |
| Popover / 筛选/上下文表单 | 宽280–360px、padding16、锚点距8；Glass短面板，长表单实色 | 容器无Hover/Selected；内部控件各自七态；可Tab进入，不误作menu |
| Context Menu / 影片更多 | 与Dropdown同一行规格；按钮附近或指针位置，碰撞翻转 | menuitem/checkbox/radio按真实动作；右键不是唯一入口；Shift+F10支持；Disabled项说明原因 |
| Modal / 多步骤任务 | 默认宽560、匹配960，padding24、radius20，Elevated实色；Overlay48% | 容器七态仅Default/Loading；内部控件继承；显示标题与关闭，内部滚动不裁Footer |
| Dialog / 确认 | 宽440–560，影响说明+取消+唯一确认，Destructive按需要 | 默认焦点置安全动作/标题；Enter不能误触破坏操作；请求失败留在对话框 |
| Drawer / 详情编辑 | 右侧宽440且不超视口，Elevated，左角20，右贴屏角0 | 从右侧进出；仅真选择条目Selected；关闭/中断和焦点行为遵守Motion |
| Sheet / 窄屏动作 | 底部全宽，上角20，下贴屏，最大85dvh，safe-area | 行目标44；同桌面菜单的业务动作；拖拽关闭可选但始终有关闭按钮，未保存数据不可滑掉 |
| Floating Toolbar / Quick Actions | radius16，padding8，按内容宽，Glass一次 | 按钮七态；不遮标题/字幕/输入，临时出现且可关闭，无权限动作不出现 |
| Floating Glass Surface | 第11节统一材质，仅临时覆盖 | 容器不是按钮，无Hover/Active/Selected；内部Focus不改变全层透明度；Loading仍保证可读 |

外部点击仅关闭非破坏性临时面板；表单Modal若会丢改动不能静默关闭。非模态Popover不全局锁滚；Modal锁背景滚动但保持内容宽度，关闭恢复原滚动位置。移动键盘出现时输入和提交按钮可见，浮层不能跑到可视区域之外。

## 33. Feedback & Status

Toast 使用Floating实色或单层材质，宽 `min(360px, viewport - 32px)`，padding16、radius16；默认屏幕右下，移动底部安全区。成功约4s、普通信息5s；含行动的通知在Hover/Focus暂停，不把失败恢复入口仅放自动消失Toast。最多3条合并重复消息，不堆满屏幕。

Success/Warning/Error/Info = 同源图标+准确文字+可选操作，色彩只小面积表达。成功示例“已添加到收藏”；播放示例“已发起播放”；失败示例“连接测试失败，请检查认证信息”。后台堆栈、Token、完整路径或原始Prompt不显示。一般消息 `role="status"`，需立即处理的错误可alert，避免重复播报。

Progress 的百分比仅来自可靠完成量；阶段变化同时更新文本。Loading spinner16/20px配短文本，不单独转圈无限等待；超时转可恢复状态以真实超时策略为准。Toast/Progress/Loading 容器无Hover/Active/Focus/Selected/Disabled，只有可点击重试/关闭继承按钮状态；Toast暂停计时不等于容器变成按钮。

## 34. Empty / Loading / Error

| 场景 | 画面与行动 |
|---|---|
| 全新空片库 | 标题“开始建立你的片库”+说明添加本人WebDAV+唯一Primary“添加媒体来源”；不自动填电影 |
| 已有来源但无影片 | 说明还未扫描/未识别，给“查看来源/开始扫描”，以真实状态判断 |
| 筛选无结果 | 保留工具条与条件，给“清除筛选”；不同于空片库 |
| 收藏/已看为空 | 当前视图说明+“浏览片库”，不再引导重复添加来源 |
| AI无结果 | 说明哪些条件限制结果，给具体可选调整；不虚构推荐 |
| 全页首次Loading | 保留Shell、标题、工具条；内容Skeleton匹配真实网格首屏数量 |
| Skeleton | Surface2底、Elevated轻高光；Poster比例/文字高度固定，aria-hidden；容器aria-busy、一次加载播报 |
| 局部/追加Loading | 保留已加载结果，只在当前组或网格尾部占位 |
| 数据Error | 就近说明失败范围、重试、返回；网络错误保留输入与筛选 |
| Image Error | 第17节图片占位，数据与详情入口保留 |
| 无效ID/无权限 | 独立说明不可访问/不存在，提供返回；不可拿另一用户/首个Mock数据顶替 |

Empty State / Error State 正文最多两三句，标题18，说明15，图标32可选；区域padding32，不做营销插画卡。状态容器无Hover/Active/Selected/Disabled；重试/添加/返回按按钮/链接七态；Skeleton本体不聚焦，无交互，不播报每一个占位。Reduced Motion下Skeleton静态，不能用脉冲代替明确Loading文字。

## 35. Responsive

| 区间 | Shell / Padding | 内容与浮层 |
|---|---|---|
| Large Desktop ≥1600 | 220 Sidebar，40内容边距 | 全宽片库最小海报180；表单/文字仍限宽；Backdrop≤620 |
| Desktop 1200–1599 | 220 Sidebar，40边距 | 海报最小160，自适应约5–7列；详情保持居中第一层 |
| Small Desktop 900–1199 | 72紧凑Sidebar，Main偏移88，24边距 | 图标配Tooltip；Grid依可用空间约4–5列；工具摘要可折两列 |
| Tablet 640–899 | Sidebar由按钮打开Drawer，Main偏移0，24边距 | Grid约3–4列；详情技术列堆叠；Backdrop高400px；菜单可Sheet |
| Mobile <640 | Sidebar收Drawer，Top Bar保留导航入口，16边距 | Poster2列/gap12；标题32px，Backdrop高320px；表单输入16px；Modal按任务变Sheet或全屏 |

建议列数不是硬编码：可用宽度、最小海报宽与gap决定真实列数。移动极窄/字体放大时允许一列，禁止横向溢出。不要为设备型号新增十几个断点。

详情移动：标题/动作可换行，技术信息逐行，合集海报104px；Movie Detail仍不强加大Poster。Modal窄屏底部Sheet适合短动作，长表单使用全屏可滚动Dialog，不把85dvh硬上限强施在键盘上方。Search Suggestions在Tablet以内扩展为可视口内面板，保持输入和建议关系；若切换为模态必须同步焦点/遮罩语义，不能只变CSS。图片层高度减少不截断文字内容。

在320/640/900/1200/1600边界附近和200%缩放检查布局；44px触摸目标、底部安全区、长中文片名、长来源名/路径必须可用。Hover相关CSS限 `(hover: hover) and (pointer: fine)`；触摸提供常驻更多入口。

## 36. Accessibility

- **Focus Visible**：统一2px Accent外环、3pxoffset；图片和白按钮添加Canvas隔离；不能仅 `outline:none`。焦点不被overflow/sticky裁掉，必要时scroll-margin。
- **Keyboard Navigation**：所有核心流程仅键盘可完成；按Tab自然顺序、菜单方向键、Escape关顶层、Dialog圈定并归还；输入法composition正确处理，无正tabindex。
- **Contrast**：普通文字目标≥4.5:1，大字≥3:1；关键控件边界与状态图形≥3:1。Hairline仅装饰。对Artwork/Glass必须检查合成后的最不利背景，不能只测透明前的颜色。
- **Target Size**：桌面独立操作有效目标至少32×32；触摸44×44；小图标扩充点击区且不能重叠邻居。整行Label可用于扩大Checkbox/Toggle目标。
- **Labels**：Icon Button有中文aria-label；当前页aria-current；勾选/展开/忙状态有正确aria属性；图片旁已有相同片名时装饰图可空alt避免重复，独立有意义图片提供描述。
- **Hover Alternative**：Focus展示海报动作，触摸可见更多；完整片名和错误原因不能仅靠hover。
- **Reduced Motion**：遵守系统偏好和显式减少设置；禁位移/弹簧/视差/自动滚动，状态仍立即更新；无需动画也能理解流程。
- **Reduced Transparency**：系统查询+显式属性+无filter实色回退；减少透明与减少动效分别处理，不推断同一偏好。
- **Forced Colors**：保留原生系统高对比，装饰Scrim可关闭，焦点使用系统Highlight，控件用CanvasText边界；不要强制关闭浏览器颜色适配。
- **Readable Content**：支持文本放大、200%缩放、长中文/英文路径；状态不用颜色独立编码。Disabled低对比只用于真不可用控件，不用于重要帮助。
- **Announcements**：扫描阶段/错误以合适live region汇总，不每个百分比或AI token播报；用户阅读时不夺焦点。

建议统一焦点样式（不要给静态容器滥加tabindex）：

```css
:focus-visible {
  outline: var(--focus-width) solid var(--color-focus);
  outline-offset: var(--focus-offset);
}
.on-artwork:focus-visible, .button-primary:focus-visible {
  box-shadow: 0 0 0 3px var(--color-background);
}
@media (forced-colors: active) {
  :focus-visible { outline: 2px solid Highlight; }
  .floating-glass, .floating-glass[data-backdrop="busy"] {
    background: Canvas;
    color: CanvasText;
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}
```

## Anti-Patterns

- **Traditional Admin Dashboard / SaaS Dashboard aesthetic / Unnecessary Dashboard Statistics**：个人首页四块数量卡、KPI为主；禁止用后台密度替代观影内容。获准ADMIN区也保持轻量。
- **Apple.com Clone / Apple TV Clone / Spotify Clone / Infuse Clone / Linear Clone / Raycast Clone / PlayStation Clone**：品牌色/Logo/专有字体、购买导航、音乐播放条、游戏商店或项目管理布局不能拼接进本项目。
- **Glassmorphism Everywhere / Excessive Liquid Glass / Everything Having Blur**：全Sidebar、海报、所有Card/Input/Settings毛玻璃，多层叠blur。
- **Purple AI Gradient / AI Glow / Everything Having Glow**：AI另起紫色主题、发光Sparkle边框、霓虹对话框。
- **Excessive Gradient / Excessive Shadow / Excessive Border**：用装饰渐变、大阴影、每卡描边建立层级；Artwork功能性Scrim除外。
- **Excessive Card / Card inside Card**：已有间距和标题能分组仍套多层容器。
- **Excessive Hover Scale / Excessive Spring / Animation for Decoration**：海报scale1.10、所有按钮弹跳、整墙逐个飞入、动画锁输入。
- **Huge Marketing Typography / Random Radius / Random Spacing / Random Colors**：普通页面56/80px大标题；每页自定一组灰色/间距/圆角。
- **Dense Metadata on Movie Card / Technical Information Dominating Movie Detail**：卡片五行技术规格，HEVC/码率/文件大小抢过电影名。
- **AI UI Breaking Visual Consistency / Every Page Inventing New Components**：AI换字体/图标/Surface；新增页自行重写Button/Menu/Card。
- **UI Decoration Competing With Artwork / Everything Being Rounded Pills**：图像外再加大彩色底板、巨大圆角、全站胶囊控件。
- **False State**：公共电影充当用户片库、模拟时间当进度、请求唤起当播放成功、未知资源当可播放、AI推断当文件事实。

## 实施验收与维护边界

本文完成了源码审计、指定参考研究与规则收敛；本轮只新增本文，不宣称完成Vue组件落地或新视觉浏览器验收。后续首个相关切片执行以下检查，结果随正常项目进度记录，不另建第二份设计事实源。

本轮文档检查：本地来源链接可解析、CSS Token 引用均有定义、代码围栏成对。按不透明 Surface 的 sRGB 对比计算，Primary/Secondary/Tertiary 最低分别为12.77/5.41/4.61:1；control-border 对最亮 Floating 为3.13:1。88%玻璃覆盖白色背景时，合成底色约为`#373739`，Floating辅助文字对比约6.02:1。这是数值校验，不代替真实图片、焦点状态、浏览器渲染及性能验收。

| 自检维度 | 通过条件 / 对照现有页面 |
|---|---|
| Product | 登录新用户→空片库→本人WebDAV→扫描→片库；无公共播放/个人首页统计大盘 |
| Apple / Media | Home Shelf和Library Grid保留；Poster2:3/10、无scale；Detail画面优先且不是营销页面 |
| Tools | Source→Scan→Matching→Result状态不混淆；Settings用同一组控件 |
| AI | 输入/结果仍属影音语言，理由有标识、硬条件不放宽、无紫色Glow；失效不影响普通业务 |
| Material | 搜索/菜单用统一Token；Sidebar/Poster不Glass；亮白、暗图、复杂后景下可读；实色fallback完整 |
| Motion / Skill | 连续开关Drawer无跳变/锁输入；菜单锚点正确；无全站Spring；减少动效有效 |
| Tokens | 新值能映射本表；13/15各有职责；没有局部复制同名不同值 |
| Components | Movie Card、Button、Input、Menu七态明确；静态容器不伪装交互 |
| Accessibility | 键盘全流程、焦点还原、屏幕阅读状态、触摸目标、对比、两种减少偏好均覆盖 |
| Responsive | 五区间及边界、长片名/路径、200%缩放无裁切；图片层高度不限制文字 |
| Business / Security | 无用户越权、凭据/临时定位泄露、伪播放进度；P0不新增服务或播放器 |

当前代码与目标有差异时按“复用骨架→统一Token→补状态与可访问性→验证Material/Motion”逐组件迁移。首批建议覆盖Movie Card、Search/Popover、Source Form，不以建立设计系统为由一次性改写所有HTML。需要改API或业务状态时走正式切片契约确认，本文不承担接口设计。

## Agent Implementation Rules

1. 新增或重构UI前先读本文，再读当前任务相关产品/API事实及组件源码。
2. 优先复用已有成熟组件；没有正式Vue组件时从已审计共享HTML/CSS结构抽取，不从零另画。
3. 优先复用本文Token；在首个相关切片建立唯一全局Token出口，旧命名可暂存别名，值不分叉。
4. 不创建无意义随机颜色；Artwork自身颜色不等于新增UI Accent。
5. 不创建无意义随机Radius；圆形/比例/Checkbox明确例外不得推广。
6. 不创建无意义随机Spacing；先判断属于哪种内容关系再选值。
7. 不因单页需求创造新的Design Language；工具页只调密度，不换主题。
8. Movie Artwork优先于UI Decoration；普通片库卡不得增加装饰容器。
9. AI页面不得脱离影音视觉语言，AI推断不能覆盖影片/资源事实。
10. Floating Glass只用于合适的临时浮层，必须有实色回退与可读性检查。
11. 不滥用Liquid Glass；整页/Sidebar/Poster默认实色或图片本身。
12. 不滥用Hover Scale；保留当前Poster不缩放行为，Focus和触摸有等效入口。
13. 不滥用Spring；需要时实现Interruptibility与正确速度承接，不锁动画输入。
14. 不滥用Card；Spacing与Typography足以表达关系时不套容器。
15. 小UI修改不要随意修改整个设计系统或冻结需求/架构/开发规范。
16. 需求、成熟行为与本文冲突时明确指出证据和影响，按第1节优先级解决，不静默覆盖。
17. 新设计经真实内容、状态、键盘和响应式验证成熟后才考虑更新本文。
18. DESIGN.md改动属于设计系统变更，说明来源、影响和迁移边界；不创建DESIGN-v2等平行事实源。
19. 使用apple-design时必须服从产品事实、成熟UI和本文；它只辅助交互、动效、Material与细节。
20. Skill示例不得直接覆盖项目规范；原生Web行为、不适用手势/营销模式需要主动舍弃。
21. 完成切片前按上表审查全部适用状态；Mock演示、静态检查和真实浏览器/接口验证分开报告，不虚报完成度。
22. 本文不授权扩展P0、修改业务/数据库/API、写入远程应用或执行Git操作；遵守当前任务授权和AGENTS.md。

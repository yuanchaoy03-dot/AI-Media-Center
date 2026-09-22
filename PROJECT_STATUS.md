# PROJECT STATUS

- 最后更新时间：2026-09-22

## 当前状态

- 透明度规则统一：账号菜单取消系统减少透明度自动降级；搜索、筛选/排序、影片菜单、海报按钮及详情操作补齐显式减少透明度和无滤镜回退，默认材质与业务逻辑不变。内置 Chromium 实测系统减少透明度为true时仍保留默认玻璃；显式属性测试发现并修正Vue scoped全局选择器写法，认证、片库组件及详情操作均成功关闭模糊，清除测试属性后恢复。类型检查、构建及diff检查通过，未捕获浏览器error日志；无滤镜能力分支仅源码审查，未在不支持滤镜的浏览器实测。

仅在恢复任务、判断下一步或核对实现程度时读取。项目范围和工作规则见 [AGENTS.md](AGENTS.md)，契约状态见 [API.md](docs/API.md)；本文件不定义新的产品决策。

- 当前阶段：正式需求/架构/工程基线已完成；Vue 使用 Frontend Mock，尚未接入 Spring Boot / FastAPI、真实登录或播放器。
- 当前前端切片状态：片库、筛选排序、加载状态、合集详情、全局搜索、电影详情及媒体来源列表/详情已迁移；均使用 Frontend Mock。主页及其他未完整迁移页面仍不能按 HTML 原型完成度计为 Vue 完成。
- 最近完成：媒体来源 Vue Mock 列表/详情及扫描目录主流程迁移；此前完成详情横图与竖版海报分离、滚动条补齐和电影详情桌面验证。
- 最近文档维护：API 增补媒体来源前端已确认数据需求 draft，未锁定 HTTP 契约；此前完成 Context Routing、Apple Skill reference 拆分和 DESIGN 治理。
- 媒体来源 Vue：列表与 `/media-sources/:sourceId` 已从 HTML 原型迁移，复用现有 Shell；包含 WebDAV 添加/编辑/测试/删除、独立 MediaScanRoot 暂选后保存及增删启停、目录逐层浏览、手动 Mock ScanTask 和最近扫描摘要。新连接为 0 个根、不自动扫描；任务保留启动时 rootPaths 快照，不虚构新增影片。会话内跨路由保留状态，刷新恢复 fixture；尚未接 Spring Boot / 真实 WebDAV。
- 媒体来源验证：内置 Chromium 完成 1366/1440/1600/1920px 与 900×500 的同内容 HTML/Vue 几何对照，检查列表、详情及短窗口弹窗截图；覆盖添加/必填/测试失败与成功/修改失效、0/1/多根、全停用/部分启用、目录取消/保存/移除、扫描运行/完成、删除/空列表、非法 ID/返回及菜单外部/滚动/resize 关闭。服务回归覆盖范围快照、扫描门槛、删除取消任务与连接中断 failed；failed 的浏览器展示及显式减少透明度/减少动效分支仅源码检查，未单独验证 Edge 或系统级 Windows scaling。
- 媒体来源检查：`npx vue-tsc -b`、`npm run build`、7 项 Node 服务回归和 tracked/untracked diff whitespace 检查通过；未捕获浏览器 error/warn。无新依赖，无独立 lint 脚本。原型 `confirm()` 改为原生 `<dialog>` 二次确认；播放反馈沿用“未接入”，未迁移移动 Action Sheet 或自定义焦点代码。
- 登录 / 注册 UI：已直接用 Vue 实现 `/login`、`/register`，独立无侧栏布局、页面互切、必填/确认密码校验、密码显隐、提交中和服务未接入反馈。只预览 UI，不发送/存储凭据、不创建账号/登录态、不改变现有业务路由访问。真实认证、路由守卫及注册后的空片库闭环尚未实现。
- 登录 / 注册视觉更新：共用 AuthForm 使用本地开发素材的私人电影收藏背景与深色磨砂认证窗口；Dune横图移至中央两列中段，调整裁切与表面高光，玻璃alpha/blur/saturate及表单不变，参数见 DESIGN 第31节。仍为 UI Preview，尚未接入 Spring Boot Authentication。本轮类型检查与构建通过；Edge检查登录/注册正常玻璃截图、注册480×720窄窗口及900×500低窗口无横向溢出且内容可滚动。按用户确认，认证窗口不再因系统减少透明度偏好自动降级；保留显式减少透明度、无滤镜回退和减少动效，未修改系统偏好。显式减少透明度与无滤镜分支源码保留，未独立模拟；未验证系统级缩放。
- 登录 / 注册验证：类型检查与构建通过；内置 Chromium 验证必填、密码显隐、注册密码不一致、Enter 提交、Loading 禁用、未接入反馈及页面切换；1366/1440/1920px 与900×500短窗口无横向溢出，已检查页面截图。未单独验证 Edge、系统级 Windows scaling 或真实密码管理器。
- 下一步：基于媒体来源 UI 数据需求 draft 确认 API，实施 Spring Boot 认证/CurrentUser → 新用户空来源 → 保存/测试本人 WebDAV → 只读目录浏览 → MediaScanRoot 保存的垂直联调，再接主动扫描。来源凭据更新、资源生命周期、路径归属和重叠根策略需由后端契约落实；继续 Desktop + Mouse。
- 已知问题 / 限制：当前个人状态仅 Mock 副本，无后端持久化；播放、版本选择与 AI 仍提示未接入。完整原型不代表功能已实现。
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

# API契约

## 用途

本文件随真实页面和垂直切片逐步维护Vue与Spring Boot、Spring Boot与FastAPI之间的API契约。当前不预先设计完整系统接口；只有出现明确页面或用例时才新增条目。

接口状态只使用：`draft`、`confirmed`、`implemented`。

## 当前契约

### 登录 / 注册表单（UI 草案）

- 状态：`draft`；对应 `/login`、`/register`，尚无 HTTP 请求或 Spring Boot 实现。
- 页面暂用 `username`、`password`；注册额外输入确认密码，仅用于前端一致性校验，不作为业务请求字段。
- 当前仅校验用户名非空白、密码非空、确认密码一致；用户名格式/长度、密码强度、重复账号语义和最终认证字段待联调确认，不视为后端规则。
- 提交仅模拟短暂 Loading，随后显示认证服务未接入提示；不发送、记录或持久化凭据，不生成 Token，不创建账号或登录态。
- Endpoint、响应、JWT 生命周期及成功后的导航留待认证切片确认；未来业务请求仍只访问 Spring Boot，新用户默认空片库。

### 获取当前用户片库

| 项目 | 内容 |
| --- | --- |
| 所属模块 | movie |
| 对应页面/用例 | `/library` 普通电影海报网格 |
| Method | GET |
| Path | `/api/movies`（暂定） |
| 状态 | draft；仅明确展示语义，尚未实现 Spring Boot / HTTP 接入 |

**Request**

当前阶段无查询参数。身份由 Spring Boot 的可信 CurrentUser 确定，不接受前端传入 `userId` 作为身份依据。

**Response**

以下仅定义列表项业务字段（对应前端 `LibraryMovie`），统一响应包裹、分页、筛选、排序和合集聚合留待后续切片确认，不据此承诺一次返回完整片库。

| 字段 | 类型 | 当前语义 |
| --- | --- | --- |
| id | string | 电影标识；客户端按不透明字符串处理 |
| title | string | 展示片名 |
| year | number | 上映年份 |
| genreLabel | string | 卡片使用的简短类型展示标签，不是完整类型模型 |
| posterUrl | string | 海报地址；正式服务返回 OSS 图片地址，无海报用空字符串，前端显示标题 fallback |
| favorite | boolean | 当前用户是否收藏该电影 |
| watchStatus | `unwatched` / `watching` / `watched` | 当前用户的观看状态：未开始 / 观看中 / 已看；watching 不属于未看 |

favorite 与 watchStatus 是当前用户针对该电影的个人状态，不属于公共 Movie 元数据。此处只扩展列表响应，状态修改接口留待真实后端联调确认；当前页面仅切换 Mock 副本，刷新恢复初始值。

仅返回关联到当前用户本人可访问 MediaResource 的电影；同一电影多个资源不重复成为多张卡。公共 Movie 元数据可复用，但不直接构成用户片库，新用户列表为空。字段缺失的进一步约定在真实数据接入前确认。

Frontend Mock 位于 `frontend/src/mocks/library.ts`，海报使用 `/mock/posters/` 开发素材；不表示真实用户拥有这些电影，也不构成后端种子数据。

**主要错误**

- `401`：未认证或登录失效。
- 服务错误不得伪装为成功的空片库；具体错误码与响应结构待确认。

### 当前用户片库传统搜索

| 项目 | 内容 |
| --- | --- |
| 所属模块 | movie |
| 对应页面/用例 | Shell 全局搜索浮层 |
| Method / Path | GET `/api/movies/search`（暂定） |
| 状态 | draft；当前仅由 movieService 的本地 Mock 实现 |

Request：`q: string`，去除首尾空白；身份来自可信 CurrentUser。按片名、原片名、导演与演员检索；当前 Mock 同时匹配年份和类型。空关键词在当前演示中返回最近添加的 5 部本人电影，不代表后端分页契约。

Response：当前前端复用 `LibraryMovie` 展示字段，搜索行可附带可缺省的 `rating`；不返回无本人资源关联的公共电影，不把合集作为电影搜索结果。排名、分页、人员中文别名匹配留待真实联调确认。

主要状态：加载、无结果、空片库与请求失败分开呈现；401 沿用认证语义。连续查询仅展示最新请求结果，关闭浮层后旧请求不再回填。选择电影结果关闭浮层并进入 `/library/movies/:movieId`。

### 当前用户电影详情

| 项目 | 内容 |
| --- | --- |
| 所属模块 | movie |
| 对应页面 | `/library/movies/:movieId` |
| Method / Path | GET `/api/movies/{movieId}`（暂定） |
| 状态 | draft；仅 movieDetailService 本地 Mock，未实现 HTTP |

身份来自可信 CurrentUser。当前前端先检查本人片库关联，再读取详情；非法 ID 或无本人关联不返回公共电影详情。正式后端必须独立执行同样的访问控制。

当前展示类型为 `MovieDetail`：`movie` 复用 `LibraryMovie`；`metadata` 包含原片名、简介、分级、演职员（姓名 / 角色 / 肖像）、背景图、评分，以及当前来源标识 / 名称和可空 `resource`。资源包含文件名、质量标签、文件大小、视频规格、音轨和字幕轨；资源及来源是本人关联数据，不属于公共 Movie 元数据。正式响应结构及多资源选择待联调确认，不能据当前嵌套结构推导数据库模型。

无资源摘要时展示“暂无媒体版本信息”，不虚构探测结果；无简介 / 评分、缺图独立降级。加载失败与未找到分开；连续路由切换忽略旧请求。正式接口认证失败使用 401，不可访问资源的错误语义待确认。

图片展示字段独立：`movie.posterUrl` 为竖版海报，`metadata.backdropUrl` 为横版背景图，未来分别由后端返回对应 OSS 图片地址。横图缺失或加载失败时保留深色背景，不以竖版海报替代；当前 15 部 Movie Mock 均配置独立的本地横图。

收藏 / 观看状态仅修改当前页面 Mock 副本，离开或刷新不持久化；播放、媒体版本选择、AI 提问明确提示未接入，不生成 PlaybackLocator 或声称已播放 / 已检索。系列内容仅派生自本人片库，仍遵守下面的合集 Mock 边界。

### 合集展示的本地 Mock 边界

当前 `/library` 与 `/library/collections/:collectionId` 使用 `LibraryCollection`：`id`、`title`、`posterUrl`、`backdropUrl`、`memberMovieIds`。仅通过本人 Movie 列表派生成员与数量；无筛选的主片库在拥有至少两部成员时聚合，筛选时展开单片，排序后首个成员决定合集位置。

合集不是 Movie，不承载收藏、观看状态或播放操作，不建立 user_collection。此条仅记录用户授权的原型 / Mock 迁移，不新增 Spring Boot Collection API，不改变冻结基线中 Collection 完整业务非 P0 的范围。

## 已确认的媒体来源接口语义边界

状态：`draft`。媒体来源列表与详情已实现 Vue + Frontend Mock；尚无 HTTP API、数据库或 Spring Boot 能力，不属于 implemented 接口。

- MediaSource是当前用户保存的一套WebDAV连接配置，MediaSource ≠ MediaScanRoot；一个来源允许0~N个MediaScanRoot，后者是用户明确选择、允许递归扫描的目录根。
- 创建MediaSource不自动扫描，也不默认将`/`加入扫描根；需要支持连接测试及来源当前可见完整目录结构的逐层浏览。
- 需要支持查看目录是否已为扫描根，以及MediaScanRoot新增、移除；后续增加扫描目录无需重建来源。
- ScanTask由用户主动发起，只扫描本人已启用来源下已配置、已启用的MediaScanRoot；没有启用扫描根时不产生实际扫描结果。
- 目录浏览是只读操作，不创建MediaResource、不建立个人片库关系、不触发TMDB、ffprobe或扫描；只返回展示所需目录/文件元信息。
- Spring Boot依据可信CurrentUser校验来源、扫描根归属及路径边界，不信任前端sourceId、path、scanRootId或声明身份的userId；WebDAV密码、Token和认证Header不得返回Vue。
- 正式 Endpoint / Request / Response、错误码与分页仍待垂直联调确认；下面只记录 Vue 已确认的数据需求，不锁定具体路径或响应包裹。

### 媒体来源 Vue 已确认的数据需求（draft）

对应 `/media-sources` 和 `/media-sources/:sourceId`。展示类型位于 `frontend/src/types/mediaSource.ts`；它们不是数据库模型或已确认的 HTTP Response。

| 概念 | 当前 UI 需要的最小数据 |
| --- | --- |
| MediaSource | `id`、`name`、`type: WebDAV`、不含认证信息的 `address`、连接状态、最近连接测试与最近扫描摘要、脱敏连接错误 |
| MediaScanRoot | 独立 `id`、`sourceId`、`path`、`enabled`；来源允许 0~N 个根，不以来源 URL 代替扫描路径 |
| DirectoryEntry | `name`、来源内 `path`、`kind: directory/file`；当前原型 fixture 只有目录，文件不可选作根 |
| ScanTask | `id`、`sourceId`、状态、时间、本次 `rootPaths` 快照、识别电影 ID、待确认/需注意数量及脱敏失败原因 |

- 当前连接状态为 `available/error/testing`；`testing` 是前端请求中状态，不要求后端持久化。扫描沿用原型 `pending/running/completed/failed`，无历史任务表达尚未扫描。时间目前为 Mock 展示字符串，正式时间格式待确认。
- 添加/编辑输入名称、WebDAV 地址、用户名和密码；测试结果仅适用于当次输入，修改任意字段后须重新测试。当前拒绝 URL 内的账号密码、查询参数和 fragment，错误不回显输入值；此限制不代表所有 Provider 的正式兼容策略。
- 密码不回填、不进入来源展示模型、不持久化；编辑空凭据目前只是“保留凭据”的 UI 演示，正式留空/更新/清除语义及测试授权凭证机制待后端确认。
- 目录浏览与暂选无写入；显式保存才批量增加扫描根，精确同路径去重，新增后不扫描。父子目录重叠的执行去重策略仍待扫描设计确认，不擅自扩大范围。
- 启动时检查来源存在、连接正常、存在已配置且启用的根；同一来源重复点击返回当前运行任务。Mock 在启动时复制 `rootPaths`，后续根配置变化不改变该任务；这仅明确当前前端展示需求，后端并发/幂等契约仍待确认。
- 本轮操作都只修改应用内存，刷新恢复 fixture；目录浏览、连接测试和扫描不发送网络请求。新扫描仅模拟运行/完成，不伪造所选目录的媒体文件或入库结果。原型历史扫描摘要仍是示例数据。
- 删除来源只清除当前 Mock 的来源、根及任务，取消运行计时器；不删除云端文件、公共 Movie 或修改其他片库 Mock。真实资源/个人片库关系生命周期按正式需求另行确认。来源本身启停、真实用户隔离与鉴权仍属于后续联调，本轮未据此添加原型不存在的控件。

## 条目模板

### 接口名称

| 项目 | 内容 |
| --- | --- |
| 所属模块 |  |
| 对应页面/用例 |  |
| Method |  |
| Path |  |
| 状态 | draft |

**Request**

待当前切片确认。

**Response**

待当前切片确认。

**主要错误**

待当前切片确认。

## 维护规则

- Vue正式运行时只调用Spring Boot公共接口；浏览器不直连FastAPI、MySQL、TMDB或WebDAV。
- Frontend Mock与真实HTTP实现尽量共享同一TypeScript请求/响应类型和业务语义。
- 接口确认、实现或变更时同步更新状态；不得暴露数据库DO、secret、WebDAV凭据或临时敏感PlaybackLocator。
- 普通业务接口不接受前端声明的`userId`作为可信身份；管理员用例与普通用户用例保持明确边界。

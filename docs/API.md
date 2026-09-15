# API契约

## 用途

本文件随真实页面和垂直切片逐步维护Vue与Spring Boot、Spring Boot与FastAPI之间的API契约。当前不预先设计完整系统接口；只有出现明确页面或用例时才新增条目。

接口状态只使用：`draft`、`confirmed`、`implemented`。

## 当前契约

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

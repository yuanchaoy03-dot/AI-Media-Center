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

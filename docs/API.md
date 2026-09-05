# API契约

## 用途

本文件随真实页面和垂直切片逐步维护Vue与Spring Boot、Spring Boot与FastAPI之间的API契约。当前不预先设计完整系统接口；只有出现明确页面或用例时才新增条目。

接口状态只使用：`draft`、`confirmed`、`implemented`。

## 当前契约

暂无。首个功能切片确定后补充。

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

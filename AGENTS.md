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

## 文档与完成检查

- `docs/01-项目需求文档.md`、`docs/02-系统架构设计文档.md`、`docs/开发规范与模块边界.md`是当前冻结的正式稳定基线；普通页面、组件、样式、Bug或单个接口实现变化不得修改它们。
- 按实际影响更新文档：产品需求/P0范围/验收标准→`docs/01-项目需求文档.md`，架构/ADR→`docs/02-系统架构设计文档.md`，长期开发规则→`docs/开发规范与模块边界.md`，接口→`docs/API.md`，进度→`PROJECT_STATUS.md`，工作规则→`AGENTS.md`；数据库事实留给未来03。
- 不因小型UI或组件改动重写稳定基线，不创建零散任务Markdown。
- 每个切片结束前完成相应测试、Code Review、必要文档更新和Git提交检查，并确认用户隔离、secret、模块边界及P0范围未被破坏。

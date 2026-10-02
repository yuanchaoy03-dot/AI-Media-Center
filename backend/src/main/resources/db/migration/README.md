# 数据库迁移学习说明

本文件只用于阅读，不是 Flyway migration。实际结构以同目录的 [V1__create_users.sql](V1__create_users.sql)、[V2__create_media_source.sql](V2__create_media_source.sql)、[V3__add_media_source_connection_test_time.sql](V3__add_media_source_connection_test_time.sql) 与 [V4__create_media_scan_root.sql](V4__create_media_scan_root.sql) 为准。

## Flyway migration 是什么

Migration 是按顺序改变数据库结构的脚本。文件名中的 `V1`、`V2` 是版本号，两个下划线 `__` 后是便于人阅读的描述。Spring Boot 启动时，Flyway 按版本顺序执行尚未执行的脚本，并在数据库的 `flyway_schema_history` 表记录执行历史和校验和（checksum）。

已执行的版本脚本原则上保持原样。Flyway 的校验和取决于脚本内容；即使只加 SQL 注释，内容也会变化，已有数据库在校验时可能报告 checksum mismatch。因此教学说明放在此 README，而不再写进已执行的 V1/V2。今后真正需要变更表结构时，应另行设计新版本迁移。

## V1：`users` 账号表

`users` 保存当前认证所需的账号记录，不保存明文密码或 JWT。注册时，`AuthService` 创建用户，再由 `UserMapper` 写入此表。

| 字段或约束 | 在当前项目中的作用 |
| --- | --- |
| `id`、`PRIMARY KEY` | `id` 是主键：每行账号的唯一标识。注册时由后端 `BusinessIds.next()` 生成 UUIDv7，并以标准 36 字符 UUID 文本存入 `CHAR(36)`；`ascii_bin` 让文本按字面值精确比较。 |
| `username`、`UNIQUE` | 用户名经 Java 层规范化为小写后存储。唯一约束阻止重复用户名，也能兜住并发注册时的冲突；格式 `CHECK` 限定为 3～32 位小写英文字母、数字或下划线。 |
| `password_hash` | 存储 `DelegatingPasswordEncoder` 生成的带算法标识的单向密码散列，不存原始 `password`。当前默认保存 `{argon2id}` 与 Argon2id PHC 字符串，登录时用 `matches` 比对。当前 Argon2id 完整编码为 171 个字符，现有 `VARCHAR(255)` 足够，无需扩容 migration。 |
| `role` | 当前账号角色取值受 `CHECK` 限定为 `USER` 或 `ADMIN`；当前公开注册只创建 `USER`，表中允许 `ADMIN` 不代表已经实现复杂管理员权限体系。 |
| `status` | 当前账号状态只能是 `ACTIVE` 或 `DISABLED`。受保护请求会重新读取此值，使已禁用账号在下次请求时被拒绝。 |
| `created_at`、`updated_at` | 分别记录创建和更新时间；当前注册 SQL 用 `UTC_TIMESTAMP(3)` 写入两者。`DATETIME(3)` 中的 `3` 表示保留到毫秒，`DATETIME` 本身不携带时区，因此本项目按 UTC 写入和理解这些值。 |

这些字段上的 `NOT NULL` 表示不能留空；默认值不能替代所有校验。`CHECK` 约束进一步限制用户名格式、角色和状态的合法取值。Java 校验给用户清晰的错误提示，数据库约束则保护最终落库的数据。

## V2：`media_source` 媒体来源表

当前关系是 **`users` 1 : N `media_source`**：一个用户可以拥有多条媒体来源，每条来源只能归属一个用户。

- `media_source.id` 是该来源自己的主键，与 `users.id` 是不同的标识。
- `user_id NOT NULL` 要求每条来源都有归属；外键 `FOREIGN KEY (user_id) REFERENCES users(id)` 还要求所指账号真实存在。外键保证关系有效，但不会自动判断某个 HTTP 请求能否读取这条来源。
- `idx_media_source_user_id` 是 `user_id` 上的非唯一索引，帮助数据库执行“按用户查来源”的查询；非唯一是因为一个用户可有多条来源。**外键检查引用是否有效，索引帮助查找，两者用途不同。**
- `ON DELETE RESTRICT` 表示用户仍被来源引用时，不允许直接删除该用户，避免留下失去归属的来源。
- `source_type` 的 `CHECK` 目前只允许 `WEBDAV`，`enabled` 的 `CHECK` 只允许 `0` 或 `1`。`connection_config_ciphertext` 由 Java 的 AES-256-GCM 加密后写入，完整地址和凭据不存明文；密钥只由后端配置提供。

当前 `MediaSourceMapper` 支持单行新增、`WHERE user_id = #{userId}` 本人列表及 `user_id + sourceId` 本人单条查询，应用层解密本人行后投影脱敏 DTO 或进行只读 WebDAV 目录浏览；无来源返回空列表，非空返回真实来源。首次新增先完成 WebDAV 测试再写入，不建立扫描根或任务；目录浏览不写库。扫描范围由 V4 独立表和应用服务保存；来源编辑、删除与扫描仍未实现。

## V3：最近成功连接测试时间

V3 在 `media_source` 增加可空的 `last_connection_test_at DATETIME(3)`，按 UTC 写入保存前成功测试的时间。旧记录保留 `NULL`，不伪造成功测试历史；新建来源必须先测试成功。它表示历史测试事实，不保证来源当前在线、已经扫描或资源可以播放。未修改已执行的 V1/V2。

## V4：`media_scan_root` 扫描范围表

关系为 `media_source` 1 : N `media_scan_root`，根通过来源继承用户归属。来源先通过本人查询，才能读取或保存该来源的根；外键和索引本身不能授权用户访问。

- `id` 沿用 UUIDv7；`source_id` 引用来源并使用 `ON DELETE RESTRICT`，删除来源前必须先明确处理其根。
- `path` 保存完整规范化来源内路径，支持 2048 个 Unicode 码点；`path_hash BINARY(32)` 保存其 UTF-8 字节的 SHA-256。`UNIQUE (source_id, path_hash)` 使用固定长度完整路径散列，避开 utf8mb4 长路径直接唯一索引的字节上限；应用层检查同散列不同原文并整体回滚。
- `enabled TINYINT` 用 `CHECK` 限定 `0/1`，不使用显示宽度。`created_at`、`updated_at` 为 UTC 毫秒时间。
- 整批保存先只读验证所有目录，再短事务锁来源行；保留路径的 ID/启用状态，新增根启用，取消根删除。空集合清空；网络或持久化失败保留完整旧配置。并发保存不会产生两个集合的混合状态。
- 扫描任务、资源与片库关系仍未创建；独立测试库清理时先删除扫描根，再删除来源与用户，遵循外键引用顺序。V1/V2/V3 保持原样。

## 数据库约束和 Java 业务权限有什么区别

数据库的 `FOREIGN KEY`、`UNIQUE`、`NOT NULL`、`CHECK` 主要保证**数据本身是否合法**：例如来源不能指向不存在的用户，用户名不能重复。

Java 与 Spring Security 主要判断**当前请求有没有资格读取数据**。当前链路是：`JWT.sub` → `AuthService.requireActive()` 查询账号 → `CurrentUser.id` → `MediaSourceQueryService` → `MediaSourceMapper` 的 `WHERE user_id = 当前用户 ID`。Controller 不接受客户端自行指定 `userId` 来决定查询范围。即使数据库中的来源和外键都合法，也不能因此让用户 A 读取用户 B 的来源；两层保护解决的是不同问题。

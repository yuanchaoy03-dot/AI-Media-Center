# API契约

## 用途

本文件随真实页面和垂直切片逐步维护Vue与Spring Boot、Spring Boot与FastAPI之间的API契约。当前不预先设计完整系统接口；只有出现明确页面或用例时才新增条目。

接口状态只使用：`draft`、`confirmed`、`implemented`。`confirmed` 表示可据此开始实现，不代表已存在 HTTP 服务；局部确认必须写明场景边界。

## 当前契约

### 认证与新用户空来源：首个联调切片

确认日期：2026-09-27；实现日期：2026-09-28。注册 → 登录 → 获取当前用户 → 获取本人空来源列表已完成联调。2026-10-02 扩展为真实 WebDAV 测试、新增、本人非空列表及已保存来源只读目录浏览；认证三个接口及这些来源接口为 `implemented`。

默认 Vue 运行路径调用 Spring Boot，使用真实账号、JWT、路由守卫及本人范围查询。未接入的个人数据页面显示尚未开放，不注入 Mock；开发预览须显式启用，配置见 [frontend/README.md](../frontend/README.md)。当前闭环到来源测试、加密保存、刷新后本人列表及逐层只读目录浏览；扫描根保存、扫描及片库仍待接入。

#### 共同 HTTP 约定

- Vue 业务请求只访问 Spring Boot，路径前缀为 `/api`；JSON 字段使用 camelCase，请求与响应使用 `application/json`。
- ID 使用不透明字符串；客户端不得转为数值或从中推导身份。时间使用带 `Z` 的 UTC ISO 8601 字符串。
- 本切片成功和失败均使用下面的响应包裹；HTTP 状态表达真实结果，错误不能包装成 `200`。后文其他 `draft` 接口随各自联调采用本约定，不因此自动变为 `confirmed`。

```json
{
  "code": "OK",
  "message": "",
  "data": [],
  "requestId": "req-example"
}
```

`data` 类型由接口确定；成功时 `code` 固定为 `OK`。失败时 `data` 固定为 `null`，`code` 为下表稳定错误码，`message` 为可展示中文说明。`requestId` 由后端生成，用于关联脱敏日志，不包含身份或凭据；客户端按 HTTP 状态和 `code` 分支，不匹配文案。

```json
{
  "code": "VALIDATION_FAILED",
  "message": "请检查输入内容。",
  "data": null,
  "requestId": "req-example",
  "fieldErrors": { "username": "用户名须为 3–32 位英文字母、数字或下划线。" }
}
```

`fieldErrors` 仅在字段校验失败时提供，为字段名到错误文案的映射；不得包含用户提交的密码、Token、被拒绝的值或内部异常。JSON 格式错误及未知字段可只返回总错误文案。

| HTTP | code | 本切片语义 |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | 请求格式、字段或查询参数不符合契约 |
| 401 | `INVALID_CREDENTIALS` | 登录失败；用户名不存在、密码错误或账号禁用统一说明“用户名或密码错误，或账号暂不可用。” |
| 401 | `UNAUTHENTICATED` | 受保护请求缺失、无效或过期 JWT，或对应账号不存在 |
| 403 | `ACCOUNT_DISABLED` | JWT 有效，但当前账号已禁用；清理本地登录态并提示账号暂不可用 |
| 404 | `NOT_FOUND` | 请求路径没有对应接口或资源 |
| 404 | `SOURCE_NOT_FOUND` | 来源不存在或不属于当前用户，使用相同脱敏响应 |
| 404 | `SOURCE_DIRECTORY_NOT_FOUND` | 本人来源内请求的目录不存在或不是目录 |
| 405 | `METHOD_NOT_ALLOWED` | 接口不支持该 HTTP Method；保留 `Allow` 响应头 |
| 406 | `NOT_ACCEPTABLE` | 无法提供 `Accept` 要求的响应类型 |
| 409 | `USERNAME_TAKEN` | 注册时规范化后的用户名已占用，包括并发注册冲突 |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | 请求 Content-Type 不受支持 |
| 422 | `SOURCE_AUTH_FAILED` | 上游 WebDAV 拒绝认证或访问；不会清理平台登录态 |
| 422 | `SOURCE_CONNECTION_FAILED` | WebDAV 不可达或上游服务失败 |
| 422 | `SOURCE_NOT_WEBDAV` | 地址未返回有效的 WebDAV 目录事实 |
| 422 | `SOURCE_REDIRECT_UNSUPPORTED` | WebDAV 地址返回重定向，本切片不跟随 |
| 422 | `SOURCE_DIRECTORY_INVALID` | 目录响应结构、路径边界或数量 / 大小不符合列举契约，不能作为完整目录展示 |
| 504 | `SOURCE_CONNECTION_TIMEOUT` | WebDAV 连接测试或目录读取超过总时限 |
| 503 | `SOURCE_CONFIG_UNAVAILABLE` | 来源加密主密钥未配置或格式错误 |
| 500 | `SOURCE_CONFIG_INVALID` | 本人保存的连接密文损坏或无法解密；不得伪装为空列表 |
| 500 | `INTERNAL_ERROR` | 数据库不可用或其他服务内部失败；统一说明“服务暂时不可用，请稍后重试。” |

Spring Security 的认证失败响应与 Controller 异常响应采用同一包裹；受保护接口的 `401` 响应附带 `WWW-Authenticate: Bearer`。受保护请求先认证，再校验业务输入；缺失身份不因携带无效参数而变成业务成功。网络断开、网关非 JSON 错误等由前端归为请求失败，不伪装成空列表或登录失效。

Spring MVC 请求协议与映射错误保留框架确定的 4xx 状态及协议响应头，使用同一 JSON 错误包裹，不返回框架异常详情；即使 `Accept` 无法满足，406 错误体仍为 `application/json`。其他框架 4xx 使用对应 HTTP 状态名作为错误码（非标准状态使用 `CLIENT_ERROR`），400 继续使用 `VALIDATION_FAILED`；未预期服务器错误仍返回 `500 INTERNAL_ERROR`。

#### 身份与 JWT 生命周期

- 沿用 [开发规范第 7.1 节](开发规范与模块边界.md#71-spring-security-jwt入口规范) 的 Spring Security + JWT Bearer。只有注册、登录两个接口公开；`/api/auth/me` 和 `/api/media-sources` 均要求 `Authorization: Bearer <accessToken>`。Vue 调用公开认证接口不附带旧 Token。
- 本切片 access token 固定有效 3600 秒，登录响应返回 `expiresIn: 3600`；不签发 refresh token、不滑动续期，过期后重新登录。使用 HS256，issuer 为 `ai-media-center`、audience 为 `ai-media-center-web`；校验签名、必需的 `iss` / `aud` / `exp` / `sub`，过期校验不配置额外宽限。`sub` 对应稳定 User ID。`JWT_SECRET` 为至少 32 字节随机密钥的 Base64 文本，由后端环境配置注入，不进入前端或仓库。
- 每次受保护请求在 JWT 验证后读取当前账号，复核允许访问状态，并以当前角色建立可信 CurrentUser；不以 Token 中过时的账号状态或前端提交的 `userId`、`role` 决定权限。普通用户和管理员访问本人来源时均受本人范围限制。
- Vue 将 Token 保存在当前标签页的 `sessionStorage`，不保存明文密码，不使用 `localStorage` 或 Cookie 建立登录态。刷新后先调用 `/api/auth/me` 验证，再加载个人数据；`expiresIn` 只供前端提示，后端过期校验是最终依据。sessionStorage 可被同源脚本读取，不能替代 XSS 防护；不承诺跨标签页共享登录或退出。
- 退出登录清除当前标签页 Token、当前用户和所有个人数据缓存，返回 `/login`；切换账号及认证失效同样清理，退出前的未完成请求不得回填旧用户数据。本切片不新增服务端 logout 接口；退出不会撤销已经复制出去的 JWT，其最长剩余有效期为 1 小时，账号禁用仍在下一次受保护请求时生效。
- 受保护请求返回 `401 UNAUTHENTICATED` 时清理登录态、返回登录页；`403 ACCOUNT_DISABLED` 同样清理并显示对应原因。登录表单的 `401 INVALID_CREDENTIALS` 留在表单展示，不触发重定向循环；普通网络错误或 `500` 保留登录态并允许重试。
- 认证及个人数据响应设置 `Cache-Control: no-store`。正式部署通过 HTTPS 传递密码和 Bearer Token；密码只以安全单向散列保存，日志和错误响应不记录密码、完整 Token 或 Authorization Header。

#### 注册

| 项目 | 内容 |
| --- | --- |
| 所属模块 / 页面 | user / `/register` |
| Method / Path | POST `/api/auth/register` |
| 认证 / 状态 | 公开 / `implemented` |

**Request**：仅接受 `username: string`、`password: string`。

- 用户名去除首尾空白、ASCII 大写转小写后，须匹配 `^[a-z0-9_]{3,32}$`；存储、唯一性判断、登录查找和响应使用同一规范化值。`Alice` 与 `alice` 为同一账号名；后端保证唯一性，并发重复注册返回 `409`。
- 密码为 12–128 个 Unicode 码点，允许中文、空格及特殊字符，不强制字符组合；不 trim、不做大小写转换、不静默截断。仅空白的密码无效。12 位下限是本项目为个人使用场景作出的易用性选择，低于 [OWASP Authentication 指引](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#implement-proper-password-strength-controls)对无 MFA 密码的 15 位建议；128 位上限为本项目约定，散列实现须支持完整输入。
- 确认密码仅在前端比较，不提交给后端；额外提交 `role`、`userId`、`confirmation` 等未定义字段返回 `400`，不得批量绑定数据库实体。

**Response**：`201 Created`，`data` 为 `CurrentUser`，字段如下。

| 字段 | 类型 | 语义 |
| --- | --- | --- |
| id | string | 后端生成的稳定 User ID |
| username | string | 规范化后的用户名 |
| role | `USER` / `ADMIN` | 当前角色；注册响应只能为 `USER` |

注册只创建用户及必要默认设置，不创建来源、扫描根、资源、任务或个人片库关系，也不复制任何 fixture。注册成功不签发 JWT；Vue 清空密码和确认密码，跳转 `/login` 并可在内存中保留用户名预填，显示“账号已创建，请登录”。用户名和密码不写入 URL。

**主要错误**：`400 VALIDATION_FAILED`、`409 USERNAME_TAKEN`、`500 INTERNAL_ERROR`。重复账号提示在注册表单内展示。请求超时后不得认定创建失败并自动重复提交；提示结果未确认，可尝试登录。

#### 登录

| 项目 | 内容 |
| --- | --- |
| 所属模块 / 页面 | user / `/login` |
| Method / Path | POST `/api/auth/login` |
| 认证 / 状态 | 公开 / `implemented` |

**Request**：仅接受 `username: string`、`password: string`。用户名使用注册时相同的规范化和格式规则；密码按原样验证，只校验非空及最多 128 个 Unicode 码点，不在登录时重新执行注册密码强度规则。

**Response**：`200 OK`，`data` 如下；示例 Token 为占位文本。

```json
{
  "accessToken": "<access-token>",
  "tokenType": "Bearer",
  "expiresIn": 3600
}
```

登录成功后 Vue 保存 Token，调用 `/api/auth/me` 建立当前用户状态，再进入 `/media-sources` 并请求来源列表。本切片统一使用该落点；业务数据加载成功前不显示 Mock 数据。`me` 请求失败时按共同错误约定处理，网络失败允许重试，不当作登录已验证。

**主要错误**：`400 VALIDATION_FAILED`、`401 INVALID_CREDENTIALS`、`500 INTERNAL_ERROR`。只有密码匹配且账号允许访问时才签发 Token。

#### 获取当前用户

| 项目 | 内容 |
| --- | --- |
| 所属模块 / 用例 | user / 登录完成、页面刷新后的身份恢复 |
| Method / Path | GET `/api/auth/me` |
| 认证 / 状态 | Bearer JWT / `implemented` |

**Request**：无请求体、无查询参数；不接受由前端指定的 `userId`。身份由 Spring Security 建立的 CurrentUser 决定。

**Response**：`200 OK`，`data` 为注册节定义的 `CurrentUser`。只返回 `id`、`username`、`role`，不返回密码、密码散列、Token 或用户数据库实体。

**主要错误**：`400 VALIDATION_FAILED`（未知查询参数）、`401 UNAUTHENTICATED`、`403 ACCOUNT_DISABLED`、`500 INTERNAL_ERROR`。

#### 获取本人媒体来源列表

| 项目 | 内容 |
| --- | --- |
| 所属模块 / 页面 | media / `/media-sources` |
| Method / Path | GET `/api/media-sources` |
| 认证 | Bearer JWT |
| 状态 | `implemented`：鉴权、本人范围、空列表及下述非空 DTO |

**Request**：无请求体、无查询参数；不接受 `userId`、分页、筛选或排序参数，未知查询参数返回 `400`。

**Response**：`200 OK`，本人没有来源时为下列完整响应；`data` 为列表，不能使用 `null`、`404` 或 `204` 表示空列表。

```json
{
  "code": "OK",
  "message": "",
  "data": [],
  "requestId": "req-example"
}
```

必须按可信 CurrentUser 查询本人来源后得出空集合；不得硬编码 `[]`、返回全库来源、注入演示来源，或把数据库失败转换为空数组。用户 B 有来源不影响新用户 A 的空结果，公共 Movie 元数据存在也不改变结果。查询不测试 WebDAV、不扫描、不创建默认来源或扫描根。

非空 `data` 为下述来源 DTO 数组，按创建时间及 ID 降序排列；只查询本人行，再解密以取得不含认证信息的地址。列表不执行实时连接测试。原临时 `501 SOURCE_LIST_NOT_READY` 分支已移除。

```json
{
  "id": "source-example",
  "name": "家庭 NAS",
  "type": "WebDAV",
  "address": "https://nas.example.com/dav/",
  "enabled": true,
  "lastConnectionTestAt": "2026-10-02T05:00:00Z",
  "createdAt": "2026-10-02T05:00:00Z"
}
```

`lastConnectionTestAt` 只表示保存时成功测试的历史时间，不表示当前在线或可播放；兼容已有未测试行时为 `null`。DTO 不含 `userId`、用户名、密码、认证 Header、密文、扫描根或伪造影片数量。新来源未扫描，正式页展示“尚未扫描”。

Vue 接入后区分加载中、请求失败和成功空列表；仅在成功取得 `data: []` 时显示现有“还没有媒体来源”状态。本人来源、最近扫描和最近入库均不得回退到 Mock fixture。其他尚未接入的页面不能据此宣称已完成真实空片库闭环。

**主要错误**：`400 VALIDATION_FAILED`、`401 UNAUTHENTICATED`、`403 ACCOUNT_DISABLED`、`500 INTERNAL_ERROR`、`500 SOURCE_CONFIG_INVALID`、`503 SOURCE_CONFIG_UNAVAILABLE`。无来源用户不需要配置加密密钥即可得到空列表。

#### 测试未保存的 WebDAV 连接 / 新增本人来源

| 项目 | 测试连接 | 新增来源 |
| --- | --- | --- |
| Method / Path | POST `/api/media-sources/test-connection` | POST `/api/media-sources` |
| 认证 / 状态 | Bearer JWT / `implemented` | Bearer JWT / `implemented` |
| 成功 | `200 OK`；`data: { "testedAt": "2026-10-02T05:00:00Z" }` | `201 Created`；`data` 为上面的来源 DTO |

两个接口均不接受查询参数；请求 JSON 固定为四个字符串字段：

```json
{
  "name": "家庭 NAS",
  "address": "https://nas.example.com/dav/",
  "username": "webdav-user",
  "password": "example-only"
}
```

- 名称和地址去除首尾空白；凭据保持原样。名称 1–80 个字符，地址最多 2048、用户名最多 256、密码最多 1024；用户名不能含冒号，名称及凭据拒绝控制字符和非法 Unicode。空用户名、空密码表示匿名访问；非空密码需要用户名。未知字段（包括 `userId`、`enabled`、`tested` 或客户端测试授权声明）、缺失字段及错误类型返回 `400 VALIDATION_FAILED`。
- 地址只支持 HTTP(S)，不允许 URL 内凭据、查询参数或 fragment。P0 本切片支持匿名或 Basic 认证，不承诺所有 Provider 的认证兼容性。浏览器只向 Spring Boot 提交，Spring Boot 通过 `MediaSourceAdapter` / `WebDavMediaSourceAdapter` 访问来源。
- 测试使用 `PROPFIND`、`Depth: 0`，验证地址自身的 `DAV:multistatus`、成功属性和目录类型；普通网页 `200` 不算成功。不跟随重定向，不因测试展开目录或创建来源。成功 XML 上限 128 KiB，总时限默认 8000ms（配置范围 100–15000ms），禁用 XML DTD / 外部实体。NAS 私网与 localhost 可用，明确危险的 IP 字面量和已知元数据主机被拒绝；部署仍需约束目标网络并防 DNS 重绑定。
- 测试结果仅适用于当次输入；修改字段使前端旧结果失效。新增接口独立重新测试当前请求的全部连接信息，不信任前端成功状态；失败不写入。外部调用结束后再执行单行数据库写入，不在数据库事务中等待网络。
- 成功创建时由可信 CurrentUser 填入归属、后端生成 ID，默认启用；不自动创建扫描根、任务、资源或影片。新增后 Vue 留在本人来源页重新加载列表，刷新后仍可见。退出、账号切换或离开页面取消请求并隔离迟到响应。
- 完整地址与凭据使用 AES-256-GCM 加密，随机 nonce，认证附加数据绑定用户 ID 与来源 ID。`MEDIA_SOURCE_ENCRYPTION_KEY` 是 32 字节随机密钥的 Base64，仅存于后端安全配置；不与 JWT 密钥复用。缺失或非法密钥不能保存来源；密文或主密钥不可写入响应、日志或前端。
- 保存成功、关闭或卸载弹窗清除表单凭据；Mock 预览仍仅用内存和演示凭据。编辑、删除、已保存来源重测、扫描根与扫描接口仍为 `draft`。

主要错误除共同鉴权与输入错误外，包括 `422 SOURCE_AUTH_FAILED / SOURCE_CONNECTION_FAILED / SOURCE_NOT_WEBDAV / SOURCE_REDIRECT_UNSUPPORTED`、`504 SOURCE_CONNECTION_TIMEOUT`；新增还可能返回加密配置与数据库错误。上游 WebDAV 的 401/403 映射为来源错误，不冒充平台 `UNAUTHENTICATED / ACCOUNT_DISABLED`，错误不回显提交信息或上游正文。

#### 浏览本人已保存来源的目录

| 项目 | 内容 |
| --- | --- |
| Method / Path | GET `/api/media-sources/{sourceId}/directory?path=%2F` |
| 认证 / 状态 | Bearer JWT / `implemented` |
| 成功 | `200 OK`；`data` 为指定目录及其直接子项 |

`sourceId` 为不透明字符串；`path` 是必需且唯一的查询参数，不接受额外参数、重复参数或 GET 请求体。路径为已解码的来源内绝对路径，由 Vue 用 `encodeURIComponent` 编码一次；`/` 表示已保存连接地址对应的根目录，不表示服务器文件系统根。内部连续 `/` 合并，非根尾部 `/` 去除；路径最多 2048 个 Unicode 码点，空白、相对路径、前导 `//`、`.` / `..` 段、反斜线、控制字符、非法 Unicode 及危险编码串返回 `400 VALIDATION_FAILED`。中文、空格和普通字面 `%`、`#`、`?` 可以作为名称；当前拒绝含 `%2F` / `%5C` / `%2E` 编码串及其再次编码形式的名称。

```json
{
  "path": "/",
  "entries": [
    { "name": "电影", "path": "/电影", "kind": "directory" },
    { "name": "说明.txt", "path": "/说明.txt", "kind": "file" }
  ]
}
```

- Spring Boot 先按可信 CurrentUser 和 sourceId 查询本人行，再解密配置并调用 Adapter。来源不存在或归属不符均为 `404 SOURCE_NOT_FOUND`，拒绝时不访问上游；USER / ADMIN 都不能浏览他人来源。来源或扫描根启停不限制只读浏览，扫描授权单独实现。
- Adapter 使用 `PROPFIND Depth: 1`，只返回直接子项，排除当前目录自身；`name` 从经过严格解码和边界校验的 href 取得，`kind` 来自成功 DAV 属性。DTO 不含服务地址、远程 href、用户名、密码、认证头或密文。
- 请求目标固定在已保存连接的同协议 / 主机 / 有效端口及目录边界内；不跟随重定向，拒绝外部或越界 href、编码路径分隔符、非法 UTF-8、重复项及非直接子项。上游目录不存在或当前项不是目录返回 `404 SOURCE_DIRECTORY_NOT_FOUND`；认证、连接、超时继续使用来源错误码，不能伪装成空目录。
- 目录成功 XML 最多 1 MiB，直接子项最多 2000 个，不递归、不分页、不截断成假完整列表；超限或列举结构无效返回 `422 SOURCE_DIRECTORY_INVALID`。总时限沿用连接配置，禁用 DTD / 外部实体；Depth:0 测试仍保留 128 KiB 限制。
- 浏览不写数据库、不创建扫描根、任务、资源或个人片库关系，不调用 TMDB / ffprobe。Vue 正式列表提供“浏览目录”，弹窗支持加载、成功空目录、进入子目录、返回上一级、失败重试与关闭；不展示根选择或保存控件。目录导航、关闭、离页及会话变化取消请求并隔离迟到响应，真实模式不读取 Mock 状态。

主要错误：共同鉴权 / 输入 / 加密配置错误、`404 SOURCE_NOT_FOUND / SOURCE_DIRECTORY_NOT_FOUND`、`422 SOURCE_AUTH_FAILED / SOURCE_CONNECTION_FAILED / SOURCE_NOT_WEBDAV / SOURCE_REDIRECT_UNSUPPORTED / SOURCE_DIRECTORY_INVALID`、`504 SOURCE_CONNECTION_TIMEOUT`。

#### 本切片实现后的验收条件

以下定义身份、错误、数据隔离和前端会话的验收条件；实际执行结果与未验证范围统一见 [PROJECT_STATUS.md](../PROJECT_STATUS.md#当前验证)，不在契约中维护测试过程。

1. 合法注册返回 `201` 和 `USER`；重复及并发重复用户名返回 `409`，额外提交角色/身份字段返回 `400`，不创建任何个人媒体数据。
2. 正确登录返回有效 JWT；错误用户名、错误密码或禁用账号不签发 Token，均返回 `401 INVALID_CREDENTIALS`。
3. 有效 Token 调用 `me` 返回本人；缺失、篡改、过期 Token 返回 `401`；签发后禁用账号，其有效 Token 请求返回 `403 ACCOUNT_DISABLED`。
4. 新用户来源接口返回 `200` 和空数组；测试库同时存在另一用户的来源及公共 Movie 时仍为空。携带他人 `userId` 参数被拒绝，不能改变查询范围。
5. 数据库/网络失败显示可重试错误，不显示成功空状态；Security 层和业务层错误响应结构一致，且无凭据或堆栈泄露。
6. 注册 → 登录 → `me` → 空来源页完成；刷新后验证身份再加载，退出/过期/账号切换后旧数据与旧请求结果不残留，真实路径不注入 Mock。

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

以下仅定义列表项业务字段（对应前端 `LibraryMovie`）；接入时采用上文共同响应包裹，分页、筛选、排序和合集聚合留待后续切片确认，不据此承诺一次返回完整片库。

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
- 服务错误不得伪装为成功的空片库；接入时采用上文共同错误包裹，其余业务错误码待确认。

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

状态：列表、测试未保存连接、首次新增及只读目录浏览为 `implemented`，契约见上文；来源详情、编辑、删除、已保存来源重测、扫描根与扫描仍为 `draft`，当前仅有显式开发预览。

- MediaSource是当前用户保存的一套WebDAV连接配置，MediaSource ≠ MediaScanRoot；一个来源允许0~N个MediaScanRoot，后者是用户明确选择、允许递归扫描的目录根。
- 创建MediaSource不自动扫描，也不默认将`/`加入扫描根；需要支持连接测试及来源当前可见完整目录结构的逐层浏览。
- 需要支持查看目录是否已为扫描根，以及MediaScanRoot新增、移除；后续增加扫描目录无需重建来源。
- ScanTask由用户主动发起，只扫描本人已启用来源下已配置、已启用的MediaScanRoot；没有启用扫描根时不产生实际扫描结果。
- 目录浏览是只读操作，不创建MediaResource、不建立个人片库关系、不触发TMDB、ffprobe或扫描；只返回展示所需目录/文件元信息。
- Spring Boot依据可信CurrentUser校验来源、扫描根归属及路径边界，不信任前端sourceId、path、scanRootId或声明身份的userId；WebDAV密码、Token和认证Header不得返回Vue。
- 除上文已实现契约与共同响应约定，其余 Endpoint / Request / Response、业务错误码与分页仍待垂直联调确认；下面保留完整 Mock 页的数据需求，不扩展已实现 DTO。

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
- Mock 密码不回填、不进入展示模型、不持久化；正式新增按上文加密保存。编辑空凭据仍只是“保留凭据”的 UI 演示，正式留空/更新/清除语义待对应切片确认；首次新增无需测试授权凭证，保存时重新测试。
- MediaScanRoot 表示从该目录开始递归扫描全部后代；同一 MediaSource 的根集合必须互不包含：禁止精确重复及祖先/后代重叠，兄弟目录合法。范围校验与 enabled 无关，停用不代表从其他根的范围中排除该目录；本轮不支持 exclude path 或单文件根。
- 路径按目录边界比较，合并连续 `/` 并去掉非根路径尾部 `/`；空白、非绝对路径及 `.` / `..` 路径段无效。`/电影` 与 `/电影2` 不冲突；`/` 合法且包含全部其他目录。
- DirectoryBrowser 只读浏览；草稿从全部已有根初始化（包括已停用根），只管理 membership。已有祖先时后代仍可浏览，但不可独立选择；选择祖先必须明确确认后一次替换所有已选后代，取消祖先不恢复被替换后代。选择 `/` 替换已有根时同样确认，并说明递归扫描全部可见目录。
- 仅显式保存 selection 才 reconciliation：整批校验路径存在且集合无重叠，保留仍存在路径的 id / enabled，移除未选配置，新增根默认 enabled=true；取消不写入，顺序改变不算 membership 修改。只修改扫描配置，不删除云端文件，不创建任务或 MediaResource。
- ScanTask 接受的 rootPaths 必须是无重复、无重叠的合法集合；启动前防御性校验来源的全部根配置，再复制启用根作为冻结快照。配置错误拒绝创建任务，不静默去重或自动扩大范围。
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

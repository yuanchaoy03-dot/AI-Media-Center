# Vue 3 + TypeScript + Vite

项目正式前端入口。文档职责与按需导航见 [项目文档索引](../docs/README.md)。

Learn more about the recommended Project Setup and IDE Support in the [Vue Docs TypeScript Guide](https://vuejs.org/guide/typescript/overview.html#project-setup).

## 页面与路由

- `src/router/index.ts` 使用 Vue Router 4 与 `createWebHistory` 定义路由，页面按需加载。
- `src/views/` 存放完整页面；`App.vue` 只保留布局与 `RouterView`。
- 新增页面时，在 `views/` 创建页面并在路由表注册；需要侧栏入口时再更新 `AppSidebar.vue` 的菜单数据。
- 侧栏按路由记录高亮，嵌套子路由会保留父级入口的选中态。电影、合集等详情路由应明确所属导航，不依靠路径字符串前缀猜测。
- 用户入口目前仅显示未实现提示，不代表登录或账号功能。
- `/login`、`/register` 为独立 Vue 登录/注册页面，不显示业务侧栏；共用 `components/auth/AuthForm.vue`。可直接访问和互相切换，现有业务路由不强制跳转登录。
- 认证当前仅为 UI 预览：用户名/密码必填，注册确认密码一致；提交短暂显示 Loading 后提示服务尚未接入。不发送或存储凭据、不创建账号或登录态；字段和规则为待后端确认的草案。

开发运行 `npm run dev`，构建运行 `npm run build`，本地查看构建结果运行 `npm run preview`。

媒体来源 `/media-sources` 与 `/media-sources/:sourceId` 使用内存 Mock，刷新恢复示例来源；不执行真实 WebDAV 请求或保存凭据。`offline` 主机名及 `cloud.example.com` 模拟连接失败，其余合法 HTTP(S) 地址仅模拟成功。名称/地址变化后需重新测试；扫描约 4 秒完成且不生成虚构影片。

媒体来源服务回归：在本目录使用 Node.js 24 运行 `node --test tests/mediaSourceService.test.mjs`。测试通过 Node 内置 TypeScript 支持读取实际服务，使用虚拟计时器验证扫描范围快照、前置条件、失败与删除任务清理；不增加测试依赖。单独类型检查使用 `npx vue-tsc -b`；当前未配置独立 lint 脚本。

使用 History 模式部署时，静态服务器需要将非静态资源的前端路径回退到 `index.html`，使 `/library` 等地址支持直接访问和刷新；业务 API 不应走此回退。本次未添加部署配置。参见 [Vue Router History 模式说明](https://router.vuejs.org/guide/essentials/history-mode.html)。

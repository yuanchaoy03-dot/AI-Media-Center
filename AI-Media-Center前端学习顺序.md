# AI-Media-Center 前端学习顺序

> 目标：不是把 Vue 3 的 71 节课程全部学完，而是**优先补齐当前 AI-Media-Center 前端代码真正用到的知识**，做到“能看懂项目、能跟着代码走、知道每一层在干什么”。

当前前端基础技术栈为 Vue 3、TypeScript、Vue Router、Pinia、Axios、Vite、ESLint、Prettier 和原生 CSS。ESLint 检查代码质量，Prettier 统一格式；两者是开发辅助工具，不改变现有 Pinia / Service / Axios / Router 分工。具体命令与实际验证结果见 [frontend/README.md](frontend/README.md)，当前进度见 [PROJECT_STATUS.md](PROJECT_STATUS.md)。

---

## 一、当前前端需要掌握的知识范围

当前项目主要涉及：

- JavaScript / TypeScript 基础
- Vue 3 Composition API
- `<script setup>`
- `ref`
- `reactive`
- `computed`
- `watch`
- `props`
- Vue 生命周期
- Vue Router
- Pinia Setup Store、State 与 Action
- Axios
- HTTP 请求与响应
- Service 层封装
- JWT 请求头
- 基础错误处理

当前认证状态已经由 Pinia 的 `auth` Store 管理，理解登录流程时需要一并学习 Store；表单输入等局部状态仍留在组件中。

---

# 二、Vue 课程学习顺序

## 第一阶段：Vue 核心基础

### 第一轮先看这 8 节

1. **004. 编写 App 组件**
2. **006. OptionsAPI 与 CompositionAPI**
3. **010. setup 的语法糖**
4. **011. ref 创建基本类型的响应式数据**
5. **012. reactive 创建对象类型的响应式数据**
6. **013. ref 创建对象类型的响应式数据**
7. **014. ref 对比 reactive**
8. **016. computed 计算属性**

### 这一阶段的目标

看完之后，应当能够基本理解项目中的：

```ts
const username = ref('')
const password = ref('')
const pending = ref(false)

const errors = reactive({
  username: '',
  password: ''
})

const registering = computed(() => ...)
```

重点不是背 API，而是做到：

- 知道 `ref()` 是什么
- 知道为什么 `script` 中经常出现 `.value`
- 知道 `reactive()` 是干什么的
- 知道 `computed()` 是“根据其他状态计算出来的数据”
- 能理解 `<script setup lang="ts">` 的基本结构

---

## 第二阶段：组件、Props 与生命周期

按顺序学习：

1. **024. 回顾 TS 中的接口、泛型、自定义类型**
2. **025. props 的使用**
3. **026. 对生命周期的理解**
4. **028. Vue3 的生命周期**
5. **052. 组件通信_方式1_props**

### 这一阶段的目标

能够理解项目中的：

```ts
const props = defineProps<{
  mode: 'login' | 'register'
}>()
```

以及：

```ts
onBeforeUnmount(() => {
  ...
})
```

同时理解：

```text
父组件
   ↓ props
子组件
```

例如为什么同一个 `AuthForm.vue` 可以同时服务于登录和注册页面。

---

## 第三阶段：watch

课程中的：

- 017. watch 监视_情况一
- 018. watch 监视_情况二
- 019. watch 监视_情况三
- 020. watch 监视_情况四
- 021. watch 监视_情况五

### 学习要求

**不用把五种情况全部背下来。**

第一轮只需要理解：

```ts
watch(
  () => 某个值,
  () => {
    // 值变化后执行这里
  }
)
```

目标是以后看到项目中的 `watch()` 不害怕，知道它是在“监听某个状态的变化”。

---

# 四、Vue Router 学习顺序

按顺序学习：

1. **030. 对路由的理解**
2. **031. 路由_基本切换效果**
3. **033. 路由_路由器工作模式**
4. **035. 路由_命名路由**
5. **038. 路由_params 参数**
6. **040. 路由_replace 属性**
7. **041. 路由_编程式路由导航**

### 这一阶段的目标

能够看懂：

```ts
const router = useRouter()
```

```ts
await router.replace({
  name: 'media-sources'
})
```

以及：

```ts
{
  path: '/library/movies/:movieId',
  name: 'movie-detail'
}
```

需要真正理解：

```text
URL
  ↓
Vue Router
  ↓
对应的 Vue 页面
```

---

# 五、目前可以先跳过的 Vue 课程

以下内容目前不是理解当前项目的刚需，可以以后需要时再回来补。

## 暂时跳过

- 015. toRefs 与 toRef
- 022. watchEffect
- 023. 标签的 ref 属性
- 027. Vue2 的生命周期
- 029. 自定义 Hooks

### 路由暂缓内容

- 032. 路由_两个注意点
- 034. 路由_to 的两种写法
- 036. 路由_嵌套路由
- 037. 路由_query 参数
- 039. 路由_props 配置
- 042. 路由_重定向

这些以后项目代码真正用到时再补即可。

---

# 六、Pinia：先学当前认证 Store 用到的内容

按顺序学习：

- 043. 对 Pinia 的理解
- 045. 搭建 Pinia 环境
- 046. 存储 + 读取数据
- 047. 修改数据（三种方式）
- 051. store 组合式写法

回到 `frontend/src/stores/auth.ts`，理解 `defineStore('auth', () => { ... })`：返回的 `ref` 是 State，函数是 Action。先追登录、恢复会话与退出，不要求一次掌握全部 Pinia API。

`src/stores/index.ts` 创建应用唯一的 Pinia instance；`main.ts` 先注册 Pinia，再注册 Router。组件 setup 中使用 `useAuthStore()`，Router 和业务 Service 在组件外显式传入同一个 Pinia instance。Store 管理认证生命周期，`authService.ts` 负责认证 API 与响应校验，`http.ts` 负责 Axios 传输与统一错误，Router 负责导航与守卫。

044、048、049、050 可按后续阅读需要补充；当前无需引入持久化插件，JWT 继续保存在 `sessionStorage`。

---

# 七、高级 Vue 内容可以稍后按需补充

第一轮暂缓：

- 053～060 各种组件通信方式
- 061～063 插槽
- 064. shallowRef 与 shallowReactive
- 065. readonly 与 shallowReadonly
- 066. toRaw 与 markRaw
- 067. customRef
- 068. Teleport
- 069. Suspense
- 070. 全局 API 转移到应用对象
- 071. Vue3 的非兼容性改变

这些是学习优先级安排，不代表项目没有使用；阅读到 `shallowRef`、`readonly` 或 `Teleport` 等实际代码时，再补对应内容。

---

# 八、Vue 学完之后：补 JavaScript / TypeScript

只学当前项目真正需要的。

## JavaScript 必须掌握

- `const` / `let`
- 对象
- 数组
- 函数
- 箭头函数
- `import` / `export`
- `async`
- `await`
- `Promise`
- `try / catch`
- 解构
- 展开运算符 `...`
- `map`
- `filter`
- `some`
- `Object.values`
- `Object.entries`

### 目标

看到：

```ts
async function submit() {
  try {
    const result = await login(...)
  } catch (error) {
    ...
  }
}
```

能够知道代码大致在做什么。

---

## TypeScript 必须掌握

- 基础类型：`string`、`number`、`boolean`
- 联合类型：

```ts
'login' | 'register'
```

- 接口 `interface`
- `type`
- 可选属性 `?`
- `unknown`
- 泛型 `<T>`
- `Promise<T>`
- `Record<string, string>`
- `keyof`
- 类型断言 `as`

### 不需要

现阶段不用深入研究复杂类型体操。

目标只是：

> 看得懂项目里的 TypeScript，而不是成为 TypeScript 类型专家。

---

# 九、最后再学 Axios

不要现在马上硬啃项目里的 `http.ts`。

等前面的 Vue + JS/TS 基础补好以后，再学 Axios。

## Axios 第一轮只学这些

1. Axios 是什么
2. `axios.get()`
3. `axios.post()`
4. `axios.create()`
5. `baseURL`
6. `timeout`
7. `headers`
8. 请求体 `data`
9. `response.data`
10. HTTP 状态码
11. `try / catch`
12. Axios 错误处理

例如先理解最简单的：

```ts
const response = await axios.post('/api/auth/login', {
  username,
  password
})
```

再去理解项目中的统一封装：

```ts
const apiClient = axios.create(...)
```

以及：

```ts
request<T>()
```

## 日常开发工具

在 `frontend` 目录按需执行：

- `npm run lint`：ESLint 代码质量检查。
- `npm run lint:fix`：ESLint 自动修复，完成后审查 diff。
- `npm run format`：Prettier 格式化。
- `npm run format:check`：Prettier 只检查格式。

这四个命令独立运行。现有 `npm test` 负责回归测试，`npm run build` 负责类型检查与生产构建，`npx vue-tsc -b` 可单独检查类型。配置与最终验证记录统一维护在 [前端 README](frontend/README.md)，不用新增一套规则或把所有检查串成一个命令。

---

# 十、最终学习路线

推荐完整顺序：

```text
第一阶段
Vue 基础
004
 ↓
006
 ↓
010
 ↓
011
 ↓
012
 ↓
013
 ↓
014
 ↓
016

第二阶段
组件 + TS + 生命周期
024
 ↓
025
 ↓
026
 ↓
028
 ↓
052

第三阶段
watch
017～021
（理解即可，不必全部背）

第四阶段
Vue Router
030
 ↓
031
 ↓
033
 ↓
035
 ↓
038
 ↓
040
 ↓
041

第五阶段
JavaScript / TypeScript 补缺

第六阶段
Pinia 认证 Store

第七阶段
Axios

第八阶段
ESLint / Prettier 日常命令

第九阶段
回到自己的项目逐文件阅读
```

---

# 十一、回到项目后的阅读顺序

学完前面的基础之后，不要随机打开文件。

推荐按业务链阅读：

```text
用户打开登录页面
        ↓
router/index.ts
        ↓
LoginView.vue
        ↓
AuthForm.vue
        ↓
stores/auth.ts（login Action）
        ↓
authService.ts
        ↓
http.ts
        ↓
Axios
        ↓
POST /api/auth/login
```

登录拿到 JWT 后，Store 写入 `sessionStorage` 并通过 `/auth/me` 恢复可信用户；登录成功后的跳转由 Router 负责。启动时 Pinia 的注册顺序与共享实例可接着阅读 `main.ts` 和 `stores/index.ts`。

第一轮只追：

> **“用户点登录以后发生了什么？”**

暂时不要同时研究整个片库、媒体来源、搜索、WebDAV、后端和数据库。

---

# 十二、当前最重要的原则

## 不追求一次全部学会

你的目标不是：

> “我要完整掌握 Vue 3。”

而是：

> **“我要能看懂自己的毕业设计前端。”**

所以采用：

```text
看到项目代码
    ↓
发现一个不会的知识点
    ↓
学这个知识点
    ↓
马上回项目找真实代码
```

而不是：

```text
先学完 Vue 71 节
↓
再学完整 TypeScript
↓
再学完整 Axios
↓
半年后才打开自己的项目
```

---

# 十三、近期执行计划

目前先只做：

### 第一批

- [ ] 004. 编写 App 组件
- [ ] 006. OptionsAPI 与 CompositionAPI
- [ ] 010. setup 的语法糖
- [ ] 011. ref 创建基本类型的响应式数据
- [ ] 012. reactive 创建对象类型的响应式数据
- [ ] 013. ref 创建对象类型的响应式数据
- [ ] 014. ref 对比 reactive
- [ ] 016. computed 计算属性

完成这 8 节以后：

> **暂停继续刷课，重新阅读 AI-Media-Center 的 `AuthForm.vue`。**

重点检查自己是否已经能理解：

```ts
ref()
reactive()
computed()
.value
v-model
```

如果能理解，再进入第二阶段。

---

## 一句话总结

**先补 Vue 核心 → 再补组件和生命周期 → 再学 Router → 再补 JS/TS → 再学 Pinia 与 Axios → 掌握 ESLint / Prettier 命令 → 沿着登录请求链阅读自己的真实项目。**

不要追求“课程全部学完”，优先追求“项目代码逐渐能看懂”。

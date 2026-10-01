import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { pinia } from '../stores/index'
import { mockPreview } from '../services/dataMode'
import { watch } from 'vue'

// () => import(...) 会在进入对应路由时才加载页面代码。
const unavailable = () => import('../views/UnavailableView.vue')

// Router 模块可能在 main.ts 注册插件前加载；显式传入同一 Pinia，避免 no active Pinia。
const auth = useAuthStore(pinia)

// routes 把浏览器地址映射到页面组件；history 让地址使用普通路径形式。
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.path !== from.path) return { top: 0 }
  },
  routes: [
    {
      path: '/login',
      name: 'login',
      meta: { layout: 'auth' },
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/register',
      name: 'register',
      meta: { layout: 'auth' },
      component: () => import('../views/RegisterView.vue'),
    },
    {
      // :movieId 是动态参数，例如 /library/movies/123 中的 123，可在页面里用 route.params.movieId 读取。
      path: '/library/movies/:movieId',
      name: 'movie-detail',
      component: mockPreview ? () => import('../views/MovieDetailView.vue') : unavailable,
    },
    {
      path: '/',
      name: 'home',
      component: mockPreview ? () => import('../views/HomeView.vue') : unavailable,
    },
    {
      path: '/library',
      name: 'library',
      component: mockPreview ? () => import('../views/LibraryView.vue') : unavailable,
    },
    {
      path: '/library/collections/:collectionId',
      name: 'collection-detail',
      component: mockPreview ? () => import('../views/CollectionDetailView.vue') : unavailable,
    },
    {
      path: '/ai-discovery',
      name: 'ai-discovery',
      component: mockPreview ? () => import('../views/AiDiscoveryView.vue') : unavailable,
    },
    {
      path: '/media-sources/:sourceId',
      name: 'media-source-detail',
      component: mockPreview ? () => import('../views/MediaSourceDetailView.vue') : unavailable,
    },
    {
      path: '/media-sources',
      name: 'media-sources',
      // 开发预览用演示页面；正常模式用向 Spring Boot 请求本人来源的页面。
      component: mockPreview
        ? () => import('../views/MediaSourcesPreviewView.vue')
        : () => import('../views/MediaSourcesView.vue'),
    },
    {
      path: '/favorites',
      name: 'favorites',
      component: mockPreview ? () => import('../views/FavoritesView.vue') : unavailable,
    },
    {
      path: '/recently-added',
      name: 'recently-added',
      component: mockPreview ? () => import('../views/RecentlyAddedView.vue') : unavailable,
    },
    {
      path: '/unwatched',
      name: 'unwatched',
      component: mockPreview ? () => import('../views/UnwatchedView.vue') : unavailable,
    },
    {
      path: '/watched',
      name: 'watched',
      component: mockPreview ? () => import('../views/WatchedView.vue') : unavailable,
    },
    {
      path: '/settings',
      name: 'settings',
      component: mockPreview ? () => import('../views/SettingsView.vue') : unavailable,
    },
  ],
})

// 路由守卫在每次进入页面前检查身份，to 是准备前往的路由。
// 返回 true 就放行，返回 { name: 'login' } 就改去登录页；有 Token 也要先恢复并验证用户。
router.beforeEach(async (to) => {
  if (mockPreview) return true
  if (to.meta.layout === 'auth') {
    if (auth.tokenPresent && (await auth.restoreSession())) return { name: 'media-sources' }
    return true
  }
  if (!auth.tokenPresent) return { name: 'login' }
  if (!(await auth.restoreSession())) return { name: 'login' }
  return true
})

// watch 在监听的状态变化时执行回调；会话被清掉后，让仍停在个人页面的用户回到登录页。
watch(
  () => auth.epoch,
  () => {
    if (
      !mockPreview &&
      !auth.user &&
      !auth.tokenPresent &&
      router.currentRoute.value.meta.layout !== 'auth'
    )
      void router.replace({ name: 'login' })
  },
)

// logout 清理登录数据，replace 替换当前历史记录；void 表示这里不等待跳转的 Promise。
export function signOut() {
  auth.logout()
  void router.replace({ name: 'login' })
}

export default router

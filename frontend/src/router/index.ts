import { createRouter, createWebHistory } from 'vue-router'
import { authState, hasToken, logout, restoreSession } from '../services/authService'
import { mockPreview } from '../services/dataMode'
import { watch } from 'vue'

const unavailable = () => import('../views/UnavailableView.vue')

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
      component: mockPreview ? () => import('../views/MediaSourcesPreviewView.vue') : () => import('../views/MediaSourcesView.vue'),
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

router.beforeEach(async to => {
  if (mockPreview) return true
  if (to.meta.layout === 'auth') {
    if (hasToken() && await restoreSession()) return { name: 'media-sources' }
    return true
  }
  if (!hasToken()) return { name: 'login' }
  if (!await restoreSession()) return { name: 'login' }
  return true
})

watch(() => authState.epoch, () => {
  if (!mockPreview && !authState.user && !hasToken() && router.currentRoute.value.meta.layout !== 'auth') void router.replace({ name: 'login' })
})

export function signOut() {
  logout()
  void router.replace({ name: 'login' })
}

export default router

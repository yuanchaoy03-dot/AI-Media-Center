import { createRouter, createWebHistory } from 'vue-router'

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
      component: () => import('../views/MovieDetailView.vue'),
    },
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/library',
      name: 'library',
      component: () => import('../views/LibraryView.vue'),
    },
    {
      path: '/library/collections/:collectionId',
      name: 'collection-detail',
      component: () => import('../views/CollectionDetailView.vue'),
    },
    {
      path: '/ai-discovery',
      name: 'ai-discovery',
      component: () => import('../views/AiDiscoveryView.vue'),
    },
    {
      path: '/media-sources/:sourceId',
      name: 'media-source-detail',
      component: () => import('../views/MediaSourceDetailView.vue'),
    },
    {
      path: '/media-sources',
      name: 'media-sources',
      component: () => import('../views/MediaSourcesView.vue'),
    },
    {
      path: '/favorites',
      name: 'favorites',
      component: () => import('../views/FavoritesView.vue'),
    },
    {
      path: '/recently-added',
      name: 'recently-added',
      component: () => import('../views/RecentlyAddedView.vue'),
    },
    {
      path: '/unwatched',
      name: 'unwatched',
      component: () => import('../views/UnwatchedView.vue'),
    },
    {
      path: '/watched',
      name: 'watched',
      component: () => import('../views/WatchedView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue'),
    },
  ],
})

export default router

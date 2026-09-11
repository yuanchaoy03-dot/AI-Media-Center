import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
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
      path: '/ai-discovery',
      name: 'ai-discovery',
      component: () => import('../views/AiDiscoveryView.vue'),
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

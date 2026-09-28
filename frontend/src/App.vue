<script setup lang="ts">
import { defineAsyncComponent, ref, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import AppSidebar from './components/layout/AppSidebar.vue'
import { authState } from './services/authService'
import { mockPreview } from './services/dataMode'
import { signOut } from './router'
import type { LibraryMovie } from './types/movie'

const searchOpen = ref(false)
const GlobalSearch = defineAsyncComponent(() => import('./components/layout/GlobalSearch.vue'))
const route = useRoute()
const router = useRouter()
watch(() => route.fullPath, () => { searchOpen.value = false })
function selectSearchMovie(movie: LibraryMovie) {
  searchOpen.value = false
  void router.push({ name: 'movie-detail', params: { movieId: movie.id } })
}
const notice = ref('')
watch(() => authState.epoch, () => { searchOpen.value = false; notice.value = '' })
function showNotice(message: string) {
  notice.value = message
}
function dismissNotice() {
  notice.value = ''
}
</script>

<template>
  <main v-if="route.meta.layout === 'auth'" class="auth-main">
    <RouterView />
  </main>
  <div v-else-if="mockPreview || authState.user" class="app-layout">
    <div class="app-sidebar-container">
      <AppSidebar :user-name="mockPreview ? '演示预览' : authState.user?.username ?? ''" :user-initial="mockPreview ? '演' : authState.user?.username.slice(0, 1).toUpperCase() ?? ''"
        :search-expanded="searchOpen" @search="mockPreview ? searchOpen = true : showNotice('搜索功能尚未开放。')" @notice="showNotice" @logout="mockPreview ? showNotice('当前为开发预览。') : signOut()" />
    </div>
    <main class="app-main">
      <RouterView :key="authState.epoch" />
    </main>
    <GlobalSearch v-if="mockPreview" :open="searchOpen" @close="searchOpen = false" @select="selectSearchMovie" />
    <div v-if="notice" class="shell-notice">
      <p role="status">{{ notice }}</p>
      <button type="button" @click="dismissNotice">关闭提示</button>
    </div>
  </div>
  <main v-else class="auth-main"><p role="status">正在验证登录身份…</p></main>
</template>

<style scoped>

.app-sidebar-container {
  position: fixed;
  z-index: var(--z-navigation);
  inset: var(--layout-shell-inset) auto var(--layout-shell-inset) var(--layout-shell-inset);
  width: var(--layout-sidebar);
}

.app-main {
  min-height: 100dvh;
  margin-left: var(--layout-main-offset);
  padding: var(--space-8) var(--layout-page-padding);
}

.shell-notice {
  position: fixed;
  right: var(--space-4);
  bottom: var(--space-4);
  z-index: var(--z-toast);
  width: min(360px, calc(100% - 32px));
  padding: var(--space-4);
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-floating);
  background: var(--material-floating-fallback);
  box-shadow: var(--shadow-floating);
  font-size: .8125rem;
  line-height: 1.5;
}
.shell-notice p { margin: 0 0 var(--space-2); }
.shell-notice button {
  min-height: var(--control-height);
  padding: 0 var(--space-2);
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.shell-notice button:active { background: var(--color-pressed); }
.shell-notice button:focus-visible {
  outline: var(--focus-width) solid var(--color-focus);
  outline-offset: var(--focus-offset);
}
@media (hover: hover) and (pointer: fine) {
  .shell-notice button:hover { background: var(--color-hover); }
}
@media (max-width: 900px) {
  .app-sidebar-container { position: sticky; inset: auto; top: 0; width: 100%; }
  .app-main { margin-left: 0; min-height: calc(100dvh - 70px); }
}
</style>

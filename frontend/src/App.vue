<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import AppSidebar from './components/layout/AppSidebar.vue'
import GlobalSearch from './components/layout/GlobalSearch.vue'
import type { LibraryMovie } from './types/movie'

const searchOpen = ref(false)
const route = useRoute()
const router = useRouter()
watch(() => route.fullPath, () => { searchOpen.value = false })
function selectSearchMovie(movie: LibraryMovie) {
  searchOpen.value = false
  void router.push({ name: 'movie-detail', params: { movieId: movie.id } })
}
const notice = ref('')
function showNotice(message: string) {
  notice.value = message
}
function dismissNotice() {
  notice.value = ''
}
</script>

<template>
  <div class="app-layout">
    <div class="app-sidebar-container">
      <AppSidebar :search-expanded="searchOpen" @search="searchOpen = true" @notice="showNotice" />
    </div>
    <main class="app-main">
      <RouterView />
    </main>
    <GlobalSearch :open="searchOpen" @close="searchOpen = false" @select="selectSearchMovie" />
    <div v-if="notice" class="shell-notice">
      <p role="status">{{ notice }}</p>
      <button type="button" @click="dismissNotice">关闭提示</button>
    </div>
  </div>
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

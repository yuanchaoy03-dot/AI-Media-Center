<script setup lang="ts">
import { ref } from 'vue'
import { RouterView } from 'vue-router'
import AppSidebar from './components/layout/AppSidebar.vue'

// 全局搜索尚未迁移；未来在此接 Search Dialog，侧栏仅发出意图。
const notice = ref('')
let noticeTrigger: HTMLElement | null = null
function showNotice(message: string) {
  noticeTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
  notice.value = message
}
function dismissNotice() {
  notice.value = ''
  if (noticeTrigger?.isConnected) noticeTrigger.focus()
}
</script>

<template>
  <div class="app-layout">
    <div class="app-sidebar-container">
      <AppSidebar @search="showNotice('全局搜索尚未开放。')" @notice="showNotice" />
    </div>
    <main class="app-main">
      <RouterView />
    </main>
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
  bottom: max(var(--space-4), env(safe-area-inset-bottom));
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

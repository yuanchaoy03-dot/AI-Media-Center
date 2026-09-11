<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppSidebar from './components/layout/AppSidebar.vue'
</script>

<template>
  <div class="app-layout">
    <div class="app-sidebar-container">
      <AppSidebar />
    </div>
    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
/* 最小桌面布局容器；引入页面布局时再抽取 AppShell。 */
.app-sidebar-container {
  position: fixed;
  inset: var(--layout-shell-inset) auto var(--layout-shell-inset) var(--layout-shell-inset);
  width: var(--layout-sidebar);
}

.app-main {
  min-height: 100dvh;
  margin-left: var(--layout-main-offset);
  padding: var(--space-8) var(--layout-page-padding);
}
</style>

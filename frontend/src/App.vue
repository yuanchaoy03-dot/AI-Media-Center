<script setup lang="ts">
import { computed, ref } from 'vue'
import AppSidebar, { type SidebarItemId } from './components/layout/AppSidebar.vue'

type PreviewId = SidebarItemId | 'settings' | 'user'

const currentView = ref<PreviewId>('home')
const viewLabels: Record<PreviewId, string> = {
  home: '首页',
  library: '我的片库',
  'ai-discovery': 'AI 发现',
  'media-sources': '媒体来源',
  favorites: '收藏',
  'recently-added': '最近添加',
  unwatched: '未看',
  watched: '已看',
  settings: '设置',
  user: '用户入口',
}

const activeItem = computed(() =>
  currentView.value === 'settings' || currentView.value === 'user'
    ? undefined
    : currentView.value,
)
</script>

<template>
  <div class="app-layout">
    <div class="app-sidebar-container">
      <AppSidebar
        :active-item="activeItem"
        @select="currentView = $event"
        @settings="currentView = 'settings'"
        @user="currentView = 'user'"
      />
    </div>
    <main class="app-main">
      <h1>{{ viewLabels[currentView] }}</h1>
      <p role="status">{{ viewLabels[currentView] }}页面尚未实现。</p>
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

.app-main h1 {
  margin: 0 0 var(--space-4);
  font: var(--type-page);
  letter-spacing: var(--tracking-title);
}

.app-main p {
  margin: 0;
  color: var(--color-text-secondary);
  font: var(--type-body);
}
</style>

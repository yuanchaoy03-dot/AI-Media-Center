<script setup lang="ts">
import sidebarIcons from '../../assets/sidebar-icons.svg?url'

export type SidebarItemId =
  | 'home'
  | 'library'
  | 'ai-discovery'
  | 'media-sources'
  | 'favorites'
  | 'recently-added'
  | 'unwatched'
  | 'watched'

interface SidebarItem {
  id: SidebarItemId
  label: string
  icon: string
  activeIcon?: string
}

interface SidebarGroup {
  label: string
  showLabel: boolean
  items: SidebarItem[]
}

// 当前选中项由父组件管理；这些标识表示界面选择，不是路由路径。
defineProps<{ activeItem?: SidebarItemId }>()

const emit = defineEmits<{
  select: [id: SidebarItemId]
  settings: []
  user: []
}>()

const groups: SidebarGroup[] = [
  {
    label: '主导航',
    showLabel: false,
    items: [
      { id: 'home', label: '首页', icon: 'ph-house', activeIcon: 'ph-house-fill' },
      { id: 'library', label: '我的片库', icon: 'ph-film-slate' },
      { id: 'ai-discovery', label: 'AI 发现', icon: 'ph-sparkle' },
      { id: 'media-sources', label: '媒体来源', icon: 'ph-hard-drives' },
    ],
  },
  {
    label: '资料库',
    showLabel: true,
    items: [
      { id: 'favorites', label: '收藏', icon: 'ph-heart' },
      { id: 'recently-added', label: '最近添加', icon: 'ph-clock-counter-clockwise' },
      { id: 'unwatched', label: '未看', icon: 'ph-eye-slash' },
      { id: 'watched', label: '已看', icon: 'ph-check-circle' },
    ],
  },
]
</script>

<template>
  <aside class="app-sidebar" aria-label="应用侧栏">
    <div class="sidebar-brand">
      <span class="sidebar-brand-mark" aria-hidden="true">
        <svg class="sidebar-icon" viewBox="0 0 256 256" focusable="false">
          <use :href="`${sidebarIcons}#ph-film-reel-fill`" />
        </svg>
      </span>
      <span class="sidebar-brand-name">AI-Media-Center</span>
    </div>

    <div class="sidebar-navigation">
      <nav v-for="group in groups" :key="group.label" :aria-label="group.label">
        <h2 v-if="group.showLabel" class="sidebar-group-label">{{ group.label }}</h2>
        <ul class="sidebar-list">
          <li v-for="item in group.items" :key="item.id">
            <!-- 当前仅通知父组件选择变化，后续由 AppShell 接入实际导航。 -->
            <button
              type="button"
              class="sidebar-button"
              :aria-current="activeItem === item.id ? 'page' : undefined"
              @click="emit('select', item.id)"
            >
              <svg class="sidebar-icon" viewBox="0 0 256 256" aria-hidden="true" focusable="false">
                <use
                  :href="`${sidebarIcons}#${activeItem === item.id ? (item.activeIcon ?? item.icon) : item.icon}`"
                />
              </svg>
              <span>{{ item.label }}</span>
            </button>
          </li>
        </ul>
      </nav>
    </div>

    <div class="sidebar-bottom">
      <button type="button" class="sidebar-button" @click="emit('settings')">
        <svg class="sidebar-icon" viewBox="0 0 256 256" aria-hidden="true" focusable="false">
          <use :href="`${sidebarIcons}#ph-gear-six`" />
        </svg>
        <span>设置</span>
      </button>
      <button type="button" class="sidebar-button sidebar-user" @click="emit('user')">
        <span class="sidebar-avatar" aria-hidden="true">我</span>
        <span class="sidebar-user-label">用户入口</span>
        <svg class="sidebar-icon" viewBox="0 0 256 256" aria-hidden="true" focusable="false">
          <use :href="`${sidebarIcons}#ph-caret-right`" />
        </svg>
      </button>
    </div>
  </aside>
</template>

<style scoped>
/* 使用 DESIGN.md 规定的回退值，使组件不依赖 Vite 示例主题。
   全局设计变量、视口定位和响应式抽屉由后续 AppShell 统一管理。 */
.app-sidebar {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: var(--space-6, 1.5rem);
  width: var(--layout-sidebar, 220px);
  max-width: 100%;
  height: 100%;
  min-height: 0;
  padding: var(--space-4, 1rem) var(--space-2, 0.5rem);
  overflow-y: auto;
  color-scheme: dark;
  color: var(--color-text-primary, #f5f5f7);
  background: var(--color-surface, #141416);
  border-radius: var(--radius-lg, 20px);
  font-family: var(--font-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif);
  font-optical-sizing: auto;
  letter-spacing: 0;
  text-align: start;
}

.sidebar-brand {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  min-height: var(--control-height, 2.5rem);
  padding-inline: var(--space-3, 0.75rem);
}

.sidebar-brand-mark {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-xs, 8px);
  background: var(--color-primary, #f5f5f7);
  color: var(--color-text-on-primary, #0a0a0b);
}

.sidebar-brand-name {
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1.4;
}

.sidebar-navigation {
  display: grid;
  gap: var(--space-6, 1.5rem);
}

.sidebar-group-label {
  margin: 0 0 var(--space-2, 0.5rem);
  padding-inline: var(--space-3, 0.75rem);
  color: var(--color-text-secondary, #a1a1a6);
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.5;
  letter-spacing: 0;
}

.sidebar-list,
.sidebar-bottom {
  display: grid;
  gap: var(--space-1, 0.25rem);
  margin: 0;
  padding: 0;
  list-style: none;
}

.sidebar-bottom {
  margin-top: auto;
  padding-top: var(--space-3, 0.75rem);
  border-top: 1px solid var(--color-hairline, rgb(245 245 247 / 7%));
}

.sidebar-button {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  width: 100%;
  min-height: var(--control-height, 2.5rem);
  padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
  border: 0;
  border-radius: var(--radius-nav, 10px);
  background: transparent;
  color: var(--color-text-secondary, #a1a1a6);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.4;
  text-align: start;
  cursor: pointer;
  transition: background-color var(--motion-fast, 120ms), color var(--motion-fast, 120ms);
}

.sidebar-icon {
  display: block;
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
  fill: currentColor;
}

.sidebar-button .sidebar-icon {
  color: var(--color-icon, #afafb6);
}

@media (hover: hover) {
  .sidebar-button:hover {
    background: var(--color-hover, rgb(255 255 255 / 6%));
    color: var(--color-text-primary, #f5f5f7);
  }

  .sidebar-button:hover .sidebar-icon {
    color: var(--color-icon-hover, #d7d7dc);
  }
}

.sidebar-button[aria-current='page'] {
  background: var(--color-selected, rgb(115 169 183 / 14%));
  color: var(--color-text-primary, #f5f5f7);
  font-weight: 600;
}

.sidebar-button[aria-current='page'] .sidebar-icon {
  color: inherit;
}

.sidebar-button:active {
  background: var(--color-pressed, rgb(255 255 255 / 10%));
  transition: none;
}

.sidebar-button:focus-visible {
  outline: var(--focus-width, 2px) solid var(--color-focus, #73a9b7);
  outline-offset: var(--focus-offset, 3px);
}

.sidebar-avatar {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: var(--color-surface-2, #1c1c1e);
  color: var(--color-text-primary, #f5f5f7);
  font-size: 0.75rem;
}

.sidebar-user-label {
  flex: 1;
}

@media (pointer: coarse) {
  .sidebar-button {
    min-height: var(--control-height-touch, 2.75rem);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sidebar-button {
    transition: none;
  }
}
</style>

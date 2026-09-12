<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import sidebarIcons from '../../assets/sidebar-icons.svg?url'

type SidebarItemId =
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

// 展示数据可由未来用户状态替换；这里不维护认证状态。
withDefaults(defineProps<{
  userName?: string
  userSubtitle?: string
  userInitial?: string
  searchExpanded?: boolean
}>(), {
  userName: '林默',
  userSubtitle: '个人电影收藏',
  userInitial: '林',
  searchExpanded: false,
})
const emit = defineEmits<{ search: []; notice: [message: string] }>()
const route = useRoute()
const menuOpen = ref(false)
const accountWrap = ref<HTMLElement | null>(null)
const accountButton = ref<HTMLButtonElement | null>(null)
const accountMenu = ref<HTMLElement | null>(null)

function closeMenu(restoreFocus = false) {
  menuOpen.value = false
  if (restoreFocus) accountButton.value?.focus()
}

function menuItems() {
  return Array.from(accountMenu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    .filter(item => item.getClientRects().length > 0)
}

async function openMenu(last = false) {
  menuOpen.value = true
  await nextTick()
  if (!menuOpen.value) return
  const items = menuItems()
  items[last ? items.length - 1 : 0]?.focus()
}

function onMenuKeydown(event: KeyboardEvent) {
  const items = menuItems()
  const index = items.indexOf(document.activeElement as HTMLElement)
  let next: number
  switch (event.key) {
    case 'ArrowDown': next = (index + 1) % items.length; break
    case 'ArrowUp': next = (index - 1 + items.length) % items.length; break
    case 'Home': next = 0; break
    case 'End': next = items.length - 1; break
    case 'Tab':
      // 先归还触发器，再让原生 Tab/Shift+Tab 继续，不困住焦点。
      closeMenu(true)
      return
    default: return
  }
  event.preventDefault()
  items[next]?.focus()
}

function onOutsideInteraction(event: Event) {
  if (event.target instanceof Node && !accountWrap.value?.contains(event.target)) closeMenu()
}

function onEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && menuOpen.value) {
    event.preventDefault()
    closeMenu(true)
  }
}

function showAccountNotice(action: 'profile' | 'logout') {
  closeMenu(true)
  emit('notice', action === 'profile' ? '个人资料功能尚未开放。' : '退出登录功能尚未接入，当前账号状态未改变。')
}

watch(() => route.fullPath, () => closeMenu())
onMounted(() => {
  document.addEventListener('pointerdown', onOutsideInteraction)
  document.addEventListener('focusin', onOutsideInteraction)
  document.addEventListener('keydown', onEscape)
})
onUnmounted(() => {
  document.removeEventListener('pointerdown', onOutsideInteraction)
  document.removeEventListener('focusin', onOutsideInteraction)
  document.removeEventListener('keydown', onEscape)
})

const groups: SidebarGroup[] = [
  {
    label: '主导航',
    showLabel: false,
    items: [
      { id: 'home', label: '主页', icon: 'ph-house', activeIcon: 'ph-house-fill' },
      { id: 'library', label: '电影', icon: 'ph-film-slate' },
      { id: 'ai-discovery', label: 'AI 发现', icon: 'ph-sparkle' },
      { id: 'media-sources', label: '媒体来源', icon: 'ph-hard-drives' },
    ],
  },
  {
    label: '资料库',
    showLabel: true,
    items: [
      { id: 'recently-added', label: '最近添加', icon: 'ph-clock-counter-clockwise' },
      { id: 'favorites', label: '收藏', icon: 'ph-heart' },
      { id: 'unwatched', label: '未看', icon: 'ph-eye-slash' },
      { id: 'watched', label: '已看', icon: 'ph-check-circle' },
    ],
  },
]
</script>

<template>
  <aside class="app-sidebar" aria-label="应用侧栏">
    <RouterLink class="sidebar-brand" :to="{ name: 'home' }" aria-label="Personal Cinema 主页">
      <span class="sidebar-brand-mark" aria-hidden="true">
        <svg class="sidebar-icon" viewBox="0 0 256 256" focusable="false">
          <use :href="`${sidebarIcons}#ph-film-reel-fill`" />
        </svg>
      </span>
      <span class="sidebar-brand-name">PERSONAL CINEMA</span>
    </RouterLink>

    <button type="button" class="sidebar-search" aria-label="打开全局搜索"
      :aria-expanded="searchExpanded" @click="emit('search')">
      <svg class="sidebar-icon" viewBox="0 0 256 256" aria-hidden="true" focusable="false">
        <use :href="`${sidebarIcons}#ph-magnifying-glass`" />
      </svg>
      <span>搜索</span>
    </button>

    <div class="sidebar-navigation">
      <nav v-for="group in groups" :key="group.label" :aria-label="group.label"
        :class="{ 'library-group': group.showLabel, 'top-group': !group.showLabel }">
        <h2 v-if="group.showLabel" class="sidebar-group-label">{{ group.label }}</h2>
        <ul class="sidebar-list">
          <li v-for="item in group.items" :key="item.id">
            <RouterLink v-slot="{ isActive }" :to="{ name: item.id }"
              class="sidebar-button" :aria-label="item.label" :title="item.label">
              <svg class="sidebar-icon" viewBox="0 0 256 256" aria-hidden="true" focusable="false">
                <use :href="`${sidebarIcons}#${isActive ? (item.activeIcon ?? item.icon) : item.icon}`" />
              </svg>
              <span>{{ item.label }}</span>
            </RouterLink>
          </li>
        </ul>
      </nav>
    </div>

    <div class="sidebar-bottom">
      <RouterLink :to="{ name: 'settings' }" class="sidebar-button sidebar-settings">
        <svg class="sidebar-icon" viewBox="0 0 256 256" aria-hidden="true" focusable="false">
          <use :href="`${sidebarIcons}#ph-gear-six`" />
        </svg>
        <span>设置</span>
      </RouterLink>
      <div ref="accountWrap" class="sidebar-account" :data-open="menuOpen">
        <button id="sidebar-account-button" ref="accountButton" type="button" class="sidebar-user"
          :aria-label="`${userName}，用户菜单`" aria-haspopup="menu"
          aria-controls="sidebar-account-menu" :aria-expanded="menuOpen"
          @click="menuOpen ? closeMenu() : openMenu()"
          @keydown.down.prevent="openMenu()" @keydown.up.prevent="openMenu(true)">
          <span class="sidebar-avatar" aria-hidden="true">{{ userInitial }}</span>
          <span class="sidebar-user-copy"><strong>{{ userName }}</strong><small>{{ userSubtitle }}</small></span>
          <svg class="sidebar-icon" viewBox="0 0 256 256" aria-hidden="true" focusable="false">
            <use :href="`${sidebarIcons}#ph-caret-right`" />
          </svg>
        </button>
        <!-- 保留 DOM，CSS 从当前呈现值反向过渡；关闭时立即移出焦点与可访问树。 -->
        <div id="sidebar-account-menu" ref="accountMenu" class="account-menu" role="menu"
          aria-labelledby="sidebar-account-button" :inert="!menuOpen" :aria-hidden="!menuOpen"
          @keydown="onMenuKeydown">
          <!-- 原型窄屏隐藏的导航保留在同一账号浮层内，避免入口失联。 -->
          <div class="compact-navigation" role="group" aria-label="资料库与设置">
            <template v-for="group in groups" :key="group.label">
              <template v-if="group.showLabel">
                <RouterLink v-for="item in group.items" :key="item.id" :to="{ name: item.id }"
                  class="menu-action" role="menuitem" tabindex="-1" @click="closeMenu(true)">{{ item.label }}</RouterLink>
              </template>
            </template>
            <RouterLink :to="{ name: 'settings' }" class="menu-action" role="menuitem"
              tabindex="-1" @click="closeMenu(true)">设置</RouterLink>
          </div>
          <button type="button" class="menu-action" role="menuitem" tabindex="-1"
            @click="showAccountNotice('profile')">个人资料</button>
          <button type="button" class="menu-action" role="menuitem" tabindex="-1"
            @click="showAccountNotice('logout')">退出登录</button>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
/* 几何来自原型的完整级联；材质、状态与动效遵循 DESIGN.md。 */
.app-sidebar {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: var(--layout-sidebar);
  height: 100%;
  min-height: 0;
  padding: 20px 14px 16px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-lg);
  color: var(--color-text-primary);
  background: var(--color-surface);
  font-family: var(--font-ui);
  font-optical-sizing: auto;
  line-height: 1.45;
}
.sidebar-brand {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 11px;
  min-height: 40px;
  padding: 0 9px;
  border-radius: var(--radius-xs);
  color: inherit;
  text-decoration: none;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .075em;
}
.sidebar-brand-mark {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 27px;
  height: 27px;
  border-radius: var(--radius-xs);
  background: var(--color-primary);
  color: var(--color-text-on-primary);
}
.sidebar-brand-mark .sidebar-icon { width: 16px; height: 16px; }
.sidebar-brand-name { white-space: nowrap; }
.sidebar-search {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 38px;
  padding: 0 11px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-card);
  background: var(--color-surface-2);
  color: var(--color-text-secondary);
}
.sidebar-navigation {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: 27px;
  overflow-y: auto;
  /* 预留焦点外环空间，不改变项目在原型中的坐标。 */
  margin: -5px;
  padding: 5px;
  scrollbar-width: thin;
}
.library-group { margin-top: 2px; }
.sidebar-group-label {
  margin: 0 0 5px;
  padding: 0 12px 8px;
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: .06em;
}
.sidebar-list { display: grid; gap: 5px; margin: 0; padding: 0; list-style: none; }
.sidebar-button {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 38px;
  padding: 0 11px;
  border-radius: var(--radius-nav);
  background: transparent;
  color: var(--color-text-secondary);
  font-weight: 500;
  text-decoration: none;
}
.sidebar-icon { display: block; flex-shrink: 0; width: 20px; height: 20px; fill: currentColor; }
:is(.sidebar-button, .sidebar-search, .sidebar-user) > .sidebar-icon { color: var(--color-icon); }
.sidebar-bottom {
  display: grid;
  flex-shrink: 0;
  gap: 9px;
  padding-top: 14px;
  border-top: 1px solid var(--color-hairline);
}
.sidebar-account { position: relative; }
.sidebar-user {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 20px;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 48px;
  padding: 6px 8px;
  border: 0;
  border-radius: var(--radius-card);
  background: transparent;
  color: inherit;
}
.sidebar-avatar {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-primary);
  color: var(--color-text-on-primary);
  font-size: 12px;
  font-weight: 700;
}
.sidebar-user-copy { display: grid; min-width: 0; line-height: 1.4; }
.sidebar-user-copy strong { font-size: 13px; font-weight: 600; }
.sidebar-user-copy small { color: var(--color-text-secondary); font-size: 12px; }
.sidebar-user-copy :is(strong, small) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.account-menu {
  position: absolute;
  left: 0;
  bottom: calc(100% + 8px);
  z-index: var(--z-floating);
  width: 190px;
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  padding: 7px;
  border: 1px solid var(--material-floating-border);
  border-radius: var(--radius-floating);
  background: var(--material-floating-fallback);
  box-shadow: var(--material-floating-highlight), var(--shadow-floating);
  opacity: 0;
  pointer-events: none;
  transform: translateY(var(--motion-popover-offset));
  transform-origin: bottom center;
  transition: opacity var(--motion-standard) var(--motion-ease), transform var(--motion-standard) var(--motion-ease);
}
.sidebar-account[data-open='true'] .account-menu { opacity: 1; pointer-events: auto; transform: translateY(0); }
.menu-action {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 38px;
  padding: 0 10px;
  border: 0;
  border-radius: var(--radius-card);
  background: transparent;
  color: var(--color-text-primary);
  text-decoration: none;
}
.compact-navigation { display: none; }
:is(.sidebar-search, .sidebar-user, .menu-action) { font-family: inherit; line-height: inherit; cursor: pointer; }
:is(.sidebar-search, .sidebar-button, .menu-action) { font-size: 13px; }
:is(.sidebar-brand, .sidebar-search, .sidebar-button, .sidebar-user, .menu-action) {
  text-align: start;
  touch-action: manipulation;
  transition: background-color var(--motion-fast) var(--motion-ease), color var(--motion-fast) var(--motion-ease);
}
@media (hover: hover) and (pointer: fine) {
  :is(.sidebar-brand, .sidebar-button, .sidebar-search, .sidebar-user, .menu-action):hover {
    background: var(--color-hover);
    color: var(--color-text-primary);
  }
  :is(.sidebar-button, .sidebar-search, .sidebar-user):hover > .sidebar-icon { color: var(--color-icon-hover); }
}
.sidebar-button.router-link-active, .menu-action.router-link-active {
  background: var(--color-selected);
  color: var(--color-text-primary);
  font-weight: 600;
}
.sidebar-button.router-link-active .sidebar-icon { color: inherit; }
:is(.sidebar-brand, .sidebar-button, .sidebar-search, .sidebar-user, .menu-action):active {
  background: var(--color-pressed);
  transition: none;
}
:is(a, button):focus-visible {
  outline: var(--focus-width) solid var(--color-focus);
  outline-offset: var(--focus-offset);
}
@supports (backdrop-filter: blur(1px)) {
  .account-menu {
    background: var(--material-floating-background);
    backdrop-filter: blur(var(--material-floating-blur)) saturate(var(--material-floating-saturation));
  }
}
@media (max-width: 900px) {
  .app-sidebar { width: 100%; height: 70px; padding: 10px 14px; flex-direction: row; align-items: center; gap: 8px; border-radius: 0; }
  .sidebar-brand { padding: 0 4px; }
  .sidebar-brand-name, .library-group, .sidebar-settings, .sidebar-user-copy { display: none; }
  .sidebar-search { width: 42px; min-height: 42px; padding: 0; justify-content: center; }
  .sidebar-search span { display: none; }
  .sidebar-navigation { flex-direction: row; min-width: 0; overflow-x: auto; }
  .sidebar-list { display: flex; gap: 2px; }
  .sidebar-button { padding: 0 10px; white-space: nowrap; }
  .sidebar-bottom { display: block; padding: 0; border: 0; }
  .sidebar-user { grid-template-columns: 34px; width: 42px; min-height: 42px; padding: 4px; }
  .sidebar-user > .sidebar-icon { display: none; }
  .account-menu { left: auto; right: 0; bottom: auto; top: calc(100% + 8px); max-height: calc(100dvh - 86px); transform-origin: top right; transform: translateY(calc(-1 * var(--motion-popover-offset))); }
  .compact-navigation { display: block; border-bottom: 1px solid var(--color-hairline); margin-bottom: 7px; padding-bottom: 7px; }
}
@media (max-width: 680px) {
  .sidebar-brand { width: 40px; }
  .top-group .sidebar-button span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
}
@media (pointer: coarse) {
  :is(.sidebar-brand, .sidebar-button, .sidebar-search, .sidebar-user, .menu-action) { min-height: var(--control-height-touch); }
  .sidebar-search, .sidebar-user { min-width: var(--control-height-touch); }
  .top-group .sidebar-button { min-width: var(--control-height-touch); }
}
@media (prefers-reduced-motion: reduce) {
  :is(.sidebar-brand, .sidebar-button, .sidebar-search, .sidebar-user, .menu-action, .account-menu) { transition: none; }
  .account-menu { transform: none; }
}
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .account-menu { background: var(--material-floating-fallback); backdrop-filter: none; }
}
:global(html[data-transparency='reduced'] #sidebar-account-menu) { background: var(--material-floating-fallback); backdrop-filter: none; }
@media (forced-colors: active) {
  :is(a, button):focus-visible { outline-color: Highlight; }
  .account-menu { background: Canvas; color: CanvasText; backdrop-filter: none; }
  .sidebar-button.router-link-active, .menu-action.router-link-active { outline: 1px solid Highlight; outline-offset: -1px; }
}
</style>

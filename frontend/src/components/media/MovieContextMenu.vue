<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import movieIcons from '../../assets/movie-icons.svg?url&no-inline'
import type { WatchStatus } from '../../types/movie'

const props = defineProps<{
  id: string
  open: boolean
  trigger: HTMLButtonElement | null
  movieId: string
  title: string
  favorite: boolean
  watchStatus: WatchStatus
}>()
type CloseReason = 'escape' | 'tab' | 'action' | 'outside' | 'scrim' | 'resize' | 'unmount'
const emit = defineEmits<{
  close: [reason: CloseReason]
  play: [movieId: string]
  detail: [movieId: string]
  favoriteChange: [movieId: string, next: boolean]
  watchStatusChange: [movieId: string, next: WatchStatus]
  versions: [movieId: string]
}>()
const menu = ref<HTMLDivElement | null>(null)
const visible = ref(false)
const position = ref({ left: '10px', top: '10px' })
const sheet = ref(false)
const keyboardInput = ref(false)
let media: MediaQueryList | undefined
let restoreScroll: (() => void) | undefined
let revision = 0
const actions = computed(() => [
  { key: 'play', icon: 'ph-play-fill', label: '播放' },
  { key: 'detail', icon: 'ph-film-slate', label: '查看详情' },
  { key: 'favorite', icon: 'ph-heart', label: props.favorite ? '取消收藏' : '收藏' },
  { key: 'watched', icon: 'ph-check-circle', label: props.watchStatus === 'watched' ? '标记为未看' : '标记为已看' },
  { key: 'versions', icon: 'ph-hard-drives', label: '查看媒体版本' },
] as const)

function syncScroll() {
  if (visible.value && sheet.value) {
    if (restoreScroll) return
    const body = document.body
    const overflow = body.style.getPropertyValue('overflow')
    const priority = body.style.getPropertyPriority('overflow')
    body.style.setProperty('overflow', 'hidden')
    restoreScroll = () => {
      if (overflow) body.style.setProperty('overflow', overflow, priority)
      else body.style.removeProperty('overflow')
    }
  } else {
    restoreScroll?.()
    restoreScroll = undefined
  }
}

function close(reason: CloseReason) {
  if (!visible.value) return
  revision++
  visible.value = false
  // 同步移出 Tab 顺序，原生 Tab 不会进入仍在退出动画中的菜单。
  if (menu.value) menu.value.inert = true
  syncScroll()
  if (reason !== 'outside' && reason !== 'unmount' && props.trigger?.isConnected) {
    props.trigger.focus({ preventScroll: true })
  }
  emit('close', reason)
}

async function syncOpen() {
  const current = ++revision
  if (!props.open || !props.trigger?.isConnected) {
    visible.value = false
    syncScroll()
    return
  }
  await nextTick()
  if (current !== revision || !menu.value) return
  if (!sheet.value) {
    const rect = props.trigger.getBoundingClientRect()
    const width = menu.value.offsetWidth
    const height = menu.value.offsetHeight
    let top = rect.bottom + 8
    if (top + height > window.innerHeight - 10) top = rect.top - height - 8
    position.value = {
      left: `${Math.max(10, Math.min(window.innerWidth - width - 10, rect.right - width))}px`,
      top: `${Math.max(10, top)}px`,
    }
  }
  visible.value = true
  syncScroll()
  await nextTick()
  if (current === revision) menu.value?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
}

function activate(action: typeof actions.value[number]['key']) {
  if (!visible.value) return
  switch (action) {
    case 'play': emit('play', props.movieId); break
    case 'detail': emit('detail', props.movieId); break
    case 'favorite': emit('favoriteChange', props.movieId, !props.favorite); break
    case 'watched': emit('watchStatusChange', props.movieId, props.watchStatus === 'watched' ? 'unwatched' : 'watched'); break
    case 'versions': emit('versions', props.movieId); break
  }
  close('action')
}

function onKeydown(event: KeyboardEvent) {
  keyboardInput.value = true
  if (!visible.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    close('escape')
    return
  }
  if (event.key === 'Tab') { close('tab'); return }
  const items = [...(menu.value?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
  const index = items.indexOf(document.activeElement as HTMLButtonElement)
  let next: number
  switch (event.key) {
    case 'ArrowDown': next = (index + 1) % items.length; break
    case 'ArrowUp': next = index <= 0 ? items.length - 1 : index - 1; break
    case 'Home': next = 0; break
    case 'End': next = items.length - 1; break
    default: return
  }
  event.preventDefault()
  items[next]?.focus({ preventScroll: true })
}

function onOutside(event: Event) {
  if (event.type === 'pointerdown') keyboardInput.value = false
  const target = event.target
  if (!(target instanceof Element) || menu.value?.contains(target)) return
  // 其他卡片的触发器直接切换单实例，不先关闭并抢回旧焦点。
  if (target.closest('button[aria-controls]')?.getAttribute('aria-controls') === props.id) return
  if (target.closest('.context-scrim')) return
  close('outside')
}
function onResize() { close('resize') }
function onMediaChange() {
  close('resize')
  sheet.value = media?.matches ?? false
}
watch(() => [props.open, props.trigger, props.movieId], syncOpen)
onMounted(() => {
  media = window.matchMedia('(max-width: 900px), (hover: none)')
  sheet.value = media.matches
  media.addEventListener('change', onMediaChange)
  document.addEventListener('pointerdown', onOutside)
  document.addEventListener('focusin', onOutside)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', onResize)
  void syncOpen()
})
onBeforeUnmount(() => {
  close('unmount')
  revision++
  restoreScroll?.()
  media?.removeEventListener('change', onMediaChange)
  document.removeEventListener('pointerdown', onOutside)
  document.removeEventListener('focusin', onOutside)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <Teleport to="body">
    <div class="context-scrim" :data-open="visible && sheet" aria-hidden="true" @click="close('scrim')" />
    <div :id="id" ref="menu" class="context-menu" :data-open="visible" :data-keyboard="keyboardInput" :style="position"
      lang="zh-CN" role="menu" aria-label="电影操作" :aria-description="title" :aria-hidden="!visible" :inert="!visible">
      <template v-for="action in actions" :key="action.key">
        <div v-if="action.key === 'versions'" class="context-divider" role="separator" />
        <button class="context-action" type="button" role="menuitem" tabindex="-1"
          :data-menu-action="action.key" @click="activate(action.key)">
          <svg viewBox="0 0 256 256" aria-hidden="true" focusable="false"><use :href="`${movieIcons}#${action.icon}`" /></svg>
          <span>{{ action.label }}</span>
        </button>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
/* 片库原型的最终级联；局部 Token 保留其视觉终点。 */
.context-menu {
  --radius-editorial: 14px;
  --radius-xs: 8px;
  --radius-nav: 10px;
  --radius-pill: 9999px;
  --fg: #f5f5f7;
  --text-primary: rgba(255,255,255,.92);
  --icon-default: #afafb6;
  --icon-hover: #d7d7dc;
  --line: color-mix(in oklch, #f5f5f7 7%, transparent);
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Segoe UI', sans-serif;
  font-size: 15px;
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
  font-synthesis: weight style small-caps;
  text-rendering: auto;
  max-height: calc(100dvh - 24px);
  overflow-y: auto;
  overscroll-behavior: contain;
}
.context-action { font-family: inherit; line-height: inherit; cursor: pointer; touch-action: manipulation; }
.context-action svg { display: block; max-width: 100%; }
.context-scrim{display:none}
.context-menu{position:fixed;z-index:38;width:168px;padding:6px;border:1px solid rgba(255,255,255,.1);border-radius:var(--radius-editorial);background:rgba(28,28,30,.88);box-shadow:0 18px 48px rgba(0,0,0,.36),inset 0 1px 0 rgba(255,255,255,.045);opacity:0;pointer-events:none;-webkit-backdrop-filter:blur(18px) saturate(115%);backdrop-filter:blur(18px) saturate(115%);transform:translateY(-4px);transition:opacity .16s ease-out,transform .16s ease-out}
.context-menu[data-open="true"]{opacity:1;pointer-events:auto;transform:none}
.context-action{display:flex;align-items:center;gap:9px;width:100%;min-height:35px;padding:0 9px;border:0;border-radius:var(--radius-xs);background:transparent;color:var(--text-primary);font-size:13px;font-weight:450;text-align:left;transition:background .11s ease-in,color .11s ease-in}
.context-action svg{flex:0 0 auto;width:16px;height:16px;color:var(--icon-default);fill:currentColor;transition:color .11s ease-in}
.context-action:hover,.context-menu[data-keyboard="true"] .context-action:focus-visible{background:rgba(255,255,255,.06);color:var(--fg)}
.context-action:hover svg,.context-menu[data-keyboard="true"] .context-action:focus-visible svg{color:var(--icon-hover)}
.context-action:focus{outline:none}
.context-menu[data-keyboard="true"] .context-action:focus-visible{outline:1px solid rgba(255,255,255,.18);outline-offset:-1px}
.context-divider{height:1px;margin:5px 7px;background:var(--line)}
@media (max-width: 900px), (hover: none) {
  .context-scrim{position:fixed;inset:0;z-index:37;display:block;background:rgba(0,0,0,.28);opacity:0;visibility:hidden;pointer-events:none;-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);transition:opacity .18s ease-out,visibility .18s ease-out}
  .context-scrim[data-open="true"]{opacity:1;visibility:visible;pointer-events:auto}
  .context-menu{right:auto!important;bottom:max(12px,env(safe-area-inset-bottom))!important;left:50%!important;top:auto!important;width:min(420px,calc(100% - 24px));padding:18px 10px 10px;border-color:rgba(255,255,255,.11);border-radius:24px;background:rgba(31,31,34,.82);box-shadow:0 18px 44px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.07);-webkit-backdrop-filter:blur(24px) saturate(125%);backdrop-filter:blur(24px) saturate(125%);transform:translate(-50%,calc(100% + 28px)) scale(.985);transform-origin:center bottom;transition:opacity .18s ease-out,transform .22s cubic-bezier(.22,.75,.28,1)}
  .context-menu::before{content:"";position:absolute;top:7px;left:50%;width:34px;height:4px;border-radius:var(--radius-pill);background:rgba(255,255,255,.2);transform:translateX(-50%)}
  .context-menu[data-open="true"]{transform:translate(-50%,0) scale(1)}
  .context-action{min-height:50px;padding:0 14px;border-radius:var(--radius-nav);font-size:15px}
  .context-action svg{width:19px;height:19px}
  .context-action[data-menu-action="play"]{color:var(--fg);font-weight:600}
  .context-divider{margin:5px 12px;background:rgba(255,255,255,.08)}
}

@media (hover: none) { .context-action { min-height: 44px; } }
@media (prefers-reduced-motion: reduce) {
  .context-menu, .context-scrim, .context-action, .context-action svg { transition: none; }
  .context-menu { transform: none; }
}
@media (prefers-reduced-motion: reduce) and (max-width: 900px), (prefers-reduced-motion: reduce) and (hover: none) {
  .context-menu, .context-menu[data-open="true"] { transform: translateX(-50%); }
}
</style>

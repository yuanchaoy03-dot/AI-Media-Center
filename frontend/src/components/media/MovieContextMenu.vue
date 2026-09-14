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
  collection?: boolean
}>()
type CloseReason = 'action' | 'outside' | 'resize' | 'scroll' | 'unmount'
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
let revision = 0
const actions = computed(() => props.collection ? [
  { key: 'detail', icon: 'ph-caret-right', label: '查看合集' },
] as const : [
  { key: 'play', icon: 'ph-play-fill', label: '播放' },
  { key: 'detail', icon: 'ph-film-slate', label: '查看详情' },
  { key: 'favorite', icon: 'ph-heart', label: props.favorite ? '取消收藏' : '收藏' },
  { key: 'watched', icon: 'ph-check-circle', label: props.watchStatus === 'watched' ? '标记为未看' : '标记为已看' },
  { key: 'versions', icon: 'ph-hard-drives', label: '查看媒体版本' },
] as const)

function close(reason: CloseReason) {
  if (!visible.value) return
  revision++
  visible.value = false
  emit('close', reason)
}

async function syncOpen() {
  const current = ++revision
  if (!props.open || !props.trigger?.isConnected) {
    visible.value = false
    return
  }
  await nextTick()
  if (current !== revision || !menu.value) return
  const rect = props.trigger.getBoundingClientRect()
  const width = menu.value.offsetWidth
  const height = menu.value.offsetHeight
  let top = rect.bottom + 8
  if (top + height > window.innerHeight - 10) top = rect.top - height - 8
  position.value = {
    left: `${Math.max(10, Math.min(window.innerWidth - width - 10, rect.right - width))}px`,
    top: `${Math.max(10, top)}px`,
  }
  visible.value = true
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

function onOutside(event: Event) {
  const target = event.target
  if (!(target instanceof Element) || menu.value?.contains(target)) return
  // 其他卡片的触发器直接切换单实例，不先关闭。
  if (target.closest('button[aria-controls]')?.getAttribute('aria-controls') === props.id) return
  close('outside')
}
function onResize() { close('resize') }
function onScroll(event: Event) {
  const target = event.target
  if (target instanceof Node && menu.value?.contains(target)) return
  close('scroll')
}
watch(() => [props.open, props.trigger, props.movieId, props.collection], syncOpen)
onMounted(() => {
  document.addEventListener('pointerdown', onOutside)
  window.addEventListener('resize', onResize)
  window.addEventListener('scroll', onScroll, { capture: true, passive: true })
  void syncOpen()
})
onBeforeUnmount(() => {
  close('unmount')
  revision++
  document.removeEventListener('pointerdown', onOutside)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('scroll', onScroll, { capture: true })
})
</script>

<template>
  <Teleport to="body">
    <div :id="id" ref="menu" class="context-menu" :data-open="visible" :style="position"
      lang="zh-CN" role="group" :aria-label="`${title}${collection ? '合集' : '电影'}操作`" :aria-hidden="!visible" :inert="!visible">
      <template v-for="action in actions" :key="action.key">
        <div v-if="action.key === 'versions'" class="context-divider" role="separator" />
        <button class="context-action" type="button"
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
.context-action { font-family: inherit; line-height: inherit; cursor: pointer; }
.context-action svg { display: block; max-width: 100%; }
.context-menu{position:fixed;z-index:38;width:168px;padding:6px;border:1px solid rgba(255,255,255,.1);border-radius:var(--radius-editorial);background:rgba(28,28,30,.88);box-shadow:0 18px 48px rgba(0,0,0,.36),inset 0 1px 0 rgba(255,255,255,.045);opacity:0;pointer-events:none;-webkit-backdrop-filter:blur(18px) saturate(115%);backdrop-filter:blur(18px) saturate(115%);transform:translateY(-4px);transition:opacity .16s ease-out,transform .16s ease-out}
.context-menu[data-open="true"]{opacity:1;pointer-events:auto;transform:none}
.context-action{display:flex;align-items:center;gap:9px;width:100%;min-height:35px;padding:0 9px;border:0;border-radius:var(--radius-xs);background:transparent;color:var(--text-primary);font-size:13px;font-weight:450;text-align:left;transition:background .11s ease-in,color .11s ease-in}
.context-action svg{flex:0 0 auto;width:16px;height:16px;color:var(--icon-default);fill:currentColor;transition:color .11s ease-in}
.context-action:hover{background:rgba(255,255,255,.06);color:var(--fg)}
.context-action:hover svg{color:var(--icon-hover)}
.context-divider{height:1px;margin:5px 7px;background:var(--line)}
@media (prefers-reduced-motion: reduce) {
  .context-menu, .context-action, .context-action svg { transition: none; }
  .context-menu { transform: none; }
}
</style>

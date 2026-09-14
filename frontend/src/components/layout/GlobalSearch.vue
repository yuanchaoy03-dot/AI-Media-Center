<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import icons from '../../assets/sidebar-icons.svg?url'
import { searchLibraryMovies } from '../../services/movieService'
import type { LibraryMovie } from '../../types/movie'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; select: [movie: LibraryMovie] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const query = ref('')
const results = ref<Array<LibraryMovie & { rating?: string }>>([])
const loading = ref(false)
const failed = ref(false)
let revision = 0
watch(() => props.open, async open => {
  await nextTick()
  if (open && props.open && !dialog.value?.open) dialog.value?.showModal()
  else if (!props.open) dialog.value?.close()
})
watch([() => props.open, query], async ([open, keyword]) => {
  const request = ++revision
  if (!open) return
  loading.value = true
  failed.value = false
  results.value = []
  try {
    const movies = await searchLibraryMovies(keyword)
    if (request === revision) results.value = movies
  } catch {
    if (request === revision) failed.value = true
  } finally {
    if (request === revision) loading.value = false
  }
})
onBeforeUnmount(() => { revision++ })
function close() { emit('close') }
function onBackdrop(event: MouseEvent) {
  if (!dialog.value || event.target !== dialog.value) return
  const rect = dialog.value.getBoundingClientRect()
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close()
}
function select(movie: LibraryMovie) { emit('select', movie); close() }
</script>

<template>
  <Teleport to="body">
    <dialog id="global-search-dialog" ref="dialog" class="search-dialog" aria-label="搜索影片"
      @cancel="close" @close="close" @click="onBackdrop">
      <div class="search-field">
        <label class="sr-only" for="global-search">搜索片名、导演或演员</label>
        <svg viewBox="0 0 256 256" aria-hidden="true"><use :href="`${icons}#ph-magnifying-glass`" /></svg>
        <input id="global-search" v-model="query" class="search-input" type="search" autocomplete="off" autofocus
          aria-controls="search-result-list" placeholder="搜索片名、导演或演员" />
        <button class="search-clear" v-show="query" type="button" aria-label="清空搜索关键词" @click="query = ''">
          <svg viewBox="0 0 256 256" aria-hidden="true"><path d="m61 50 67 67 67-67 11 11-67 67 67 67-11 11-67-67-67 67-11-11 67-67-67-67z" /></svg>
        </button>
        <button class="search-key" type="button" aria-label="关闭搜索" @click="close">ESC</button>
      </div>
      <div class="search-results" :aria-busy="loading">
        <p class="search-caption">{{ query.trim() ? '搜索结果' : '最近内容' }}</p>
        <div id="search-result-list" class="search-result-list">
          <button v-for="movie in results" :key="movie.id" class="search-result" type="button" @click="select(movie)">
            <img class="search-thumb" :src="movie.posterUrl" :alt="`${movie.title}电影海报`" />
            <span><strong>{{ movie.title }}</strong><small>{{ movie.year }} · {{ movie.genres.join(' / ') }}{{ movie.rating ? ` · ${movie.rating}` : '' }}</small></span>
            <span class="search-result-caret"><svg viewBox="0 0 256 256" aria-hidden="true"><use :href="`${icons}#ph-caret-right`" /></svg></span>
          </button>
        </div>
        <div v-if="loading || failed || !results.length" class="search-empty" role="status">
          <strong>{{ loading ? '正在搜索片库' : failed ? '搜索暂时不可用' : query.trim() ? '没有找到匹配的影片' : '还没有电影' }}</strong>
          <span v-if="!loading">{{ failed ? '请稍后重新打开搜索' : query.trim() ? '尝试搜索片名、导演或演员' : '添加 WebDAV 媒体来源后，影片会出现在这里。' }}</span>
        </div>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
.search-field{display:grid;flex:0 0 auto;grid-template-columns:22px minmax(0,1fr) 30px auto;align-items:center;gap:12px;margin:15px 15px 7px;padding:12px 15px;border:1px solid rgba(255,255,255,.09);border-radius:var(--radius-md);background:rgba(255,255,255,.055);box-shadow:inset 0 1px 0 rgba(255,255,255,.035);transition:border-color .2s ease-out,background .2s ease-out,box-shadow .2s ease-out}
.search-field:focus-within{border-color:rgba(255,255,255,.26);outline:0;background:rgba(255,255,255,.07);box-shadow:inset 0 1px 0 rgba(255,255,255,.07)}
.search-field>svg{width:20px;height:20px;color:var(--icon-default);fill:currentColor}
.search-input{width:100%;border:0;outline:0;background:transparent;color:var(--fg);font-size:17px}
.search-input::placeholder{color:var(--muted)}
.search-input:focus-visible{outline:0}
.search-input::-webkit-search-cancel-button,.search-input::-webkit-search-decoration{-webkit-appearance:none;appearance:none}
.search-clear{display:grid;place-items:center;width:30px;height:30px;padding:0;border:0;border-radius:var(--radius-circle);background:transparent;color:var(--muted);transition:color .2s ease-out,background .2s ease-out}
.search-clear:hover,.search-clear:focus-visible{background:rgba(255,255,255,.07);color:var(--fg)}
.search-clear:focus-visible{outline:2px solid rgba(255,255,255,.28);outline-offset:1px}
.search-clear svg{width:17px;height:17px;fill:currentColor}
.search-key{padding:3px 7px;border:1px solid rgba(255,255,255,.11);border-radius:var(--radius-xs);background:rgba(255,255,255,.035);color:var(--weak);font:10px var(--font-mono);letter-spacing:.02em}
.search-results{min-height:0;max-height:calc(74vh - 82px);overflow-y:auto;padding:8px 12px 13px;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.2) transparent}
.search-results::-webkit-scrollbar{width:5px}
.search-results::-webkit-scrollbar-track{background:transparent}
.search-results::-webkit-scrollbar-thumb{border-radius:var(--radius-pill);background:rgba(255,255,255,.16)}
.search-results:hover::-webkit-scrollbar-thumb{background:rgba(255,255,255,.25)}
.search-caption{padding:5px 8px 8px;color:color-mix(in oklch,var(--fg) 66%,transparent);font-size:12px;font-weight:600;letter-spacing:.015em}
.search-result-list{display:grid}
.search-result{display:grid;grid-template-columns:42px minmax(0,1fr) 24px;align-items:center;gap:12px;width:100%;min-height:68px;padding:7px 9px;border:0;border-radius:var(--radius-sm);background:transparent;text-align:left;transition:background .2s ease-out,color .2s ease-out}
.search-result:hover,.search-result:focus-visible,.search-result[data-active="true"]{background:rgba(255,255,255,.055)}
.search-result:focus-visible{outline:1px solid rgba(255,255,255,.2);outline-offset:-1px}
.search-thumb{width:40px;aspect-ratio:2/3;border-radius:var(--radius-xs);object-fit:cover;opacity:1;filter:none;transform:none}
.search-result span:nth-child(2){display:grid}
.search-result strong{color:color-mix(in oklch,var(--fg) 92%,transparent);font-size:14px;font-weight:600;transition:color .2s ease-out}
.search-result:hover strong,.search-result:focus-visible strong,.search-result[data-active="true"] strong{color:var(--fg)}
.search-result small{margin-top:2px;color:var(--muted);font-size:12px}
.search-result-caret{display:grid;place-items:center;color:var(--weak);opacity:.42;transition:color .2s ease-out,opacity .2s ease-out,transform .2s ease-out}
.search-result-caret svg{width:15px;height:15px;fill:currentColor}
.search-result:hover .search-result-caret,.search-result:focus-visible .search-result-caret,.search-result[data-active="true"] .search-result-caret{color:var(--icon-hover);opacity:1;transform:translateX(1px)}
.search-empty{display:grid;gap:4px;padding:28px 10px 32px;color:var(--muted);font-size:12px;text-align:center}
.search-empty strong{color:var(--fg);font-size:14px;font-weight:600}
.search-empty span{color:var(--muted);font-size:12px}


.search-dialog { --fg:#f5f5f7;--muted:#a1a1a6;--weak:#6e6e73;--icon-default:#afafb6;--icon-hover:#d7d7dc;--radius-md:16px;--radius-sm:12px;--radius-xs:8px;--radius-pill:9999px;--radius-circle:50%;--font-mono:'SFMono-Regular',Consolas,monospace; position:fixed;inset:10vh auto auto 50%;margin:0;padding:0;width:min(760px,calc(100% - 40px));max-height:74vh;overflow:hidden;flex-direction:column;border:1px solid rgba(255,255,255,.11);border-radius:20px;background:rgba(28,28,30,.82);color:var(--fg);box-shadow:0 32px 90px rgba(0,0,0,.56),inset 0 1px 0 rgba(255,255,255,.055);backdrop-filter:blur(26px) saturate(120%);transform:translateX(-50%);font:15px/1.45 -apple-system,BlinkMacSystemFont,'SF Pro Text','PingFang SC','Segoe UI',sans-serif; }
.search-dialog[open] { display:flex; }
.search-dialog::backdrop { background:rgba(0,0,0,.38);backdrop-filter:blur(2px) saturate(92%); }
.search-dialog button,.search-dialog input { font-family:inherit;cursor:pointer; }
.search-input { cursor:text!important;line-height:1.45; }
.search-result { font-size:15px;line-height:1.45; }
.search-dialog .search-key { font-family:var(--font-mono); }
.search-dialog p { margin:0; }
.search-dialog svg { display:block; }
.search-result span:nth-child(2) { min-width:0; }
.search-result strong,.search-result small { overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.search-results { min-height:0;overscroll-behavior:contain; }
.sr-only { position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap; }
@media(prefers-reduced-motion:no-preference) {
 .search-dialog { transition:opacity .2s ease-out,transform .2s ease-out,display .2s allow-discrete,overlay .2s allow-discrete; }
 .search-dialog:not([open]) { opacity:0;transform:translate(-50%,-10px) scale(.992); }
 @starting-style { .search-dialog[open] { opacity:0;transform:translate(-50%,-10px) scale(.992); } }
}
@media(prefers-reduced-motion:reduce) { *,*::before,*::after { transition:none!important; } }
</style>

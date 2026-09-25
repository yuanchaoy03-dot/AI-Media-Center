<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { mediaSourceState, removeSource, scanLabel, startScan } from '../services/mediaSourceService'
import { getLibraryMovies } from '../services/movieService'
import type { LibraryMovie } from '../types/movie'
import type { MediaSource } from '../types/mediaSource'
import SourceIcon from '../components/media-source/SourceIcon.vue'
import SourceMenu from '../components/media-source/SourceMenu.vue'
import SourceDialog from '../components/media-source/SourceDialog.vue'
import SourceConfirmDialog from '../components/media-source/SourceConfirmDialog.vue'
import ScanTaskList from '../components/media-source/ScanTaskList.vue'
import '../assets/media-source.css'

const router = useRouter()
const movies = ref<LibraryMovie[]>([])
const sourceList = computed(() => mediaSourceState.sources)
const scanTasks = computed(() => mediaSourceState.tasks)
const menuSource = ref<MediaSource>()
const menuScanLabel = ref('')
const menuTaskId = ref('')
const trigger = shallowRef<HTMLButtonElement>()
const dialogOpen = ref(false)
const editing = ref<MediaSource>()
const notice = ref('')
const removing = ref<MediaSource>()
const recentMovies = computed(() => movies.value.filter(movie => movie.sourceIds.some(id => sourceList.value.some(source => source.id === id))).sort((a,b) => b.addedAt - a.addedAt).slice(0,6))
const sourceRoots = (id: string) => mediaSourceState.roots.filter(root => root.sourceId === id)
const runningTask = (id: string) => mediaSourceState.tasks.find(task => task.sourceId === id && task.status === 'running')
function folderSummary(id: string) {
  const roots = sourceRoots(id)
  if (!roots.length) return '未选择影片文件夹'
  const paused = roots.filter(root => !root.enabled).length
  return `已选择 ${roots.length} 个影片文件夹${paused ? ` · ${paused} 个已暂停` : ''}`
}
const movieCount = (id: string) => movies.value.filter(movie => movie.sourceIds.includes(id)).length
function openMenu(source: MediaSource, event: MouseEvent) {
  if (!(event.currentTarget instanceof HTMLButtonElement)) return
  if (menuSource.value?.id === source.id) { menuSource.value = undefined; return }
  menuSource.value = source
  menuScanLabel.value = scanLabel(source)
  menuTaskId.value = runningTask(source.id)?.id ?? ''
  trigger.value = event.currentTarget
}
function openDialog(source?: MediaSource) { editing.value = source; dialogOpen.value = true }
function menuAction(action: 'detail' | 'scan' | 'edit' | 'remove') {
  const source = menuSource.value
  const selectedTaskId = menuTaskId.value
  menuSource.value = undefined
  if (!source) return
  if (action === 'edit') openDialog(source)
  else if (action === 'remove') {
    removing.value = source
  } else if (action === 'scan') {
    const detail = { name: 'media-source-detail', params: { sourceId: source.id } }
    if (source.status !== 'available') {
      void router.push({ ...detail, query: { action: 'scan' } })
      return
    }
    const runningId = selectedTaskId || runningTask(source.id)?.id
    if (runningId) {
      void router.push({ ...detail, query: { task: runningId }, hash: '#recent-scans' })
      return
    }
    const roots = sourceRoots(source.id)
    if (!roots.length || !roots.some(root => root.enabled)) {
      void router.push({ ...detail, hash: '#scan-roots' })
      return
    }
    try {
      startScan(source.id)
      notice.value = `${source.name}已开始扫描。`
    } catch (error) {
      notice.value = error instanceof Error ? error.message : '扫描未启动。'
    }
  } else void router.push({ name: 'media-source-detail', params: { sourceId: source.id } })
}
function confirmRemove() {
  if (!removing.value) return
  removeSource(removing.value.id)
  notice.value = `已移除${removing.value.name}`
  removing.value = undefined
}
function saved(id: string) { dialogOpen.value = false; void router.push({ name: 'media-source-detail', params: { sourceId: id }, query: editing.value ? {} : { created: '1' } }) }
onMounted(async () => { movies.value = await getLibraryMovies() })
</script>
<template>
  <section class="media-source-ui source-page" lang="zh-CN">
    <header class="page-heading"><h1 class="page-title">媒体来源</h1><button class="primary-action" @click="openDialog()"><SourceIcon name="plus" />添加来源</button></header>
    <div class="sources-workspace">
      <section class="sources-section" aria-labelledby="connected-title">
        <h2 id="connected-title" class="section-title">我的来源</h2>
        <div v-if="sourceList.length" class="source-list">
          <article v-for="source in sourceList" :key="source.id" class="source-item">
            <RouterLink class="source-hit" :to="{ name: 'media-source-detail', params: { sourceId: source.id } }" :aria-label="`查看${source.name}详情`" />
            <div class="source-copy"><strong class="source-name" :title="source.name">{{ source.name }}</strong><span class="source-type">{{ source.type }}</span><span class="source-location" :title="source.address">{{ source.address.replace(/^https?:\/\//, '') }}</span></div>
            <span class="source-status"><span v-if="source.status === 'testing' || (source.status === 'available' && runningTask(source.id))" class="spinner" /><SourceIcon v-else :name="source.status === 'available' ? 'check-circle' : 'x'" />{{ source.status === 'available' ? runningTask(source.id) ? '扫描中' : '已连接' : source.status === 'testing' ? '正在测试' : '连接异常' }}</span>
            <span class="source-config">{{ folderSummary(source.id) }}</span>
            <RouterLink v-if="!sourceRoots(source.id).length" class="source-config-link" :to="{ name: 'media-source-detail', params: { sourceId: source.id }, hash: '#scan-roots' }">选择影片文件夹 →</RouterLink>
            <span class="source-footer"><span>{{ movieCount(source.id) }} 部电影</span><span>上次扫描 · {{ source.lastScan }}</span></span>
            <button class="source-more" :aria-label="`${source.name}更多操作`" aria-controls="source-menu" :aria-expanded="menuSource?.id === source.id" @click="openMenu(source, $event)"><SourceIcon name="dots-three-bold" /></button>
          </article>
        </div>
        <div v-else class="source-empty"><span class="empty-icon"><SourceIcon name="hard-drives" /></span><h3>还没有媒体来源</h3><p>添加 WebDAV 媒体来源，开始建立你的个人片库。支持 AList、NAS WebDAV、Nextcloud 等标准 WebDAV 服务。</p><button class="primary-action" @click="openDialog()">添加媒体来源</button></div>
      </section>
      <section v-if="scanTasks.length" class="sources-section"><h2 class="section-title">最近扫描</h2><ScanTaskList :tasks="scanTasks" :sources="sourceList" @select="router.push({ name: 'media-source-detail', params: { sourceId: $event.sourceId }, query: { task: $event.id }, hash: '#recent-scans' })" /></section>
      <section class="sources-section"><div class="section-heading-row"><h2 class="section-title">最近入库</h2><RouterLink class="section-action" to="/library">查看全部<SourceIcon name="caret-right" /></RouterLink></div>
        <div class="recent-media-grid"><RouterLink v-for="movie in recentMovies" :key="movie.id" class="recent-movie" :to="{ name: 'movie-detail', params: { movieId: movie.id } }"><span class="recent-art"><img :src="movie.posterUrl" :alt="`${movie.title}电影海报`" /></span><strong>{{ movie.title }}</strong><span>{{ sourceList.find(source => movie.sourceIds.includes(source.id))?.name }}</span></RouterLink></div>
      </section>
      <p v-if="notice" class="source-note" role="status">{{ notice }}</p>
    </div>
    <SourceMenu v-if="menuSource && trigger" :trigger="trigger" :scan-label="menuScanLabel" @close="menuSource = undefined" @action="menuAction" />
    <SourceDialog v-if="dialogOpen" :source="editing" @close="dialogOpen = false" @saved="saved" />
    <SourceConfirmDialog v-if="removing" title="移除来源？" :message="`移除“${removing.name}”后，此来源已选择的影片文件夹也会移除。云端文件不会删除。`" confirm-label="移除来源" @close="removing = undefined" @confirm="confirmRemove" />
  </section>
</template>
<style scoped>
.recent-movie { min-width:0; text-decoration:none; display:grid; grid-template-rows:auto 16px 15px; gap:2px; }
.recent-art { position:relative; aspect-ratio:2/3; overflow:hidden; border-radius:10px; margin-bottom:6px; background:var(--color-surface-2); }
.recent-art img { display:block; width:100%; height:100%; object-fit:cover; }
.recent-art::after { content:''; position:absolute; inset:0; background:rgba(0,0,0,.38); opacity:0; transition:opacity var(--motion-fast); }
.recent-movie:hover .recent-art::after { opacity:1; }
.recent-movie strong { color:rgba(255,255,255,.92); font-size:13px; font-weight:500; line-height:16px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.recent-movie>span:last-child { color:rgba(255,255,255,.62); font-size:12px; line-height:15px; }
@media(prefers-reduced-motion:reduce) { .recent-art::after { transition:none; } }
</style>

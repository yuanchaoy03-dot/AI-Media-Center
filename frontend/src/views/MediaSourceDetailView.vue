<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowRef, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { mediaSourceState, scanLabel, testSourceConnection, setRootEnabled, removeScanRoot, startScan } from '../services/mediaSourceService'
import { getLibraryMovies } from '../services/movieService'
import type { LibraryMovie } from '../types/movie'
import SourceIcon from '../components/media-source/SourceIcon.vue'
import SourceDialog from '../components/media-source/SourceDialog.vue'
import SourceConfirmDialog from '../components/media-source/SourceConfirmDialog.vue'
import DirectoryBrowser from '../components/media-source/DirectoryBrowser.vue'
import ScanTaskList from '../components/media-source/ScanTaskList.vue'
import MovieCard from '../components/media/MovieCard.vue'
import MovieContextMenu from '../components/media/MovieContextMenu.vue'
import '../assets/media-source.css'

const route = useRoute()
const router = useRouter()
const sourceId = computed(() => String(route.params.sourceId))
const source = computed(() => mediaSourceState.sources.find(item => item.id === sourceId.value))
const roots = computed(() => mediaSourceState.roots.filter(item => item.sourceId === sourceId.value))
const tasks = computed(() => mediaSourceState.tasks.filter(item => item.sourceId === sourceId.value))
const selectedTaskId = ref('')
const selectedTask = computed(() => tasks.value.find(task => task.id === selectedTaskId.value))
const movies = ref<LibraryMovie[]>([])
const sourceMovies = computed(() => movies.value.filter(movie => movie.sourceIds.includes(sourceId.value)).sort((a,b) => b.addedAt - a.addedAt))
const editing = ref(false)
const browsing = ref(false)
const removingRoot = ref<{ id: string; path: string }>()
const notice = ref('')
const rootSection = ref<HTMLElement>()
const taskSection = ref<HTMLElement>()
const activeMovie = ref<LibraryMovie>()
const movieTrigger = shallowRef<HTMLButtonElement | null>(null)
const statusLabels = { pending: '等待首次扫描', running: '扫描中（演示）', completed: '扫描完成（演示）', failed: '扫描未完成（演示）' }
const connectionNotice = computed(() => source.value?.status === 'error' ? source.value.connectionError : source.value?.status === 'testing' ? '正在测试连接（演示）…' : notice.value || (route.query.created && !roots.value.length ? '来源已创建。尚未选择影片文件夹，也未开始扫描。' : '连接测试仅验证连通性，不代表已扫描或文件可播放。'))
async function workflow() {
  if (!source.value) return
  if (source.value.status !== 'available') { await testSourceConnection(sourceId.value); return }
  const running = tasks.value.find(task => task.status === 'running')
  if (running) { selectedTaskId.value = running.id; await nextTick(); taskSection.value?.scrollIntoView(); return }
  if (!roots.value.length) { browsing.value = true; return }
  if (!roots.value.some(root => root.enabled)) { rootSection.value?.scrollIntoView(); notice.value = '请先为至少一个影片文件夹恢复扫描。'; return }
  try { selectedTaskId.value = startScan(sourceId.value); await nextTick(); taskSection.value?.scrollIntoView() }
  catch (error) { notice.value = error instanceof Error ? error.message : '扫描未启动。' }
}
function removeRoot(id: string, path: string) {
  removingRoot.value = { id, path }
}
function confirmRemoveRoot() {
  if (removingRoot.value) removeScanRoot(sourceId.value, removingRoot.value.id)
  removingRoot.value = undefined
}
function showMovie(id: string) { void router.push({ name: 'movie-detail', params: { movieId: id } }) }
function moreMovie(payload: { movieId: string; trigger: HTMLButtonElement }) {
  if (activeMovie.value?.id === payload.movieId) { activeMovie.value = undefined; return }
  activeMovie.value = movies.value.find(movie => movie.id === payload.movieId)
  movieTrigger.value = payload.trigger
}
function playback() { notice.value = '播放功能尚未接入，当前仅展示 Frontend Mock。' }
watch(sourceId, () => { editing.value = false; browsing.value = false; removingRoot.value = undefined; selectedTaskId.value = ''; notice.value = ''; activeMovie.value = undefined })
async function syncRoute() {
  selectedTaskId.value = typeof route.query.task === 'string' ? route.query.task : selectedTaskId.value
  await nextTick()
  if (route.hash === '#scan-roots') rootSection.value?.scrollIntoView()
  if (route.hash === '#recent-scans') taskSection.value?.scrollIntoView()
  if (route.query.action === 'scan') {
    // 消费一次动作意图；前进/后退不会重复自动发起扫描。
    await router.replace({ path: route.path, query: {}, hash: route.hash })
    await workflow()
  }
}
watch(() => route.fullPath, syncRoute)
onMounted(async () => { await syncRoute(); movies.value = await getLibraryMovies() })
</script>
<template>
  <section class="media-source-ui source-page" lang="zh-CN">
    <RouterLink class="back-link" to="/media-sources"><SourceIcon name="arrow-left" />返回媒体来源</RouterLink>
    <header class="page-heading source-heading"><div><h1 class="page-title">{{ source?.name ?? '未找到这个媒体来源' }}</h1><p class="page-subtitle">{{ source ? `WebDAV · ${source.address.replace(/^https?:\/\//, '')}` : '这个来源可能已移除，或链接不完整。' }}</p></div></header>
    <div v-if="source" class="sources-workspace">
      <section class="source-summary" aria-labelledby="summary-name">
        <div class="source-summary-heading"><div><h2 id="summary-name" class="section-title">{{ source.name }}</h2><p>WebDAV</p></div><span class="source-status" role="status"><span v-if="source.status === 'testing'" class="spinner" /><SourceIcon v-else :name="source.status === 'available' ? 'check-circle' : 'x'" />{{ source.status === 'available' ? '已连接' : source.status === 'testing' ? '正在测试' : '连接异常' }}</span></div>
        <dl class="source-meta-grid"><div><dt>地址</dt><dd>{{ source.address }}</dd></div><div><dt>最近连接测试</dt><dd>{{ source.lastConnection }}</dd></div><div><dt>电影</dt><dd>{{ sourceMovies.length }} 部电影</dd></div><div><dt>最近扫描</dt><dd>{{ source.lastScan }}</dd></div></dl>
        <p class="source-note" role="status">{{ connectionNotice }}</p>
        <div class="header-actions"><button class="secondary-action" :disabled="source.status === 'testing'" @click="testSourceConnection(sourceId)">测试连接</button><button class="secondary-action" :disabled="source.status === 'testing'" @click="editing = true">编辑来源</button><button class="primary-action" :disabled="source.status === 'testing'" @click="workflow">{{ scanLabel(source) }}</button></div>
      </section>
      <section id="scan-roots" ref="rootSection" class="sources-section scan-roots" aria-labelledby="scan-roots-title">
        <div class="section-heading-row"><h2 id="scan-roots-title" class="section-title">影片文件夹</h2><button class="secondary-action" :disabled="source.status !== 'available'" @click="browsing = true">{{ roots.length ? '更改影片文件夹' : '选择影片文件夹' }}</button></div>
        <p class="source-note">只扫描已选择、未暂停的影片文件夹及里面的内容；保存后仍需点击“立即扫描”。</p>
        <div v-if="roots.length"><div v-for="root in roots" :key="root.id" class="scan-root-row"><div><code>{{ root.path }}</code><span>{{ root.enabled ? '已选择' : '已选择 · 扫描已暂停' }}</span></div><div class="root-actions"><button class="secondary-action" @click="setRootEnabled(sourceId, root.id, !root.enabled)">{{ root.enabled ? '暂停扫描' : '恢复扫描' }}</button><button class="quiet-action" @click="removeRoot(root.id, root.path)">移除</button></div></div></div>
        <p v-else class="source-empty-panel">还没有选择影片文件夹。选择后，只有这些文件夹及里面的内容会进入扫描范围。</p>
      </section>
      <section class="sources-section"><div class="section-title-line"><h2 class="section-title">此来源的电影</h2><span class="section-count">{{ sourceMovies.length }} 部</span></div>
        <div v-if="sourceMovies.length" class="recent-media-grid"><MovieCard v-for="movie in sourceMovies" :key="movie.id" :movie="movie" :more-expanded="activeMovie?.id === movie.id" menu-id="source-movie-menu" @detail="showMovie" @play="playback" @more="moreMovie" /></div>
        <div v-else class="source-empty-panel"><p>这个来源还没有加入片库的电影</p><button class="secondary-action" :disabled="source.status === 'testing'" @click="workflow">{{ scanLabel(source) }}</button></div>
      </section>
      <section id="recent-scans" ref="taskSection" class="sources-section"><h2 class="section-title">最近扫描</h2>
        <ScanTaskList v-if="tasks.length" :tasks="tasks" :sources="[source]" @select="selectedTaskId = $event.id" />
        <div v-else class="source-empty-panel"><p>还没有扫描记录</p><button class="secondary-action" :disabled="source.status === 'testing'" @click="workflow">{{ scanLabel(source) }}</button></div>
        <article v-if="selectedTask" class="task-detail" aria-label="扫描任务详情" aria-live="polite"><div class="section-heading-row"><h3 class="section-title">{{ statusLabels[selectedTask.status] }}</h3><button class="quiet-action" @click="selectedTaskId = ''">收起</button></div><p class="source-note">本次扫描的影片文件夹（{{ selectedTask.rootPaths.length }}）</p><div><code v-for="path in selectedTask.rootPaths" :key="path">{{ path }}</code></div><p class="source-note">新增 {{ selectedTask.recognizedMovieIds.length }} 部 · 待确认 {{ selectedTask.pendingCount }} 个 · 需要注意 {{ selectedTask.attentionCount }} 个</p><p v-if="selectedTask.error" class="source-note danger">{{ selectedTask.error }}</p><p v-else class="source-note">{{ selectedTask.status === 'running' ? '正在模拟扫描开始时选中的影片文件夹；之后更改选择不会影响本次扫描。' : '当前为扫描 UI 演示，未连接真实 WebDAV，也未产生新的媒体资源。' }}</p></article>
      </section>
    </div>
    <div v-else class="source-empty-panel"><p>请返回来源列表，选择一个媒体来源。</p><RouterLink class="secondary-action" to="/media-sources">返回媒体来源</RouterLink></div>
    <SourceDialog v-if="editing && source" :source="source" @close="editing = false" @saved="editing = false; notice = '来源已更新。影片文件夹的选择没有变化。'" />
    <DirectoryBrowser v-if="browsing && source" :source-id="sourceId" @close="browsing = false" @saved="browsing = false; notice = '影片文件夹已保存。准备好后，点击“立即扫描”。'" />
    <SourceConfirmDialog v-if="removingRoot" title="移除影片文件夹？" :message="`这只会移除“${removingRoot.path}”的扫描设置，以后不会再扫描它。云端文件不会删除。`" confirm-label="移除设置" @close="removingRoot = undefined" @confirm="confirmRemoveRoot" />
    <MovieContextMenu v-if="activeMovie" id="source-movie-menu" :open="true" :trigger="movieTrigger" :movie-id="activeMovie.id" :title="activeMovie.title" :favorite="activeMovie.favorite" :watch-status="activeMovie.watchStatus" @close="activeMovie = undefined" @detail="showMovie" @play="playback" @versions="notice = '媒体版本选择尚未接入。'" @favorite-change="(_id, value) => { if (activeMovie) activeMovie.favorite = value }" @watch-status-change="(_id, value) => { if (activeMovie) activeMovie.watchStatus = value }" />
  </section>
</template>

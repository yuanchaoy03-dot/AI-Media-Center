<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { RouterLink } from 'vue-router'
import SourceIcon from '../components/media-source/SourceIcon.vue'
import SourceDialog from '../components/media-source/SourceDialog.vue'
import SourceMenu from '../components/media-source/SourceMenu.vue'
import DirectoryBrowser from '../components/media-source/DirectoryBrowser.vue'
import DirectorySelection from '../components/media-source/DirectorySelection.vue'
import OwnedScanTaskList from '../components/media-source/OwnedScanTaskList.vue'
import OwnedScanResults from '../components/media-source/OwnedScanResults.vue'
import {
  getOwnedSourceScans,
  getOwnedSourceResources,
  startOwnedSourceScan,
} from '../services/ownedScanService'
import type { OwnedScanTask, OwnedResourcePage } from '../services/ownedScanService'
import { ApiError } from '../services/http'
import {
  createOwnedSource,
  getOwnedSourceDirectory,
  getOwnedSourceScanRoots,
  getOwnedSources,
  saveOwnedSourceScanRoots,
  testOwnedSourceConnection,
} from '../services/ownedSourceService'
import type { OwnedMediaSource } from '../services/ownedSourceService'
import type { DirectoryEntry, MediaScanRoot, SourceConnectionInput } from '../types/mediaSource'
import { useAuthStore } from '../stores/auth'
import '../assets/media-source.css'

const auth = useAuthStore()
const status = ref<'loading' | 'error' | 'empty' | 'ready'>('loading')
const sourceList = ref<OwnedMediaSource[]>([])
const dialogOpen = ref(false)
const menuSource = ref<OwnedMediaSource>()
const trigger = shallowRef<HTMLButtonElement>()
const error = ref('')
const notice = ref('')
const browsingSource = ref<OwnedMediaSource>()
const directoryPath = ref('/')
const directoryEntries = ref<DirectoryEntry[]>([])
const directoryLoading = ref(false)
const directoryError = ref('')
const selectingSource = ref<OwnedMediaSource>()
const scanRoots = ref<
  Record<string, { status: 'loading' | 'error' | 'ready'; roots: MediaScanRoot[]; error: string }>
>({})
let controller: AbortController | undefined
let directoryController: AbortController | undefined
const scanRootControllers = new Map<string, AbortController>()
const scans = ref<
  Record<string, { status: 'loading' | 'error' | 'ready'; tasks: OwnedScanTask[]; error: string }>
>({})
const scanStarting = ref<Record<string, boolean>>({})
const scanNotices = ref<Record<string, string>>({})
const scanControllers = new Map<string, AbortController>()
const scanTimers = new Map<string, ReturnType<typeof setTimeout>>()
const resultSource = ref<OwnedMediaSource>()
const selectedTask = ref<OwnedScanTask>()
const resourcePage = ref(0)
const resourceResult = ref<OwnedResourcePage>()
const resourceLoading = ref(false)
const resourceError = ref('')
let resourceController: AbortController | undefined
const recentScans = computed(() =>
  Object.values(scans.value)
    .flatMap((source) => source.tasks)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 20),
)
const resultTask = computed(
  () =>
    selectedTask.value &&
    (scans.value[selectedTask.value.sourceId]?.tasks.find(
      (task) => task.id === selectedTask.value?.id,
    ) ||
      selectedTask.value),
)

function clearScanTimer(sourceId: string) {
  clearTimeout(scanTimers.get(sourceId))
  scanTimers.delete(sourceId)
}
function cancelScanRequests() {
  for (const sourceId of scanTimers.keys()) clearScanTimer(sourceId)
  for (const current of scanControllers.values()) current.abort()
  scanControllers.clear()
}
function closeResults() {
  resourceController?.abort()
  resultSource.value = undefined
  selectedTask.value = undefined
  resourceResult.value = undefined
  resourceLoading.value = false
  resourceError.value = ''
  resourcePage.value = 0
}
async function loadResources(page = resourcePage.value) {
  const source = resultSource.value
  if (!source) return
  resourceController?.abort()
  const current = new AbortController()
  resourceController = current
  resourcePage.value = page
  resourceResult.value = undefined
  resourceError.value = ''
  resourceLoading.value = true
  try {
    const result = await getOwnedSourceResources(source.id, page, current.signal)
    if (current.signal.aborted) return
    resourceResult.value = result
  } catch (reason) {
    if (current.signal.aborted) return
    resourceError.value = reason instanceof Error ? reason.message : '资源读取失败，请重试。'
  } finally {
    if (!current.signal.aborted) resourceLoading.value = false
  }
}
async function openResults(task: OwnedScanTask) {
  const source = sourceList.value.find((item) => item.id === task.sourceId)
  if (!source) return
  closeDirectory()
  closeSelection()
  closeResults()
  menuSource.value = undefined
  resultSource.value = source
  selectedTask.value = task
  await loadResources(0)
}
function latestScan(sourceId: string) {
  return scans.value[sourceId]?.tasks[0]
}
function scanSummary(sourceId: string) {
  const sourceScans = scans.value[sourceId]
  if (!sourceScans || sourceScans.status === 'loading') return '正在读取扫描记录…'
  if (sourceScans.status === 'error') return '扫描记录读取失败'
  const latest = latestScan(sourceId)
  return latest ? `本次入库 ${latest.persistedCount} 个文件` : '尚未扫描'
}
function scanTime(sourceId: string) {
  const latest = latestScan(sourceId)
  if (!latest) return ''
  const labels = {
    pending: '等待扫描',
    running: '扫描中',
    completed: '扫描完成',
    failed: '扫描未完成',
  }
  return `${labels[latest.status]} · ${new Date(latest.createdAt).toLocaleString('zh-CN')}`
}
async function loadScans(sourceId: string) {
  if (scanStarting.value[sourceId]) return
  clearScanTimer(sourceId)
  scanControllers.get(sourceId)?.abort()
  const current = new AbortController()
  scanControllers.set(sourceId, current)
  const previous = scans.value[sourceId]?.tasks ?? []
  scans.value[sourceId] = {
    status: previous.length ? 'ready' : 'loading',
    tasks: previous,
    error: '',
  }
  try {
    const tasks = await getOwnedSourceScans(sourceId, current.signal)
    if (current.signal.aborted) return
    const finished = tasks.some(
      (task) =>
        (task.status === 'completed' || task.status === 'failed') &&
        previous.some(
          (old) => old.id === task.id && (old.status === 'pending' || old.status === 'running'),
        ),
    )
    scans.value[sourceId] = { status: 'ready', tasks, error: '' }
    scanNotices.value[sourceId] = ''
    if (finished && resultSource.value?.id === sourceId) void loadResources()
    // 每次请求结束后才安排下一次；没有活动任务时停止，失败保留最后结果并提供重查。
    if (tasks.some((task) => task.status === 'pending' || task.status === 'running')) {
      scanTimers.set(
        sourceId,
        setTimeout(() => {
          void loadScans(sourceId)
        }, 1500),
      )
    }
  } catch (reason) {
    if (current.signal.aborted) return
    scans.value[sourceId] = {
      status: 'error',
      tasks: previous,
      error: reason instanceof Error ? reason.message : '扫描记录读取失败，请重试。',
    }
  } finally {
    if (scanControllers.get(sourceId) === current) scanControllers.delete(sourceId)
  }
}
async function startScan(source: OwnedMediaSource) {
  menuSource.value = undefined
  if (scanStarting.value[source.id]) return
  clearScanTimer(source.id)
  scanControllers.get(source.id)?.abort()
  const current = new AbortController()
  scanControllers.set(source.id, current)
  scanStarting.value[source.id] = true
  scanNotices.value[source.id] = ''
  try {
    const task = await startOwnedSourceScan(source.id, current.signal)
    if (current.signal.aborted) return
    const previous = scans.value[source.id]?.tasks ?? []
    scans.value[source.id] = {
      status: 'ready',
      tasks: [task, ...previous.filter((old) => old.id !== task.id)].slice(0, 20),
      error: '',
    }
    notice.value = '扫描已接受，仅处理开始时已启用的影片文件夹。文件暂以未识别资源保存。'
  } catch (reason) {
    if (current.signal.aborted) return
    scanNotices.value[source.id] =
      reason instanceof ApiError && reason.status === 0
        ? '扫描请求结果尚不确定，请重新查询扫描记录确认。'
        : reason instanceof Error
          ? reason.message
          : '扫描请求未被接受，请重试。'
  } finally {
    if (scanControllers.get(source.id) === current) {
      scanControllers.delete(source.id)
      scanStarting.value[source.id] = false
      if (!current.signal.aborted && !scanNotices.value[source.id]) void loadScans(source.id)
    }
  }
}

function cancelScanRootRequests() {
  for (const current of scanRootControllers.values()) current.abort()
  scanRootControllers.clear()
}

async function loadScanRoots(sourceId: string) {
  scanRootControllers.get(sourceId)?.abort()
  const current = new AbortController()
  scanRootControllers.set(sourceId, current)
  scanRoots.value[sourceId] = { status: 'loading', roots: [], error: '' }
  try {
    const roots = await getOwnedSourceScanRoots(sourceId, current.signal)
    if (current.signal.aborted) return
    scanRoots.value[sourceId] = { status: 'ready', roots, error: '' }
  } catch (reason) {
    if (current.signal.aborted) return
    scanRoots.value[sourceId] = {
      status: 'error',
      roots: [],
      error: reason instanceof Error ? reason.message : '影片文件夹读取失败，请重试。',
    }
  } finally {
    if (scanRootControllers.get(sourceId) === current) scanRootControllers.delete(sourceId)
  }
}

function folderSummary(sourceId: string) {
  const selection = scanRoots.value[sourceId]
  if (!selection || selection.status === 'loading') return '正在读取影片文件夹…'
  if (selection.status === 'error') return '影片文件夹读取失败'
  if (!selection.roots.length) return '未选择影片文件夹'
  const paused = selection.roots.filter((root) => !root.enabled).length
  return `已选择 ${selection.roots.length} 个影片文件夹${paused ? ` · ${paused} 个已暂停` : ''}`
}

async function load() {
  // 每次重试先取消上一轮请求；只有当前请求未被取消时，才更新成功或失败状态。
  controller?.abort()
  cancelScanRootRequests()
  cancelScanRequests()
  closeResults()
  closeDirectory()
  closeSelection()
  const current = new AbortController()
  controller = current
  status.value = 'loading'
  sourceList.value = []
  scanRoots.value = {}
  scans.value = {}
  scanStarting.value = {}
  scanNotices.value = {}
  error.value = ''
  try {
    // 页面负责显示状态，service 负责取数据；signal 会一直传到 Axios。
    const sources = await getOwnedSources(current.signal)
    if (!current.signal.aborted) {
      sourceList.value = sources
      status.value = sources.length ? 'ready' : 'empty'
      await Promise.all(
        sources.flatMap((source) => [loadScanRoots(source.id), loadScans(source.id)]),
      )
    }
  } catch (reason) {
    if (current.signal.aborted) return
    status.value = 'error'
    error.value = reason instanceof Error ? reason.message : '来源加载失败，请重试。'
  }
}
function addSource() {
  closeResults()
  closeDirectory()
  closeSelection()
  menuSource.value = undefined
  dialogOpen.value = true
}
async function testConnection(input: SourceConnectionInput, signal: AbortSignal) {
  await testOwnedSourceConnection(input, signal)
  return true
}
async function saveConnection(input: SourceConnectionInput, signal: AbortSignal) {
  return (await createOwnedSource(input, signal)).id
}
async function saved() {
  dialogOpen.value = false
  notice.value = '来源已添加，可以选择影片文件夹。保存后不会立即扫描。'
  await load()
}
function openMenu(source: OwnedMediaSource, event: MouseEvent) {
  if (!(event.currentTarget instanceof HTMLButtonElement)) return
  menuSource.value = menuSource.value?.id === source.id ? undefined : source
  trigger.value = event.currentTarget
}
function unavailable(action: 'detail' | 'edit' | 'remove') {
  menuSource.value = undefined
  const labels = {
    detail: '来源详情',
    edit: '编辑来源',
    remove: '移除来源',
  }
  notice.value = `${labels[action]}功能尚未开放。`
}
async function menuAction(action: 'detail' | 'scan' | 'edit' | 'remove') {
  const source = menuSource.value
  if (action === 'scan') {
    if (source) await startScan(source)
  } else unavailable(action)
}
function closeDirectory() {
  directoryController?.abort()
  browsingSource.value = undefined
  directoryPath.value = '/'
  directoryEntries.value = []
  directoryLoading.value = false
  directoryError.value = ''
}
async function openDirectory(source: OwnedMediaSource) {
  closeResults()
  closeSelection()
  closeDirectory()
  menuSource.value = undefined
  browsingSource.value = source
  await loadDirectory('/')
}

function closeSelection() {
  selectingSource.value = undefined
}

function openSelection(source: OwnedMediaSource) {
  closeResults()
  closeDirectory()
  menuSource.value = undefined
  selectingSource.value = source
}

async function selectionDirectory(sourceId: string, path: string, signal: AbortSignal) {
  return (await getOwnedSourceDirectory(sourceId, path, signal)).entries
}

function selectionLoaded(roots: MediaScanRoot[], sourceId: string) {
  const source = selectingSource.value
  if (!source || source.id !== sourceId) return
  scanRootControllers.get(source.id)?.abort()
  scanRootControllers.delete(source.id)
  scanRoots.value[source.id] = { status: 'ready', roots, error: '' }
}

function selectionSaved(roots: MediaScanRoot[], sourceId: string) {
  if (!selectingSource.value || selectingSource.value.id !== sourceId) return
  selectionLoaded(roots, sourceId)
  closeSelection()
  notice.value = '影片文件夹已保存，尚未开始扫描。'
}
async function loadDirectory(path: string) {
  const source = browsingSource.value
  if (!source) return
  directoryController?.abort()
  const current = new AbortController()
  directoryController = current
  directoryPath.value = path
  directoryEntries.value = []
  directoryLoading.value = true
  directoryError.value = ''
  try {
    const directory = await getOwnedSourceDirectory(source.id, path, current.signal)
    if (current.signal.aborted) return
    directoryPath.value = directory.path
    directoryEntries.value = directory.entries
    directoryLoading.value = false
  } catch (reason) {
    if (current.signal.aborted) return
    directoryLoading.value = false
    directoryError.value = reason instanceof Error ? reason.message : '目录读取失败，请重试。'
  }
}
// 会话改变时同步清理本页；尚未返回的旧请求和弹窗不能显示在新账号下。
watch(
  () => auth.epoch,
  () => {
    controller?.abort()
    cancelScanRootRequests()
    cancelScanRequests()
    closeResults()
    closeDirectory()
    closeSelection()
    sourceList.value = []
    scanRoots.value = {}
    scans.value = {}
    scanStarting.value = {}
    scanNotices.value = {}
    dialogOpen.value = false
    menuSource.value = undefined
    notice.value = ''
    error.value = ''
    status.value = 'loading'
  },
  { flush: 'sync' },
)
// onMounted 在页面挂载后加载数据；onBeforeUnmount 在离开页面前取消尚未完成的请求。
onMounted(load)
onBeforeUnmount(() => {
  controller?.abort()
  cancelScanRootRequests()
  cancelScanRequests()
  closeResults()
  closeDirectory()
  closeSelection()
})
</script>

<template>
  <section class="media-source-ui source-page" lang="zh-CN">
    <header class="page-heading">
      <h1 class="page-title">媒体来源</h1>
      <button class="primary-action" @click="addSource"><SourceIcon name="plus" />添加来源</button>
    </header>
    <div class="sources-workspace">
      <section
        class="sources-section"
        aria-labelledby="connected-title"
        :aria-busy="status === 'loading'"
      >
        <h2 id="connected-title" class="section-title">我的来源</h2>
        <div v-if="status === 'loading'" class="source-empty" role="status">
          <span class="spinner" />
          <p>正在加载媒体来源…</p>
        </div>
        <div v-else-if="status === 'error'" class="source-empty" role="alert">
          <h3>暂时无法加载来源</h3>
          <p>{{ error }}</p>
          <button class="primary-action" @click="load">重试</button>
        </div>
        <div v-else-if="status === 'ready'" class="source-list">
          <article v-for="source in sourceList" :key="source.id" class="source-item">
            <button
              class="source-hit"
              :aria-label="`查看${source.name}详情`"
              @click="unavailable('detail')"
            />
            <div class="source-copy">
              <strong class="source-name" :title="source.name">{{ source.name }}</strong
              ><span class="source-type">{{ source.type }}</span
              ><span class="source-location" :title="source.address">{{
                source.address.replace(/^https?:\/\//, '')
              }}</span>
            </div>
            <span
              class="source-status"
              :title="
                source.lastConnectionTestAt
                  ? `上次测试成功 · ${new Date(source.lastConnectionTestAt).toLocaleString('zh-CN')}`
                  : '尚未测试'
              "
              ><SourceIcon
                :name="source.enabled && source.lastConnectionTestAt ? 'check-circle' : 'x'"
              />{{
                !source.enabled
                  ? '已停用'
                  : source.lastConnectionTestAt
                    ? '上次测试成功'
                    : '尚未测试'
              }}</span
            >
            <span class="source-config" :title="scanRoots[source.id]?.error || undefined">{{
              folderSummary(source.id)
            }}</span>
            <div class="source-config-actions">
              <button class="source-config-link" @click="openSelection(source)">
                {{
                  scanRoots[source.id]?.status === 'ready' && scanRoots[source.id]?.roots.length
                    ? '修改影片文件夹 →'
                    : '选择影片文件夹 →'
                }}
              </button>
              <button class="source-config-link" @click="openDirectory(source)">浏览目录</button>
              <button
                class="source-config-link"
                :disabled="scanStarting[source.id] || !source.enabled"
                @click="startScan(source)"
              >
                {{ scanStarting[source.id] ? '正在提交扫描…' : '扫描' }}
              </button>
              <button
                v-if="scanRoots[source.id]?.status === 'error'"
                class="source-config-link"
                @click="loadScanRoots(source.id)"
              >
                重试
              </button>
            </div>
            <span class="source-footer"
              ><span>{{ scanSummary(source.id) }}</span
              ><span>{{ scanTime(source.id) }}</span></span
            >
            <div
              v-if="scanNotices[source.id] || scans[source.id]?.status === 'error'"
              class="source-scan-feedback"
            >
              <p class="source-note" role="alert">
                {{ scanNotices[source.id] || scans[source.id]?.error }}
              </p>
              <button
                class="source-config-link"
                :disabled="scanStarting[source.id]"
                @click="loadScans(source.id)"
              >
                重新查询扫描记录
              </button>
            </div>
            <button
              class="source-more"
              :aria-label="`${source.name}更多操作`"
              aria-controls="source-menu"
              :aria-expanded="menuSource?.id === source.id"
              @click="openMenu(source, $event)"
            >
              <SourceIcon name="dots-three-bold" />
            </button>
          </article>
        </div>
        <div v-else class="source-empty">
          <span class="empty-icon"><SourceIcon name="hard-drives" /></span>
          <h3>还没有媒体来源</h3>
          <p>
            添加 WebDAV 媒体来源，开始建立你的个人片库。支持 AList、NAS WebDAV、Nextcloud 等标准
            WebDAV 服务。
          </p>
          <button class="primary-action" @click="addSource">添加媒体来源</button>
        </div>
      </section>
      <section
        v-if="status === 'empty' || status === 'ready'"
        class="sources-section"
        aria-labelledby="recent-scans-title"
      >
        <h2 id="recent-scans-title" class="section-title">最近扫描</h2>
        <OwnedScanTaskList
          v-if="recentScans.length"
          :tasks="recentScans"
          :sources="sourceList"
          @select="openResults"
        />
        <p
          v-else-if="Object.values(scans).some((source) => source.status === 'loading')"
          class="source-note"
          role="status"
        >
          正在读取扫描记录…
        </p>
        <p
          v-else-if="Object.values(scans).some((source) => source.status === 'error')"
          class="source-note"
        >
          部分扫描记录暂时无法读取，请在对应来源重试。
        </p>
        <p v-else class="source-note">尚未扫描。选择影片文件夹后，可以主动开始扫描。</p>
      </section>
      <section v-if="status === 'empty' || status === 'ready'" class="sources-section">
        <div class="section-heading-row">
          <h2 class="section-title">最近入库</h2>
          <RouterLink class="section-action" to="/library"
            >查看全部<SourceIcon name="caret-right"
          /></RouterLink>
        </div>
        <p class="source-note">
          扫描文件暂以未识别资源保存，可以在最近扫描中查看。影片识别与个人片库尚未开放。
        </p>
      </section>
      <p v-if="notice" class="source-note" role="status">{{ notice }}</p>
    </div>
    <SourceMenu
      v-if="menuSource && trigger"
      :trigger="trigger"
      scan-label="扫描"
      @close="menuSource = undefined"
      @action="menuAction"
    />
    <SourceDialog
      v-if="dialogOpen"
      :test-connection="testConnection"
      :save-connection="saveConnection"
      @close="dialogOpen = false"
      @saved="saved"
    />
    <DirectoryBrowser
      v-if="browsingSource"
      :current-path="directoryPath"
      :entries="directoryEntries"
      :loading="directoryLoading"
      :error="directoryError"
      :description="`只读查看“${browsingSource.name}”中的文件夹和文件。`"
      @close="closeDirectory"
      @navigate="loadDirectory"
      @retry="loadDirectory(directoryPath)"
    />
    <DirectorySelection
      v-if="selectingSource"
      :key="selectingSource.id"
      :source-id="selectingSource.id"
      :load-roots="getOwnedSourceScanRoots"
      :load-directory="selectionDirectory"
      :save-roots="saveOwnedSourceScanRoots"
      @close="closeSelection"
      @loaded="selectionLoaded"
      @saved="selectionSaved"
    />
    <OwnedScanResults
      v-if="resultSource"
      :source-name="resultSource.name"
      :task="resultTask"
      :result="resourceResult"
      :page="resourcePage"
      :loading="resourceLoading"
      :error="resourceError"
      :scan-error="scans[resultSource.id]?.error || ''"
      @close="closeResults"
      @page="loadResources"
      @retry="loadResources()"
      @retry-task="loadScans(resultSource.id)"
    />
  </section>
</template>

<style scoped>
.source-hit,
.source-config-link {
  border: 0;
  padding: 0;
  background: transparent;
}
.source-item {
  grid-template-rows: auto auto auto minmax(28px, auto) auto;
}
.source-config-actions {
  grid-column: 1 / -1;
  grid-row: 4;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.source-scan-feedback {
  grid-column: 1 / -1;
  display: grid;
  gap: 8px;
  padding-top: 8px;
}
</style>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { RouterLink } from 'vue-router'
import SourceIcon from '../components/media-source/SourceIcon.vue'
import SourceDialog from '../components/media-source/SourceDialog.vue'
import SourceMenu from '../components/media-source/SourceMenu.vue'
import DirectoryBrowser from '../components/media-source/DirectoryBrowser.vue'
import {
  createOwnedSource,
  getOwnedSourceDirectory,
  getOwnedSources,
  testOwnedSourceConnection,
} from '../services/ownedSourceService'
import type { OwnedMediaSource } from '../services/ownedSourceService'
import type { DirectoryEntry, SourceConnectionInput } from '../types/mediaSource'
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
let controller: AbortController | undefined
let directoryController: AbortController | undefined
async function load() {
  // 每次重试先取消上一轮请求；只有当前请求未被取消时，才更新成功或失败状态。
  controller?.abort()
  const current = new AbortController()
  controller = current
  status.value = 'loading'
  sourceList.value = []
  error.value = ''
  try {
    // 页面负责显示状态，service 负责取数据；signal 会一直传到 Axios。
    const sources = await getOwnedSources(current.signal)
    if (!current.signal.aborted) {
      sourceList.value = sources
      status.value = sources.length ? 'ready' : 'empty'
    }
  } catch (reason) {
    if (current.signal.aborted) return
    status.value = 'error'
    error.value = reason instanceof Error ? reason.message : '来源加载失败，请重试。'
  }
}
function addSource() {
  closeDirectory()
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
  notice.value = '来源已添加，可以浏览目录。扫描范围设置与扫描功能尚未开放。'
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
    if (source) await openDirectory(source)
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
  menuSource.value = undefined
  browsingSource.value = source
  await loadDirectory('/')
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
    closeDirectory()
    sourceList.value = []
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
  closeDirectory()
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
            <span class="source-config">未选择影片文件夹</span>
            <button class="source-config-link" @click="openDirectory(source)">浏览目录 →</button>
            <span class="source-footer"><span>0 部电影</span><span>上次扫描 · 尚未扫描</span></span>
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
      <section v-if="status === 'empty' || status === 'ready'" class="sources-section">
        <div class="section-heading-row">
          <h2 class="section-title">最近入库</h2>
          <RouterLink class="section-action" to="/library"
            >查看全部<SourceIcon name="caret-right"
          /></RouterLink>
        </div>
        <p class="source-note">添加来源并扫描后，影片会出现在这里。</p>
      </section>
      <p v-if="notice" class="source-note" role="status">{{ notice }}</p>
    </div>
    <SourceMenu
      v-if="menuSource && trigger"
      :trigger="trigger"
      scan-label="浏览目录"
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
  </section>
</template>

<style scoped>
.source-hit,
.source-config-link {
  border: 0;
  padding: 0;
  background: transparent;
}
</style>

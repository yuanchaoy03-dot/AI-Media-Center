<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { DirectoryEntry, MediaScanRoot } from '../../types/mediaSource'
import { ApiError } from '../../services/http'
import {
  findContainedDescendants,
  findCoveringAncestor,
  normalizeScanRootPath,
  replaceDescendantsWithParent,
  sameScanRootSelection,
} from '../../services/scanRootPaths'
import DirectoryBrowser from './DirectoryBrowser.vue'
import SourceIcon from './SourceIcon.vue'
import SourceConfirmDialog from './SourceConfirmDialog.vue'

const props = withDefaults(
  defineProps<{
    sourceId: string
    loadRoots: (sourceId: string, signal: AbortSignal) => MediaScanRoot[] | Promise<MediaScanRoot[]>
    loadDirectory: (
      sourceId: string,
      path: string,
      signal: AbortSignal,
    ) => DirectoryEntry[] | Promise<DirectoryEntry[]>
    saveRoots: (
      sourceId: string,
      paths: readonly string[],
      signal: AbortSignal,
    ) => MediaScanRoot[] | Promise<MediaScanRoot[]>
    retryable?: boolean
  }>(),
  { retryable: true },
)
const emit = defineEmits<{
  close: []
  loaded: [roots: MediaScanRoot[], sourceId: string]
  saved: [roots: MediaScanRoot[], sourceId: string]
}>()
const currentPath = ref('/')
const roots = ref<MediaScanRoot[]>([])
// initialSelectedPaths 是打开时的选择，draftSelectedPaths 是当前草稿；点保存才写入共享状态。
// dirty 比较两份选择是否不同，用来决定是否需要保存。
const initialSelectedPaths = ref<string[]>([])
const draftSelectedPaths = ref<string[]>([])
const dirty = computed(
  () => !sameScanRootSelection(initialSelectedPaths.value, draftSelectedPaths.value),
)
const error = ref('')
const replacement = ref<{ path: string; descendants: string[] }>()
const entries = ref<DirectoryEntry[]>([])
const directoryError = ref('')
const loading = ref(false)
const saving = ref(false)
const initialized = ref(false)
let rootController: AbortController | undefined
let directoryController: AbortController | undefined
let saveController: AbortController | undefined
let closed = false

function cancelRequests() {
  rootController?.abort()
  directoryController?.abort()
  saveController?.abort()
}

async function initialize() {
  cancelRequests()
  closed = false
  currentPath.value = '/'
  roots.value = []
  initialSelectedPaths.value = []
  draftSelectedPaths.value = []
  entries.value = []
  replacement.value = undefined
  error.value = ''
  directoryError.value = ''
  saving.value = false
  initialized.value = false
  loading.value = true
  const current = new AbortController()
  rootController = current
  const sourceId = props.sourceId
  try {
    const loadedRoots = await props.loadRoots(sourceId, current.signal)
    if (current.signal.aborted || closed || sourceId !== props.sourceId) return
    roots.value = loadedRoots
    initialSelectedPaths.value = loadedRoots.map((root) => normalizeScanRootPath(root.path))
    draftSelectedPaths.value = [...initialSelectedPaths.value]
    initialized.value = true
    emit('loaded', loadedRoots, sourceId)
    await navigateDirectory('/')
  } catch (cause) {
    if (current.signal.aborted || closed || sourceId !== props.sourceId) return
    loading.value = false
    directoryError.value =
      cause instanceof Error ? cause.message : '已选影片文件夹读取失败，请重试。'
  }
}

async function navigateDirectory(path: string) {
  if (!initialized.value || saving.value || closed) return
  directoryController?.abort()
  const current = new AbortController()
  directoryController = current
  const sourceId = props.sourceId
  currentPath.value = path
  entries.value = []
  loading.value = true
  directoryError.value = ''
  try {
    const loadedEntries = await props.loadDirectory(sourceId, path, current.signal)
    if (current.signal.aborted || closed || sourceId !== props.sourceId) return
    entries.value = loadedEntries
    loading.value = false
  } catch (cause) {
    if (current.signal.aborted || closed || sourceId !== props.sourceId) return
    loading.value = false
    directoryError.value = cause instanceof Error ? cause.message : '文件夹读取失败，请重试。'
  }
}

async function retry() {
  if (!initialized.value) await initialize()
  else await navigateDirectory(currentPath.value)
}

function close() {
  closed = true
  cancelRequests()
  emit('close')
}

function folderName(path: string) {
  return path === '/' ? '整个来源' : path.slice(path.lastIndexOf('/') + 1)
}

// 当前目录与子目录共用状态；已选择和暂停扫描分别展示。
// selected 是直接选中，ancestor 表示已被选中的上级覆盖，descendants 是单独选中的下级目录。
function selectionState(path: string) {
  path = normalizeScanRootPath(path)
  const selected = draftSelectedPaths.value.includes(path)
  const ancestor = findCoveringAncestor(path, draftSelectedPaths.value)
  const descendants = findContainedDescendants(path, draftSelectedPaths.value)
  const scanPaused =
    selected &&
    roots.value.some((root) => normalizeScanRootPath(root.path) === path && !root.enabled)
  return {
    selected,
    ancestor,
    descendants,
    label: ancestor
      ? '已包含在所选上级文件夹中'
      : selected
        ? path === '/'
          ? '取消选择整个来源'
          : `取消选择 ${path}`
        : path === '/'
          ? '选择整个来源及里面的内容'
          : `选择 ${path} 及里面的内容`,
    text:
      selected && scanPaused
        ? '扫描已暂停'
        : !selected && !ancestor && descendants.length
          ? `已选其中 ${descendants.length} 个`
          : '',
    icon: selected || ancestor ? 'check-circle' : 'plus',
  }
}
const currentSelection = computed(() => selectionState(currentPath.value))
const replacementMessage = computed(() => {
  if (!replacement.value) return ''
  const { path, descendants } = replacement.value
  const names = descendants
    .slice(0, 2)
    .map((item) => `“${folderName(item)}”`)
    .join('和')
  const chosen =
    descendants.length > 2
      ? `${names}等 ${descendants.length} 个文件夹`
      : `${names}${descendants.length === 1 ? '文件夹' : '两个文件夹'}`
  return path === '/'
    ? `你已经单独选择了${chosen}。选择整个来源后，所有可见的文件夹都会一起扫描，就不需要再单独选择它们了。`
    : `你已经单独选择了其中的${chosen}。选择整个“${folderName(path)}”文件夹后，就不需要再单独选择它们了。`
})
// 被上级覆盖时不用再选；若已单独选了下级，先确认是否改为选择整个上级，避免扫描范围重叠。
function select(path: string) {
  if (!initialized.value || loading.value || saving.value || directoryError.value || closed) return
  path = normalizeScanRootPath(path)
  const state = selectionState(path)
  if (state.ancestor) return
  error.value = ''
  if (state.selected)
    draftSelectedPaths.value = draftSelectedPaths.value.filter((item) => item !== path)
  else if (state.descendants.length) replacement.value = { path, descendants: state.descendants }
  else if (draftSelectedPaths.value.length >= 32) error.value = '最多选择 32 个影片文件夹。'
  else draftSelectedPaths.value = [...draftSelectedPaths.value, path]
}
function confirmReplacement() {
  if (!replacement.value || saving.value || closed) return
  draftSelectedPaths.value = replaceDescendantsWithParent(
    draftSelectedPaths.value,
    replacement.value.path,
  )
  replacement.value = undefined
}
// 保存交给 service 整批检查，成功后通知父页面；取消关闭时草稿不会写回。
async function save() {
  if (!dirty.value || !initialized.value || loading.value || saving.value || closed) return
  saveController?.abort()
  const current = new AbortController()
  saveController = current
  const sourceId = props.sourceId
  const paths = [...draftSelectedPaths.value]
  saving.value = true
  error.value = ''
  try {
    const savedRoots = await props.saveRoots(sourceId, paths, current.signal)
    if (current.signal.aborted || closed || sourceId !== props.sourceId) return
    roots.value = savedRoots
    initialSelectedPaths.value = savedRoots.map((root) => normalizeScanRootPath(root.path))
    draftSelectedPaths.value = [...initialSelectedPaths.value]
    emit('saved', savedRoots, sourceId)
  } catch (cause) {
    if (current.signal.aborted || closed || sourceId !== props.sourceId) return
    error.value =
      cause instanceof ApiError
        ? cause.fieldErrors.paths || cause.message
        : cause instanceof Error
          ? cause.message
          : '保存影片文件夹失败，请重试。'
  } finally {
    if (!current.signal.aborted && !closed && sourceId === props.sourceId) saving.value = false
  }
}

watch(() => props.sourceId, initialize)
onMounted(initialize)
onBeforeUnmount(() => {
  closed = true
  cancelRequests()
})
</script>
<template>
  <DirectoryBrowser
    :current-path="currentPath"
    :entries="entries"
    :loading="loading"
    :busy="saving"
    :error="directoryError"
    title="选择影片文件夹"
    :description="saving ? '正在保存，关闭后可重新打开查看结果。' : '保存后不会立即扫描。'"
    :close-label="saving ? '关闭' : '取消'"
    selectable
    :retryable="retryable"
    @close="close"
    @navigate="navigateDirectory"
    @retry="retry"
  >
    <template #current-description>
      <small v-if="currentSelection.text">{{ currentSelection.text }}</small>
    </template>
    <template #current-control>
      <button
        class="directory-select"
        :class="{
          'is-selected': currentSelection.selected,
          'is-contained': currentSelection.ancestor,
        }"
        :disabled="
          !!currentSelection.ancestor || !initialized || loading || saving || !!directoryError
        "
        :title="currentSelection.ancestor ? currentSelection.label : undefined"
        :aria-label="currentSelection.label"
        :aria-pressed="currentSelection.selected || !!currentSelection.ancestor"
        @click="select(currentPath)"
      >
        <SourceIcon :name="currentSelection.icon" />
      </button>
    </template>
    <template #entry-description="{ entry }">
      <small v-if="selectionState(entry.path).text">{{ selectionState(entry.path).text }}</small>
    </template>
    <template #entry-control="{ entry }">
      <button
        class="directory-select"
        :class="{
          'is-selected': selectionState(entry.path).selected,
          'is-contained': selectionState(entry.path).ancestor,
        }"
        :disabled="!!selectionState(entry.path).ancestor || saving"
        :title="selectionState(entry.path).ancestor ? selectionState(entry.path).label : undefined"
        :aria-label="selectionState(entry.path).label"
        :aria-pressed="selectionState(entry.path).selected || !!selectionState(entry.path).ancestor"
        @click="select(entry.path)"
      >
        <SourceIcon :name="selectionState(entry.path).icon" />
      </button>
    </template>
    <template #error>
      <p v-if="error" class="source-note danger" role="alert">{{ error }}</p>
    </template>
    <template #footer>
      <p class="source-note" role="status">
        {{
          initialized
            ? `已选择 ${draftSelectedPaths.length} 个文件夹`
            : loading
              ? '正在读取已选影片文件夹…'
              : '已选影片文件夹尚未读取'
        }}
      </p>
      <div class="header-actions">
        <button class="secondary-action" @click="close">{{ saving ? '关闭' : '取消' }}</button>
        <button
          class="primary-action"
          :disabled="!dirty || !initialized || loading || saving"
          @click="save"
        >
          <span v-if="saving" class="spinner" />{{ saving ? '正在保存…' : '保存' }}
        </button>
      </div>
    </template>
    <template #confirmation>
      <SourceConfirmDialog
        v-if="replacement"
        :title="
          replacement.path === '/'
            ? '选择整个来源？'
            : `选择整个“${folderName(replacement.path)}”文件夹？`
        "
        :message="replacementMessage"
        :paths="replacement.descendants"
        :destructive="false"
        confirm-label="选择整个文件夹"
        @close="replacement = undefined"
        @confirm="confirmReplacement"
      />
    </template>
  </DirectoryBrowser>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { browseDirectory, mediaSourceState, saveScanRootSelection } from '../../services/mediaSourceService'
import { findContainedDescendants, findCoveringAncestor, normalizeScanRootPath, replaceDescendantsWithParent, sameScanRootSelection } from '../../services/scanRootPaths'
import SourceIcon from './SourceIcon.vue'
import SourceConfirmDialog from './SourceConfirmDialog.vue'

const props = defineProps<{ sourceId: string }>()
const emit = defineEmits<{ close: []; saved: [] }>()
const dialog = ref<HTMLDialogElement>()
const currentPath = ref('/')
const roots = computed(() => mediaSourceState.roots.filter(root => root.sourceId === props.sourceId))
const initialSelectedPaths = roots.value.map(root => normalizeScanRootPath(root.path))
const draftSelectedPaths = ref([...initialSelectedPaths])
const dirty = computed(() => !sameScanRootSelection(initialSelectedPaths, draftSelectedPaths.value))
const error = ref('')
const replacement = ref<{ path: string; descendants: string[] }>()
const directory = computed(() => {
  try { return { entries: browseDirectory(props.sourceId, currentPath.value), error: '' } }
  catch (cause) { return { entries: [], error: cause instanceof Error ? cause.message : '文件夹读取失败。' } }
})

function folderName(path: string) { return path === '/' ? '整个来源' : path.slice(path.lastIndexOf('/') + 1) }

// 当前目录与子目录共用状态；已选择和暂停扫描分别展示。
function selectionState(path: string) {
  path = normalizeScanRootPath(path)
  const selected = draftSelectedPaths.value.includes(path)
  const ancestor = findCoveringAncestor(path, draftSelectedPaths.value)
  const descendants = findContainedDescendants(path, draftSelectedPaths.value)
  const scanPaused = selected && roots.value.some(root => normalizeScanRootPath(root.path) === path && !root.enabled)
  return {
    selected, ancestor, descendants,
    label: ancestor ? '已包含在所选上级文件夹中' : selected ? path === '/' ? '取消选择整个来源' : `取消选择 ${path}` : path === '/' ? '选择整个来源及里面的内容' : `选择 ${path} 及里面的内容`,
    text: selected && scanPaused ? '扫描已暂停' : !selected && !ancestor && descendants.length ? `已选其中 ${descendants.length} 个` : '',
    icon: selected || ancestor ? 'check-circle' : 'plus',
  }
}
const currentSelection = computed(() => selectionState(currentPath.value))
const directories = computed(() => directory.value.entries.filter(entry => entry.kind === 'directory').map(entry => ({ ...entry, selection: selectionState(entry.path) })))
const files = computed(() => directory.value.entries.filter(entry => entry.kind === 'file'))
function fileIcon(name: string) { return /\.(?:mp4|mkv|mov|avi|m4v|wmv|ts|m2ts|webm|mpg|mpeg)$/i.test(name) ? 'video' : 'file' }
const replacementMessage = computed(() => {
  if (!replacement.value) return ''
  const { path, descendants } = replacement.value
  const names = descendants.slice(0, 2).map(item => `“${folderName(item)}”`).join('和')
  const chosen = descendants.length > 2 ? `${names}等 ${descendants.length} 个文件夹` : `${names}${descendants.length === 1 ? '文件夹' : '两个文件夹'}`
  return path === '/'
    ? `你已经单独选择了${chosen}。选择整个来源后，所有可见的文件夹都会一起扫描，就不需要再单独选择它们了。`
    : `你已经单独选择了其中的${chosen}。选择整个“${folderName(path)}”文件夹后，就不需要再单独选择它们了。`
})
function select(path: string) {
  if (directory.value.error) return
  const state = selectionState(path)
  if (state.ancestor) return
  error.value = ''
  if (state.selected) draftSelectedPaths.value = draftSelectedPaths.value.filter(item => item !== path)
  else if (state.descendants.length) replacement.value = { path, descendants: state.descendants }
  else draftSelectedPaths.value = [...draftSelectedPaths.value, path]
}
function confirmReplacement() {
  if (!replacement.value) return
  draftSelectedPaths.value = replaceDescendantsWithParent(draftSelectedPaths.value, replacement.value.path)
  replacement.value = undefined
}
function save() {
  if (!dirty.value) return
  try { saveScanRootSelection(props.sourceId, draftSelectedPaths.value); emit('saved') }
  catch (cause) { error.value = cause instanceof Error ? cause.message : '保存影片文件夹失败。' }
}
onMounted(() => dialog.value?.showModal())
onBeforeUnmount(() => dialog.value?.close())
</script>
<template>
  <Teleport to="body">
    <dialog ref="dialog" class="media-source-ui directory-dialog" aria-labelledby="directory-title" @cancel.prevent="emit('close')">
      <div class="directory-heading">
        <div><h2 id="directory-title">选择影片文件夹</h2><p class="source-note">保存后不会立即扫描。</p></div>
        <button class="secondary-action" @click="emit('close')">取消</button>
      </div>
      <div class="directory-toolbar">
        <button class="secondary-action" :disabled="currentPath === '/'" @click="currentPath = currentPath.slice(0, currentPath.lastIndexOf('/')) || '/'">返回上一级</button>
        <div class="directory-copy" :title="currentSelection.ancestor ? currentSelection.label : undefined"><span class="directory-group-label">{{ currentPath === '/' ? '整个来源' : '当前文件夹' }}</span><code aria-label="当前文件夹路径">{{ currentPath }}</code><small v-if="currentSelection.text">{{ currentSelection.text }}</small></div>
        <button class="directory-select" :class="{ 'is-selected': currentSelection.selected, 'is-contained': currentSelection.ancestor }" :disabled="!!currentSelection.ancestor || !!directory.error" :aria-label="currentSelection.label" :aria-pressed="currentSelection.selected || !!currentSelection.ancestor" @click="select(currentPath)"><SourceIcon :name="currentSelection.icon" /></button>
      </div>
      <div class="directory-list">
        <div v-for="entry in directories" :key="entry.path" class="directory-row" :title="entry.selection.ancestor ? entry.selection.label : undefined">
          <button class="directory-open" @click="currentPath = entry.path">
            <SourceIcon name="folder" /><span class="directory-copy"><span>{{ entry.name }}</span><small v-if="entry.selection.text">{{ entry.selection.text }}</small></span><SourceIcon name="caret-right" />
          </button>
          <button class="directory-select" :class="{ 'is-selected': entry.selection.selected, 'is-contained': entry.selection.ancestor }" :disabled="!!entry.selection.ancestor" :aria-label="entry.selection.label" :aria-pressed="entry.selection.selected || !!entry.selection.ancestor" @click="select(entry.path)"><SourceIcon :name="entry.selection.icon" /></button>
        </div>
        <div v-for="entry in files" :key="entry.path" class="directory-row">
          <div class="directory-file"><SourceIcon :name="fileIcon(entry.name)" /><span class="directory-copy">{{ entry.name }}</span></div>
        </div>
        <p v-if="directory.error" class="source-note danger" role="alert">{{ directory.error }}</p>
        <p v-else-if="!directories.length && !files.length" class="source-note">这个文件夹是空的。</p>
      </div>
      <p v-if="error" class="source-note danger" role="alert">{{ error }}</p>
      <div class="directory-footer"><p class="source-note" role="status">已选择 {{ draftSelectedPaths.length }} 个文件夹</p><div class="header-actions"><button class="secondary-action" @click="emit('close')">取消</button><button class="primary-action" :disabled="!dirty" @click="save">保存</button></div></div>
    </dialog>
    <SourceConfirmDialog v-if="replacement" :title="replacement.path === '/' ? '选择整个来源？' : `选择整个“${folderName(replacement.path)}”文件夹？`" :message="replacementMessage" :paths="replacement.descendants" :destructive="false" confirm-label="选择整个文件夹" @close="replacement = undefined" @confirm="confirmReplacement" />
  </Teleport>
</template>

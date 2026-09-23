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
  catch (cause) { return { entries: [], error: cause instanceof Error ? cause.message : '目录读取失败。' } }
})

function folderName(path: string) { return path === '/' ? '整个来源' : path.slice(path.lastIndexOf('/') + 1) }

// 当前目录与子目录共用状态；已选择和暂停扫描分别展示。
function selectionState(path: string) {
  path = normalizeScanRootPath(path)
  const selected = draftSelectedPaths.value.includes(path)
  const ancestor = findCoveringAncestor(path, draftSelectedPaths.value)
  const descendants = findContainedDescendants(path, draftSelectedPaths.value)
  const disabled = selected && roots.value.some(root => normalizeScanRootPath(root.path) === path && !root.enabled)
  return {
    selected, ancestor, descendants,
    label: ancestor ? `${path} 已随${folderName(ancestor)}一起选择` : selected ? path === '/' ? '取消选择整个来源' : `取消选择 ${path}` : path === '/' ? '选择整个来源及里面的内容' : `选择 ${path} 及里面的内容`,
    text: ancestor ? `已随${folderName(ancestor)}一起选择` : selected ? disabled ? '已选择 · 当前暂停扫描' : '已选择' : descendants.length ? `含 ${descendants.length} 个已选目录` : '',
    icon: ancestor ? 'folder' : selected ? 'check-circle' : 'plus',
  }
}
const currentSelection = computed(() => selectionState(currentPath.value))
const entries = computed(() => directory.value.entries.map(entry => ({ ...entry, selection: selectionState(entry.path) })))
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
  catch (cause) { error.value = cause instanceof Error ? cause.message : '保存目录失败。' }
}
onMounted(() => dialog.value?.showModal())
onBeforeUnmount(() => dialog.value?.close())
</script>
<template>
  <Teleport to="body">
    <dialog ref="dialog" class="media-source-ui directory-dialog" aria-labelledby="directory-title" @cancel.prevent="emit('close')">
      <div class="directory-heading">
        <div><h2 id="directory-title">选择影片文件夹</h2><p class="source-note">选择存放影片的文件夹，里面的文件夹也会一起扫描。<br />保存后不会立即开始扫描。</p></div>
        <button class="secondary-action" @click="emit('close')">取消</button>
      </div>
      <div class="directory-toolbar">
        <button class="secondary-action" :disabled="currentPath === '/'" @click="currentPath = currentPath.slice(0, currentPath.lastIndexOf('/')) || '/'">返回上一级</button>
        <div class="directory-copy"><span class="directory-group-label">{{ currentPath === '/' ? '整个来源' : '当前文件夹' }}</span><code aria-label="当前文件夹路径">{{ currentPath }}</code><small class="directory-scope-hint">{{ currentSelection.selected || currentSelection.ancestor ? '整个文件夹及里面的内容都已选择' : currentPath === '/' ? '选择整个来源及里面的内容' : '选择整个文件夹及里面的内容' }}</small><small v-if="currentSelection.text">{{ currentSelection.text }}</small></div>
        <button class="directory-select" :class="{ 'is-selected': currentSelection.selected }" :disabled="!!currentSelection.ancestor || !!directory.error" :aria-label="currentSelection.label" :aria-pressed="currentSelection.selected" @click="select(currentPath)"><SourceIcon :name="currentSelection.icon" /></button>
      </div>
      <p class="directory-group-label directory-list-label">里面的文件夹 <small>只想选一部分，就选下面的文件夹</small></p>
      <div class="directory-list">
        <div v-for="entry in entries" :key="entry.path" class="directory-row">
          <button class="directory-open" :disabled="entry.kind !== 'directory'" @click="currentPath = entry.path">
            <SourceIcon name="folder" /><span class="directory-copy"><span>{{ entry.name }}</span><small v-if="entry.selection.text">{{ entry.selection.text }}</small></span><SourceIcon name="caret-right" />
          </button>
          <button v-if="entry.kind === 'directory'" class="directory-select" :class="{ 'is-selected': entry.selection.selected }" :disabled="!!entry.selection.ancestor" :aria-label="entry.selection.label" :aria-pressed="entry.selection.selected" @click="select(entry.path)"><SourceIcon :name="entry.selection.icon" /></button>
        </div>
        <p v-if="directory.error" class="source-note danger" role="alert">{{ directory.error }}</p>
        <p v-else-if="!entries.length" class="source-note">{{ currentSelection.ancestor ? '这里没有其他文件夹，当前文件夹已一起选择。' : currentSelection.selected ? '这里没有其他文件夹，当前文件夹已选择。' : '这里没有其他文件夹，你仍可以选择当前文件夹。' }}</p>
      </div>
      <p v-if="error" class="source-note danger" role="alert">{{ error }}</p>
      <div class="directory-footer"><p class="source-note" role="status">已选择 {{ draftSelectedPaths.length }} 个文件夹</p><div class="header-actions"><button class="secondary-action" @click="emit('close')">取消</button><button class="primary-action" :disabled="!dirty" @click="save">保存</button></div></div>
    </dialog>
    <SourceConfirmDialog v-if="replacement" :title="replacement.path === '/' ? '选择整个来源？' : `选择整个“${folderName(replacement.path)}”文件夹？`" :message="replacementMessage" :paths="replacement.descendants" :destructive="false" confirm-label="选择整个文件夹" @close="replacement = undefined" @confirm="confirmReplacement" />
  </Teleport>
</template>

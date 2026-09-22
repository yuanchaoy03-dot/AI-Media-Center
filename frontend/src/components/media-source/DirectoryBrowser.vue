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

// 当前目录与子目录共用状态；membership 与 enabled 独立。
function selectionState(path: string) {
  path = normalizeScanRootPath(path)
  const selected = draftSelectedPaths.value.includes(path)
  const ancestor = findCoveringAncestor(path, draftSelectedPaths.value)
  const descendants = findContainedDescendants(path, draftSelectedPaths.value)
  const disabled = selected && roots.value.some(root => normalizeScanRootPath(root.path) === path && !root.enabled)
  return {
    selected, ancestor, descendants,
    label: ancestor ? `${path} 已由 ${ancestor} 包含` : selected ? `取消选择 ${path}` : `选择 ${path} 作为扫描目录`,
    text: ancestor ? `已包含于 ${ancestor}` : selected ? disabled ? '已选择 · 已停用' : '已选择' : descendants.length ? `含 ${descendants.length} 个已选目录` : '',
    icon: ancestor ? 'folder' : selected ? 'check-circle' : 'plus',
  }
}
const currentSelection = computed(() => selectionState(currentPath.value))
const entries = computed(() => directory.value.entries.map(entry => ({ ...entry, selection: selectionState(entry.path) })))
const replacementMessage = computed(() => {
  if (!replacement.value) return ''
  const { path, descendants } = replacement.value
  return path === '/'
    ? `选择根目录后，将递归扫描此来源的全部可见目录，并替换当前 ${descendants.length} 个扫描目录。只修改扫描配置，不删除云端文件。`
    : `${path} 将递归包含当前已选择的 ${descendants.length} 个下级扫描目录。继续后，这些下级目录将不再单独配置。`
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
        <div><h2 id="directory-title">管理扫描目录</h2><p class="source-note">每个扫描目录都会递归扫描。选择父目录时，会替换已选的下级扫描目录。保存不会开始扫描。</p></div>
        <button class="secondary-action" @click="emit('close')">取消</button>
      </div>
      <div class="directory-toolbar">
        <button class="secondary-action" :disabled="currentPath === '/'" @click="currentPath = currentPath.slice(0, currentPath.lastIndexOf('/')) || '/'">返回上一级</button>
        <div class="directory-copy"><small>当前目录</small><code aria-label="当前目录路径">{{ currentPath }}</code><small v-if="currentSelection.text">{{ currentSelection.text }}</small></div>
        <button class="directory-select" :class="{ 'is-selected': currentSelection.selected }" :disabled="!!currentSelection.ancestor || !!directory.error" :aria-label="currentSelection.label" :aria-pressed="currentSelection.selected" @click="select(currentPath)"><SourceIcon :name="currentSelection.icon" /></button>
      </div>
      <div class="directory-list">
        <div v-for="entry in entries" :key="entry.path" class="directory-row">
          <button class="directory-open" :disabled="entry.kind !== 'directory'" @click="currentPath = entry.path">
            <SourceIcon name="folder" /><span class="directory-copy"><span>{{ entry.name }}</span><small v-if="entry.selection.text">{{ entry.selection.text }}</small></span><SourceIcon name="caret-right" />
          </button>
          <button v-if="entry.kind === 'directory'" class="directory-select" :class="{ 'is-selected': entry.selection.selected }" :disabled="!!entry.selection.ancestor" :aria-label="entry.selection.label" :aria-pressed="entry.selection.selected" @click="select(entry.path)"><SourceIcon :name="entry.selection.icon" /></button>
        </div>
        <p v-if="directory.error" class="source-note danger" role="alert">{{ directory.error }}</p>
        <p v-else-if="!entries.length" class="source-note">{{ currentSelection.ancestor ? '没有子目录，当前目录已由上级扫描目录包含。' : currentSelection.selected ? '没有子目录。当前目录已选择。' : '没有子目录。你仍可以选择当前目录。' }}</p>
      </div>
      <p v-if="error" class="source-note danger" role="alert">{{ error }}</p>
      <div class="directory-footer"><p class="source-note" role="status">已选择 {{ draftSelectedPaths.length }} 个扫描目录</p><div class="header-actions"><button class="secondary-action" @click="emit('close')">取消</button><button class="primary-action" :disabled="!dirty" @click="save">保存</button></div></div>
    </dialog>
    <SourceConfirmDialog v-if="replacement" title="替换下级扫描目录？" :message="replacementMessage" :paths="replacement.descendants" :destructive="false" confirm-label="使用父目录" @close="replacement = undefined" @confirm="confirmReplacement" />
  </Teleport>
</template>

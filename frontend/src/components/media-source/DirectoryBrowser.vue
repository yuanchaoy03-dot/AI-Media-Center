<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { addScanRoots, browseDirectory, mediaSourceState } from '../../services/mediaSourceService'
import SourceIcon from './SourceIcon.vue'
import SourceConfirmDialog from './SourceConfirmDialog.vue'
const props = defineProps<{ sourceId: string }>()
const emit = defineEmits<{ close: []; saved: [] }>()
const dialog = ref<HTMLDialogElement>()
const currentPath = ref('/')
const selected = ref<string[]>([])
const error = ref('')
const confirmingCancel = ref(false)
const roots = computed(() => mediaSourceState.roots.filter(root => root.sourceId === props.sourceId))
const configured = computed(() => roots.value.find(root => root.path === currentPath.value))
const directory = computed(() => {
  try { return { entries: browseDirectory(props.sourceId, currentPath.value), error: '' } }
  catch (cause) { return { entries: [], error: cause instanceof Error ? cause.message : '目录读取失败。' } }
})
function select() {
  if (configured.value) return
  selected.value = selected.value.includes(currentPath.value) ? selected.value.filter(path => path !== currentPath.value) : [...selected.value, currentPath.value]
}
function cancel(event?: Event) {
  if (selected.value.length) { event?.preventDefault(); confirmingCancel.value = true; return }
  emit('close')
}
function save() {
  try { addScanRoots(props.sourceId, selected.value); emit('saved') }
  catch (cause) { error.value = cause instanceof Error ? cause.message : '保存目录失败。' }
}
onMounted(() => dialog.value?.showModal())
onBeforeUnmount(() => dialog.value?.close())
</script>
<template>
  <Teleport to="body">
    <dialog ref="dialog" class="media-source-ui directory-dialog" aria-labelledby="directory-title" @cancel="cancel">
      <div class="directory-heading"><div><h2 id="directory-title">添加扫描目录</h2><p class="source-note">浏览此 WebDAV，选择一个或多个目录。保存不会开始扫描。</p></div><button class="secondary-action" @click="cancel">取消</button></div>
      <div class="directory-toolbar"><button class="secondary-action" :disabled="currentPath === '/'" @click="currentPath = currentPath.slice(0, currentPath.lastIndexOf('/')) || '/'">返回上一级</button><code aria-label="当前目录路径">{{ currentPath }}</code></div>
      <div class="directory-list">
        <button v-for="entry in directory.entries" :key="entry.path" class="directory-row" :disabled="entry.kind !== 'directory'" @click="currentPath = entry.path"><SourceIcon name="folder" /><span>{{ entry.name }}</span><small>{{ roots.some(root => root.path === entry.path) ? '已配置' : selected.includes(entry.path) ? '已选' : '目录' }}</small><span aria-hidden="true">›</span></button>
        <p v-if="directory.error" class="source-note danger" role="alert">{{ directory.error }}</p>
        <p v-else-if="!directory.entries.length" class="source-note">没有子目录。你仍可以选择当前目录。</p>
      </div>
      <div class="directory-current"><span class="source-note" role="status">{{ configured ? `已配置 · ${configured.enabled ? '已启用' : '已停用，可在详情中启用'}` : selected.includes(currentPath) ? '已加入本次选择' : '当前目录尚未选择' }}</span><button class="secondary-action" :disabled="!!configured || !!directory.error" @click="select">{{ configured ? '已配置此目录' : selected.includes(currentPath) ? '取消选择当前目录' : '选择当前目录' }}</button></div>
      <div class="directory-selection"><h3>本次已选 {{ selected.length }}</h3><div class="selected-directories"><button v-for="path in selected" :key="path" class="selected-directory" :aria-label="`取消选择 ${path}`" @click="selected = selected.filter(item => item !== path)">{{ path }} ×</button></div></div>
      <p v-if="error" class="source-note danger" role="alert">{{ error }}</p>
      <div class="directory-footer"><p class="source-note">已配置的目录会标记显示，不能重复添加。</p><button class="primary-action" :disabled="!selected.length" @click="save">保存扫描目录</button></div>
    </dialog>
    <SourceConfirmDialog v-if="confirmingCancel" title="放弃本次选择？" message="本次尚未保存的目录选择将被放弃，已配置的扫描目录保持不变。" confirm-label="放弃选择" @close="confirmingCancel = false" @confirm="emit('close')" />
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { DirectoryEntry } from '../../types/mediaSource'
import SourceIcon from './SourceIcon.vue'

const props = withDefaults(
  defineProps<{
    currentPath: string
    entries: DirectoryEntry[]
    loading?: boolean
    busy?: boolean
    error?: string
    title?: string
    description?: string
    closeLabel?: string
    selectable?: boolean
    retryable?: boolean
  }>(),
  {
    loading: false,
    busy: false,
    error: '',
    title: '浏览目录',
    description: '只读查看来源中的文件夹和文件。',
    closeLabel: '关闭',
    selectable: false,
    retryable: true,
  },
)
const emit = defineEmits<{ close: []; navigate: [path: string]; retry: [] }>()
const dialog = ref<HTMLDialogElement>()
const directories = computed(() => props.entries.filter((entry) => entry.kind === 'directory'))
const files = computed(() => props.entries.filter((entry) => entry.kind === 'file'))
function fileIcon(name: string) {
  return /\.(?:mp4|mkv|mov|avi|m4v|wmv|ts|m2ts|webm|mpg|mpeg)$/i.test(name) ? 'video' : 'file'
}
onMounted(() => dialog.value?.showModal())
onBeforeUnmount(() => dialog.value?.close())
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="media-source-ui directory-dialog"
      :class="{ 'directory-readonly': !selectable }"
      aria-labelledby="directory-title"
      @cancel.prevent="emit('close')"
    >
      <div class="directory-heading">
        <div>
          <h2 id="directory-title">{{ title }}</h2>
          <p class="source-note">{{ description }}</p>
        </div>
        <button class="secondary-action" @click="emit('close')">{{ closeLabel }}</button>
      </div>
      <div class="directory-toolbar">
        <button
          class="secondary-action"
          :disabled="currentPath === '/' || loading || busy"
          @click="emit('navigate', currentPath.slice(0, currentPath.lastIndexOf('/')) || '/')"
        >
          返回上一级
        </button>
        <div class="directory-copy">
          <span class="directory-group-label">{{
            currentPath === '/' ? '整个来源' : '当前文件夹'
          }}</span>
          <code aria-label="当前文件夹路径">{{ currentPath }}</code>
          <slot name="current-description" />
        </div>
        <slot name="current-control" />
      </div>
      <div class="directory-list" :aria-busy="loading || busy">
        <p v-if="loading" class="source-note" role="status">
          <span class="spinner" /> 正在读取目录…
        </p>
        <template v-else-if="!error">
          <div v-for="entry in directories" :key="entry.path" class="directory-row">
            <button class="directory-open" :disabled="busy" @click="emit('navigate', entry.path)">
              <SourceIcon name="folder" />
              <span class="directory-copy">
                <span>{{ entry.name }}</span>
                <slot name="entry-description" :entry="entry" />
              </span>
              <SourceIcon name="caret-right" />
            </button>
            <slot name="entry-control" :entry="entry" />
          </div>
          <div v-for="entry in files" :key="entry.path" class="directory-row">
            <div class="directory-file">
              <SourceIcon :name="fileIcon(entry.name)" />
              <span class="directory-copy">{{ entry.name }}</span>
            </div>
          </div>
          <p v-if="!entries.length" class="source-note">这个文件夹是空的。</p>
        </template>
        <div v-else class="directory-error">
          <p class="source-note danger" role="alert">{{ error }}</p>
          <button v-if="retryable" class="secondary-action" :disabled="busy" @click="emit('retry')">
            重试
          </button>
        </div>
      </div>
      <slot name="error" />
      <div class="directory-footer">
        <slot name="footer">
          <p class="source-note">选择影片文件夹可设置扫描范围，保存后不会立即扫描。</p>
          <button class="secondary-action" @click="emit('close')">关闭</button>
        </slot>
      </div>
    </dialog>
    <slot name="confirmation" />
  </Teleport>
</template>

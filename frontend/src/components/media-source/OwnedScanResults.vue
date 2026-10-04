<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type {
  OwnedMediaNameCandidate,
  OwnedResourcePage,
  OwnedScanTask,
} from '../../services/ownedScanService'
import SourceIcon from './SourceIcon.vue'

defineProps<{
  sourceName: string
  task?: OwnedScanTask
  result?: OwnedResourcePage
  page: number
  loading: boolean
  error: string
  scanError: string
}>()
const emit = defineEmits<{ close: []; page: [page: number]; retry: []; 'retry-task': [] }>()
const dialog = ref<HTMLDialogElement>()
const labels = {
  pending: '等待扫描',
  running: '扫描中',
  completed: '扫描完成',
  failed: '扫描未完成',
}
function sizeLabel(size: number | null) {
  if (size === null) return '大小未知'
  if (size < 1024) return `${size} B`
  const unit = size < 1024 ** 2 ? 1 : size < 1024 ** 3 ? 2 : 3
  return `${(size / 1024 ** unit).toFixed(1)} ${['B', 'KiB', 'MiB', 'GiB'][unit]}`
}
function nameCandidateLabel(candidate: OwnedMediaNameCandidate) {
  const parts = [candidate.title, candidate.year?.toString(), candidate.editionLabel].filter(
    Boolean,
  )
  return parts.length ? `名称解析候选：${parts.join(' · ')}` : '名称暂无法解析'
}
onMounted(() => dialog.value?.showModal())
onBeforeUnmount(() => dialog.value?.close())
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="media-source-ui directory-dialog scan-results-dialog"
      aria-labelledby="scan-results-title"
      @cancel.prevent="emit('close')"
    >
      <div class="directory-heading">
        <div>
          <h2 id="scan-results-title">扫描结果</h2>
          <p class="source-note">{{ sourceName }}</p>
        </div>
        <button class="secondary-action" @click="emit('close')">关闭</button>
      </div>
      <div v-if="task" class="scan-result-summary" aria-live="polite">
        <p>{{ labels[task.status] }} · 已遍历 {{ task.directoryCount }} 个目录</p>
        <p class="source-note">
          发现 {{ task.discoveredCount }} 个文件 · 入库 {{ task.persistedCount }} 个文件 ·
          影片尚未识别
        </p>
        <details>
          <summary>本次扫描的影片文件夹（{{ task.rootPaths.length }}）</summary>
          <ul>
            <li v-for="path in task.rootPaths" :key="path">
              <code>{{ path }}</code>
            </li>
          </ul>
        </details>
        <p v-if="task.errorMessage" class="source-note danger" role="alert">
          {{ task.errorMessage }}
        </p>
        <div v-if="scanError" class="scan-query-error">
          <p class="source-note danger" role="alert">
            扫描进度暂时无法更新，以上是最近读取的状态。{{ scanError }}
          </p>
          <button class="secondary-action" @click="emit('retry-task')">重新查询扫描记录</button>
        </div>
      </div>
      <div class="section-heading-row resource-heading">
        <h3>来源中的未识别资源</h3>
        <button class="source-config-link" :disabled="loading" @click="emit('retry')">
          刷新结果
        </button>
      </div>
      <p class="source-note">
        以下是这个来源已保存的文件，包含此前扫描结果。影片识别完成后才能进入个人片库。
      </p>
      <div class="directory-list" :aria-busy="loading">
        <p v-if="loading" class="source-note" role="status">
          <span class="spinner" /> 正在读取资源…
        </p>
        <div v-else-if="error" class="directory-error">
          <p class="source-note danger" role="alert">{{ error }}</p>
          <button class="secondary-action" @click="emit('retry')">重试</button>
        </div>
        <template v-else-if="result">
          <div
            v-for="resource in result.items"
            :key="resource.id"
            class="directory-file resource-file"
          >
            <SourceIcon name="video" />
            <div class="directory-copy">
              <strong>{{ resource.name }}</strong
              ><code>{{ resource.path }}</code
              ><small
                >{{ sizeLabel(resource.size) }} · 未识别 ·
                {{
                  resource.modifiedAt
                    ? `修改于 ${new Date(resource.modifiedAt).toLocaleString('zh-CN')}`
                    : '修改时间未知'
                }}</small
              >
              <small class="resource-name-candidate">{{
                nameCandidateLabel(resource.nameCandidate)
              }}</small>
            </div>
          </div>
          <p v-if="!result.items.length" class="source-note">
            {{ result.total ? '这一页暂无资源，请返回上一页。' : '尚未发现并保存视频文件。' }}
          </p>
        </template>
      </div>
      <div class="directory-footer">
        <p class="source-note">
          {{ result ? `共 ${result.total} 个未识别文件 · 第 ${page + 1} 页` : `第 ${page + 1} 页` }}
        </p>
        <div class="resource-pagination">
          <button
            class="secondary-action"
            :disabled="loading || page === 0"
            @click="emit('page', page - 1)"
          >
            上一页</button
          ><button
            class="secondary-action"
            :disabled="loading || !result || (page + 1) * result.pageSize >= result.total"
            @click="emit('page', page + 1)"
          >
            下一页
          </button>
        </div>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
.scan-results-dialog {
  display: none;
}
.scan-results-dialog[open] {
  display: flex;
  flex-direction: column;
  overflow: auto;
}
.scan-result-summary {
  display: grid;
  gap: 8px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--source-line);
}
.scan-query-error {
  display: grid;
  gap: 8px;
  justify-items: start;
}
.scan-result-summary details {
  font-size: 13px;
  color: var(--source-secondary);
  overflow-wrap: anywhere;
}
.scan-result-summary summary {
  cursor: pointer;
}
.scan-result-summary ul {
  margin-block: 8px 0;
  padding-left: 20px;
}
.resource-heading {
  margin-block: 20px 8px;
}
.resource-heading h3 {
  font-size: 15px;
}
.resource-file {
  border-bottom: 1px solid var(--source-line);
  align-items: flex-start;
}
.resource-file strong {
  font-size: 13px;
  font-weight: 600;
  color: var(--source-primary);
}
.resource-file code {
  font-size: 12px;
}
.resource-name-candidate {
  white-space: normal;
  overflow-wrap: anywhere;
}
.directory-list {
  min-height: 80px;
  flex: 1;
  flex-shrink: 0;
  margin-block: 12px;
}
.resource-pagination {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.directory-footer {
  flex-wrap: wrap;
}
.source-config-link {
  border: 0;
  padding: 0;
  background: transparent;
}
</style>

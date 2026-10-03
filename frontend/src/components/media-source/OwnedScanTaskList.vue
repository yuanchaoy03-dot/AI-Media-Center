<script setup lang="ts">
import type { OwnedScanTask } from '../../services/ownedScanService'
import type { OwnedMediaSource } from '../../services/ownedSourceService'
import SourceIcon from './SourceIcon.vue'

defineProps<{ tasks: OwnedScanTask[]; sources: OwnedMediaSource[] }>()
const emit = defineEmits<{ select: [task: OwnedScanTask] }>()
const labels = {
  pending: '等待扫描',
  running: '扫描中',
  completed: '扫描完成',
  failed: '扫描未完成',
}
</script>

<template>
  <div class="scan-list">
    <article v-for="task in tasks" :key="task.id" class="scan-item">
      <button
        class="scan-hit"
        :aria-label="`查看${sources.find((source) => source.id === task.sourceId)?.name}扫描结果`"
        @click="emit('select', task)"
      />
      <span class="scan-icon"
        ><SourceIcon
          :name="task.status === 'completed' ? 'check-circle' : 'clock-counter-clockwise'"
      /></span>
      <span class="scan-copy">
        <strong>{{ sources.find((source) => source.id === task.sourceId)?.name }}</strong>
        <span :title="task.errorMessage || undefined"
          >{{ labels[task.status] }} · 发现 {{ task.discoveredCount }} 个文件 · 入库
          {{ task.persistedCount }} 个文件{{
            task.status === 'failed' ? ` · ${task.errorMessage || '请查看失败原因'}` : ''
          }}</span
        >
      </span>
      <time class="scan-time" :datetime="task.createdAt">{{
        new Date(task.createdAt).toLocaleString('zh-CN')
      }}</time>
      <SourceIcon class="scan-chevron" name="caret-right" />
    </article>
  </div>
</template>

<style scoped>
.scan-list .scan-icon,
.scan-list .scan-copy,
.scan-list .scan-time,
.scan-list .scan-chevron {
  position: relative;
  z-index: 1;
  pointer-events: none;
}
.scan-list .scan-icon {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
}
.scan-list .scan-icon svg {
  width: 17px;
  height: 17px;
}
.scan-list .scan-copy strong {
  color: var(--source-primary);
  transition: color 0.16s ease-out;
}
.scan-list .scan-item:hover .scan-copy strong {
  color: var(--color-text-primary);
}
.scan-list .scan-chevron {
  transition: color 0.16s ease-out;
}
.scan-list .scan-item:hover .scan-chevron {
  color: var(--color-icon-hover);
}
@media (max-width: 900px) {
  .scan-copy {
    grid-template-columns: minmax(0, 1fr);
    gap: 4px;
  }
}
@media (max-width: 760px) {
  .scan-item {
    grid-template-columns: 26px minmax(0, 1fr) 18px;
  }
  .scan-time {
    grid-column: 2;
    grid-row: 2;
  }
  .scan-chevron {
    grid-column: 3;
    grid-row: 1;
  }
}
</style>

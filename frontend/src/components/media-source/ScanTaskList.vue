<script setup lang="ts">
import type { MediaSource, ScanTask } from '../../types/mediaSource'
import SourceIcon from './SourceIcon.vue'
defineProps<{ tasks: readonly Readonly<ScanTask>[]; sources: readonly MediaSource[] }>()
const emit = defineEmits<{ select: [task: Readonly<ScanTask>] }>()
const statusLabels = { pending: '等待首次扫描', running: '扫描中', completed: '扫描完成', failed: '扫描未完成' }
</script>
<template>
  <div class="scan-list">
    <article v-for="task in tasks" :key="task.id" class="scan-item">
      <button class="scan-hit" :aria-label="`查看${sources.find(source => source.id === task.sourceId)?.name}扫描详情`" @click="emit('select', task)" />
      <span class="scan-icon"><SourceIcon :name="task.status === 'completed' ? 'check-circle' : 'clock-counter-clockwise'" /></span>
      <span class="scan-copy"><strong>{{ sources.find(source => source.id === task.sourceId)?.name }}</strong><span>{{ statusLabels[task.status] }} · {{ task.status === 'running' ? '本次只扫描开始时选中的影片文件夹' : `新增 ${task.recognizedMovieIds.length} 部 · 待确认 ${task.pendingCount} 个 · 需要注意 ${task.attentionCount} 个` }}</span></span>
      <time class="scan-time">{{ task.time }}</time><SourceIcon class="scan-chevron" name="caret-right" />
    </article>
  </div>
</template>

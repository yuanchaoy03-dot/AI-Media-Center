<script setup lang="ts">
import {
  browseDirectory,
  mediaSourceState,
  saveScanRootSelection,
} from '../../services/mediaSourceService'
import DirectorySelection from './DirectorySelection.vue'

defineProps<{ sourceId: string }>()
const emit = defineEmits<{ close: []; saved: [] }>()

function loadRoots(sourceId: string) {
  return mediaSourceState.roots.filter((root) => root.sourceId === sourceId)
}

function loadDirectory(sourceId: string, path: string) {
  return browseDirectory(sourceId, path)
}

function saveRoots(sourceId: string, paths: readonly string[]) {
  saveScanRootSelection(sourceId, paths)
  return loadRoots(sourceId)
}
</script>

<template>
  <DirectorySelection
    :source-id="sourceId"
    :load-roots="loadRoots"
    :load-directory="loadDirectory"
    :save-roots="saveRoots"
    :retryable="false"
    @close="emit('close')"
    @saved="emit('saved')"
  />
</template>

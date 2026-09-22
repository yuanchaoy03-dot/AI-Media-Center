<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
withDefaults(defineProps<{ title: string; message: string; confirmLabel: string; paths?: readonly string[]; destructive?: boolean }>(), { destructive: true })
const emit = defineEmits<{ confirm: []; close: [] }>()
const dialog = ref<HTMLDialogElement>()
onMounted(() => dialog.value?.showModal())
onBeforeUnmount(() => dialog.value?.close())
</script>
<template>
  <Teleport to="body">
    <dialog ref="dialog" class="media-source-ui source-confirm" aria-labelledby="source-confirm-title" @cancel="emit('close')">
      <h2 id="source-confirm-title" class="section-title">{{ title }}</h2>
      <p class="source-note">{{ message }}</p>
      <ul v-if="paths?.length" class="confirmation-paths"><li v-for="path in paths" :key="path"><code>{{ path }}</code></li></ul>
      <div class="dialog-actions"><button class="secondary-action" @click="emit('close')">取消</button><button class="secondary-action" :class="{ danger: destructive }" @click="emit('confirm')">{{ confirmLabel }}</button></div>
    </dialog>
  </Teleport>
</template>
<style scoped>
.source-confirm { width:min(440px,calc(100vw - 44px)); padding:24px; }
.source-confirm p { margin-top:16px; }
.confirmation-paths { max-height:160px; overflow:auto; padding-left:20px; font-size:13px; }
.confirmation-paths li + li { margin-top:6px; }
</style>

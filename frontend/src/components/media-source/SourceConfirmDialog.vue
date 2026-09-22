<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
defineProps<{ title: string; message: string; confirmLabel: string }>()
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
      <div class="dialog-actions"><button class="secondary-action" @click="emit('close')">取消</button><button class="secondary-action danger" @click="emit('confirm')">{{ confirmLabel }}</button></div>
    </dialog>
  </Teleport>
</template>
<style scoped>
.source-confirm { width:min(440px,calc(100vw - 44px)); padding:24px; }
.source-confirm p { margin-top:16px; }
</style>

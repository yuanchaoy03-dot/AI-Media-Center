<script setup lang="ts">
import { nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import SourceIcon from './SourceIcon.vue'
const props = defineProps<{ trigger: HTMLButtonElement; scanLabel: string }>()
const emit = defineEmits<{ close: []; action: [action: 'detail' | 'scan' | 'edit' | 'remove'] }>()
const menu = ref<HTMLElement>()
const position = ref({ left: '12px', top: '12px', visibility: 'hidden' as 'hidden' | 'visible' })
async function positionMenu() {
  await nextTick()
  if (!menu.value || !props.trigger.isConnected) return
  const rect = props.trigger.getBoundingClientRect()
  position.value = { left: `${Math.max(12, Math.min(rect.right - 176, innerWidth - 188))}px`, top: `${Math.max(12, Math.min(rect.bottom + 6, innerHeight - menu.value.offsetHeight - 12))}px`, visibility: 'visible' }
}
function outside(event: Event) {
  if (event.target instanceof Node && !menu.value?.contains(event.target) && !props.trigger.contains(event.target)) emit('close')
}
function scroll(event: Event) { if (!(event.target instanceof Node) || !menu.value?.contains(event.target)) emit('close') }
function close() { emit('close') }
function escape(event: KeyboardEvent) { if (event.key === 'Escape') close() }
watch(() => props.trigger, positionMenu)
onMounted(() => {
  void positionMenu()
  document.addEventListener('pointerdown', outside)
  document.addEventListener('keydown', escape)
  window.addEventListener('resize', close)
  window.addEventListener('scroll', scroll, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', outside)
  document.removeEventListener('keydown', escape)
  window.removeEventListener('resize', close)
  window.removeEventListener('scroll', scroll, true)
})
</script>
<template>
  <Teleport to="body">
    <div id="source-menu" ref="menu" class="media-source-ui source-menu" :style="position" role="group" aria-label="来源操作">
      <button @click="emit('action', 'detail')"><SourceIcon name="caret-right" />查看详情</button>
      <button @click="emit('action', 'scan')"><SourceIcon name="arrow-clockwise" />{{ scanLabel }}</button>
      <button @click="emit('action', 'edit')"><SourceIcon name="pencil" />编辑来源</button>
      <div class="menu-divider" />
      <button class="danger" @click="emit('action', 'remove')"><SourceIcon name="trash" />移除来源</button>
    </div>
  </Teleport>
</template>

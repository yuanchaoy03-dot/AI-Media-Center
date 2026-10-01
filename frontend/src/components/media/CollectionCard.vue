<script setup lang="ts">
import { ref, watch } from 'vue'
import movieIcons from '../../assets/movie-icons.svg?url&no-inline'
import type { LibraryCollection } from '../../types/collection'

const props = withDefaults(
  defineProps<{
    collection: LibraryCollection
    movieCount: number
    moreExpanded?: boolean
    menuId?: string
  }>(),
  { moreExpanded: false },
)
const emit = defineEmits<{
  detail: [collectionId: string]
  more: [payload: { collectionId: string; trigger: HTMLButtonElement }]
}>()
const imageFailed = ref(false)
watch(
  () => [props.collection.id, props.collection.posterUrl],
  () => {
    imageFailed.value = false
  },
)

function requestMore(event: MouseEvent) {
  if (event.currentTarget instanceof HTMLButtonElement) {
    emit('more', { collectionId: props.collection.id, trigger: event.currentTarget })
  }
}
</script>

<template>
  <article class="movie-card collection-card">
    <div class="poster-art" :data-fallback="collection.title">
      <img
        v-if="collection.posterUrl && !imageFailed"
        :key="collection.posterUrl"
        :src="collection.posterUrl"
        :alt="`${collection.title}合集海报`"
        @error="imageFailed = true"
      />
      <button
        class="poster-detail-hit"
        type="button"
        :aria-label="`查看${collection.title}合集`"
        @click="emit('detail', collection.id)"
      />
      <button
        class="series-mark"
        type="button"
        :aria-label="`查看${collection.title}合集`"
        @click="emit('detail', collection.id)"
      >
        <svg viewBox="0 0 256 256" aria-hidden="true" focusable="false">
          <use :href="`${movieIcons}#ph-caret-right`" />
        </svg>
      </button>
      <button
        class="poster-more-mark"
        type="button"
        :aria-label="`${collection.title}更多操作`"
        :aria-expanded="moreExpanded"
        :aria-controls="menuId"
        @click="requestMore"
      >
        <svg viewBox="0 0 256 256" aria-hidden="true" focusable="false">
          <use :href="`${movieIcons}#ph-dots-three-bold`" />
        </svg>
      </button>
    </div>
    <div class="poster-copy">
      <strong class="poster-title" :title="collection.title">{{ collection.title }}</strong>
      <span class="poster-meta">{{ movieCount }} 部电影</span>
    </div>
  </article>
</template>

<style scoped src="../../assets/poster-card.css"></style>

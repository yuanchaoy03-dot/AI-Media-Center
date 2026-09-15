<script setup lang="ts">
import { computed, ref, shallowRef, useId, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import MovieCard from '../components/media/MovieCard.vue'
import MovieContextMenu from '../components/media/MovieContextMenu.vue'
import { getLibraryCollections, getOwnedCollectionMembers } from '../services/collectionService'
import { getLibraryMovies } from '../services/movieService'
import type { LibraryCollection } from '../types/collection'
import type { LibraryMovie, WatchStatus } from '../types/movie'

const route = useRoute()
const router = useRouter()
const collection = ref<LibraryCollection>()
const movies = ref<LibraryMovie[]>([])
const loading = ref(true)
const failed = ref(false)
const posterFailed = ref(false)
const backdropFailed = ref(false)
const members = computed(() => collection.value ? getOwnedCollectionMembers(collection.value, movies.value) : [])
const meta = computed(() => [`${members.value.length} 部电影`, ...new Set(members.value.flatMap(movie => movie.genres))].join(' · '))
const menuId = `collection-movie-menu-${useId()}`
const activeId = ref('')
const trigger = shallowRef<HTMLButtonElement | null>(null)
const menuOpen = ref(false)
const activeMovie = computed(() => members.value.find(movie => movie.id === activeId.value))
const announcement = ref('')
watch(() => route.params.collectionId, async (id, _, onCleanup) => {
  let cancelled = false
  onCleanup(() => { cancelled = true })
  loading.value = true
  failed.value = false
  menuOpen.value = false
  posterFailed.value = backdropFailed.value = false
  try {
    const [collections, library] = await Promise.all([getLibraryCollections(), getLibraryMovies()])
    if (cancelled) return
    collection.value = collections.find(item => item.id === id)
    movies.value = library
  } catch {
    if (!cancelled) failed.value = true
  } finally {
    if (!cancelled) loading.value = false
  }
}, { immediate: true })
function openMenu(event: { movieId: string; trigger: HTMLButtonElement }) {
  menuOpen.value = !(menuOpen.value && activeId.value === event.movieId)
  activeId.value = event.movieId
  trigger.value = event.trigger
}
function favorite(id: string, next: boolean) {
  const movie = members.value.find(item => item.id === id)
  if (movie) { movie.favorite = next; announcement.value = `《${movie.title}》${next ? '已加入收藏' : '已取消收藏'}` }
}
function watchStatus(id: string, next: WatchStatus) {
  const movie = members.value.find(item => item.id === id)
  if (movie) { movie.watchStatus = next; announcement.value = `《${movie.title}》已标记为${next === 'watched' ? '已看' : '未看'}` }
}
function intent(action: string, id: string) {
  if (action === 'detail') { void router.push({ name: 'movie-detail', params: { movieId: id } }); return }
  if (import.meta.env.DEV) console.info('[Library Mock intent]', action, id)
  announcement.value = action === 'detail' ? '电影详情尚未开放。' : action === 'play' ? '播放尚未接入。' : '媒体版本尚未开放。'
}
</script>

<template>
  <Teleport to="body">
    <div v-if="!loading && !failed && collection?.backdropUrl && !backdropFailed" class="collection-backdrop-stage" aria-hidden="true">
      <img :src="collection.backdropUrl" alt="" @error="backdropFailed = true" />
    </div>
  </Teleport>
  <div class="collection-page">
    <RouterLink class="collection-back" :to="{ name: 'library' }">‹ 返回电影</RouterLink>
    <section v-if="loading" class="collection-empty" aria-busy="true"><p role="status">正在加载合集</p></section>
    <section v-else-if="failed || !collection" class="collection-empty">
      <h1>{{ failed ? '合集加载失败' : '未找到这个电影合集' }}</h1>
      <p>请返回电影资料库，选择已有的合集。</p>
    </section>
    <template v-else>
      <section class="collection-hero" aria-labelledby="collection-title">
        <div class="collection-heading">
          <img v-if="!posterFailed" class="collection-poster" :src="collection.posterUrl" :alt="`${collection.title}合集海报`" @error="posterFailed = true" />
          <div v-else class="collection-poster poster-fallback">{{ collection.title }}</div>
          <div><h1 id="collection-title">{{ collection.title }}</h1><p class="collection-meta">{{ meta }}</p></div>
        </div>
      </section>
      <section class="collection-members" aria-labelledby="members-title">
        <h2 id="members-title">我的电影</h2>
        <div class="collection-movie-grid">
          <MovieCard v-for="movie in members" :key="movie.id" :movie="movie" :menu-id="menuId"
            :more-expanded="menuOpen && activeId === movie.id" @more="openMenu" @detail="intent('detail', $event)" @play="intent('play', $event)" />
        </div>
        <p v-if="!members.length" class="collection-meta">你的片库中还没有这个合集的电影。</p>
      </section>
    </template>
    <MovieContextMenu :id="menuId" :open="menuOpen" :trigger="trigger" :movie-id="activeId"
      :title="activeMovie?.title ?? ''" :favorite="activeMovie?.favorite ?? false" :watch-status="activeMovie?.watchStatus ?? 'unwatched'"
      @close="menuOpen = false" @favorite-change="favorite" @watch-status-change="watchStatus"
      @detail="intent('detail', $event)" @play="intent('play', $event)" @versions="intent('versions', $event)" />
    <p class="sr-only" role="status">{{ announcement }}</p>
  </div>
</template>

<style scoped>
/* Collection-only layout; poster surfaces and controls use the shared Movie Card. */
.collection-page{position:relative;z-index:1}
.collection-back{position:absolute;top:30px;left:40px;z-index:2;color:var(--fg);text-decoration:none;font-size:14px;text-shadow:0 2px 12px #000}
.collection-hero{position:relative;min-height:440px}
.collection-backdrop-stage{position:absolute;inset:0 0 auto;z-index:0;height:100vh;overflow:hidden;background:#0a0a0b;pointer-events:none}
.collection-backdrop-stage img{display:block;width:100%;height:100%;object-fit:cover;object-position:center 42%}
.collection-backdrop-stage::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,10,11,.04) 0%,rgba(10,10,11,.08) 64%,rgba(10,10,11,.28) 74%,rgba(10,10,11,.68) 88%,#0a0a0b 100%),linear-gradient(90deg,rgba(10,10,11,.48) 0%,rgba(10,10,11,.2) 35%,rgba(10,10,11,.05) 70%,transparent 100%)}
.collection-heading{display:flex;align-items:flex-end;gap:30px;min-height:440px;padding:110px 40px 40px}
.collection-poster{width:160px;aspect-ratio:2/3;object-fit:cover;border-radius:var(--radius-poster);box-shadow:0 12px 40px #0006}
.collection-heading h1{font-size:clamp(32px,3vw,56px);line-height:1.15;letter-spacing:-.035em;overflow-wrap:anywhere}
.collection-meta{margin-top:14px;color:var(--muted);font-size:14px;line-height:1.6}
.collection-members{padding:0 40px 64px}
.collection-members h2{margin-bottom:20px;font-size:20px;font-weight:650}
.collection-movie-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,190px));gap:24px 20px}
.collection-empty{padding:140px 40px}
.collection-empty h1{font-size:28px}
.collection-empty p{margin-top:14px;color:var(--muted)}
@media(min-width:1920px){.collection-hero,.collection-heading{min-height:520px}.collection-poster{width:190px}}
@media(max-width:900px){.collection-back{left:22px;top:22px}.collection-heading{padding:100px 22px 32px;gap:20px}.collection-members{padding:0 22px 48px}.collection-empty{padding:110px 22px}}

.collection-page { --bg:#0a0a0b; --fg:#f5f5f7; --muted:#a1a1a6; --radius-poster:10px; margin:-32px -40px; font:15px/1.45 -apple-system,BlinkMacSystemFont,'SF Pro Text','PingFang SC','Segoe UI',sans-serif; }
.collection-page h1,.collection-page h2,.collection-page p { margin-top:0; }
.collection-heading h1 { margin-bottom:0; }
.collection-page .collection-meta { margin-top:14px; margin-bottom:0; }
.collection-poster { flex-shrink:0; }
.poster-fallback { display:grid;place-items:center;background:#1c1c1e; }
.sr-only { position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap; }
@media(max-width:900px) { .collection-page { margin:-32px -40px; } }
</style>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import MovieCard from '../components/media/MovieCard.vue'
import MovieContextMenu from '../components/media/MovieContextMenu.vue'
import icons from '../assets/detail-icons.svg?url&no-inline'
import { getMovieDetail } from '../services/movieDetailService'
import { getLibraryMovies } from '../services/movieService'
import { getLibraryCollections, getOwnedCollectionMembers } from '../services/collectionService'
import { mediaSummary } from '../utils/mediaSummary'
import type { MovieDetail } from '../types/movieDetail'
import type { LibraryMovie, WatchStatus } from '../types/movie'
import type { LibraryCollection } from '../types/collection'

const route = useRoute(), router = useRouter()
const detail = ref<MovieDetail | null>(null), loading = ref(true), failed = ref(false)
const library = ref<LibraryMovie[]>([]), collections = ref<LibraryCollection[]>([])
const movie = computed(() => detail.value?.movie)
const metadata = computed(() => detail.value?.metadata)
const collection = computed(() => collections.value.find(c => c.memberMovieIds.includes(movie.value?.id ?? '')))
const shelfMovies = computed(() => collection.value ? getOwnedCollectionMembers(collection.value, library.value) : library.value)
const primaryMeta = computed(() => movie.value ? [movie.value.year, `${Math.floor(movie.value.runtimeMinutes / 60)}小时${movie.value.runtimeMinutes % 60}分钟`, metadata.value?.certification].filter(Boolean).join(' · ') : '')
const specs = computed(() => mediaSummary(metadata.value?.resource ?? null))
const backdropHidden = ref(false), overviewExpanded = ref(false)
const backdrop = computed(() => metadata.value?.backdropUrl)
const failedPortraits = ref<Set<number>>(new Set())
const announcement = ref(''), heroMenuOpen = ref(false)
const heroMenu = ref<HTMLElement>(), heroButton = ref<HTMLElement>()
const peopleShelf = ref<HTMLElement>(), seriesShelf = ref<HTMLElement>()
const edges = ref({ people: [false, false], series: [false, false] })
const menuId = `detail-menu-${useId()}`, menuOpen = ref(false), activeId = ref('')
const trigger = shallowRef<HTMLButtonElement | null>(null)
const activeMovie = computed(() => library.value.find(item => item.id === activeId.value))
const question = ref(''), spoilerMode = ref(false), pendingSpoiler = ref(false)
const answer = ref('可以问我这部影片的风格、观看氛围，或观看前需要知道的背景。')
const quickQuestions = ['这部电影是什么风格？', '适合什么心情观看？', '观看前需要知道什么？', '分析结局']
function ask(value: string) {
  if (!value.trim()) return
  question.value = value
  if (/结局|剧透|真相|死亡|凶手/.test(value) && !spoilerMode.value) { pendingSpoiler.value = true; return }
  pendingSpoiler.value = false
  answer.value = 'AI 影片助手尚未接入，暂时无法回答这个问题。'
}
function confirmSpoiler() { spoilerMode.value = true; ask(question.value) }
function cancelSpoiler() { pendingSpoiler.value = false; answer.value = '已保持无剧透模式。' }
function unavailable(action: 'play' | 'versions') { announcement.value = action === 'play' ? '播放尚未接入，暂时无法启动本机 mpv。' : '媒体版本选择尚未接入，可在下方查看已有媒体信息。'; heroMenuOpen.value = false }
function openDetail(id: string) { void router.push({ name: 'movie-detail', params: { movieId: id } }) }
function favorite(id: string, value: boolean) {
  const item = library.value.find(m => m.id === id)
  if (item) item.favorite = value
  if (movie.value?.id === id) movie.value.favorite = value
  announcement.value = value ? '已加入收藏' : '已取消收藏'
}
function watchStatus(id: string, value: WatchStatus) {
  const item = library.value.find(m => m.id === id)
  if (item) item.watchStatus = value
  if (movie.value?.id === id) movie.value.watchStatus = value
  announcement.value = value === 'watched' ? '已标记为已看' : '已标记为未看'
  heroMenuOpen.value = false
}
function openMenu(payload: { movieId: string; trigger: HTMLButtonElement }) {
  heroMenuOpen.value = false
  menuOpen.value = !(menuOpen.value && activeId.value === payload.movieId)
  activeId.value = payload.movieId; trigger.value = payload.trigger
}
function updateShelves() {
  for (const [key, element] of [['people', peopleShelf.value], ['series', seriesShelf.value]] as const) {
    edges.value[key] = element ? [element.scrollLeft > 1, element.scrollWidth - element.clientWidth - element.scrollLeft > 1] : [false, false]
  }
}
function scrollShelf(kind: 'people' | 'series', direction: number) {
  const element = kind === 'people' ? peopleShelf.value : seriesShelf.value
  element?.scrollBy({ left: direction * 360, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
}
function outside(event: PointerEvent) {
  if (event.target instanceof Node && !heroMenu.value?.contains(event.target) && !heroButton.value?.contains(event.target)) heroMenuOpen.value = false
}
function closeHero() { heroMenuOpen.value = false }
let observer: ResizeObserver | undefined
onMounted(() => {
  document.addEventListener('pointerdown', outside)
  window.addEventListener('scroll', closeHero, true)
  window.addEventListener('resize', closeHero)
  observer = new ResizeObserver(updateShelves)
  if (peopleShelf.value) observer.observe(peopleShelf.value)
  if (seriesShelf.value) observer.observe(seriesShelf.value)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', outside)
  window.removeEventListener('scroll', closeHero, true)
  window.removeEventListener('resize', closeHero)
  observer?.disconnect()
})
watch(() => route.params.movieId, async (id, _, cleanup) => {
  let cancelled = false; cleanup(() => { cancelled = true })
  loading.value = true; failed.value = false; detail.value = null
  heroMenuOpen.value = menuOpen.value = overviewExpanded.value = backdropHidden.value = false
  failedPortraits.value = new Set(); announcement.value = ''; question.value = ''; spoilerMode.value = pendingSpoiler.value = false
  answer.value = '可以问我这部影片的风格、观看氛围，或观看前需要知道的背景。'
  try {
    const [result, movies, groups] = await Promise.all([getMovieDetail(String(id)), getLibraryMovies(), getLibraryCollections()])
    if (cancelled) return
    detail.value = result; library.value = movies; collections.value = groups
  } catch { if (!cancelled) failed.value = true }
  finally {
    if (!cancelled) {
      loading.value = false
      await nextTick()
      if (!cancelled) {
        observer?.disconnect()
        for (const element of [peopleShelf.value, seriesShelf.value]) if (element) { element.scrollLeft = 0; observer?.observe(element) }
        updateShelves()
      }
    }
  }
}, { immediate: true })
</script>

<template>
  <Teleport to="body">
    <div v-if="movie && !loading" class="detail-backdrop-stage" aria-hidden="true">
      <img v-if="backdrop && !backdropHidden" :src="backdrop" alt="" @error="backdropHidden = true" />
    </div>
  </Teleport>
  <div class="movie-detail-page">
    <section v-if="loading || failed || !movie || !metadata" class="hero-content" :aria-busy="loading">
      <div class="hero-copy"><h1 class="movie-title">{{ loading ? '正在加载电影' : failed ? '电影加载失败' : '未找到这部电影' }}</h1><RouterLink class="overview-more" :to="{ name: 'library' }">返回电影资料库</RouterLink></div>
    </section>
    <template v-else>
      <section class="movie-hero" aria-labelledby="movieTitle">
        <RouterLink class="hero-control back-button" :to="{ name: 'library' }" aria-label="返回电影片库"><svg viewBox="0 0 256 256" aria-hidden="true"><use :href="`${icons}#ph-arrow-left`" /></svg></RouterLink>
        <button ref="heroButton" class="hero-control hero-more-button" type="button" :aria-label="`${movie.title}更多操作`" :aria-expanded="heroMenuOpen" aria-controls="heroMenu" @click="menuOpen = false; heroMenuOpen = !heroMenuOpen"><svg viewBox="0 0 256 256" aria-hidden="true"><use :href="`${icons}#ph-dots-three-bold`" /></svg></button>
        <div id="heroMenu" ref="heroMenu" class="hero-menu" :data-open="heroMenuOpen" :inert="!heroMenuOpen" role="group" aria-label="电影操作">
          <button type="button" @click="watchStatus(movie.id, movie.watchStatus === 'watched' ? 'unwatched' : 'watched')">{{ movie.watchStatus === 'watched' ? '标记为未看' : '标记为已看' }}</button>
          <button type="button" @click="unavailable('versions')">查看媒体版本</button>
        </div>
        <div class="hero-content"><div class="hero-copy">
          <h1 id="movieTitle" class="movie-title">{{ movie.title }}</h1><p class="original-title">{{ metadata.originalTitle }}</p>
          <p class="primary-meta">{{ primaryMeta }}</p><div class="secondary-meta"><span>{{ movie.genres.join(' · ') }}</span><span v-if="metadata.resource?.quality" class="quality-label">{{ metadata.resource.quality }}</span></div>
          <div class="hero-actions"><button class="play-button" type="button" @click="unavailable('play')"><svg viewBox="0 0 256 256" aria-hidden="true"><use :href="`${icons}#ph-play-fill`" /></svg><span>播放</span></button><button class="secondary-action" type="button" :aria-label="`${movie.favorite ? '取消收藏' : '收藏'}${movie.title}`" :aria-pressed="movie.favorite" @click="favorite(movie.id, !movie.favorite)"><svg viewBox="0 0 256 256" aria-hidden="true"><use :href="`${icons}#ph-heart`" /></svg></button></div>
          <div class="overview-wrap"><p id="overview" class="overview" :data-expanded="overviewExpanded">{{ metadata.overview || '暂无简介' }}</p><button v-if="metadata.overview && metadata.overview !== '暂无简介'" class="overview-more" type="button" :aria-expanded="overviewExpanded" aria-controls="overview" @click="overviewExpanded = !overviewExpanded">{{ overviewExpanded ? '收起' : '更多' }}</button></div>
        </div></div>
      </section>
      <div class="detail-content">
        <section class="ratings" aria-label="影片评分"><div class="rating"><span class="rating-label">TMDB</span><span class="rating-score">{{ metadata.rating || '暂无评分' }}</span></div></section>
        <section class="detail-section ai-assistant-section" aria-labelledby="aiAssistantTitle"><div class="ai-assistant-panel">
          <div class="ai-assistant-heading"><div class="ai-assistant-title-wrap"><svg viewBox="0 0 256 256" aria-hidden="true"><use :href="`${icons}#ph-sparkle`" /></svg><h2 id="aiAssistantTitle" class="section-title">AI 影片助手</h2></div><span class="spoiler-badge">{{ spoilerMode ? '剧透模式' : '无剧透' }}</span></div>
          <p class="ai-assistant-context">回答与当前影片绑定，并基于片库中的 TMDB 元数据、简介、演职员和语义资料进行检索。默认不会透露关键情节。</p>
          <div class="ai-quick-list" aria-label="快捷问题"><button v-for="item in quickQuestions" :key="item" class="ai-quick-question" type="button" @click="ask(item)">{{ item }}</button></div>
          <div class="ai-assistant-answer" role="status"><strong>{{ pendingSpoiler ? '需要确认剧透' : spoilerMode ? '剧透模式' : '默认无剧透' }}</strong><p>{{ answer }}</p></div>
          <form class="ai-assistant-form" @submit.prevent="ask(question)"><label class="sr-only" for="aiAssistantInput">向 AI 影片助手提问</label><input id="aiAssistantInput" v-model="question" class="ai-assistant-input" maxlength="180" autocomplete="off" placeholder="不剧透地告诉我这部电影的风格和观看前需要知道什么" /><button class="ai-assistant-submit" type="submit">提问</button></form>
          <div v-if="pendingSpoiler" class="spoiler-confirm"><p>这个问题会涉及关键情节或结局。确认后，本页后续回答将进入剧透模式。</p><div class="spoiler-confirm-actions"><button type="button" @click="confirmSpoiler">确认进入剧透模式</button><button class="spoiler-cancel" type="button" @click="cancelSpoiler">保持无剧透</button></div></div>
        </div></section>
        <section v-if="metadata.cast.length" class="detail-section" aria-labelledby="castTitle">
          <div class="section-heading"><h2 id="castTitle" class="section-title">演职员</h2><div v-if="edges.people.some(Boolean)" class="shelf-controls"><button v-for="(visible, index) in edges.people" v-show="visible" :key="index" class="shelf-arrow" type="button" :aria-label="index ? '向右浏览演职员' : '向左浏览演职员'" @click="scrollShelf('people', index ? 1 : -1)"><svg viewBox="0 0 256 256" aria-hidden="true"><use :href="`${icons}#ph-caret-right`" /></svg></button></div></div>
          <div ref="peopleShelf" class="people-shelf" aria-label="演职员列表" @scroll="updateShelves"><article v-for="(person, index) in metadata.cast" :key="index" class="person-card"><img :src="person.portrait || undefined" :alt="person.portrait ? `${person.name} 肖像` : ''" :style="{ visibility: !person.portrait || failedPortraits.has(index) ? 'hidden' : undefined }" @error="failedPortraits.add(index)" /><strong class="person-name">{{ person.name }}</strong><span class="person-role">{{ person.role }}</span></article></div>
        </section>
        <section class="detail-section" aria-labelledby="seriesTitle">
          <div class="section-heading"><h2 id="seriesTitle" class="section-title"><RouterLink v-if="collection" :to="{ name: 'collection-detail', params: { collectionId: collection.id } }">{{ collection.title }} ›</RouterLink><template v-else>电影</template></h2><div v-if="edges.series.some(Boolean)" class="shelf-controls"><button v-for="(visible, index) in edges.series" v-show="visible" :key="index" class="shelf-arrow" type="button" :aria-label="index ? '向右浏览系列影片' : '向左浏览系列影片'" @click="scrollShelf('series', index ? 1 : -1)"><svg viewBox="0 0 256 256" aria-hidden="true"><use :href="`${icons}#ph-caret-right`" /></svg></button></div></div>
          <div ref="seriesShelf" class="series-shelf" aria-label="当前片库电影" @scroll="updateShelves"><MovieCard v-for="item in shelfMovies" :key="item.id" class="series-card" :class="{ current: item.id === movie.id }" :movie="item" :menu-id="menuId" :more-expanded="menuOpen && activeId === item.id" @detail="openDetail" @play="unavailable('play')" @more="openMenu" /></div>
        </section>
        <section class="detail-section" aria-labelledby="mediaTitle"><div class="section-heading"><h2 id="mediaTitle" class="section-title">媒体信息</h2></div><div class="media-panel"><p class="media-source">{{ metadata.sourceName }}<span class="media-source-type">{{ metadata.sourceId ? 'WebDAV' : '' }}</span></p><p class="media-file">{{ metadata.resource?.filename || '暂无媒体版本信息' }}</p><div class="media-specs"><template v-for="(row, index) in specs" :key="index"><div v-if="row.length" class="media-spec-row" :class="index ? 'media-spec-secondary' : 'media-spec-primary'"><span v-for="value in row" :key="value">{{ value }}</span></div></template></div></div></section>
      </div>
    </template>
    <div v-if="announcement" class="detail-notice"><p role="status">{{ announcement }}</p><button type="button" aria-label="关闭提示" @click="announcement = ''">关闭</button></div>
    <MovieContextMenu :id="menuId" :open="menuOpen" :trigger="trigger" :movie-id="activeId" :title="activeMovie?.title ?? ''" :favorite="activeMovie?.favorite ?? false" :watch-status="activeMovie?.watchStatus ?? 'unwatched'" @close="menuOpen = false" @favorite-change="favorite" @watch-status-change="watchStatus" @detail="openDetail" @play="unavailable('play')" @versions="unavailable('versions')" />
  </div>
</template>

<style scoped src="../assets/movie-detail.css"></style>
<style scoped>
/* The prototype scrolls the document while hiding its scrollbar. */
:global(html:has(.movie-detail-page)) { scrollbar-width:none; }
:global(html:has(.movie-detail-page)::-webkit-scrollbar) { display:none;width:0;height:0; }
.movie-detail-page,.detail-backdrop-stage { --bg:#0a0a0b;--panel:#1c1c1e;--fg:#f5f5f7;--accent:#73a9b7;--text-primary:rgba(255,255,255,.92);--text-secondary:rgba(255,255,255,.62);--text-tertiary:rgba(255,255,255,.46);--font-body:-apple-system,BlinkMacSystemFont,'SF Pro Text','PingFang SC','Segoe UI',sans-serif;--font-display:-apple-system,BlinkMacSystemFont,'SF Pro Display','PingFang SC','Segoe UI',sans-serif;--font-mono:'SFMono-Regular',Consolas,monospace;--detail-hero-height:clamp(480px,58vh,620px);--detail-section-gap:36px;--detail-section-gap-tight:24px;--radius-sm:12px;--radius-circle:50%;--radius-nav:10px;--radius-xs:8px;--radius-md:16px;--radius-editorial:14px;--radius-pill:9999px; }
.movie-detail-page { position:relative;z-index:1;margin:-32px -40px;font:15px/1.45 var(--font-body);color:var(--fg); }
h1,h2,h3,p { margin:0; }
button,input { font:inherit; }
button { cursor:pointer; }
svg { display:block;max-width:100%;width:20px;height:20px; }
.hero-control svg,.secondary-action svg,.play-button svg,.shelf-arrow svg,.ai-assistant-title-wrap svg { overflow:visible; }
.original-title { margin-top:6px; }.primary-meta { margin-top:22px; }
.section-title a { color:inherit;text-decoration:none; }
.series-card.current :deep(.poster-art) { outline:2px solid var(--accent);outline-offset:3px; }
.detail-backdrop-stage { position:absolute;inset:0 0 auto;z-index:0;height:var(--detail-hero-height);overflow:hidden;background:var(--bg);pointer-events:none; }
.detail-backdrop-stage img { display:block;width:100%;height:100%;object-fit:cover;object-position:center 42%; }
.detail-backdrop-stage::after { content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,10,11,.04) 0%,rgba(10,10,11,.08) 64%,rgba(10,10,11,.28) 74%,rgba(10,10,11,.68) 88%,var(--bg) 100%),linear-gradient(90deg,rgba(10,10,11,.48) 0%,rgba(10,10,11,.2) 35%,rgba(10,10,11,.05) 70%,transparent 100%); }
.hero-menu { max-height:calc(100dvh - 90px);overflow-y:auto; }
.sr-only { position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap; }
.detail-notice { position:fixed;right:24px;bottom:24px;z-index:90;display:flex;gap:16px;align-items:center;max-width:calc(100vw - 48px);padding:16px;border:1px solid var(--color-hairline);border-radius:14px;background:var(--material-floating-fallback);font-size:13px; }
.detail-notice button { border:0;background:transparent;color:var(--fg);min-height:32px; }
button:active { filter:brightness(.88); }
:is(button,a,input):focus-visible { outline:2px solid var(--accent);outline-offset:3px; }
@media(max-width:900px) { .hero-content { padding-inline:28px; }.detail-content { padding-inline:28px; } }
@media(prefers-reduced-motion:reduce) { *,*::before,*::after { transition:none!important;scroll-behavior:auto!important; } }
:global(html[data-transparency='reduced'] :is(.hero-control, .secondary-action, .hero-menu)) { background: var(--color-surface-2); -webkit-backdrop-filter: none; backdrop-filter: none; }
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  :is(.hero-control, .secondary-action, .hero-menu) { background: var(--color-surface-2); }
}
</style>

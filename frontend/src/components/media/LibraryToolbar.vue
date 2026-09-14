<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import movieIcons from '../../assets/movie-icons.svg?url&no-inline'
import type { LibraryFilters, LibrarySort, LibrarySourceOption, LibraryYear, WatchStatus } from '../../types/movie'

const props = defineProps<{
  filters: LibraryFilters
  sort: LibrarySort
  genreOptions: string[]
  sourceOptions: LibrarySourceOption[]
}>()
const emit = defineEmits<{
  'update:filters': [filters: LibraryFilters]
  'update:sort': [sort: LibrarySort]
  'clear-filters': []
}>()
const toolbar = ref<HTMLDivElement | null>(null)
const open = ref<'filter' | 'sort' | null>(null)
const id = useId()
const availableHeight = ref(560)
const activeCount = computed(() => props.filters.genres.length + props.filters.sourceIds.length
  + Number(props.filters.year !== 'all') + Number(props.filters.status !== 'all'))
const years: { value: LibraryYear; label: string }[] = [
  { value: 'all', label: '全部' }, { value: '2020', label: '2020–' },
  { value: '2010', label: '2010–2019' }, { value: '2000', label: '2000–2009' },
  { value: '1990', label: '1990–1999' }, { value: 'older', label: '更早' },
]
const statuses: { value: 'all' | WatchStatus; label: string }[] = [
  { value: 'all', label: '全部' }, { value: 'unwatched', label: '未看' },
  { value: 'watching', label: '观看中' }, { value: 'watched', label: '已看' },
]
const sorts: { value: LibrarySort; label: string }[] = [
  { value: 'added', label: '最近添加' }, { value: 'title', label: '片名 A–Z' },
  { value: 'year', label: '上映年份' }, { value: 'watched', label: '最近观看' },
  { value: 'duration', label: '时长' },
]
const sortLabel = computed(() => sorts.find(option => option.value === props.sort)?.label)
function toggle(panel: 'filter' | 'sort') {
  availableHeight.value = Math.max(0, window.innerHeight - (toolbar.value?.getBoundingClientRect().bottom ?? 0) - 16)
  open.value = open.value === panel ? null : panel
}
function toggleSelection(key: 'genres' | 'sourceIds', value: string) {
  const selected = props.filters[key]
  emit('update:filters', { ...props.filters,
    [key]: selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value] })
}
function selectSort(value: LibrarySort) {
  emit('update:sort', value)
  open.value = null
}
function close() { open.value = null }
function onOutside(event: PointerEvent) {
  if (event.target instanceof Node && !toolbar.value?.contains(event.target)) close()
}
function onScroll(event: Event) {
  if (event.target instanceof Node && toolbar.value?.contains(event.target)) return
  close()
}
onMounted(() => {
  document.addEventListener('pointerdown', onOutside)
  window.addEventListener('resize', close)
  window.addEventListener('scroll', onScroll, { capture: true, passive: true })
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutside)
  window.removeEventListener('resize', close)
  window.removeEventListener('scroll', onScroll, { capture: true })
})
</script>

<template>
  <div ref="toolbar" class="movie-toolbar" :style="{ '--available-height': `${availableHeight}px` }">
    <div class="toolbar-group">
      <button class="toolbar-button" type="button" :aria-expanded="open === 'filter'"
        :aria-controls="`${id}-filter`" :data-active="activeCount > 0" @click="toggle('filter')">
        <svg viewBox="0 0 256 256" aria-hidden="true"><path d="M230.6,49.53A15.81,15.81,0,0,0,216,40H40A16,16,0,0,0,28.19,66.78L96,141.32V216a8,8,0,0,0,12.29,6.75l32-20A8,8,0,0,0,144,196V141.32l67.81-74.54A15.81,15.81,0,0,0,230.6,49.53ZM130.08,132.58A8,8,0,0,0,128,138v53.57l-16,10V138a8,8,0,0,0-2.08-5.42L40,56H216Z"/></svg>
        <span>{{ activeCount ? `筛选 · ${activeCount}` : '筛选' }}</span>
      </button>
      <div :id="`${id}-filter`" class="popover filter-popover" :data-open="open === 'filter'"
        :inert="open !== 'filter'" :aria-hidden="open !== 'filter'" role="group" aria-label="筛选电影">
        <section class="filter-section"><h2 class="filter-section-title">类型</h2><div class="filter-list">
          <label v-for="genre in genreOptions" :key="genre" class="option-row">
            <span>{{ genre }}</span><input type="checkbox" :name="`${id}-genres`"
              :value="genre" :checked="filters.genres.includes(genre)" @change="toggleSelection('genres', genre)" />
            <span class="option-check"><svg viewBox="0 0 256 256" aria-hidden="true"><use :href="`${movieIcons}#ph-check-circle`" /></svg></span>
          </label>
        </div></section>
        <section class="filter-section"><h2 class="filter-section-title">年份</h2><div class="filter-list">
          <label v-for="option in years" :key="option.value" class="option-row">
            <span>{{ option.label }}</span><input type="radio" :name="`${id}-year`"
              :value="option.value" :checked="filters.year === option.value" @change="emit('update:filters', { ...filters, year: option.value })" />
            <span class="option-check"><svg viewBox="0 0 256 256" aria-hidden="true"><use :href="`${movieIcons}#ph-check-circle`" /></svg></span>
          </label>
        </div></section>
        <section class="filter-section"><h2 class="filter-section-title">状态</h2><div class="filter-list">
          <label v-for="option in statuses" :key="option.value" class="option-row">
            <span>{{ option.label }}</span><input type="radio" :name="`${id}-status`"
              :value="option.value" :checked="filters.status === option.value" @change="emit('update:filters', { ...filters, status: option.value })" />
            <span class="option-check"><svg viewBox="0 0 256 256" aria-hidden="true"><use :href="`${movieIcons}#ph-check-circle`" /></svg></span>
          </label>
        </div></section>
        <section class="filter-section"><h2 class="filter-section-title">来源</h2><div class="filter-list">
          <label v-for="source in sourceOptions" :key="source.id" class="option-row">
            <span>{{ source.name }}</span><input type="checkbox" :name="`${id}-sourceIds`"
              :value="source.id" :checked="filters.sourceIds.includes(source.id)" @change="toggleSelection('sourceIds', source.id)" />
            <span class="option-check"><svg viewBox="0 0 256 256" aria-hidden="true"><use :href="`${movieIcons}#ph-check-circle`" /></svg></span>
          </label>
        </div></section>
        <div class="filter-footer"><button class="quiet-action" type="button" @click="emit('clear-filters')">清除筛选</button></div>
      </div>
    </div>
    <div class="toolbar-group">
      <button class="toolbar-button" type="button" :aria-expanded="open === 'sort'"
        :aria-controls="`${id}-sort`" @click="toggle('sort')">
        <span>{{ sortLabel }}</span><svg class="control-caret" viewBox="0 0 256 256" aria-hidden="true"><path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z"/></svg>
      </button>
      <div :id="`${id}-sort`" class="popover sort-popover" :data-open="open === 'sort'"
        :inert="open !== 'sort'" :aria-hidden="open !== 'sort'" role="group" aria-label="电影排序">
        <button v-for="option in sorts" :key="option.value" class="sort-option" type="button"
          :aria-pressed="sort === option.value" @click="selectSort(option.value)">
          {{ option.label }}<svg viewBox="0 0 256 256" aria-hidden="true"><use :href="`${movieIcons}#ph-check-circle`" /></svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 原型视觉 Token，仅作用于 Toolbar。当前 Shell 文档滚动，采用普通布局。 */
.movie-toolbar {
  --bg: #0a0a0b; --fg: #f5f5f7; --muted: #a1a1a6; --accent: #73a9b7;
  --text-primary: rgba(255,255,255,.92); --text-secondary: rgba(255,255,255,.62);
  --text-tertiary: rgba(255,255,255,.46); --icon-active: #f5f5f7;
  --radius-xs: 8px; --radius-nav: 10px; --radius-md: 16px;
  --line: color-mix(in oklch, #f5f5f7 7%, transparent);
}
button, input { font: inherit; }
button { color: inherit; cursor: pointer; }
svg { display: block; max-width: 100%; }
h2 { margin: 0; }
button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.movie-toolbar{position:relative;z-index:15;display:flex;align-items:center;justify-content:space-between;width:100%;margin:-4px 0 16px;padding:4px 0;background:color-mix(in oklch,var(--bg) 92%,transparent);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
.toolbar-group{position:relative}
.toolbar-button{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 11px;border:1px solid rgba(255,255,255,.08);border-radius:var(--radius-nav);background:rgba(255,255,255,.045);color:var(--text-secondary);font-size:13px;font-weight:500;transition:background .18s ease-out,border-color .18s ease-out,color .18s ease-out}
.toolbar-button:hover,.toolbar-button[aria-expanded="true"]{border-color:rgba(255,255,255,.12);background:rgba(255,255,255,.07);color:var(--fg)}
.toolbar-button[data-active="true"]{color:var(--text-primary)}
.toolbar-button svg{width:15px;height:15px;fill:currentColor}
.control-caret{width:13px!important;height:13px!important;transform:rotate(90deg)}

/* Filter and sort popovers */
.popover{position:absolute;top:calc(100% + 8px);z-index:32;padding:10px;border:1px solid rgba(255,255,255,.1);border-radius:var(--radius-md);background:rgba(28,28,30,.86);box-shadow:0 20px 54px rgba(0,0,0,.44),inset 0 1px 0 rgba(255,255,255,.045);opacity:0;pointer-events:none;-webkit-backdrop-filter:blur(18px) saturate(115%);backdrop-filter:blur(18px) saturate(115%);transform:translateY(-4px);transition:opacity .18s ease-out,transform .18s ease-out}
.popover[data-open="true"]{opacity:1;pointer-events:auto;transform:none}
.filter-popover{left:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px 22px;width:min(390px,calc(100vw - 36px));max-height:min(560px,72vh);overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.18) transparent}
.sort-popover{right:0;width:188px}
.filter-section{min-width:0}
.filter-section-title{padding:4px 7px 6px;color:var(--text-tertiary);font-size:11px;font-weight:600;letter-spacing:.045em}
.filter-list{display:grid}
.option-row{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 18px;align-items:center;min-height:34px;padding:0 7px;border-radius:var(--radius-xs);color:var(--text-secondary);font-size:13px;cursor:pointer;transition:background .18s ease-out,color .18s ease-out}
.option-row:hover{background:rgba(255,255,255,.055);color:var(--fg)}
.option-row input{position:absolute;opacity:0;pointer-events:none}
.option-check{display:grid;place-items:center;color:var(--icon-active);opacity:0}
.option-check svg{width:15px;height:15px;fill:currentColor}
.option-row input:checked~.option-check{opacity:1}
.option-row:has(input:focus-visible){outline:2px solid var(--accent);outline-offset:-1px}
.filter-footer{grid-column:1/-1;display:flex;justify-content:flex-end;border-top:1px solid var(--line);padding:9px 5px 0}
.quiet-action{min-height:32px;padding:0 8px;border:0;border-radius:var(--radius-xs);background:transparent;color:var(--muted);font-size:12px}
.quiet-action:hover{background:rgba(255,255,255,.055);color:var(--fg)}
.sort-option{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:36px;padding:0 9px;border:0;border-radius:var(--radius-xs);background:transparent;color:var(--text-secondary);font-size:13px;text-align:left}
.sort-option:hover,.sort-option[aria-pressed="true"]{background:rgba(255,255,255,.055);color:var(--fg)}
.sort-option svg{width:15px;height:15px;fill:currentColor;opacity:0}
.sort-option[aria-pressed="true"] svg{opacity:1}


.popover { max-height: min(560px, 72vh, var(--available-height)); overflow-y: auto; overscroll-behavior: contain; }
button:active, .option-row:active { background: rgba(255,255,255,.09); }
@supports not (backdrop-filter: blur(1px)) { .popover { background: #1c1c1e; } }
@media (prefers-reduced-transparency: reduce) { .popover { background: #1c1c1e; backdrop-filter: none; } }
@media (prefers-reduced-motion: reduce) {
  .popover, .toolbar-button, .option-row { transition: none; }
  .popover { transform: none; }
}
</style>

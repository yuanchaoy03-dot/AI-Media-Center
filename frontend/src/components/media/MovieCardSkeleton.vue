<template>
  <div class="movie-card-skeleton" aria-hidden="true">
    <div class="skeleton-poster" />
    <div class="skeleton-copy">
      <span class="skeleton-title" />
      <span class="skeleton-meta" />
    </div>
  </div>
</template>

<style scoped>
.movie-card-skeleton { min-width: 0; }
.skeleton-poster { aspect-ratio: 2 / 3; border-radius: 10px; background: linear-gradient(90deg, rgba(255,255,255,.025), rgba(255,255,255,.065), rgba(255,255,255,.025)); background-size: 200% 100%; animation: library-shimmer 1.25s ease-in-out infinite; }
/* 保留原型骨架表面，对齐 MovieCard 的海报比例与 41px 文案区。 */
.skeleton-copy { display: grid; grid-template-rows: 16px 15px; gap: 2px; height: 41px; padding-top: 8px; align-items: center; }
.skeleton-title, .skeleton-meta { display: block; height: 10px; border-radius: var(--radius-pill); background: rgba(255,255,255,.05); }
.skeleton-meta { width: 58%; opacity: .72; }
@keyframes library-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .skeleton-poster { animation: none; } }
</style>

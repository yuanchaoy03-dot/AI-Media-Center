// Navigation and status presentation shared by source overview and detail views.
(() => {
  const getScanStartHref = sourceId =>
    `personal-cinema-scan-task.html?autostart=1&source=${encodeURIComponent(sourceId)}`;

  function sourceStatusMarkup(source) {
    if (source.status === 'scanning') return '<span class="spinner" aria-hidden="true"></span><span>扫描中…</span>';
    if (source.status === 'available') return '<svg aria-hidden="true"><use href="#ph-check-circle"></use></svg><span>可用</span>';
    return '<svg aria-hidden="true"><use href="#ph-x"></use></svg><span>不可用</span>';
  }

  window.PersonalCinemaSourceWorkflow = { getScanStartHref, sourceStatusMarkup };
})();

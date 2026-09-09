(() => {
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(window.location.search);
  const sourceId = params.get('source');
  const source = window.PersonalCinemaMediaSourceMock.getSourceById(sourceId);
  const { getMoviesBySourceId, renderMovieCard } = window.PersonalCinemaLibraryMock;
  const { tasks, getAddedMovies } = window.PersonalCinemaScanMock;
  const { getScanStartHref, sourceStatusMarkup } = window.PersonalCinemaSourceWorkflow;
  const announce = window.PersonalCinemaShell.announce;

  if (!source) {
    $('pageTitle').textContent = '未找到这个媒体来源';
    $('pageSubtitle').textContent = '这个来源可能已移除，或链接不完整。';
    $('sourceMissing').hidden = false;
    return;
  }

  const sourceMovies = getMoviesBySourceId(sourceId).sort((a, b) => b.added - a.added);
  document.title = `${source.name} · Personal Cinema`;
  $('pageTitle').textContent = source.name;
  $('pageSubtitle').textContent = `${source.type} · ${source.location}`;
  $('summaryName').textContent = source.name;
  $('summaryType').textContent = source.type;
  $('summaryStatus').innerHTML = sourceStatusMarkup(source);
  $('summaryAddress').textContent = source.address;
  $('summaryPath').textContent = source.rootPath;
  $('summaryMovieCount').textContent = `${sourceMovies.length} 部电影`;
  $('summaryLastScan').textContent = source.lastScan;
  $('sourceMovieCount').textContent = `${sourceMovies.length} 部`;
  $('editSourceLink').href = `personal-cinema-media-sources.html?edit=${encodeURIComponent(sourceId)}`;
  document.querySelectorAll('[data-start-scan]').forEach(link => { link.href = getScanStartHref(sourceId); });
  $('sourceWorkspace').hidden = false;
  $('recentMediaGrid').replaceChildren(...sourceMovies.map(renderMovieCard));
  $('recentMediaGrid').hidden = sourceMovies.length === 0;
  $('sourceMoviesEmpty').hidden = sourceMovies.length !== 0;

  function renderScans() {
    const sourceTasks = tasks.filter(task => task.sourceId === sourceId);
    $('scanList').replaceChildren(...sourceTasks.map(task => {
      const row = document.createElement('article');
      row.className = 'scan-item';
      row.dataset.taskId = task.id;
      row.innerHTML = '<a class="scan-hit"></a><span class="scan-icon"><svg aria-hidden="true"><use></use></svg></span><span class="scan-copy"><strong></strong><span></span></span><time class="scan-time"></time><svg class="scan-chevron" aria-hidden="true"><use href="#ph-caret-right"></use></svg>';
      const link = row.querySelector('a');
      const query = new URLSearchParams({ state: task.status === 'completed' ? 'complete' : task.status === 'failed' ? 'failed' : 'running', source: sourceId, task: task.id });
      link.href = `personal-cinema-scan-task.html?${query}`;
      link.setAttribute('aria-label', `查看${source.name}${task.time}扫描详情`);
      row.querySelector('.scan-icon use').setAttribute('href', task.status === 'completed' ? '#ph-check-circle' : '#ph-clock-counter-clockwise');
      row.querySelector('strong').textContent = source.name;
      const status = { completed: '扫描完成', pending: '等待首次扫描', running: '扫描中', failed: '扫描未完成' }[task.status] || '扫描记录';
      row.querySelector('.scan-copy > span').textContent = `${status} · 新增 ${getAddedMovies(task).length} 部 · 待确认 ${task.pendingCount ?? 0} 个 · 需要注意 ${task.attentionCount} 个`;
      row.querySelector('time').textContent = task.time;
      return row;
    }));
    $('scanList').hidden = sourceTasks.length === 0;
    $('sourceScansEmpty').hidden = sourceTasks.length !== 0;
  }
  renderScans();
  window.addEventListener('pageshow', event => { if (event.persisted) renderScans(); });
  window.addEventListener('storage', event => {
    if (event.key === null || event.key.startsWith('personalCinema.matching.')) renderScans();
  });

  // Public cards retain their existing detail destination and announcement-only playback.
  const menu = $('moviePreviewMenu');
  let activeMovie = null;
  let menuTrigger = null;
  function openMovie(movie) {
    window.location.href = window.PersonalCinemaLibraryMock.getMovieDetailHref(movie);
  }
  function playMovie(movie) {
    announce(`正在获取当前 PlaybackLocator，并通过 mpv:// 调用 Windows 本机 mpv 播放《${movie.title}》`);
  }
  $('recentMediaGrid').querySelectorAll('.movie-card').forEach(card => {
    const movie = sourceMovies.find(item => item.id === card.dataset.movieId);
    card.querySelector('.poster-detail-hit').addEventListener('click', () => openMovie(movie));
    card.querySelector('.play-mark').addEventListener('click', () => playMovie(movie));
    const more = card.querySelector('.poster-more-mark');
    more.setAttribute('aria-haspopup', 'menu');
    more.setAttribute('aria-expanded', 'false');
    more.setAttribute('aria-controls', menu.id);
    more.addEventListener('click', () => {
      menu.hidePopover();
      if (menuTrigger) menuTrigger.setAttribute('aria-expanded', 'false');
      activeMovie = movie;
      menuTrigger = more;
      menu.showPopover();
      more.setAttribute('aria-expanded', 'true');
      const rect = more.getBoundingClientRect();
      menu.style.left = `${Math.max(12, Math.min(rect.right - menu.offsetWidth, innerWidth - menu.offsetWidth - 12))}px`;
      menu.style.top = `${Math.max(12, Math.min(rect.bottom + 6, innerHeight - menu.offsetHeight - 12))}px`;
      menu.querySelector('button').focus();
    });
  });
  menu.addEventListener('toggle', event => {
    if (event.newState === 'closed' && menuTrigger) menuTrigger.setAttribute('aria-expanded', 'false');
  });
  menu.addEventListener('click', event => {
    const action = event.target.closest('[data-movie-action]');
    if (!action || !activeMovie) return;
    menu.hidePopover();
    menuTrigger?.focus();
    if (action.dataset.movieAction === 'detail') openMovie(activeMovie);
    if (action.dataset.movieAction === 'play') playMovie(activeMovie);
    if (action.dataset.movieAction === 'library') window.location.href = 'personal-cinema-movie-library.html';
  });
  menu.addEventListener('keydown', event => {
    const buttons = [...menu.querySelectorAll('button')];
    const index = buttons.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length].focus();
    }
    if (event.key === 'Tab') menu.hidePopover();
  });
})();

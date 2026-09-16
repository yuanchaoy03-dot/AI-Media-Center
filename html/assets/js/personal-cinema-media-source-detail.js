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
  $('summaryConnection').textContent = source.lastConnection;
  $('summaryMovieCount').textContent = `${sourceMovies.length} 部电影`;
  $('summaryLastScan').textContent = source.lastScan;
  $('sourceMovieCount').textContent = `${sourceMovies.length} 部`;
  $('editSourceLink').href = `personal-cinema-media-sources.html?edit=${encodeURIComponent(sourceId)}`;
  $('sourceWorkspace').hidden = false;
  $('recentMediaGrid').replaceChildren(...sourceMovies.map(renderMovieCard));
  $('recentMediaGrid').hidden = sourceMovies.length === 0;
  $('sourceMoviesEmpty').hidden = sourceMovies.length !== 0;

  const mock = window.PersonalCinemaMediaSourceMock;
  const { escapeHtml, scanLabel } = window.PersonalCinemaSourceWorkflow;
  const notice = $('connectionNotice');
  function renderConfiguration() {
    $('summaryStatus').innerHTML = sourceStatusMarkup(source);
    $('summaryConnection').textContent = source.lastConnection;
    $('scanRootsEmpty').hidden = source.scanRoots.length > 0;
    $('scanRootsList').innerHTML = source.scanRoots.map((root, index) => `<div class="scan-root-row"><div><code>${escapeHtml(root.path)}</code><span>${root.enabled ? '已启用' : '已停用 · 不参与扫描'}</span></div><div class="root-actions"><button class="secondary-action" data-toggle-root="${index}" type="button">${root.enabled ? '停用' : '启用'}</button><button class="quiet-action" data-remove-root="${index}" type="button">移除</button></div></div>`).join('');
    $('addScanRoot').disabled = source.status !== 'available';
    notice.textContent = source.status === 'error' ? source.connectionError : params.has('created') && !source.scanRoots.length ? '来源已创建。尚未配置扫描目录，也未开始扫描。' : source.status === 'testing' ? '正在测试连接（演示）…' : '连接测试仅验证连通性，不代表已扫描或文件可播放。';
    document.querySelectorAll('[data-start-scan]').forEach(link => {
      link.textContent = scanLabel(source);
      link.href = getScanStartHref(sourceId);
    });
  }
  $('scanRootsList').addEventListener('click', event => {
    const toggle = event.target.closest('[data-toggle-root]');
    const remove = event.target.closest('[data-remove-root]');
    if (toggle) { const root = source.scanRoots[Number(toggle.dataset.toggleRoot)]; root.enabled = !root.enabled; }
    if (remove) {
      const index = Number(remove.dataset.removeRoot);
      if (!confirm(`移除扫描目录“${source.scanRoots[index].path}”？后续扫描将不再包含此配置；不会删除云端文件。`)) return;
      source.scanRoots.splice(index, 1);
    }
    mock.persist(); renderConfiguration();
  });
  $('testSourceConnection').addEventListener('click', () => {
    source.status = 'testing'; renderConfiguration(); $('testSourceConnection').disabled = true;
    setTimeout(() => {
      source.status = source.connectionError ? 'error' : 'available'; source.lastConnection = '刚刚';
      mock.persist(); renderConfiguration(); $('testSourceConnection').disabled = false;
    }, 650);
  });
  const directoryDialog = $('directoryDialog');
  let currentPath = '/';
  const selectedPaths = new Set();
  function renderDirectory() {
    $('directoryPath').textContent = currentPath;
    $('directoryUp').disabled = currentPath === '/';
    const configured = source.scanRoots.find(root => root.path === currentPath);
    const selected = selectedPaths.has(currentPath);
    $('selectDirectory').disabled = Boolean(configured);
    $('selectDirectory').textContent = configured ? '已配置此目录' : selected ? '取消选择当前目录' : '选择当前目录';
    $('directorySelectionState').textContent = configured ? `已配置 · ${configured.enabled ? '已启用' : '已停用，可在详情中启用'}` : selected ? '已加入本次选择' : '当前目录尚未选择';
    const children = mock.directories[currentPath] || [];
    $('directoryList').replaceChildren(...children.map(name => {
      const path = `${currentPath === '/' ? '' : currentPath}/${name}`;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'directory-row';
      const existing = source.scanRoots.find(root => root.path === path);
      button.innerHTML = `<svg aria-hidden="true"><use href="#ph-folder"></use></svg><span>${escapeHtml(name)}</span><small>${existing ? '已配置' : selectedPaths.has(path) ? '已选' : '目录'}</small><span aria-hidden="true">›</span>`;
      button.addEventListener('click', () => { currentPath = path; renderDirectory(); }); return button;
    }));
    if (!children.length) { const empty = document.createElement('p'); empty.className = 'source-note'; empty.textContent = '没有子目录。你仍可以选择当前目录。'; $('directoryList').append(empty); }
    $('selectedDirectoryCount').textContent = selectedPaths.size;
    $('selectedDirectories').replaceChildren(...[...selectedPaths].map(path => {
      const button = document.createElement('button'); button.className = 'selected-directory'; button.type = 'button';
      button.textContent = `${path} ×`; button.setAttribute('aria-label', `取消选择 ${path}`);
      button.addEventListener('click', () => { selectedPaths.delete(path); renderDirectory(); }); return button;
    }));
    $('saveDirectories').disabled = !selectedPaths.size;
  }
  $('addScanRoot').addEventListener('click', () => {
    if (source.status !== 'available') return;
    currentPath = '/'; selectedPaths.clear(); renderDirectory(); directoryDialog.showModal();
  });
  $('directoryUp').addEventListener('click', () => { currentPath = currentPath.slice(0, currentPath.lastIndexOf('/')) || '/'; renderDirectory(); });
  $('selectDirectory').addEventListener('click', () => {
    if (selectedPaths.has(currentPath)) selectedPaths.delete(currentPath); else selectedPaths.add(currentPath);
    renderDirectory();
  });
  function cancelDirectory(event) {
    if (selectedPaths.size && !confirm('放弃本次尚未保存的目录选择？')) { event?.preventDefault(); return; }
    directoryDialog.close();
  }
  $('closeDirectory').addEventListener('click', cancelDirectory);
  directoryDialog.addEventListener('cancel', cancelDirectory);
  $('saveDirectories').addEventListener('click', () => {
    if (!selectedPaths.size || source.status !== 'available') return;
    source.scanRoots.push(...[...selectedPaths].filter(path => !source.scanRoots.some(root => root.path === path)).map(path => ({path, enabled:true})));
    mock.persist(); renderConfiguration(); directoryDialog.close();
    notice.textContent = '扫描目录已保存。准备好后，点击“立即扫描”。';
  });
  renderConfiguration();

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
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
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

(() => {
  const $ = id => document.getElementById(id);
  const icon = name => `<svg aria-hidden="true"><use href="#${name}"></use></svg>`;
  const params = new URLSearchParams(window.location.search);
  const { getTask, getAddedMovies, getPendingIds } = window.PersonalCinemaScanMock;
  const scanTask = getTask(params.get('task'), params.get('source'));
  const addedMovies = getAddedMovies(scanTask);
  const requestedTaskId = scanTask.id;
  const sourceProfile = window.PersonalCinemaMediaSourceMock.getSourceById(scanTask.sourceId)
    || { name: '未找到媒体来源', type: 'WebDAV', rootPath: '/' };
  const storageKey = `personalCinema.scan.${requestedTaskId}`;
  const matchingKey = `personalCinema.matching.${requestedTaskId}`;
  const duration = 16000;
  const completedMovies = addedMovies.length;
  const totalFiles = completedMovies + scanTask.pendingIds.length + scanTask.skippedFiles.length;
  const phaseNames = ['连接来源', '扫描目录', '文件名解析', 'TMDB 识别', 'ffprobe 媒体探测', '入库'];
  const phaseNotes = ['WebDAV 已连接', '发现媒体文件', '保留 Edition / Cut', '按片名与年份匹配', 'best-effort 探测', '写入个人片库'];
  let timer = null;

  function parseMovieFilename(filename) {
    const withoutPath = filename.split(/[\\/]/).pop() || filename;
    let working = withoutPath.replace(/\.[a-z0-9]{2,5}$/i, '');
    const editions = [
      [/\bDirectors?[._ -]*Cut\b/i, "Director's Cut"],
      [/\bFinal[._ -]*Cut\b/i, 'Final Cut'],
      [/\bExtended[._ -]*(?:Cut|Edition)\b/i, 'Extended Edition'],
      [/\bTheatrical[._ -]*Cut\b/i, 'Theatrical Cut']
    ];
    let edition = '';
    editions.forEach(([pattern, label]) => {
      if (pattern.test(working)) { edition = label; working = working.replace(pattern, ' '); }
    });
    working = working
      .replace(/-(?!DL\b)[A-Za-z0-9][A-Za-z0-9._-]*$/i, ' ')
      .replace(/[\[\](){}]/g, ' ')
      .replace(/[._]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const yearMatches = [...working.matchAll(/\b(?:19|20)\d{2}\b/g)];
    const yearMatch = yearMatches.at(-1);
    const year = yearMatch?.[0] || '';
    const titleSource = yearMatch ? working.slice(0, yearMatch.index) : working;
    const noise = /^(?:2160p|1080p|720p|uhd|remux|web-?dl|web-?rip|blu-?ray|bdrip|hevc|avc|h\.?26[45]|x26[45]|hdr10\+?|hdr|dolby|vision|dv|truehd|atmos|dts(?:-hd)?|aac|ac3|eac3|ddp?|flac|7\.1|5\.1|10bit)$/i;
    const title = titleSource.split(/\s+/).filter(token => token && !noise.test(token)).join(' ').trim();
    return { title, year, edition };
  }

  window.PersonalCinemaPrototype = { ...(window.PersonalCinemaPrototype || {}), parseMovieFilename };

  $('sourceName').textContent = sourceProfile.name;
  $('taskOverviewTitle').textContent = `${sourceProfile.name} · ${sourceProfile.type}`;
  $('taskRootLabel').textContent = `扫描根路径 ${sourceProfile.rootPath}`;
  $('taskSourceMeta').lastChild.textContent = sourceProfile.name;
  $('taskPathMeta').lastChild.textContent = sourceProfile.rootPath;
  $('taskIdMeta').textContent = `task_id · ${requestedTaskId}`;

  function readJSON(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch { return null; }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch { /* The prototype still works when storage is unavailable. */ }
  }

  let task = readJSON(storageKey);
  let forceComplete = params.get('state') === 'complete';
  let forceFailed = params.get('state') === 'failed';
  if (params.get('autostart') === '1' || !task || task.sourceId !== scanTask.sourceId) {
    task = { id: requestedTaskId, sourceId: scanTask.sourceId, createdAt: Date.now(), status: 'running' };
    writeJSON(storageKey, task);
    if (params.get('autostart') === '1') {
      try { localStorage.removeItem(matchingKey); } catch { /* no-op */ }
      params.delete('autostart');
      const query = params.toString();
      history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    }
  }

  function pendingIds() { return getPendingIds(scanTask); }

  function pendingTotal() { return pendingIds().length; }

  function taskProgress() {
    if (forceFailed) return .46;
    if (forceComplete || task.status === 'completed') return 1;
    return Math.max(0, Math.min(1, (Date.now() - task.createdAt) / duration));
  }

  function activityFor(progress) {
    if (progress < .1) return '正在连接媒体来源……';
    if (progress < .27) return '正在查找电影文件……';
    if (progress < .46) return '正在整理文件信息……';
    if (progress < .58) return '正在识别影片……';
    if (progress < .7) return addedMovies.length ? `正在整理《${addedMovies[0].title}》……` : '正在核对已有文件……';
    if (progress < .84) return '正在读取媒体信息……';
    return '正在加入你的片库……';
  }

  function stateMarkup(state, label) {
    const icons = { completed: 'ph-check-circle', active: 'ph-spinner', degraded: 'ph-warning', failed: 'ph-x-circle' };
    return `${icons[state] ? icon(icons[state]) : '<span class="status-dot" aria-hidden="true"></span>'}<span>${label}</span>`;
  }

  function renderPipeline(progress, completed, failed) {
    const thresholds = [0, .1, .27, .46, .66, .84];
    const activeIndex = thresholds.reduce((last, value, index) => progress >= value ? index : last, 0);
    $('pipeline').innerHTML = phaseNames.map((name, index) => {
      let state = index < activeIndex ? 'completed' : index === activeIndex ? 'active' : 'pending';
      let statusText = state === 'completed' ? '已完成' : state === 'active' ? '进行中' : '等待中';
      if (completed) {
        state = index === 4 && scanTask.degradedMovieId ? 'degraded' : 'completed';
        statusText = state === 'degraded' ? '1 个探测降级' : '已完成';
      }
      if (failed && index === activeIndex) { state = 'failed'; statusText = '失败'; }
      const stateIcon = state === 'completed' ? 'ph-check-circle' : state === 'active' ? 'ph-spinner' : state === 'degraded' ? 'ph-warning' : state === 'failed' ? 'ph-x-circle' : 'ph-clock-counter-clockwise';
      return `<div class="pipeline-step" data-state="${state}"><span class="pipeline-icon">${icon(stateIcon)}</span><span class="pipeline-copy"><strong>${name}</strong><span>${statusText} · ${phaseNotes[index]}</span></span></div>`;
    }).join('');
  }

  function fileStatus(state, label) {
    return `<span class="status-label" data-state="${state}">${stateMarkup(state, label)}</span>`;
  }

  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  function renderFiles(progress, completed) {
    const recognized = completed ? completedMovies : Math.floor(progress * completedMovies);
    $('fileList').innerHTML = addedMovies.slice(0, recognized).map(movie => {
      const result = scanTask.results[movie.id];
      const degraded = movie.id === scanTask.degradedMovieId && (completed || progress >= .76);
      return `<div class="file-row"><span class="file-icon">${icon('ph-file-video')}</span><div class="file-main"><span class="file-name">${escapeHtml(result?.filename || movie.id)}</span><span class="file-result"><strong>${escapeHtml(movie.title)}</strong><span>· ${movie.year}</span></span></div><div class="file-side">${fileStatus(degraded ? 'degraded' : 'completed', degraded ? '探测降级' : '已入库')}<span class="confidence">${degraded ? 'TMDB 识别与入库不受影响' : '唯一高置信度候选'}</span></div></div>`;
    }).join('') + (completed || progress >= .58 ? scanTask.skippedFiles.map(filename => `<div class="file-row"><span class="file-icon">${icon('ph-file-video')}</span><div class="file-main"><span class="file-name">${escapeHtml(filename)}</span><span class="file-result"><strong>未识别为电影</strong><span>· 保持未关联</span></span></div><div class="file-side">${fileStatus('pending', '已跳过')}<span class="confidence">无 TMDB 候选</span></div></div>`).join('') : '');
  }

  $('recognizedMovies').replaceChildren(...addedMovies.map(movie => {
    const card = document.createElement('a');
    card.className = 'movie-card mini-movie';
    card.dataset.movieId = movie.id;
    card.href = movie.detailHref || 'personal-cinema-movie-library.html';
    card.innerHTML = '<span class="poster-art"><img alt="" /></span><span class="poster-copy"><strong class="poster-title"></strong><span class="poster-meta"></span></span>';
    card.querySelector('.poster-art').dataset.fallback = movie.title;
    const image = card.querySelector('img');
    image.src = movie.poster;
    image.alt = `${movie.title}电影海报`;
    image.addEventListener('error', () => { image.hidden = true; });
    card.querySelector('.poster-title').textContent = movie.title;
    const quality = scanTask.results[movie.id]?.quality;
    card.querySelector('.poster-meta').textContent = `${movie.year}${quality ? ` · ${quality}` : ''}`;
    return card;
  }));
  $('degradedMovieTitle').textContent = window.PersonalCinemaLibraryMock.getMovieById(scanTask.degradedMovieId)?.title || '';
  $('skippedIssue').querySelector('strong').textContent = scanTask.skippedFiles[0] || '';

  function renderRecognizedMovies(completed, recognized) {
    const cards = [...$('recognizedMovies').querySelectorAll('.mini-movie')];
    cards.forEach((card, index) => {
      card.hidden = index >= recognized;
    });
    $('recognitionEmpty').hidden = cards.some(card => !card.hidden);
    $('recognitionEmpty').textContent = completed ? '本次没有新增影片，你可以查看现有片库或返回媒体来源。' : '识别到的电影会显示在这里。';
  }

  function renderReviewList() {
    const count = pendingTotal();
    const itemMap = {
      'blade-runner-2049': ['银翼杀手 2049', '无法自动确定对应的影片'],
      'alien-1979': ['异形', '检测到导演剪辑版，需要确认影片信息'],
      'prisoners-2013': ['囚徒', '找到多个相近结果，需要你选择']
    };
    const ids = pendingIds();
    const titles = ids.slice(0, 3).map(id => (itemMap[id] || ['待确认影片'])[0]);
    $('reviewPreviewCount').textContent = String(count);
    $('reviewCountLabel').textContent = `${count} 部影片需要确认`;
    $('reviewList').replaceChildren(...titles.map(title => {
      const item = document.createElement('li');
      item.textContent = title;
      return item;
    }));
    $('reviewRemaining').hidden = count <= titles.length;
    $('reviewRemaining').textContent = count > titles.length ? `还有 ${count - titles.length} 部待确认` : '';
    $('reviewAction').href = `personal-cinema-movie-matching.html?task=${encodeURIComponent(requestedTaskId)}&source=${encodeURIComponent(scanTask.sourceId)}`;
  }

  function renderCounts(progress, completed) {
    const discoveredCandidates = completed ? scanTask.pendingIds : scanTask.pendingIds.slice(0, Math.floor(progress * scanTask.pendingIds.length));
    const pending = discoveredCandidates.filter(id => pendingIds().includes(id)).length;
    const scanned = completed ? totalFiles : Math.min(totalFiles, Math.floor(progress * totalFiles));
    const recognized = completed ? completedMovies : Math.min(completedMovies, Math.floor(progress * completedMovies));
    const skipped = completed || progress >= .58 ? scanTask.skippedFiles.length : 0;
    const degraded = (completed || progress >= .76) && scanTask.degradedMovieId ? 1 : 0;
    const issues = skipped + degraded;

    $('scanProgressCount').textContent = `${scanned} / ${totalFiles} 个文件`;
    $('scanProgressPercent').textContent = `${Math.round(progress * 100)}%`;
    $('userRecognizedCount').textContent = String(recognized);
    $('pendingCount').textContent = String(pending);
    $('issueCount').textContent = String(issues);
    $('foundCount').textContent = String(scanned);
    $('recognizedCount').textContent = String(recognized);
    $('importedCount').textContent = String(recognized);
    $('technicalPendingCount').textContent = String(pending);
    $('resolvedCount').textContent = String(discoveredCandidates.length - pending);
    $('skippedCount').textContent = String(skipped);
    $('degradedCount').textContent = String(degraded);
    $('progressValue').style.width = `${Math.round(progress * 100)}%`;
    $('scanProgress').setAttribute('aria-valuenow', String(Math.round(progress * 100)));
    $('pendingNudgeCount').textContent = `${pending} 部`;
    $('pendingNudgeTitle').textContent = `${pending} 部电影需要确认`;
    $('addedMoviesCount').textContent = `${recognized} 部`;
    $('addedMoviesLinkLabel').textContent = completed ? `查看全部 ${recognized} 部` : '查看全部';
    $('addedMoviesLink').hidden = completed && recognized === 0;
    $('exceptionsCount').textContent = String(issues);
    $('degradedIssue').hidden = degraded === 0;
    $('skippedIssue').hidden = skipped === 0;
    return { pending, recognized, issues };
  }

  function showCompletion(count, issues) {
    $('completionCta').hidden = false;
    $('failureCta').hidden = true;
    $('addedMoviesSection').hidden = false;
    $('pendingNudge').hidden = true;
    $('backgroundNote').hidden = true;
    $('reviewSection').hidden = count === 0;
    $('exceptionsSection').hidden = issues === 0;
    renderReviewList();
    $('libraryCta').hidden = false;
    if (count > 0) {
      $('matchingCta').hidden = false;
      $('matchingCta').textContent = `处理 ${count} 部待确认影片`;
      $('matchingCta').href = `personal-cinema-movie-matching.html?task=${encodeURIComponent(requestedTaskId)}&source=${encodeURIComponent(scanTask.sourceId)}`;
    } else {
      $('matchingCta').hidden = true;
    }
  }

  function render() {
    const progress = taskProgress();
    const completed = progress >= 1 && !forceFailed;
    const failed = forceFailed;
    if (completed && task.status !== 'completed') {
      task.status = 'completed';
      task.completedAt = Date.now();
      writeJSON(storageKey, task);
      window.PersonalCinemaShell?.announce(`扫描完成，${completedMovies} 部电影已加入片库，${pendingTotal()} 部电影需要确认`);
    }

    const counts = renderCounts(progress, completed);
    $('scanContent').dataset.mode = completed ? 'complete' : 'running';
    $('completionSecondary').hidden = !completed || (counts.pending === 0 && counts.issues === 0);
    renderPipeline(progress, completed, failed);
    renderFiles(progress, completed);
    renderRecognizedMovies(completed, counts.recognized);
    const seconds = Math.floor((Date.now() - task.createdAt) / 1000);
    $('elapsedLabel').textContent = completed ? '已完成' : `已运行 00:${String(Math.max(0, seconds)).padStart(2, '0')}`;

    if (completed) {
      document.title = '扫描完成 · Personal Cinema';
      $('pageTitle').textContent = '扫描完成';
      $('pageSubtitle').textContent = sourceProfile.name;
      $('scanHero').dataset.mode = 'complete';
      $('scanHeroTitle').textContent = `${counts.recognized} 部电影已加入你的片库`;
      $('currentActivity').textContent = '你的电影已经整理好了';
      $('headerStatus').dataset.state = 'completed';
      $('headerStatus').innerHTML = stateMarkup('completed', '扫描完成');
      $('taskState').dataset.state = 'completed';
      $('taskState').innerHTML = stateMarkup('completed', '扫描完成');
      $('userRecognizedLabel').textContent = '已加入片库';
      $('pendingLabel').textContent = '待确认';
      $('issueLabel').textContent = '需要注意';
      $('addedMoviesTitle').textContent = '本次新增影片';
      $('addedMoviesHint').hidden = true;
      showCompletion(counts.pending, counts.issues);
      if (timer) { clearInterval(timer); timer = null; }
    } else if (failed) {
      document.title = '扫描未完成 · Personal Cinema';
      $('pageTitle').textContent = '扫描未完成';
      $('pageSubtitle').textContent = sourceProfile.name;
      $('scanHero').dataset.mode = 'running';
      $('scanHeroTitle').textContent = '扫描没有完成';
      $('currentActivity').textContent = 'WebDAV 连接中断，已经处理的结果会保留。';
      $('completionCta').hidden = true;
      $('failureCta').hidden = false;
      $('pendingNudge').hidden = true;
      $('backgroundNote').hidden = true;
      $('addedMoviesSection').hidden = true;
      $('reviewSection').hidden = true;
      $('exceptionsSection').hidden = true;
      $('headerStatus').dataset.state = 'failed';
      $('headerStatus').innerHTML = stateMarkup('failed', '扫描未完成');
      $('taskState').dataset.state = 'failed';
      $('taskState').innerHTML = stateMarkup('failed', '扫描失败');
      if (timer) { clearInterval(timer); timer = null; }
    } else {
      document.title = '扫描媒体来源 · Personal Cinema';
      $('pageTitle').textContent = '扫描媒体来源';
      $('pageSubtitle').textContent = 'Personal Cinema 正在帮你整理电影。';
      $('scanHero').dataset.mode = 'running';
      $('scanHeroTitle').textContent = '正在整理你的电影';
      $('currentActivity').textContent = activityFor(progress);
      $('completionCta').hidden = true;
      $('failureCta').hidden = true;
      $('addedMoviesSection').hidden = false;
      $('reviewSection').hidden = true;
      $('exceptionsSection').hidden = true;
      $('pendingNudge').hidden = counts.pending === 0;
      $('backgroundNote').hidden = false;
      $('headerStatus').dataset.state = 'active';
      $('headerStatus').innerHTML = stateMarkup('active', '扫描中');
      $('taskState').dataset.state = 'active';
      $('taskState').innerHTML = stateMarkup('active', '扫描中');
      $('userRecognizedLabel').textContent = '已识别';
      $('pendingLabel').textContent = '待确认';
      $('issueLabel').textContent = '有问题';
      $('addedMoviesTitle').textContent = '最近识别';
      $('addedMoviesHint').hidden = false;
      $('addedMoviesHint').textContent = '电影正在加入你的片库';
    }
  }

  $('detailsToggle').addEventListener('click', () => {
    const expanded = $('detailsToggle').getAttribute('aria-expanded') !== 'true';
    $('detailsToggle').setAttribute('aria-expanded', String(expanded));
    $('processingDetails').hidden = !expanded;
    $('processingDetailsLabel').textContent = expanded ? '收起处理详情' : '查看处理详情';
    window.PersonalCinemaShell?.announce(expanded ? '已展开处理详情' : '已收起处理详情');
  });

  $('retryScan').addEventListener('click', () => {
    if (timer) clearInterval(timer);
    forceComplete = false;
    forceFailed = false;
    task = { id: requestedTaskId, sourceId: scanTask.sourceId, createdAt: Date.now(), status: 'running' };
    writeJSON(storageKey, task);
    try { localStorage.removeItem(matchingKey); } catch { /* no-op */ }
    params.delete('state');
    params.delete('autostart');
    const query = params.toString();
    history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    render();
    timer = setInterval(render, 600);
    window.PersonalCinemaShell?.announce(`扫描任务 ${requestedTaskId} 已重新开始`);
  });

  // Matching can change while this completed page is cached or open in another tab.
  window.addEventListener('pageshow', event => {
    if (event.persisted) render();
  });
  window.addEventListener('storage', event => {
    if (event.key === matchingKey || event.key === null) render();
  });

  render();
  if (!forceComplete && !forceFailed && task.status !== 'completed') timer = setInterval(render, 600);
})();

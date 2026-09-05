(() => {
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(window.location.search);
  const taskId = params.get('task') || 'scan_20260903_1032';
  const storageKey = `personalCinema.matching.${taskId}`;
  const allIds = ['blade-runner-2049', 'alien-1979', 'prisoners-2013'];
  const items = {
    'blade-runner-2049': {
      id: 'blade-runner-2049', file: 'Blade.Runner.2049.2017.2160p.WEB-DL.mkv', path: '/Movies/Sci-Fi/Blade.Runner.2049.2017.2160p.WEB-DL.mkv',
      parsedTitle: 'Blade Runner 2049', year: '2017', quality: '2160p', edition: '', confidence: 63,
      candidates: [
        { id: 'tmdb-335984', title: '银翼杀手2049', original: 'Blade Runner 2049', year: '2017', genres: '科幻 / 剧情', poster: 'assets/tmdb-poster-blade-runner-2049.jpg' },
        { id: 'tmdb-78', title: '银翼杀手', original: 'Blade Runner', year: '1982', genres: '科幻 / 剧情 / 惊悚', poster: 'assets/tmdb-poster-blade-runner.jpg' },
        { id: 'tmdb-8446', title: '2046', original: '2046', year: '2004', genres: '剧情 / 科幻 / 爱情', poster: 'assets/tmdb-poster-2046.jpg' }
      ], reasons: ['标题高度接近', '年份一致', '原始标题一致']
    },
    'alien-1979': {
      id: 'alien-1979', file: 'Alien.1979.Directors.Cut.1080p.BluRay.mkv', path: '/Movies/Sci-Fi/Alien.1979.Directors.Cut.1080p.BluRay.mkv',
      parsedTitle: 'Alien', year: '1979', quality: '1080p', edition: "Director's Cut", confidence: 71,
      candidates: [
        { id: 'tmdb-348', title: '异形', original: 'Alien', year: '1979', genres: '科幻 / 恐怖', poster: 'assets/tmdb-poster-alien.jpg' },
        { id: 'tmdb-679', title: '异形2', original: 'Aliens', year: '1986', genres: '科幻 / 动作 / 恐怖', poster: 'assets/tmdb-poster-aliens.jpg' },
        { id: 'tmdb-126889', title: '异形：契约', original: 'Alien: Covenant', year: '2017', genres: '科幻 / 恐怖', poster: 'assets/tmdb-poster-alien-covenant.jpg' }
      ], reasons: ['标题完全一致', '年份一致', "保留版本信息 Director's Cut"]
    },
    'prisoners-2013': {
      id: 'prisoners-2013', file: 'Prisoners.2013.1080p.BluRay.x264.mkv', path: '/Movies/Thriller/Prisoners.2013.1080p.BluRay.x264.mkv',
      parsedTitle: 'Prisoners', year: '2013', quality: '1080p', edition: '', confidence: 58,
      candidates: [
        { id: 'tmdb-146233', title: '囚徒', original: 'Prisoners', year: '2013', genres: '剧情 / 惊悚 / 犯罪', poster: 'assets/tmdb-poster-prisoners.jpg' },
        { id: 'tmdb-359940', title: '囚犯', original: 'The Prison', year: '2017', genres: '动作 / 犯罪', poster: 'assets/tmdb-poster-the-prison.jpg' },
        { id: 'tmdb-116613', title: '罪恶之家', original: 'The Captive', year: '2014', genres: '剧情 / 惊悚', poster: 'assets/tmdb-poster-the-captive.jpg' }
      ], reasons: ['原始标题一致', '年份一致', '中文译名无法从文件名验证']
    }
  };

  const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const poster = (source, label) => `<span class="poster-frame" data-fallback="${escapeHtml(label.toUpperCase())}">${source ? `<img src="${source}" alt="${escapeHtml(label)}电影海报" onerror="this.hidden=true" />` : ''}</span>`;
  const announce = message => window.PersonalCinemaShell?.announce(message);
  let state = readState();
  let activeId = '';
  let selectedCandidateId = '';
  let currentCandidates = [];
  let dialogTrigger = null;
  let searchTimer = null;

  function readState() {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (stored && Array.isArray(stored.pendingIds)) {
        return { pendingIds: stored.pendingIds, resolved: Array.isArray(stored.resolved) ? stored.resolved : [] };
      }
    } catch { /* fall through */ }
    return { pendingIds: [...allIds], resolved: [] };
  }

  function pendingIds() { return state.pendingIds; }
  function pendingTotal() { return pendingIds().length; }

  function saveState() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); }
    catch { /* Keep the in-memory flow working. */ }
  }

  function renderList() {
    const pending = pendingIds().map(id => items[id]).filter(Boolean);
    const count = pendingTotal();
    $('matchingCount').innerHTML = `还有 <strong>${count}</strong> 个文件等待确认`;
    $('matchingList').hidden = count === 0;
    $('matchingEmpty').hidden = count !== 0;
    $('matchingList').innerHTML = pending.map(item => {
      const candidate = item.candidates[0];
      return `<article class="match-card" data-item-id="${item.id}">
        <button class="match-card-hit" type="button" data-open-match="${item.id}" aria-label="确认 ${escapeHtml(item.file)} 的影片匹配"></button>
        <span class="match-poster">${poster(candidate.poster, candidate.original)}</span>
        <span class="match-main"><span class="match-file">${escapeHtml(item.file)}</span><span class="parsed-block"><span class="parsed-label">解析结果</span><span class="parsed-title">${escapeHtml(item.parsedTitle)} · ${item.year}</span>${item.edition ? `<span class="parsed-edition">Edition: ${escapeHtml(item.edition)}</span>` : ''}</span></span>
        <span class="candidate-preview"><span class="preview-label">系统候选</span><strong>${escapeHtml(candidate.title)}</strong><span>${escapeHtml(candidate.original)} · ${candidate.year}</span><span class="candidate-score"><span class="status-dot" aria-hidden="true"></span>置信度 ${item.confidence}% · 需要确认</span></span>
        <svg class="match-chevron" aria-hidden="true"><use href="#ph-caret-right"></use></svg>
      </article>`;
    }).join('');
  }

  function renderCandidates(candidates) {
    currentCandidates = candidates;
    if (!candidates.some(candidate => candidate.id === selectedCandidateId)) selectedCandidateId = candidates[0]?.id || '';
    $('candidateList').innerHTML = candidates.map(candidate => `<label class="candidate-option">
      <span class="candidate-thumb">${poster(candidate.poster, candidate.original)}</span>
      <span class="candidate-copy"><strong>${escapeHtml(candidate.title)} / ${escapeHtml(candidate.original)}</strong><span>${candidate.year} · ${escapeHtml(candidate.genres)}</span></span>
      <input class="candidate-radio" type="radio" name="tmdbCandidate" value="${candidate.id}" ${candidate.id === selectedCandidateId ? 'checked' : ''} /><span class="radio-mark" aria-hidden="true"></span>
    </label>`).join('');
  }

  function openDialog(id, trigger = null) {
    const item = items[id];
    if (!item) return;
    activeId = id;
    dialogTrigger = trigger || document.activeElement;
    selectedCandidateId = item.candidates[0].id;
    const likely = item.candidates[0];
    $('dialogFilename').textContent = item.file;
    $('detailFile').textContent = item.file;
    $('detailPath').textContent = item.path;
    $('detailParsedTitle').textContent = item.parsedTitle;
    $('detailYear').textContent = item.year;
    $('detailQuality').textContent = item.quality;
    $('detailEditionRow').hidden = !item.edition;
    $('detailEdition').textContent = item.edition;
    $('likelyPoster').dataset.fallback = likely.original.toUpperCase();
    $('likelyPoster').innerHTML = `<img src="${likely.poster}" alt="${escapeHtml(likely.title)}电影海报" onerror="this.hidden=true" />`;
    $('likelyTitle').textContent = likely.title;
    $('likelyOriginal').textContent = `${likely.original} · ${likely.year}`;
    $('likelyMeta').textContent = likely.genres;
    $('likelyConfidence').innerHTML = `<span class="status-dot" aria-hidden="true"></span>置信度 ${item.confidence}%`;
    $('matchReasons').innerHTML = item.reasons.map(reason => `<span class="reason"><svg aria-hidden="true"><use href="#ph-check-circle"></use></svg>${escapeHtml(reason)}</span>`).join('');
    $('candidateSearch').hidden = true;
    $('candidateQuery').value = `${item.parsedTitle} ${item.year}`;
    $('candidateFeedback').textContent = '按解析标题和年份返回的候选';
    $('confirmMatchButton').disabled = false;
    $('confirmMatchButton').textContent = '确认匹配';
    renderCandidates(item.candidates);
    $('matchingDialogScrim').dataset.open = 'true';
    $('matchingDialog').removeAttribute('inert');
    document.body.dataset.dialogOpen = 'true';
    requestAnimationFrame(() => $('matchingDialogClose').focus());
  }

  function closeDialog(restoreFocus = true) {
    clearTimeout(searchTimer);
    $('matchingDialogScrim').dataset.open = 'false';
    $('matchingDialog').setAttribute('inert', '');
    document.body.dataset.dialogOpen = 'false';
    if (restoreFocus && dialogTrigger instanceof HTMLElement && document.contains(dialogTrigger)) dialogTrigger.focus();
    activeId = '';
  }

  function resolveActive(disposition) {
    const item = items[activeId];
    const candidate = currentCandidates.find(entry => entry.id === selectedCandidateId);
    if (!item) return;
    state.pendingIds = state.pendingIds.filter(id => id !== activeId);
    state.resolved.push({ id: activeId, disposition, candidateId: candidate?.id || null });
    saveState();
    $('confirmMatchButton').disabled = false;
    $('confirmMatchButton').textContent = '确认匹配';
    closeDialog(false);
    renderList();
    const message = disposition === 'matched'
      ? `已将 ${item.file} 匹配为《${candidate?.title || '所选影片'}》`
      : `已将 ${item.file} 标记为非电影`;
    announce(message);
    const nextId = state.pendingIds[0];
    if (nextId) setTimeout(() => openDialog(nextId), 360);
    else announce(`${state.resolved.length} 个待确认影片已全部处理完成`);
  }

  $('matchingList').addEventListener('click', event => {
    const trigger = event.target.closest('[data-open-match]');
    if (trigger) openDialog(trigger.dataset.openMatch, trigger);
  });

  $('candidateList').addEventListener('change', event => {
    if (event.target.matches('input[name="tmdbCandidate"]')) selectedCandidateId = event.target.value;
  });

  $('searchAgainButton').addEventListener('click', () => {
    $('candidateSearch').hidden = false;
    $('candidateFeedback').textContent = '修改片名或年份后重新查询 TMDB';
    requestAnimationFrame(() => { $('candidateQuery').focus(); $('candidateQuery').select(); });
  });

  $('candidateSearch').addEventListener('submit', event => {
    event.preventDefault();
    const item = items[activeId];
    if (!item) return;
    const query = $('candidateQuery').value.trim() || item.parsedTitle;
    const submit = $('candidateSearchSubmit');
    submit.disabled = true;
    submit.textContent = '搜索中…';
    $('candidateFeedback').textContent = `正在搜索“${query}”`;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const extra = { id: `mock-${item.id}`, title: `${item.parsedTitle}：其他结果`, original: item.parsedTitle, year: item.year, genres: 'TMDB 搜索结果', poster: '' };
      const refreshed = [item.candidates[0], extra, ...item.candidates.slice(1)];
      selectedCandidateId = refreshed[0].id;
      renderCandidates(refreshed);
      submit.disabled = false;
      submit.textContent = '搜索';
      $('candidateFeedback').textContent = `已刷新 ${refreshed.length} 个候选 · mock TMDB 搜索`;
      announce('TMDB 候选已刷新');
    }, 720);
  });

  $('confirmMatchButton').addEventListener('click', () => {
    if (!selectedCandidateId) return;
    $('confirmMatchButton').disabled = true;
    $('confirmMatchButton').textContent = '正在确认…';
    setTimeout(() => resolveActive('matched'), 420);
  });

  $('notMovieButton').addEventListener('click', () => resolveActive('not-movie'));

  $('laterButton').addEventListener('click', () => {
    const currentId = activeId;
    if (!currentId) return;
    if (state.pendingIds.length > 1) {
      state.pendingIds = [...state.pendingIds.filter(id => id !== currentId), currentId];
      saveState();
      closeDialog(false);
      renderList();
      announce('已保留此项目，稍后继续处理');
      setTimeout(() => openDialog(state.pendingIds[0]), 260);
    } else {
      closeDialog();
      announce('已保留此项目，稍后继续处理');
    }
  });

  $('matchingDialogClose').addEventListener('click', () => closeDialog());
  $('matchingDialogScrim').addEventListener('click', event => { if (event.target === $('matchingDialogScrim')) closeDialog(); });
  $('matchingDialog').addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const focusable = [...$('matchingDialog').querySelectorAll('button:not([hidden]):not(:disabled),input:not([hidden]):not(:disabled)')]
      .filter(element => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && $('matchingDialogScrim').dataset.open === 'true' && $('searchDialog').dataset.open !== 'true') closeDialog();
  });

  renderList();
  document.querySelectorAll('[data-scan-task-link]').forEach(link => {
    link.href = `personal-cinema-scan-task.html?state=complete&task=${encodeURIComponent(taskId)}`;
  });
  const requestedItem = params.get('item');
  if (requestedItem && state.pendingIds.includes(requestedItem)) requestAnimationFrame(() => openDialog(requestedItem));
})();

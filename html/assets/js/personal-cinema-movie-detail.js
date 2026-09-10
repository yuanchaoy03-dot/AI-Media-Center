(() => {
  const $ = id => document.getElementById(id);
  const announcement = $('detailAnnouncement');
  const detailPage = $('content');
  const { getMovieById, getMovieDetailHref, renderMovieCard, movies } = window.PersonalCinemaLibraryMock;
  const params = new URLSearchParams(window.location.search);
  const movieId = params.get('movie');
  const movie = getMovieById(movieId);
  const setText = (selector, text) => { document.querySelector(selector).textContent = text; };
  const backdrop = document.querySelector('.detail-backdrop-stage img');

  const isPositiveNumber = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
  function formatFileSize(bytes) {
    if (!isPositiveNumber(bytes)) return '';
    // Decimal units: GB / MB, matching the displayed labels.
    return bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${(bytes / 1e6).toFixed(1)} MB`;
  }
  function formatBitrate(bps) {
    if (!isPositiveNumber(bps)) return '';
    return bps < 1e5 ? '<0.1 Mbps' : `${(bps / 1e6).toFixed(1)} Mbps`;
  }
  function formatFrameRate(fps) {
    return isPositiveNumber(fps) ? `${fps} fps` : '';
  }
  function formatVideoCodec(codec) {
    if (typeof codec !== 'string') return '';
    return { hevc: 'HEVC', h265: 'HEVC', 'h.265': 'HEVC', avc: 'H.264', h264: 'H.264', 'h.264': 'H.264', av1: 'AV1' }[codec.toLowerCase()] || codec;
  }
  function getResolutionLabel(video) {
    const { width, height } = video;
    if (!isPositiveNumber(width) || !isPositiveNumber(height)) return '';
    if (width >= 3800 && height >= 2100) return '4K';
    if (width >= 1900 && height >= 1000) return '1080p';
    if (width >= 1200 && height >= 700) return '720p';
    return `${width}×${height}`;
  }
  function getHdrLabel(video) {
    return Array.isArray(video.hdrFormats) ? [...new Set(video.hdrFormats
      .filter(format => typeof format === 'string' && format.trim())
      .map(format => format === 'Dolby Vision' ? 'DV' : format))].join(' / ') : '';
  }
  function getPrimaryAudioTrack(tracks) {
    if (!Array.isArray(tracks)) return null;
    const valid = tracks.filter(track => track && typeof track.codec === 'string' && track.codec.trim());
    const preferred = valid.find(track => track.isDefault === true);
    if (preferred) return preferred;
    const order = ['TrueHD Atmos', 'TrueHD', 'DTS-HD MA', 'DTS-HD', 'E-AC-3 Atmos', 'E-AC-3', 'DTS', 'AC-3', 'AAC'];
    const rank = track => {
      const key = track.atmos && ['TrueHD', 'E-AC-3'].includes(track.codec) ? `${track.codec} Atmos` : track.codec;
      const index = order.indexOf(key);
      return index < 0 ? order.length : index;
    };
    // Equal codec ranks retain probe order; never mutate the resource tracks.
    return valid.reduce((best, track) => !best || rank(track) < rank(best) ? track : best, null);
  }
  function formatAudioTrack(track) {
    return track ? [track.codec, typeof track.channels === 'string' ? track.channels : '', track.atmos ? 'Atmos' : ''].filter(Boolean).join(' ') : '';
  }
  function renderMediaSummary(resource) {
    const video = resource?.video || {};
    const specification = [getResolutionLabel(video), getHdrLabel(video)].filter(Boolean).join(' ');
    const rows = [
      ['primary', [formatFileSize(resource?.sizeBytes), formatVideoCodec(video.codec), specification || resource?.quality, formatAudioTrack(getPrimaryAudioTrack(resource?.audioTracks))]],
      ['secondary', [formatBitrate(video.bitrate), formatFrameRate(video.frameRate), isPositiveNumber(video.bitDepth) ? `${video.bitDepth}-bit` : '']]
    ];
    document.querySelector('.media-specs').replaceChildren(...rows.filter(([, values]) => values.some(Boolean)).map(([level, values]) => {
      const row = document.createElement('div');
      row.className = `media-spec-row media-spec-${level}`;
      row.replaceChildren(...values.filter(Boolean).map(value => {
        const item = document.createElement('span');
        item.textContent = value;
        return item;
      }));
      return row;
    }));
  }
  if (!movie) {
    document.title = '未找到这部电影 · Personal Cinema';
    $('movieMissing').hidden = false;
    document.querySelector('.movie-hero').hidden = true;
    document.querySelector('.detail-content').hidden = true;
    document.querySelector('.detail-backdrop-stage').hidden = true;
  } else {
    document.title = `${movie.title} · Personal Cinema`;
    Object.assign(detailPage.dataset, { movieId: movie.id, title: movie.title, year: movie.year });
    setText('#movieTitle', movie.title);
    setText('.original-title', movie.originalTitle || '');
    const runtime = movie.runtime ? `${Math.floor(movie.runtime / 60)}小时${movie.runtime % 60}分钟` : '';
    setText('.primary-meta', [movie.year, runtime, movie.certification].filter(Boolean).join(' · '));
    const genres = document.createElement('span');
    genres.textContent = (movie.genres || []).join(' · ');
    document.querySelector('.secondary-meta').append(genres);
    setText('#overview', movie.overview || '暂无简介');
    $('overviewMore').hidden = !movie.overview || movie.overview === '暂无简介';
    setText('.rating-score', movie.rating || '暂无评分');
    backdrop.addEventListener('error', () => {
      if (movie.poster && backdrop.getAttribute('src') !== movie.poster) backdrop.src = movie.poster;
      else backdrop.hidden = true;
    });
    if (movie.backdrop || movie.poster) backdrop.src = movie.backdrop || movie.poster;
    else backdrop.hidden = true;
    $('heroMoreButton').setAttribute('aria-label', `${movie.title}更多操作`);
    $('heroMenu').setAttribute('aria-label', `${movie.title}操作`);

    const cast = movie.cast || [];
    $('peopleShelf').closest('section').hidden = !cast.length;
    $('peopleShelf').replaceChildren(...cast.map(person => {
      const card = document.createElement('article');
      card.className = 'person-card';
      card.innerHTML = '<img alt="" /><strong class="person-name"></strong><span class="person-role"></span>';
      const image = card.querySelector('img');
      if (person.portrait) image.src = person.portrait;
      // Match the existing error fallback, preserving the portrait's layout space.
      else image.style.visibility = 'hidden';
      image.alt = person.portrait ? `${person.name} 肖像` : '';
      image.addEventListener('error', () => { image.style.visibility = 'hidden'; });
      card.querySelector('strong').textContent = person.name;
      card.querySelector('span').textContent = person.role;
      return card;
    }));

    const { getCollectionForMovie, getOwnedCollectionMembers, getCollectionDetailHref } = window.PersonalCinemaCollectionMock;
    const collection = getCollectionForMovie(movie.id);
    const shelfMovies = collection ? getOwnedCollectionMembers(collection) : movies;
    if (collection) {
      const link = document.createElement('a');
      link.href = getCollectionDetailHref(collection);
      link.textContent = `${collection.name} ›`;
      link.style.color = 'inherit';
      link.style.textDecoration = 'none';
      $('seriesTitle').replaceChildren(link);
    } else setText('#seriesTitle', '电影');
    $('seriesShelf').setAttribute('aria-label', collection ? `当前片库中的${collection.name}电影` : '我的电影片库');
    $('seriesShelf').replaceChildren(...shelfMovies.map(item => {
      const card = renderMovieCard(item);
      card.className = `series-card${item.id === movie.id ? ' current' : ''}`;
      return card;
    }));

    const source = window.PersonalCinemaMediaSourceMock.getSourceById(movie.sourceId);
    setText('.media-source', source ? source.name : '未知来源');
    if (source?.type) {
      const type = document.createElement('span');
      type.className = 'media-source-type';
      type.textContent = source.type;
      document.querySelector('.media-source').append(type);
    }
    // Resource fields stay in Scan Mock, scoped to this movie's current source.
    const resource = window.PersonalCinemaScanMock.tasks
      .find(task => task.sourceId === movie.sourceId && task.results?.[movie.id])?.results[movie.id];
    setText('.media-file', resource?.filename || '暂无媒体版本信息');
    renderMediaSummary(resource);
    if (resource?.quality) {
      const quality = document.createElement('span');
      quality.className = 'quality-label';
      quality.textContent = resource.quality;
      document.querySelector('.secondary-meta').append(quality);
    }
  }

  function syncMovieState() {
    if (!movie) return;
    detailPage.dataset.status = movie.status;
    detailPage.dataset.favorite = String(movie.favorite);
    $('favoriteButton').setAttribute('aria-pressed', String(movie.favorite));
    $('favoriteButton').setAttribute('aria-label', `${movie.favorite ? '取消收藏' : '收藏'}${movie.title}`);
    $('heroMenu').querySelector('[data-action="watched"]').textContent = movie.status === 'watched' ? '标记为未看' : '标记为已看';
    document.querySelectorAll('.series-card').forEach(card => {
      const item = getMovieById(card.dataset.movieId);
      card.dataset.favorite = String(item.favorite);
      card.dataset.status = item.status;
    });
  }
  syncMovieState();
  const currentMovieTitle = movie?.title || '';
  const heroMoreButton = $('heroMoreButton');
  const heroMenu = $('heroMenu');
  const contextMenu = $('movieContextMenu');
  const favoriteAction = $('favoriteAction');
  const watchedAction = $('watchedAction');
  let activeMovie = null;
  let activeMoreButton = null;

  function closeHeroMenu() {
    heroMenu.dataset.open = 'false';
    heroMenu.setAttribute('inert', '');
    heroMoreButton.setAttribute('aria-expanded', 'false');
  }

  function closeContextMenu() {
    contextMenu.dataset.open = 'false';
    contextMenu.setAttribute('inert', '');
    activeMoreButton?.setAttribute('aria-expanded', 'false');
    activeMoreButton = null;
    activeMovie = null;
  }

  function openContextMenu(button, card) {
    closeHeroMenu();
    closeContextMenu();
    activeMovie = card;
    activeMoreButton = button;
    activeMoreButton.setAttribute('aria-expanded', 'true');
    favoriteAction.querySelector('span').textContent = card.dataset.favorite === 'true' ? '取消收藏' : '加入收藏';
    watchedAction.querySelector('span').textContent = card.dataset.status === 'watched' ? '标记为未看' : '标记为已看';
    contextMenu.removeAttribute('inert');
    contextMenu.dataset.open = 'true';
    const rect = button.getBoundingClientRect();
    const menuRect = contextMenu.getBoundingClientRect();
    const left = Math.min(window.innerWidth - menuRect.width - 10, Math.max(10, rect.right - menuRect.width));
    let top = rect.bottom + 8;
    if (top + menuRect.height > window.innerHeight - 10) top = rect.top - menuRect.height - 8;
    contextMenu.style.left = `${left}px`;
    contextMenu.style.top = `${Math.max(10, top)}px`;
  }

  $('backButton').addEventListener('click', () => {
    window.location.href = 'personal-cinema-movie-library.html';
  });
  $('playButton').addEventListener('click', () => announcement.textContent = `正在获取当前 PlaybackLocator，并通过 mpv:// 调用 Windows 本机 mpv 播放《${currentMovieTitle}》`);
  $('favoriteButton').addEventListener('click', event => {
    const button = event.currentTarget;
    const selected = button.getAttribute('aria-pressed') !== 'true';
    movie.favorite = selected;
    syncMovieState();
    button.setAttribute('aria-pressed', String(selected));
    button.setAttribute('aria-label', selected ? `取消收藏${currentMovieTitle}` : `收藏${currentMovieTitle}`);
    announcement.textContent = selected ? `《${currentMovieTitle}》已加入收藏` : `《${currentMovieTitle}》已取消收藏`;
  });
  $('overviewMore').addEventListener('click', event => {
    const expanded = event.currentTarget.getAttribute('aria-expanded') !== 'true';
    event.currentTarget.setAttribute('aria-expanded', String(expanded));
    event.currentTarget.textContent = expanded ? '收起' : '更多';
    $('overview').dataset.expanded = String(expanded);
  });
  const assistantForm = $('aiAssistantForm');
  const assistantInput = $('aiAssistantInput');
  const assistantAnswer = $('aiAssistantAnswer');
  const spoilerConfirm = $('spoilerConfirm');
  const spoilerModeBadge = $('spoilerModeBadge');
  let spoilerMode = false;
  let pendingSpoilerQuestion = '';

  function renderAssistantAnswer(label, text) {
    assistantAnswer.querySelector('strong').textContent = label;
    assistantAnswer.querySelector('p').textContent = text;
  }

  function answerMovieQuestion(question) {
    const asksForSpoilers = /结局|剧透|真相|死亡|凶手/.test(question);
    if (asksForSpoilers && !spoilerMode) {
      pendingSpoilerQuestion = question;
      spoilerConfirm.hidden = false;
      renderAssistantAnswer('需要确认剧透', `“${question}”可能透露《${currentMovieTitle}》的关键情节。请先明确确认是否进入剧透模式。`);
      return;
    }
    spoilerConfirm.hidden = true;
    const answer = asksForSpoilers
      ? `已在剧透模式下分析《${currentMovieTitle}》的结局结构、人物选择与主题呼应。此处为 RAG 原型状态，正式回答将引用当前影片检索资料。`
      : `《${currentMovieTitle}》的回答将基于当前影片的 TMDB 元数据、简介、演职员与语义资料生成，并保持无剧透。你问的是：“${question}”`;
    renderAssistantAnswer(spoilerMode ? '剧透模式' : '无剧透回答', answer);
    announcement.textContent = `AI 影片助手已回答关于《${currentMovieTitle}》的问题`;
  }

  document.querySelectorAll('[data-ai-question]').forEach(button => button.addEventListener('click', () => answerMovieQuestion(button.dataset.aiQuestion)));
  assistantForm.addEventListener('submit', event => {
    event.preventDefault();
    const question = assistantInput.value.trim();
    if (!question) return assistantInput.focus();
    answerMovieQuestion(question);
  });
  $('confirmSpoiler').addEventListener('click', () => {
    spoilerMode = true;
    spoilerModeBadge.textContent = '剧透模式';
    spoilerConfirm.hidden = true;
    answerMovieQuestion(pendingSpoilerQuestion || '分析结局');
  });
  $('cancelSpoiler').addEventListener('click', () => {
    pendingSpoilerQuestion = '';
    spoilerConfirm.hidden = true;
    renderAssistantAnswer('无剧透', '已保持无剧透模式。可以继续询问影片风格、观看氛围或背景信息。');
    assistantInput.focus();
  });

  heroMoreButton.addEventListener('click', event => {
    event.stopPropagation();
    closeContextMenu();
    const open = heroMenu.dataset.open !== 'true';
    heroMenu.dataset.open = String(open);
    if (open) heroMenu.removeAttribute('inert');
    else heroMenu.setAttribute('inert', '');
    heroMoreButton.setAttribute('aria-expanded', String(open));
  });
  heroMenu.addEventListener('click', event => {
    const action = event.target.closest('[data-action]');
    if (!action) return;
    if (action.dataset.action === 'watched') {
      movie.status = movie.status === 'watched' ? 'unwatched' : 'watched';
      syncMovieState();
      announcement.textContent = `《${currentMovieTitle}》已标记为${movie.status === 'watched' ? '已看' : '未看'}`;
    } else announcement.textContent = `查看《${currentMovieTitle}》的媒体版本`;
    closeHeroMenu();
  });

  const shelfArrows = [...document.querySelectorAll('.shelf-arrow')];
  const controlledShelves = [...new Set(shelfArrows.map(button => $(button.dataset.shelf)).filter(Boolean))];

  function updateShelfControls(shelf) {
    const buttons = shelfArrows.filter(button => button.dataset.shelf === shelf.id);
    const controls = buttons[0]?.closest('.shelf-controls');
    if (!controls) return;
    const maxScrollLeft = Math.max(0, shelf.scrollWidth - shelf.clientWidth);
    const hasOverflow = maxScrollLeft > 1;
    controls.hidden = !hasOverflow;
    buttons.forEach(button => {
      const atBoundary = Number(button.dataset.direction) < 0
        ? shelf.scrollLeft <= 1
        : shelf.scrollLeft >= maxScrollLeft - 1;
      button.hidden = !hasOverflow || atBoundary;
      button.disabled = !hasOverflow || atBoundary;
    });
  }

  function updateShelves() {
    controlledShelves.forEach(updateShelfControls);
  }

  shelfArrows.forEach(button => {
    button.addEventListener('click', () => {
      const shelf = $(button.dataset.shelf);
      shelf.scrollBy({ left: Number(button.dataset.direction) * 360, behavior: 'smooth' });
    });
  });
  controlledShelves.forEach(shelf => shelf.addEventListener('scroll', () => updateShelfControls(shelf), { passive: true }));
  window.addEventListener('resize', updateShelves);
  window.addEventListener('load', updateShelves, { once: true });
  updateShelves();

  document.querySelectorAll('.series-card').forEach(card => {
    card.querySelector('.poster-detail-hit').addEventListener('click', () => {
      window.location.href = getMovieDetailHref(card.dataset.movieId);
    });
    card.querySelector('.play-mark').addEventListener('click', () => announcement.textContent = `正在获取当前 PlaybackLocator，并通过 mpv:// 调用 Windows 本机 mpv 播放《${card.dataset.title}》`);
    const moreButton = card.querySelector('.poster-more-mark');
    moreButton.setAttribute('aria-haspopup', 'menu');
    moreButton.setAttribute('aria-expanded', 'false');
    moreButton.setAttribute('aria-controls', 'movieContextMenu');
    moreButton.addEventListener('click', event => {
      event.stopPropagation();
      openContextMenu(event.currentTarget, card);
    });
  });

  contextMenu.addEventListener('click', event => {
    const action = event.target.closest('[data-menu-action]');
    if (!action || !activeMovie) return;
    const title = activeMovie.dataset.title;
    const selectedMovie = getMovieById(activeMovie.dataset.movieId);
    if (action.dataset.menuAction === 'favorite') {
      selectedMovie.favorite = !selectedMovie.favorite;
      syncMovieState();
      announcement.textContent = `${title}${activeMovie.dataset.favorite === 'true' ? '已加入收藏' : '已取消收藏'}`;
    } else if (action.dataset.menuAction === 'watched') {
      selectedMovie.status = selectedMovie.status === 'watched' ? 'unwatched' : 'watched';
      syncMovieState();
      announcement.textContent = `${title}${activeMovie.dataset.status === 'watched' ? '已标记为已看' : '已标记为未看'}`;
    } else if (action.dataset.menuAction === 'play') {
      announcement.textContent = `正在获取当前 PlaybackLocator，并通过 mpv:// 调用 Windows 本机 mpv 播放《${title}》`;
    } else if (action.dataset.menuAction === 'detail') {
      window.location.href = getMovieDetailHref(selectedMovie);
    } else {
      announcement.textContent = `查看《${title}》的媒体版本`;
    }
    closeContextMenu();
  });

  const searchButton = $('searchButton');
  const searchDialog = $('searchDialog');
  const searchScrim = $('searchScrim');
  const searchInput = $('globalSearch');
  const clearSearch = $('clearSearch');
  const searchCaption = $('searchCaption');
  const searchResultItems = [...$('searchResultList').querySelectorAll('.search-result')];
  const searchEmpty = $('searchEmpty');
  let searchActiveIndex = -1;

  function visibleSearchItems() {
    return searchResultItems.filter(item => !item.hidden);
  }
  function renderSearch(query = '') {
    const normalized = query.trim().toLowerCase();
    let hasResults = false;
    clearSearch.hidden = !searchInput.value;
    searchCaption.textContent = normalized ? '搜索结果' : '最近内容';
    searchResultItems.forEach(item => {
      const matches = !normalized || item.dataset.search.toLowerCase().includes(normalized);
      item.hidden = !matches;
      if (matches) hasResults = true;
      item.removeAttribute('data-active');
    });
    searchEmpty.hidden = hasResults;
    searchActiveIndex = -1;
  }
  function openSearch() {
    closeHeroMenu();
    closeContextMenu();
    renderSearch(searchInput.value);
    searchDialog.removeAttribute('inert');
    searchDialog.dataset.open = 'true';
    searchScrim.dataset.open = 'true';
    searchButton.setAttribute('aria-expanded', 'true');
    document.body.dataset.locked = 'true';
    setTimeout(() => searchInput.focus(), 0);
  }
  function closeSearch() {
    searchDialog.dataset.open = 'false';
    searchDialog.setAttribute('inert', '');
    searchScrim.dataset.open = 'false';
    searchButton.setAttribute('aria-expanded', 'false');
    document.body.dataset.locked = 'false';
  }
  function setSearchActive(index) {
    const items = visibleSearchItems();
    searchActiveIndex = items.length ? Math.max(0, Math.min(index, items.length - 1)) : -1;
    searchResultItems.forEach(item => item.removeAttribute('data-active'));
    if (searchActiveIndex >= 0) items[searchActiveIndex].dataset.active = 'true';
  }

  searchButton.addEventListener('click', openSearch);
  searchScrim.addEventListener('click', closeSearch);
  searchInput.addEventListener('input', () => renderSearch(searchInput.value));
  clearSearch.addEventListener('click', () => {
    searchInput.value = '';
    renderSearch();
    searchInput.focus();
  });
  searchInput.addEventListener('keydown', event => {
    if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return;
    const items = visibleSearchItems();
    if (!items.length) return;
    if (event.key === 'Enter') {
      if (searchActiveIndex >= 0) items[searchActiveIndex].click();
      return;
    }
    event.preventDefault();
    const next = event.key === 'ArrowDown'
      ? (searchActiveIndex + 1) % items.length
      : searchActiveIndex <= 0 ? items.length - 1 : searchActiveIndex - 1;
    setSearchActive(next);
  });
  searchResultItems.forEach(item => item.addEventListener('click', () => {
    closeSearch();
    window.location.href = getMovieDetailHref(item.dataset.movieId);
  }));

  const accountWrap = $('accountWrap');
  const accountButton = $('accountButton');
  accountButton.addEventListener('click', event => {
    event.stopPropagation();
    const open = accountWrap.dataset.open !== 'true';
    accountWrap.dataset.open = String(open);
    accountButton.setAttribute('aria-expanded', String(open));
  });

  const routes = {
    recent: 'personal-cinema-recently-added.html', favorites: 'personal-cinema-favorites.html', unwatched: 'personal-cinema-unwatched.html', watched: 'personal-cinema-watched.html',
    home: 'personal-cinema-app-shell-v2.html',
    movies: 'personal-cinema-movie-library.html',
    ai: 'personal-cinema-ai-discovery.html',
    sources: 'personal-cinema-media-sources.html'
  };
  document.querySelectorAll('[data-route]').forEach(button => {
    button.addEventListener('click', () => {
      const target = routes[button.dataset.route];
      if (target) window.location.href = target;
      else announcement.textContent = `进入${button.textContent.trim()}`;
    });
  });

  document.addEventListener('click', event => {
    if (!contextMenu.contains(event.target) && event.target !== activeMoreButton) closeContextMenu();
    if (!heroMenu.contains(event.target) && event.target !== heroMoreButton) closeHeroMenu();
    if (!accountWrap.contains(event.target)) {
      accountWrap.dataset.open = 'false';
      accountButton.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === '/' && document.activeElement !== searchInput) {
      event.preventDefault();
      openSearch();
    }
    if (event.key === 'Escape') {
      closeSearch();
      closeHeroMenu();
      closeContextMenu();
      accountWrap.dataset.open = 'false';
      accountButton.setAttribute('aria-expanded', 'false');
    }
  });
})();

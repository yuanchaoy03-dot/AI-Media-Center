(() => {
  const $ = id => document.getElementById(id);
  const movieGrid = $('movieGrid');
  const libraryView = document.body.dataset.libraryView || 'movies';
  const movieCards = [...movieGrid.querySelectorAll('.movie-card')];
  const filterButton = $('filterButton');
  const filterButtonLabel = $('filterButtonLabel');
  const filterPopover = $('filterPopover');
  const sortButton = $('sortButton');
  const sortButtonLabel = $('sortButtonLabel');
  const sortPopover = $('sortPopover');
  const clearFilters = $('clearFilters');
  const emptyClearFilters = $('emptyClearFilters');
  const filteredEmpty = $('filteredEmpty');
  const libraryEmpty = $('libraryEmpty');
  const movieLoading = $('movieLoading');
  const movieBatchLoading = $('movieBatchLoading');
  const announcement = $('libraryAnnouncement');
  const contextMenu = $('movieContextMenu');
  const contextScrim = $('movieContextScrim');
  const mobileContextMedia = window.matchMedia('(max-width: 900px), (hover: none)');
  const contextPlayAction = contextMenu.querySelector('[data-menu-action="play"]');
  const contextDetailAction = contextMenu.querySelector('[data-menu-action="detail"]');
  const favoriteAction = $('favoriteAction');
  const watchedAction = $('watchedAction');
  const contextDivider = contextMenu.querySelector('.context-divider');
  const contextVersionsAction = contextMenu.querySelector('[data-menu-action="versions"]');
  let activeMovie = null;
  let activeMoreButton = null;
  let searchActiveIndex = -1;

  function closePopover(popover, button) {
    popover.dataset.open = 'false';
    button.setAttribute('aria-expanded', 'false');
  }

  function closeToolbarPopovers() {
    closePopover(filterPopover, filterButton);
    closePopover(sortPopover, sortButton);
  }

  function togglePopover(popover, button) {
    const open = popover.dataset.open !== 'true';
    closeToolbarPopovers();
    if (open) {
      popover.dataset.open = 'true';
      button.setAttribute('aria-expanded', 'true');
    }
  }

  filterButton.addEventListener('click', event => {
    event.stopPropagation();
    togglePopover(filterPopover, filterButton);
  });
  sortButton.addEventListener('click', event => {
    event.stopPropagation();
    togglePopover(sortPopover, sortButton);
  });
  filterPopover.addEventListener('click', event => event.stopPropagation());
  sortPopover.addEventListener('click', event => event.stopPropagation());

  function selectedValues(name) {
    return [...filterPopover.querySelectorAll(`input[name="${name}"]:checked`)]
      .map(input => input.value);
  }

  function matchesYear(year, bucket) {
    if (bucket === 'all') return true;
    if (bucket === '2020') return year >= 2020;
    if (bucket === '2010') return year >= 2010 && year <= 2019;
    if (bucket === '2000') return year >= 2000 && year <= 2009;
    if (bucket === '1990') return year >= 1990 && year <= 1999;
    return year < 1990;
  }

  function readFilterQuery() {
    return {
      genres: selectedValues('genre'),
      sourceIds: selectedValues('mediaSourceId'),
      year: selectedValues('year')[0] || 'all',
      status: selectedValues('status')[0] || 'all'
    };
  }

  function movieFromCard(card) {
    return {
      title: card.dataset.title,
      year: Number(card.dataset.year),
      genres: card.dataset.genre.split(','),
      status: card.dataset.status,
      sourceId: card.dataset.mediaSourceId,
      favorite: card.dataset.favorite === 'true'
    };
  }

  function collectionMembers(card) {
    try {
      return JSON.parse(card.dataset.members || '[]');
    } catch {
      return [];
    }
  }

  function matchesMovieFilters(movie, filters) {
    const matchesGenre = !filters.genres.length || filters.genres.some(genre => movie.genres.includes(genre));
    const matchesSource = !filters.sourceIds.length || filters.sourceIds.includes(movie.sourceId);
    const matchesStatus = filters.status === 'all' || movie.status === filters.status;
    return matchesGenre && matchesSource && matchesStatus && matchesYear(movie.year, filters.year);
  }

  function matchingMovieForCard(card, filters) {
    const movies = card.dataset.itemType === 'collection'
      ? collectionMembers(card)
      : [movieFromCard(card)];
    return movies.find(movie => {
      const matchesView = libraryView === 'favorites' ? movie.favorite === true
        : libraryView === 'unwatched' ? ['unwatched', 'watching'].includes(movie.status)
        : libraryView === 'watched' ? movie.status === 'watched'
        : true;
      return matchesView && matchesMovieFilters(movie, filters);
    }) || null;
  }

  function rememberMatchedMember(card, movie) {
    if (card.dataset.itemType !== 'collection') return;
    if (movie) {
      card.dataset.matchedMemberTitle = movie.title;
      card.dataset.matchedMemberYear = String(movie.year);
    } else {
      delete card.dataset.matchedMemberTitle;
      delete card.dataset.matchedMemberYear;
    }
  }

  // Prototype-only DOM filtering mirrors one backend query state. Production sends
  // genres/year/status/sourceIds/sort, resets cursor, and reloads the first batch.
  // Target query shape: GET /api/movies with genres, year, status, sourceIds, sort, cursor, and limit.
  function applyFilters() {
    const filters = readFilterQuery();
    const activeCount = filters.genres.length + filters.sourceIds.length + Number(filters.year !== 'all') + Number(filters.status !== 'all');
    let hasVisibleItems = false;

    setMovieBatchLoading(false);
    movieCards.forEach(card => {
      const matchedMovie = matchingMovieForCard(card, filters);
      const matches = Boolean(matchedMovie);
      card.hidden = !matches;
      rememberMatchedMember(card, matchedMovie);
      if (matches) hasVisibleItems = true;
    });

    filterButtonLabel.textContent = activeCount ? `筛选 · ${activeCount}` : '筛选';
    filterButton.dataset.active = String(activeCount > 0);
    filteredEmpty.hidden = hasVisibleItems || movieCards.length === 0;
    movieGrid.hidden = !hasVisibleItems;
  }

  function resetFilters() {
    filterPopover.querySelectorAll('input[type="checkbox"]').forEach(input => input.checked = false);
    filterPopover.querySelector('input[name="year"][value="all"]').checked = true;
    filterPopover.querySelector('input[name="status"][value="all"]').checked = true;
    applyFilters();
  }

  filterPopover.addEventListener('change', applyFilters);
  clearFilters.addEventListener('click', resetFilters);
  emptyClearFilters.addEventListener('click', resetFilters);

  const sortLabels = {
    added: '最近添加',
    title: '片名 A–Z',
    year: '上映年份',
    watched: '最近观看',
    duration: '时长'
  };

  function sortMovies(type) {
    // Production resets pagination and reloads batch one with the current filters and new sort.
    setMovieBatchLoading(false);
    const cards = [...movieCards];
    cards.sort((a, b) => {
      if (type === 'title') return a.dataset.title.localeCompare(b.dataset.title, 'zh-CN');
      if (type === 'year') return Number(b.dataset.year) - Number(a.dataset.year);
      if (type === 'watched') return Number(b.dataset.watched) - Number(a.dataset.watched);
      if (type === 'duration') return Number(b.dataset.duration) - Number(a.dataset.duration);
      return Number(b.dataset.added) - Number(a.dataset.added);
    });
    cards.forEach(card => movieGrid.append(card));
    sortButtonLabel.textContent = sortLabels[type];
    sortPopover.querySelectorAll('.sort-option').forEach(option => {
      option.setAttribute('aria-checked', String(option.dataset.sort === type));
    });
    closePopover(sortPopover, sortButton);
  }

  sortPopover.querySelectorAll('.sort-option').forEach(option => {
    option.addEventListener('click', () => sortMovies(option.dataset.sort));
  });

  function closeContextMenu(restoreFocus = false) {
    const trigger = activeMoreButton;
    contextMenu.dataset.open = 'false';
    contextMenu.setAttribute('inert', '');
    contextScrim.dataset.open = 'false';
    document.body.dataset.actionSheetOpen = 'false';
    activeMoreButton?.setAttribute('aria-expanded', 'false');
    activeMoreButton = null;
    activeMovie = null;
    if (restoreFocus) trigger?.focus();
  }

  function openContextMenu(button, card) {
    closeContextMenu();
    activeMovie = card;
    activeMoreButton = button;
    activeMoreButton.setAttribute('aria-expanded', 'true');
    const isCollection = card.dataset.itemType === 'collection';
    contextMenu.setAttribute('aria-label', isCollection ? '系列操作' : '电影操作');
    contextPlayAction.hidden = isCollection;
    contextDetailAction.querySelector('span').textContent = isCollection ? '查看系列' : '查看详情';
    contextDetailAction.querySelector('use').setAttribute('href', isCollection ? '#ph-caret-right' : '#ph-film-slate');
    favoriteAction.hidden = isCollection;
    watchedAction.hidden = isCollection;
    contextDivider.hidden = isCollection;
    contextVersionsAction.hidden = isCollection;
    if (!isCollection) {
      favoriteAction.querySelector('span').textContent = card.dataset.favorite === 'true' ? '取消收藏' : '收藏';
      watchedAction.querySelector('span').textContent = card.dataset.status === 'watched' ? '标记为未看' : '标记为已看';
    }
    contextMenu.removeAttribute('inert');
    contextMenu.dataset.open = 'true';
    if (mobileContextMedia.matches) {
      contextMenu.style.removeProperty('left');
      contextMenu.style.removeProperty('top');
      contextScrim.dataset.open = 'true';
      document.body.dataset.actionSheetOpen = 'true';
      requestAnimationFrame(() => contextMenu.querySelector('.context-action:not([hidden])')?.focus());
      return;
    }
    const rect = button.getBoundingClientRect();
    const menuRect = contextMenu.getBoundingClientRect();
    const left = Math.min(window.innerWidth - menuRect.width - 10, Math.max(10, rect.right - menuRect.width));
    let top = rect.bottom + 8;
    if (top + menuRect.height > window.innerHeight - 10) top = rect.top - menuRect.height - 8;
    contextMenu.style.left = `${left}px`;
    contextMenu.style.top = `${Math.max(10, top)}px`;
  }

  movieCards
    .filter(card => card.dataset.itemType === 'collection')
    .forEach(card => {
      const artwork = card.querySelector('.poster-art > img');
      artwork.addEventListener('error', () => {
        if (artwork.getAttribute('src') !== card.dataset.defaultMoviePoster) {
          artwork.src = card.dataset.defaultMoviePoster;
        }
      }, { once: true });
    });

  function announceOpenItem(card) {
    if (card.dataset.itemType !== 'collection') {
      announcement.textContent = `进入《${card.dataset.title}》详情`;
      return;
    }

    const hasActiveFilters = filterButton.dataset.active === 'true' || libraryView !== 'movies';
    const movieTitle = hasActiveFilters && card.dataset.matchedMemberTitle
      ? card.dataset.matchedMemberTitle
      : card.dataset.defaultMovie;
    const movieYear = hasActiveFilters && card.dataset.matchedMemberYear
      ? card.dataset.matchedMemberYear
      : card.dataset.defaultYear;
    if (card.dataset.defaultDetailHref && movieTitle === card.dataset.defaultMovie) {
      window.location.href = card.dataset.defaultDetailHref;
      return;
    }
    announcement.textContent = `查看${card.dataset.title}系列，打开${hasActiveFilters ? '匹配' : '默认'}影片《${movieTitle}》（${movieYear}）详情`;
  }

  movieCards.forEach(card => {
    card.querySelector('.poster-detail-hit').addEventListener('click', () => announceOpenItem(card));
    card.querySelector('.play-mark')?.addEventListener('click', () => {
      announcement.textContent = `正在获取当前 PlaybackLocator，并通过 mpv:// 调用 Windows 本机 mpv 播放《${card.dataset.title}》`;
    });
    card.querySelector('.series-mark')?.addEventListener('click', () => announceOpenItem(card));
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
    if (action.dataset.menuAction === 'favorite') {
      activeMovie.dataset.favorite = String(activeMovie.dataset.favorite !== 'true');
      if (libraryView === 'favorites') applyFilters();
      announcement.textContent = `${title}${activeMovie.dataset.favorite === 'true' ? '已加入收藏' : '已取消收藏'}`;
    } else if (action.dataset.menuAction === 'watched') {
      activeMovie.dataset.status = activeMovie.dataset.status === 'watched' ? 'unwatched' : 'watched';
      announcement.textContent = `${title}${activeMovie.dataset.status === 'watched' ? '已标记为已看' : '已标记为未看'}`;
      applyFilters();
    } else if (action.dataset.menuAction === 'play') {
      announcement.textContent = `正在获取当前 PlaybackLocator，并通过 mpv:// 调用 Windows 本机 mpv 播放《${title}》`;
    } else if (action.dataset.menuAction === 'detail') {
      announceOpenItem(activeMovie);
    } else {
      announcement.textContent = `查看《${title}》的媒体版本`;
    }
    closeContextMenu();
  });
  contextScrim.addEventListener('click', () => closeContextMenu());
  window.addEventListener('resize', () => closeContextMenu());

  function renderMovieSkeletons(container, count) {
    if (!container.children.length) {
      container.innerHTML = Array.from({ length: count }, () => '<div class="movie-skeleton"><span class="skeleton-poster"></span><span class="skeleton-line"></span><span class="skeleton-line short"></span></div>').join('');
    }
  }

  function setMovieLibraryLoading(loading) {
    movieLoading.hidden = !loading;
    movieGrid.hidden = loading;
    filteredEmpty.hidden = true;
    if (loading) renderMovieSkeletons(movieLoading, 12);
    if (!loading) applyFilters();
  }

  function setMovieBatchLoading(loading) {
    movieBatchLoading.hidden = !loading;
    movieGrid.setAttribute('aria-busy', String(loading));
    if (loading) renderMovieSkeletons(movieBatchLoading, 6);
  }

  window.setMovieLibraryLoading = setMovieLibraryLoading;
  window.setMovieBatchLoading = setMovieBatchLoading;
  libraryEmpty.hidden = movieCards.length > 0;
  applyFilters();

  const searchButton = $('searchButton');
  const searchDialog = $('searchDialog');
  const searchScrim = $('searchScrim');
  const searchInput = $('globalSearch');
  const clearSearch = $('clearSearch');
  const searchCaption = $('searchCaption');
  const searchResultList = $('searchResultList');
  const searchEmpty = $('searchEmpty');
  const searchResults = searchResultList.parentElement;
  const searchResultItems = [...searchResultList.querySelectorAll('.search-result')];
  const visibleSearchItems = () => searchResultItems.filter(item => !item.hidden);

  function renderSearch(query = '') {
    const q = query.trim().toLowerCase();
    let visible = 0;
    clearSearch.hidden = !searchInput.value;
    searchCaption.textContent = q ? '搜索结果' : '最近内容';
    searchResultItems.forEach((item, index) => {
      const match = q ? item.dataset.search.toLowerCase().includes(q) : index < 5;
      item.hidden = !match;
      if (match) visible += 1;
    });
    searchEmpty.hidden = visible > 0;
    searchResults.scrollTop = 0;
    searchActiveIndex = -1;
    searchResultItems.forEach(item => item.removeAttribute('data-active'));
  }

  function openSearch() {
    closeToolbarPopovers();
    closeContextMenu();
    renderSearch(searchInput.value);
    searchDialog.dataset.open = 'true';
    searchScrim.dataset.open = 'true';
    searchButton.setAttribute('aria-expanded', 'true');
    document.body.dataset.locked = 'true';
    setTimeout(() => searchInput.focus(), 0);
  }

  function closeSearch() {
    searchDialog.dataset.open = 'false';
    searchScrim.dataset.open = 'false';
    searchButton.setAttribute('aria-expanded', 'false');
    document.body.dataset.locked = 'false';
    searchActiveIndex = -1;
  }

  function setSearchActive(index) {
    const items = visibleSearchItems();
    searchActiveIndex = items.length ? Math.max(0, Math.min(index, items.length - 1)) : -1;
    searchResultItems.forEach(item => item.removeAttribute('data-active'));
    if (searchActiveIndex < 0) return;
    const item = items[searchActiveIndex];
    item.dataset.active = 'true';
    const top = item.offsetTop;
    const bottom = top + item.offsetHeight;
    if (top < searchResults.scrollTop) searchResults.scrollTop = top;
    if (bottom > searchResults.scrollTop + searchResults.clientHeight) {
      searchResults.scrollTop = bottom - searchResults.clientHeight;
    }
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
      if (searchActiveIndex >= 0) {
        event.preventDefault();
        items[searchActiveIndex].click();
      }
      return;
    }
    event.preventDefault();
    const next = event.key === 'ArrowDown'
      ? (searchActiveIndex + 1) % items.length
      : searchActiveIndex <= 0 ? items.length - 1 : searchActiveIndex - 1;
    setSearchActive(next);
  });
  searchResultItems.forEach(item => item.addEventListener('click', closeSearch));

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
      if (target) {
        window.location.href = target;
        return;
      }
      if (button.dataset.route === 'sources') announcement.textContent = '进入媒体来源';
    });
  });

  document.addEventListener('click', event => {
    if (!contextMenu.contains(event.target)) closeContextMenu();
    if (!accountWrap.contains(event.target)) {
      accountWrap.dataset.open = 'false';
      accountButton.setAttribute('aria-expanded', 'false');
    }
    if (!event.target.closest('.toolbar-group')) closeToolbarPopovers();
  });

  document.addEventListener('keydown', event => {
    if (event.key === '/' && document.activeElement !== searchInput) {
      event.preventDefault();
      openSearch();
    }
    if (event.key === 'Escape') {
      closeSearch();
      closeToolbarPopovers();
      closeContextMenu(true);
      accountWrap.dataset.open = 'false';
      accountButton.setAttribute('aria-expanded', 'false');
    }
  });
  if (libraryView !== 'movies') {
    sortMovies('added');
    applyFilters();
  }
})();

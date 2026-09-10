(() => {
  const $ = id => document.getElementById(id);
  const { getCollectionById, getOwnedCollectionMembers } = window.PersonalCinemaCollectionMock;
  const { renderMovieCard, getMovieById, getMovieDetailHref } = window.PersonalCinemaLibraryMock;
  const collection = getCollectionById(new URLSearchParams(location.search).get('collection'));
  if (!collection) {
    $('collectionNotFound').hidden = false;
    return;
  }
  const members = getOwnedCollectionMembers(collection);
  document.title = `${collection.name} · Personal Cinema`;
  $('collectionContent').hidden = false;
  $('collectionTitle').textContent = collection.name;
  $('collectionMeta').textContent = [`${members.length} 部电影`, ...new Set(members.flatMap(movie => movie.genres))].join(' · ');
  $('collectionPoster').src = collection.poster;
  $('collectionPoster').alt = `${collection.name}合集海报`;
  // Local Mock fallback only: no official Collection backdrop is available.
  const backdrop = collection.backdrop || members.find(movie => movie.backdrop)?.backdrop;
  if (backdrop) $('collectionBackdrop').src = backdrop;
  else $('collectionBackdrop').hidden = true;
  $('collectionMovies').replaceChildren(...members.map(renderMovieCard));
  $('collectionMoviesEmpty').hidden = members.length > 0;

  const menu = $('movieContextMenu');
  const scrim = $('movieContextScrim');
  const mobile = matchMedia('(max-width: 900px), (hover: none)');
  let activeMovie = null;
  let trigger = null;
  const announce = window.PersonalCinemaShell.announce;
  function closeMenu(restoreFocus = false) {
    menu.dataset.open = 'false';
    menu.setAttribute('inert', '');
    scrim.dataset.open = 'false';
    document.body.dataset.actionSheetOpen = 'false';
    trigger?.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger?.focus();
    trigger = null;
    activeMovie = null;
  }
  $('collectionMovies').addEventListener('click', event => {
    const card = event.target.closest('.movie-card');
    if (!card) return;
    const movie = getMovieById(card.dataset.movieId);
    if (event.target.closest('.poster-detail-hit')) location.href = getMovieDetailHref(movie);
    if (event.target.closest('.play-mark')) announce(`播放《${movie.title}》（Mock）`);
    const button = event.target.closest('.poster-more-mark');
    if (!button) return;
    closeMenu();
    activeMovie = movie;
    trigger = button;
    trigger.setAttribute('aria-expanded', 'true');
    $('favoriteAction').querySelector('span').textContent = movie.favorite ? '取消收藏' : '收藏';
    $('watchedAction').querySelector('span').textContent = movie.status === 'watched' ? '标记为未看' : '标记为已看';
    menu.removeAttribute('inert');
    menu.dataset.open = 'true';
    if (mobile.matches) {
      menu.style.removeProperty('left');
      menu.style.removeProperty('top');
      scrim.dataset.open = 'true';
      document.body.dataset.actionSheetOpen = 'true';
    } else {
      const rect = button.getBoundingClientRect();
      menu.style.left = `${Math.max(10, Math.min(innerWidth - menu.offsetWidth - 10, rect.right - menu.offsetWidth))}px`;
      menu.style.top = `${Math.max(10, Math.min(innerHeight - menu.offsetHeight - 10, rect.bottom + 8))}px`;
    }
    menu.querySelector('button').focus();
  });
  $('collectionMovies').querySelectorAll('.poster-more-mark').forEach(button => {
    button.setAttribute('aria-haspopup', 'menu');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', 'movieContextMenu');
  });
  menu.addEventListener('click', event => {
    const action = event.target.closest('[data-menu-action]')?.dataset.menuAction;
    if (!action || !activeMovie) return;
    if (action === 'detail') location.href = getMovieDetailHref(activeMovie);
    if (action === 'favorite') activeMovie.favorite = !activeMovie.favorite;
    if (action === 'watched') activeMovie.status = activeMovie.status === 'watched' ? 'unwatched' : 'watched';
    const card = [...$('collectionMovies').children].find(card => card.dataset.movieId === activeMovie.id);
    card.dataset.favorite = String(activeMovie.favorite);
    card.dataset.status = activeMovie.status;
    const label = { play: '播放', versions: '查看媒体版本', favorite: activeMovie.favorite ? '已收藏' : '已取消收藏', watched: activeMovie.status === 'watched' ? '已标记为已看' : '已标记为未看' }[action];
    if (label) announce(`${label}《${activeMovie.title}》`);
    closeMenu(true);
  });
  scrim.addEventListener('click', () => closeMenu(true));
  document.addEventListener('click', event => {
    if (!menu.contains(event.target) && !event.target.closest('.poster-more-mark')) closeMenu();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(true); });
  window.addEventListener('resize', () => closeMenu());
})();

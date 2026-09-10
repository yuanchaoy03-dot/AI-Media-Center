// Collection is public series metadata, not a Movie, a favorite or a user-created List.
// User ownership and playback/state belong to Movies; there is no user_collection.
(() => {
  const library = window.PersonalCinemaLibraryMock;
  const collections = [{
    id: 'collection-dune',
    name: '沙丘系列',
    poster: 'assets/tmdb-collection-poster-dune.jpg',
    backdrop: null,
    memberMovieIds: ['movie-dune', 'movie-dune-part-two']
  }];

  function getCollectionById(id) {
    return collections.find(collection => collection.id === id) || null;
  }
  function getCollectionForMovie(movieId) {
    return collections.find(collection => collection.memberMovieIds.includes(movieId)) || null;
  }
  function getCollectionMembers(collectionOrId) {
    const collection = typeof collectionOrId === 'string' ? getCollectionById(collectionOrId) : collectionOrId;
    return (collection?.memberMovieIds || []).map(library.getMovieById).filter(Boolean);
  }
  function getOwnedCollectionMembers(collectionOrId, ownedMovies = library.getOwnedMovies()) {
    const ownedIds = new Set(ownedMovies.map(movie => movie.id));
    return getCollectionMembers(collectionOrId).filter(movie => ownedIds.has(movie.id));
  }
  function getCollectionDetailHref(collectionOrId) {
    const id = typeof collectionOrId === 'string' ? collectionOrId : collectionOrId?.id;
    return `personal-cinema-collection-detail.html?collection=${encodeURIComponent(id || '')}`;
  }

  // Apply only in the unfiltered main library. Ordered Movies determine placement;
  // the first member places a Collection once, without inventing Collection state.
  function aggregateLibraryMovies(ownedMovies = library.getOwnedMovies()) {
    const shown = new Set();
    return ownedMovies.flatMap(movie => {
      const collection = getCollectionForMovie(movie.id);
      if (!collection || getOwnedCollectionMembers(collection, ownedMovies).length < 2) {
        return [{ type: 'movie', movie }];
      }
      if (shown.has(collection.id)) return [];
      shown.add(collection.id);
      return [{ type: 'collection', collection }];
    });
  }

  function renderCollectionCard(collection) {
    const card = document.createElement('article');
    card.className = 'movie-card';
    Object.assign(card.dataset, {
      itemType: 'collection', collectionId: collection.id, odId: collection.id,
      title: collection.name, movieCount: getOwnedCollectionMembers(collection).length
    });
    card.innerHTML = '<div class="poster-art"><img alt="" /><button class="poster-detail-hit" type="button"></button><button class="series-mark" type="button"><svg aria-hidden="true"><use href="#ph-caret-right"></use></svg></button><button class="poster-more-mark" type="button"><svg aria-hidden="true"><use href="#ph-dots-three-bold"></use></svg></button></div><div class="poster-copy"><strong class="poster-title"></strong><span class="poster-meta"></span></div>';
    const image = card.querySelector('img');
    image.src = collection.poster;
    image.alt = `${collection.name}合集海报`;
    card.querySelector('.poster-title').textContent = collection.name;
    card.querySelector('.poster-meta').textContent = `${card.dataset.movieCount} 部电影`;
    card.querySelectorAll('.poster-detail-hit,.series-mark').forEach(button => button.setAttribute('aria-label', `查看${collection.name}合集`));
    card.querySelector('.poster-more-mark').setAttribute('aria-label', `${collection.name}更多操作`);
    return card;
  }

  window.PersonalCinemaCollectionMock = {
    collections, getCollectionById, getCollectionForMovie, getCollectionMembers,
    getOwnedCollectionMembers, getCollectionDetailHref, aggregateLibraryMovies, renderCollectionCard
  };
})();

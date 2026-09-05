(() => {
  const $ = id => document.getElementById(id);
  const announcement = document.querySelector('[data-shell-announcement]');
  const announce = message => {
    if (!announcement) return;
    announcement.textContent = '';
    requestAnimationFrame(() => { announcement.textContent = message; });
  };

  window.PersonalCinemaShell = { announce };

  const routes = {
    home: 'personal-cinema-app-shell-v2.html',
    movies: 'personal-cinema-movie-library.html',
    ai: 'personal-cinema-ai-discovery.html',
    sources: 'personal-cinema-media-sources.html'
  };

  document.querySelectorAll('.sidebar-link[data-route]').forEach(button => {
    button.addEventListener('click', () => {
      const target = routes[button.dataset.route];
      if (target) window.location.href = target;
      else announce(`${button.textContent.trim()}页面入口已准备`);
    });
  });

  document.querySelectorAll('.sidebar-link[data-action="settings"]').forEach(button => {
    button.addEventListener('click', () => announce('设置页面入口已准备'));
  });

  const accountWrap = $('accountWrap');
  const accountButton = $('accountButton');
  if (accountWrap && accountButton) {
    accountButton.addEventListener('click', event => {
      event.stopPropagation();
      const open = accountWrap.dataset.open !== 'true';
      accountWrap.dataset.open = String(open);
      accountButton.setAttribute('aria-expanded', String(open));
    });
    accountWrap.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => {
      accountWrap.dataset.open = 'false';
      accountButton.setAttribute('aria-expanded', 'false');
      announce(button.dataset.action === 'profile' ? '个人资料入口已准备' : '退出登录为演示操作');
    }));
  }

  const searchButton = $('searchButton');
  const searchScrim = $('searchScrim');
  const searchDialog = $('searchDialog');
  const searchInput = $('globalSearch');
  const clearSearch = $('clearSearch');
  const searchCaption = $('searchCaption');
  const searchResultList = $('searchResultList');
  const searchEmpty = $('searchEmpty');
  const searchItems = searchResultList ? [...searchResultList.querySelectorAll('.search-result')] : [];
  let searchIndex = -1;
  let searchTrigger = null;

  const visibleSearchItems = () => searchItems.filter(item => !item.hidden);

  function setSearchActive(index) {
    const visible = visibleSearchItems();
    searchItems.forEach(item => item.removeAttribute('data-active'));
    searchIndex = visible.length ? Math.max(0, Math.min(index, visible.length - 1)) : -1;
    if (searchIndex >= 0) {
      const item = visible[searchIndex];
      item.dataset.active = 'true';
      item.scrollIntoView({ block: 'nearest' });
    }
  }

  function renderSearch() {
    if (!searchInput) return;
    const query = searchInput.value.trim().toLowerCase();
    let visible = 0;
    if (clearSearch) clearSearch.hidden = !searchInput.value;
    if (searchCaption) searchCaption.textContent = query ? '搜索结果' : '最近内容';
    searchItems.forEach((item, index) => {
      const match = query ? item.dataset.search.toLowerCase().includes(query) : index < 5;
      item.hidden = !match;
      if (match) visible += 1;
      item.removeAttribute('data-active');
    });
    if (searchEmpty) searchEmpty.hidden = visible > 0;
    searchIndex = -1;
  }

  function openSearch() {
    if (!searchDialog) return;
    searchTrigger = document.activeElement;
    renderSearch();
    searchDialog.removeAttribute('inert');
    searchDialog.dataset.open = 'true';
    searchScrim.dataset.open = 'true';
    searchButton.setAttribute('aria-expanded', 'true');
    document.body.dataset.locked = 'true';
    setTimeout(() => searchInput.focus(), 0);
  }

  function closeSearch(restoreFocus = true) {
    if (!searchDialog || searchDialog.dataset.open !== 'true') return;
    searchDialog.dataset.open = 'false';
    searchDialog.setAttribute('inert', '');
    searchScrim.dataset.open = 'false';
    searchButton.setAttribute('aria-expanded', 'false');
    document.body.dataset.locked = 'false';
    searchIndex = -1;
    if (restoreFocus && searchTrigger instanceof HTMLElement) searchTrigger.focus();
  }

  if (searchButton && searchDialog) {
    searchButton.addEventListener('click', openSearch);
    searchScrim.addEventListener('click', () => closeSearch());
    searchInput.addEventListener('input', renderSearch);
    clearSearch.addEventListener('click', () => {
      searchInput.value = '';
      renderSearch();
      searchInput.focus();
    });
    searchInput.addEventListener('keydown', event => {
      if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return;
      const visible = visibleSearchItems();
      if (!visible.length) return;
      if (event.key === 'Enter') {
        if (searchIndex >= 0) {
          event.preventDefault();
          visible[searchIndex].click();
        }
        return;
      }
      event.preventDefault();
      const next = event.key === 'ArrowDown'
        ? (searchIndex + 1) % visible.length
        : searchIndex <= 0 ? visible.length - 1 : searchIndex - 1;
      setSearchActive(next);
    });
    searchResultList.addEventListener('click', event => {
      const item = event.target.closest('.search-result');
      if (!item) return;
      if (item.dataset.href) window.location.href = item.dataset.href;
      else {
        announce(`已选择${item.querySelector('strong')?.textContent || '影片'}`);
        closeSearch();
      }
    });
    searchDialog.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const focusable = [...searchDialog.querySelectorAll('button:not([hidden]):not(:disabled),input:not([hidden]):not(:disabled)')]
        .filter(item => item.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
  }

  document.addEventListener('click', event => {
    if (accountWrap && !accountWrap.contains(event.target)) {
      accountWrap.dataset.open = 'false';
      accountButton.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', event => {
    const editable = event.target instanceof HTMLElement && event.target.matches('input,textarea,[contenteditable="true"]');
    if (event.key === '/' && !editable && searchDialog?.dataset.open !== 'true' && document.body.dataset.dialogOpen !== 'true') {
      event.preventDefault();
      openSearch();
    }
    if (event.key === 'Escape') {
      if (searchDialog?.dataset.open === 'true') {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeSearch();
      }
      else if (accountWrap?.dataset.open === 'true') {
        accountWrap.dataset.open = 'false';
        accountButton.setAttribute('aria-expanded', 'false');
        accountButton.focus();
      }
    }
  });
})();

// Shared prototype cards. Existing data attributes remain the Mock source of truth.
// No network request: the prototype also works when opened directly as a local file.
(() => {
  const template = document.createElement('template');
  template.innerHTML = `
<article class="movie-card" data-title="星际穿越" data-year="2014" data-genre="科幻,剧情,冒险" data-status="watching" data-media-source-id="source-home-nas" data-added="15" data-watched="15" data-duration="169" data-favorite="true" data-od-id="movie-interstellar" data-rating="8.5" data-backdrop="assets/tmdb-backdrop-interstellar.jpg"><div class="poster-art"><img src="assets/tmdb-poster-interstellar.jpg" alt="星际穿越 TMDB 官方电影海报" /><button class="poster-detail-hit" type="button" aria-label="查看星际穿越详情"></button><button class="play-mark" type="button" aria-label="播放星际穿越"><svg aria-hidden="true"><use href="#ph-play-fill"></use></svg></button><button class="poster-more-mark" type="button" aria-label="星际穿越更多操作"><svg aria-hidden="true"><use href="#ph-dots-three-bold"></use></svg></button></div><div class="poster-copy"><strong class="poster-title">星际穿越</strong><span class="poster-meta">2014 · 科幻</span></div></article>
        <article class="movie-card" data-item-type="collection" data-collection-id="dune" data-movie-count="2" data-members='[{"title":"沙丘","added":14,"watched":13,"duration":155,"year":2021,"genres":["科幻","冒险"],"status":"watched","sourceId":"source-home-nas","poster":"assets/tmdb-poster-dune.jpg","backdrop":"assets/tmdb-backdrop-dune.jpg","id":"movie-dune","rating":"7.8"},{"title":"沙丘2","added":8,"watched":0,"duration":166,"year":2024,"genres":["科幻","冒险"],"status":"unwatched","sourceId":"source-home-nas","poster":"assets/tmdb-poster-dune-part-two.jpg","backdrop":"assets/tmdb-backdrop-dune-part-two.jpg","id":"movie-dune-part-two","rating":"8.1"}]' data-collection-poster="assets/tmdb-collection-poster-dune.jpg" data-default-movie="沙丘" data-default-year="2021" data-default-movie-poster="assets/tmdb-poster-dune.jpg" data-default-movie-backdrop="assets/tmdb-backdrop-dune.jpg" data-title="沙丘" data-year="2021" data-genre="科幻,冒险" data-status="mixed" data-media-source-id="source-home-nas" data-added="14" data-watched="13" data-duration="155" data-od-id="collection-dune"><div class="poster-art"><img src="assets/tmdb-collection-poster-dune.jpg" alt="沙丘系列 TMDB 合集海报" /><button class="poster-detail-hit" type="button" aria-label="查看沙丘系列"></button><button class="series-mark" type="button" aria-label="查看沙丘系列"><svg aria-hidden="true"><use href="#ph-caret-right"></use></svg></button><button class="poster-more-mark" type="button" aria-label="沙丘系列更多操作"><svg aria-hidden="true"><use href="#ph-dots-three-bold"></use></svg></button></div><div class="poster-copy"><strong class="poster-title">沙丘</strong><span class="poster-meta">2 部电影</span></div></article>
        <article class="movie-card" data-title="银翼杀手2049" data-year="2017" data-genre="科幻,剧情" data-status="watching" data-media-source-id="source-home-nas" data-added="13" data-watched="12" data-duration="164" data-favorite="true" data-od-id="movie-blade-runner-2049" data-rating="7.6" data-backdrop="assets/tmdb-backdrop-blade-runner-2049.jpg"><div class="poster-art"><img src="assets/tmdb-poster-blade-runner-2049.jpg" alt="银翼杀手2049 TMDB 官方电影海报" /><button class="poster-detail-hit" type="button" aria-label="查看银翼杀手2049详情"></button><button class="play-mark" type="button" aria-label="播放银翼杀手2049"><svg aria-hidden="true"><use href="#ph-play-fill"></use></svg></button><button class="poster-more-mark" type="button" aria-label="银翼杀手2049更多操作"><svg aria-hidden="true"><use href="#ph-dots-three-bold"></use></svg></button></div><div class="poster-copy"><strong class="poster-title">银翼杀手2049</strong><span class="poster-meta">2017 · 科幻</span></div></article>
        <article class="movie-card" data-title="降临" data-year="2016" data-genre="剧情,科幻,悬疑" data-status="watching" data-media-source-id="source-alist" data-added="12" data-watched="11" data-duration="116" data-favorite="true" data-od-id="movie-arrival" data-rating="7.6" data-backdrop="assets/tmdb-backdrop-arrival.jpg"><div class="poster-art"><img src="assets/tmdb-poster-arrival.jpg" alt="降临 TMDB 官方电影海报" /><button class="poster-detail-hit" type="button" aria-label="查看降临详情"></button><button class="play-mark" type="button" aria-label="播放降临"><svg aria-hidden="true"><use href="#ph-play-fill"></use></svg></button><button class="poster-more-mark" type="button" aria-label="降临更多操作"><svg aria-hidden="true"><use href="#ph-dots-three-bold"></use></svg></button></div><div class="poster-copy"><strong class="poster-title">降临</strong><span class="poster-meta">2016 · 科幻</span></div></article>
        <article class="movie-card" data-title="奥本海默" data-year="2023" data-genre="剧情,历史" data-status="watching" data-media-source-id="source-nextcloud" data-added="11" data-watched="14" data-duration="181" data-favorite="false" data-od-id="movie-oppenheimer" data-rating="8.0" data-backdrop="assets/tmdb-backdrop-oppenheimer.jpg"><div class="poster-art"><img src="assets/tmdb-poster-oppenheimer.jpg" alt="奥本海默 TMDB 官方电影海报" /><button class="poster-detail-hit" type="button" aria-label="查看奥本海默详情"></button><button class="play-mark" type="button" aria-label="播放奥本海默"><svg aria-hidden="true"><use href="#ph-play-fill"></use></svg></button><button class="poster-more-mark" type="button" aria-label="奥本海默更多操作"><svg aria-hidden="true"><use href="#ph-dots-three-bold"></use></svg></button></div><div class="poster-copy"><strong class="poster-title">奥本海默</strong><span class="poster-meta">2023 · 剧情</span></div></article>
        <article class="movie-card" data-title="新蝙蝠侠" data-year="2022" data-genre="犯罪,悬疑,剧情" data-status="watched" data-media-source-id="source-home-nas" data-added="10" data-watched="10" data-duration="176" data-favorite="false" data-od-id="movie-the-batman" data-rating="7.7" data-backdrop="assets/tmdb-backdrop-the-batman.jpg"><div class="poster-art"><img src="assets/tmdb-poster-the-batman.jpg" alt="新蝙蝠侠 TMDB 官方电影海报" /><button class="poster-detail-hit" type="button" aria-label="查看新蝙蝠侠详情"></button><button class="play-mark" type="button" aria-label="播放新蝙蝠侠"><svg aria-hidden="true"><use href="#ph-play-fill"></use></svg></button><button class="poster-more-mark" type="button" aria-label="新蝙蝠侠更多操作"><svg aria-hidden="true"><use href="#ph-dots-three-bold"></use></svg></button></div><div class="poster-copy"><strong class="poster-title">新蝙蝠侠</strong><span class="poster-meta">2022 · 悬疑</span></div></article>
        <article class="movie-card" data-title="盗梦空间" data-year="2010" data-genre="动作,科幻,冒险" data-status="watching" data-media-source-id="source-alist" data-added="9" data-watched="9" data-duration="148" data-favorite="true" data-od-id="movie-inception" data-rating="8.4" data-backdrop="assets/tmdb-backdrop-inception.jpg"><div class="poster-art"><img src="assets/tmdb-poster-inception.jpg" alt="盗梦空间 TMDB 官方电影海报" /><button class="poster-detail-hit" type="button" aria-label="查看盗梦空间详情"></button><button class="play-mark" type="button" aria-label="播放盗梦空间"><svg aria-hidden="true"><use href="#ph-play-fill"></use></svg></button><button class="poster-more-mark" type="button" aria-label="盗梦空间更多操作"><svg aria-hidden="true"><use href="#ph-dots-three-bold"></use></svg></button></div><div class="poster-copy"><strong class="poster-title">盗梦空间</strong><span class="poster-meta">2010 · 科幻</span></div></article>
        <article class="movie-card" data-title="囚徒" data-year="2013" data-genre="剧情,悬疑,犯罪" data-status="watching" data-media-source-id="source-alist" data-added="7" data-watched="8" data-duration="153" data-favorite="false" data-od-id="movie-prisoners" data-rating="8.1"><div class="poster-art"><img src="assets/tmdb-poster-prisoners.jpg" alt="囚徒 TMDB 官方电影海报" /><button class="poster-detail-hit" type="button" aria-label="查看囚徒详情"></button><button class="play-mark" type="button" aria-label="播放囚徒"><svg aria-hidden="true"><use href="#ph-play-fill"></use></svg></button><button class="poster-more-mark" type="button" aria-label="囚徒更多操作"><svg aria-hidden="true"><use href="#ph-dots-three-bold"></use></svg></button></div><div class="poster-copy"><strong class="poster-title">囚徒</strong><span class="poster-meta">2013 · 悬疑</span></div></article>
        <article class="movie-card" data-title="1917" data-year="2019" data-genre="战争,剧情" data-status="watched" data-media-source-id="source-nextcloud" data-added="6" data-watched="7" data-duration="119" data-favorite="false" data-od-id="movie-1917" data-rating="8.0"><div class="poster-art"><img src="assets/tmdb-poster-1917.jpg" alt="1917 TMDB 官方电影海报" /><button class="poster-detail-hit" type="button" aria-label="查看1917详情"></button><button class="play-mark" type="button" aria-label="播放1917"><svg aria-hidden="true"><use href="#ph-play-fill"></use></svg></button><button class="poster-more-mark" type="button" aria-label="1917更多操作"><svg aria-hidden="true"><use href="#ph-dots-three-bold"></use></svg></button></div><div class="poster-copy"><strong class="poster-title">1917</strong><span class="poster-meta">2019 · 剧情</span></div></article>
        <article class="movie-card" data-title="疯狂的麦克斯4：狂暴之路" data-year="2015" data-genre="动作,冒险,科幻" data-status="unwatched" data-media-source-id="source-home-nas" data-added="5" data-watched="0" data-duration="120" data-favorite="true" data-od-id="movie-mad-max-fury-road" data-rating="7.6"><div class="poster-art"><img src="assets/tmdb-poster-mad-max-fury-road.jpg" alt="疯狂的麦克斯4：狂暴之路 TMDB 官方电影海报" /><button class="poster-detail-hit" type="button" aria-label="查看疯狂的麦克斯4：狂暴之路详情"></button><button class="play-mark" type="button" aria-label="播放疯狂的麦克斯4：狂暴之路"><svg aria-hidden="true"><use href="#ph-play-fill"></use></svg></button><button class="poster-more-mark" type="button" aria-label="疯狂的麦克斯4：狂暴之路更多操作"><svg aria-hidden="true"><use href="#ph-dots-three-bold"></use></svg></button></div><div class="poster-copy"><strong class="poster-title">疯狂的麦克斯4：狂暴之路</strong><span class="poster-meta">2015 · 动作</span></div></article>
        <article class="movie-card" data-title="寄生虫" data-year="2019" data-genre="剧情,悬疑" data-status="watched" data-media-source-id="source-nextcloud" data-added="4" data-watched="6" data-duration="133" data-favorite="true" data-od-id="movie-parasite"><div class="poster-art"><img src="assets/tmdb-poster-parasite.jpg" alt="寄生虫 TMDB 官方电影海报" /><button class="poster-detail-hit" type="button" aria-label="查看寄生虫详情"></button><button class="play-mark" type="button" aria-label="播放寄生虫"><svg aria-hidden="true"><use href="#ph-play-fill"></use></svg></button><button class="poster-more-mark" type="button" aria-label="寄生虫更多操作"><svg aria-hidden="true"><use href="#ph-dots-three-bold"></use></svg></button></div><div class="poster-copy"><strong class="poster-title">寄生虫</strong><span class="poster-meta">2019 · 剧情</span></div></article>
        <article class="movie-card" data-title="爆裂鼓手" data-year="2014" data-genre="剧情,音乐" data-status="unwatched" data-media-source-id="source-alist" data-added="3" data-watched="0" data-duration="107" data-favorite="false" data-od-id="movie-whiplash"><div class="poster-art"><img src="assets/tmdb-poster-whiplash.jpg" alt="爆裂鼓手 TMDB 官方电影海报" /><button class="poster-detail-hit" type="button" aria-label="查看爆裂鼓手详情"></button><button class="play-mark" type="button" aria-label="播放爆裂鼓手"><svg aria-hidden="true"><use href="#ph-play-fill"></use></svg></button><button class="poster-more-mark" type="button" aria-label="爆裂鼓手更多操作"><svg aria-hidden="true"><use href="#ph-dots-three-bold"></use></svg></button></div><div class="poster-copy"><strong class="poster-title">爆裂鼓手</strong><span class="poster-meta">2014 · 剧情</span></div></article>
        <article class="movie-card" data-title="消失的爱人" data-year="2014" data-genre="剧情,悬疑" data-status="watched" data-media-source-id="source-alist" data-added="2" data-watched="5" data-duration="149" data-favorite="false" data-od-id="movie-gone-girl"><div class="poster-art"><img src="assets/tmdb-poster-gone-girl.jpg" alt="消失的爱人 TMDB 官方电影海报" /><button class="poster-detail-hit" type="button" aria-label="查看消失的爱人详情"></button><button class="play-mark" type="button" aria-label="播放消失的爱人"><svg aria-hidden="true"><use href="#ph-play-fill"></use></svg></button><button class="poster-more-mark" type="button" aria-label="消失的爱人更多操作"><svg aria-hidden="true"><use href="#ph-dots-three-bold"></use></svg></button></div><div class="poster-copy"><strong class="poster-title">消失的爱人</strong><span class="poster-meta">2014 · 悬疑</span></div></article>
        <article class="movie-card" data-title="机械姬" data-year="2015" data-genre="科幻,悬疑,剧情" data-status="unwatched" data-media-source-id="source-alist" data-added="1" data-watched="0" data-duration="108" data-favorite="true" data-od-id="movie-ex-machina"><div class="poster-art"><img src="assets/tmdb-poster-ex-machina.jpg" alt="机械姬 TMDB 官方电影海报" /><button class="poster-detail-hit" type="button" aria-label="查看机械姬详情"></button><button class="play-mark" type="button" aria-label="播放机械姬"><svg aria-hidden="true"><use href="#ph-play-fill"></use></svg></button><button class="poster-more-mark" type="button" aria-label="机械姬更多操作"><svg aria-hidden="true"><use href="#ph-dots-three-bold"></use></svg></button></div><div class="poster-copy"><strong class="poster-title">机械姬</strong><span class="poster-meta">2015 · 科幻</span></div></article>
  `;
  const cards = [...template.content.querySelectorAll('.movie-card')];
  const movieTemplate = cards.find(card => card.dataset.itemType !== 'collection');
  // The existing card attributes remain the single Mock source. Flatten collection
  // members for movie previews without changing the library's collection layout.
  const movies = cards.flatMap(card => {
    if (card.dataset.itemType === 'collection') {
      return JSON.parse(card.dataset.members).map(member => ({
        ...member, favorite: member.favorite === true
      }));
    }
    card.dataset.movieId = card.dataset.odId;
    return [{
      id: card.dataset.odId, title: card.dataset.title, year: Number(card.dataset.year),
      genres: card.dataset.genre.split(','), status: card.dataset.status,
      sourceId: card.dataset.mediaSourceId, added: Number(card.dataset.added),
      watched: Number(card.dataset.watched), duration: Number(card.dataset.duration),
      favorite: card.dataset.favorite === 'true',
      rating: card.dataset.rating, backdrop: card.dataset.backdrop,
      poster: card.querySelector('.poster-art > img').getAttribute('src')
    }];
  });

  // Detail-only display metadata; all artwork is local and no request is needed.
  const detailMetadata = {
    "movie-dune": {
      "originalTitle": "Dune",
      "overview": "天赋异禀的少年保罗·厄崔迪随家族前往宇宙中最危险的星球厄拉科斯。围绕珍贵香料的争夺迅速演变为战争，他必须直面自己的命运，并在恐惧与责任之间作出选择。",
      "certification": "PG-13",
      "cast": [
        {
          "name": "Denis Villeneuve",
          "role": "导演",
          "portrait": "assets/tmdb-person-denis-villeneuve.jpg"
        },
        {
          "name": "Timothée Chalamet",
          "role": "Paul Atreides",
          "portrait": "assets/tmdb-person-timothee-chalamet.jpg"
        },
        {
          "name": "Rebecca Ferguson",
          "role": "Lady Jessica",
          "portrait": "assets/tmdb-person-rebecca-ferguson.jpg"
        },
        {
          "name": "Oscar Isaac",
          "role": "Duke Leto Atreides",
          "portrait": "assets/tmdb-person-oscar-isaac.jpg"
        },
        {
          "name": "Zendaya",
          "role": "Chani",
          "portrait": "assets/tmdb-person-zendaya.jpg"
        },
        {
          "name": "Jason Momoa",
          "role": "Duncan Idaho",
          "portrait": "assets/tmdb-person-jason-momoa.jpg"
        }
      ],
      "backdrop": "assets/tmdb-backdrop-dune.jpg"
    },
    "movie-interstellar": {
      "originalTitle": "Interstellar",
      "overview": "近未来的地球黄沙遍野，基础农作物相继因枯萎病灭绝，人类在沙尘暴的肆虐下倒数着所剩不多的光景。前 NASA 宇航员库珀发现女儿书房里的异常重力现象，并由此进入一项秘密拯救人类的计划。他忍痛告别家人，与艾米莉亚·布兰德等专家穿越土星附近的虫洞，前往遥远星系寻找适合人类居住的新家园。",
      "certification": "PG-13",
      "cast": [
        {
          "name": "Christopher Nolan",
          "role": "导演",
          "portrait": "assets/tmdb-person-christopher-nolan.jpg"
        },
        {
          "name": "Matthew McConaughey",
          "role": "Cooper",
          "portrait": "assets/tmdb-person-matthew-mcconaughey.jpg"
        },
        {
          "name": "Anne Hathaway",
          "role": "Amelia Brand",
          "portrait": "assets/tmdb-person-anne-hathaway.jpg"
        },
        {
          "name": "Michael Caine",
          "role": "Professor Brand",
          "portrait": "assets/tmdb-person-michael-caine.jpg"
        },
        {
          "name": "Jessica Chastain",
          "role": "Murph",
          "portrait": "assets/tmdb-person-jessica-chastain.jpg"
        },
        {
          "name": "Mackenzie Foy",
          "role": "Murph（10岁）",
          "portrait": "assets/tmdb-person-mackenzie-foy.jpg"
        },
        {
          "name": "Timothée Chalamet",
          "role": "Tom（15岁）",
          "portrait": "assets/tmdb-person-timothee-chalamet.jpg"
        }
      ],
      "backdrop": "assets/tmdb-backdrop-interstellar.jpg"
    },
    "movie-oppenheimer": {
      "originalTitle": "Oppenheimer",
      "overview": "第二次世界大战期间，理论物理学家 J. 罗伯特·奥本海默受命领导曼哈顿计划，在新墨西哥州洛斯阿拉莫斯集结顶尖科学家研制原子弹。科学突破改变了战争进程，也让他直面核武器带来的道德重负；战后，他的声望与忠诚又在政治审查中遭到严峻考验。",
      "certification": "R",
      "cast": [
        {
          "name": "Christopher Nolan",
          "role": "导演",
          "portrait": "assets/tmdb-person-christopher-nolan.jpg"
        },
        {
          "name": "Cillian Murphy",
          "role": "J. Robert Oppenheimer",
          "portrait": "assets/tmdb-person-cillian-murphy.jpg"
        },
        {
          "name": "Emily Blunt",
          "role": "Kitty Oppenheimer",
          "portrait": "assets/tmdb-person-emily-blunt.jpg"
        },
        {
          "name": "Matt Damon",
          "role": "Leslie Groves",
          "portrait": "assets/tmdb-person-matt-damon.jpg"
        },
        {
          "name": "Robert Downey Jr.",
          "role": "Lewis Strauss",
          "portrait": "assets/tmdb-person-robert-downey-jr.jpg"
        },
        {
          "name": "Florence Pugh",
          "role": "Jean Tatlock",
          "portrait": "assets/tmdb-person-florence-pugh.jpg"
        },
        {
          "name": "Josh Hartnett",
          "role": "Ernest Lawrence",
          "portrait": "assets/tmdb-person-josh-hartnett.jpg"
        }
      ],
      "backdrop": "assets/tmdb-backdrop-oppenheimer-detail.jpg"
    },
    "movie-dune-part-two": {
      "originalTitle": "Dune: Part Two",
      "overview": "《沙丘2》承接第一部剧情，讲述保罗·厄崔迪被帕迪沙皇帝和哈克南人联手灭族后，在厄拉科斯星球遇到弗雷曼女战士契妮并加入弗雷曼人展开传奇旅程。保罗与让他家破人亡的阴谋家们开战，同时面临着一生所爱与已知宇宙命运的两难选择。",
      "certification": "PG-13",
      "cast": [
        {
          "name": "Denis Villeneuve",
          "role": "导演",
          "portrait": "assets/tmdb-person-denis-villeneuve.jpg"
        },
        {
          "name": "Timothée Chalamet",
          "role": "Paul Atreides",
          "portrait": "assets/tmdb-person-timothee-chalamet.jpg"
        },
        {
          "name": "Zendaya",
          "role": "Chani",
          "portrait": "assets/tmdb-person-zendaya.jpg"
        },
        {
          "name": "Rebecca Ferguson",
          "role": "Lady Jessica",
          "portrait": "assets/tmdb-person-rebecca-ferguson.jpg"
        },
        {
          "name": "Javier Bardem",
          "role": "Stilgar",
          "portrait": "assets/tmdb-person-javier-bardem.jpg"
        },
        {
          "name": "Florence Pugh",
          "role": "Princess Irulan",
          "portrait": "assets/tmdb-person-florence-pugh.jpg"
        },
        {
          "name": "Austin Butler",
          "role": "Feyd-Rautha",
          "portrait": "assets/tmdb-person-austin-butler.jpg"
        }
      ],
      "backdrop": "assets/tmdb-backdrop-dune-part-two.jpg"
    },
    "movie-blade-runner-2049": {
      "originalTitle": "Blade Runner 2049"
    },
    "movie-arrival": {
      "originalTitle": "Arrival"
    },
    "movie-the-batman": {
      "originalTitle": "The Batman"
    },
    "movie-inception": {
      "originalTitle": "Inception"
    },
    "movie-prisoners": {
      "originalTitle": "Prisoners"
    },
    "movie-1917": {
      "originalTitle": "1917"
    },
    "movie-mad-max-fury-road": {
      "originalTitle": "Mad Max: Fury Road"
    },
    "movie-parasite": {
      "originalTitle": "기생충"
    },
    "movie-whiplash": {
      "originalTitle": "Whiplash"
    },
    "movie-gone-girl": {
      "originalTitle": "Gone Girl"
    },
    "movie-ex-machina": {
      "originalTitle": "Ex Machina"
    }
  };
  // status/favorite/sourceId/added/watched are current-user library fields in this
  // HTML prototype only. Production will separate them from public Movie metadata.
  movies.forEach(movie => {
    Object.assign(movie, detailMetadata[movie.id]);
    movie.runtime = movie.duration;
    movie.backdrop ||= movie.poster;
    movie.overview ||= '暂无简介';
    movie.rating ||= null;
  });

  function getMovieDetailHref(movieOrId) {
    const movie = typeof movieOrId === 'string' ? getMovieById(movieOrId) : movieOrId;
    return movie?.id
      ? `personal-cinema-movie-detail.html?movie=${encodeURIComponent(movie.id)}`
      : 'personal-cinema-movie-library.html';
  }

  // Home previews and full library views share the same collection membership rules.
  function matchesLibraryView(movie, view) {
    if (view === 'favorites') return movie.favorite === true;
    if (view === 'unwatched') return movie.status === 'unwatched';
    if (view === 'watched') return movie.status === 'watched';
    return true;
  }

  function renderMovieCard(movie) {
    const original = cards.find(card => card.dataset.itemType !== 'collection' && card.dataset.odId === movie.id);
    const card = (original || movieTemplate).cloneNode(true);
    Object.assign(card.dataset, {
      movieId: movie.id, odId: movie.id, title: movie.title, year: movie.year, genre: movie.genres.join(','),
      status: movie.status, mediaSourceId: movie.sourceId, added: movie.added,
      watched: movie.watched, duration: movie.duration, favorite: String(movie.favorite)
    });
    // Collection previews clone the single-card shape, not its extra metadata.
    ['rating', 'backdrop'].forEach(key => {
      if (movie[key]) card.dataset[key] = movie[key];
      else delete card.dataset[key];
    });
    const image = card.querySelector('.poster-art > img');
    image.src = movie.poster;
    image.alt = `${movie.title} TMDB 官方电影海报`;
    card.querySelector('.poster-title').textContent = movie.title;
    if (!original) card.querySelector('.poster-meta').textContent = `${movie.year} · ${movie.genres[0]}`;
    card.querySelector('.poster-detail-hit').setAttribute('aria-label', `查看${movie.title}详情`);
    card.querySelector('.play-mark').setAttribute('aria-label', `播放${movie.title}`);
    card.querySelector('.poster-more-mark').setAttribute('aria-label', `${movie.title}更多操作`);
    return card;
  }

  function getMovieById(id) {
    return movies.find(movie => movie.id === id) || null;
  }

  function getMoviesBySourceId(sourceId) {
    return movies.filter(movie => movie.sourceId === sourceId);
  }

  const searchList = document.getElementById('searchResultList');
  if (searchList) {
    searchList.querySelectorAll('.search-result').forEach(item => {
      if (!item.dataset.movieId) {
        const movie = movies.find(movie => movie.title === item.querySelector('strong')?.textContent);
        if (movie) item.dataset.movieId = movie.id;
      }
    });
    movies.forEach(movie => {
      if (searchList.querySelector(`[data-movie-id="${movie.id}"]`)) return;
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'search-result';
      item.dataset.movieId = movie.id;
      searchList.append(item);
    });
    searchList.querySelectorAll('.search-result[data-movie-id]').forEach(item => {
      const movie = getMovieById(item.dataset.movieId);
      if (!movie) { item.remove(); return; }
      delete item.dataset.href;
      item.innerHTML = '<img class="search-thumb" alt="" /><span><strong></strong><small></small></span><span class="search-result-caret"><svg aria-hidden="true"><use href="#ph-caret-right"></use></svg></span>';
      item.querySelector('img').src = movie.poster;
      item.querySelector('img').alt = `${movie.title}电影海报`;
      item.querySelector('strong').textContent = movie.title;
      item.querySelector('small').textContent = `${movie.year} · ${movie.genres.join(' / ')}${movie.rating ? ` · ${movie.rating}` : ''}`;
      item.dataset.search = [item.dataset.search || '', movie.title, movie.originalTitle, movie.year,
        ...movie.genres, ...(movie.cast || []).map(person => person.name)].join(' ');
    });
  }

  window.PersonalCinemaLibraryMock = { movies, renderMovieCard, matchesLibraryView, getMovieById, getMoviesBySourceId, getMovieDetailHref };
  const grid = document.getElementById('movieGrid');
  if (grid) grid.append(template.content.cloneNode(true));
})();

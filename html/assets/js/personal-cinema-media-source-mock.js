// HTML-only session fixtures; no credentials or user-entered endpoints are persisted.
(() => {
  const key = 'personalCinema.sources.v2';
  const seed = [
    {id:'source-home-nas',name:'家庭 NAS',address:'https://nas.example.com/dav',status:'available',lastScan:'8 分钟前',scanRoots:[{path:'/Movies',enabled:true},{path:'/电影/4K',enabled:true}]},
    {id:'source-alist',name:'AList · 迅雷云盘',address:'https://alist.example.com/dav',status:'available',lastScan:'23 分钟前',scanRoots:[{path:'/Movies',enabled:true}]},
    {id:'source-nextcloud',name:'我的 Nextcloud',address:'https://cloud.example.com/remote.php/dav/files/lin',status:'error',lastScan:'昨天',scanRoots:[{path:'/Cinema',enabled:true}],connectionError:'服务暂时不可达，请检查地址或稍后重试。'},
    {id:'source-new',name:'新连接 · 私人云盘',address:'https://new.example.com/dav',status:'available',lastScan:'尚未扫描',scanRoots:[]},
    {id:'source-ready',name:'纪录片收藏',address:'https://archive.example.com/dav',status:'available',lastScan:'尚未扫描',scanRoots:[{path:'/Movies/纪录片',enabled:true}]}
  ].map(source => ({type:'WebDAV',icon:'ph-cloud',lastConnection:'今天 11:32',...source,location:source.address.replace(/^https?:\/\//,'')}));
  let sources = structuredClone(seed);
  try { const saved = JSON.parse(sessionStorage.getItem(key)); if (Array.isArray(saved)) sources = saved; } catch { /* use fixtures */ }
  const getSourceById = id => sources.find(source => source.id === id) || null;
  const enabledRoots = source => (source?.scanRoots || []).filter(root => root.enabled);
  function persist() {
    const safe = sources.map(source => ({...source, address: seed.find(item => item.id === source.id)?.address || 'https://webdav.example.com/dav', location: seed.find(item => item.id === source.id)?.location || 'webdav.example.com/dav'}));
    try { sessionStorage.setItem(key, JSON.stringify(safe)); } catch { /* unavailable storage */ }
  }
  const directories = {'/':['Movies','TV','Downloads','电影','Cinema'], '/Movies':['电影','动画','纪录片'], '/电影':['4K'], '/TV':['剧集'], '/Downloads':[], '/Cinema':[]};
  window.PersonalCinemaMediaSourceMock = { sources, getSourceById, enabledRoots, persist, directories };
  document.querySelectorAll('input[name="mediaSourceId"]').forEach(input => {
    input.closest('label').querySelector('span').textContent = getSourceById(input.value)?.name || '';
  });
})();

// Current prototype user's WebDAV sources; never stores Movie entities or credentials.
(() => {
  const sources = [
      {id:'source-home-nas',name:'家庭 NAS',type:'WebDAV',address:'https://nas.example.com/dav',location:'nas.example.com/dav · /Movies',rootPath:'/Movies',status:'available',lastScan:'8 分钟前',icon:'ph-cloud'},
      {id:'source-alist',name:'AList · 迅雷云盘',type:'WebDAV',address:'https://alist.example.com/dav',location:'alist.example.com/dav · /Movies',rootPath:'/Movies',status:'available',lastScan:'23 分钟前',icon:'ph-cloud'},
      {id:'source-nextcloud',name:'我的 Nextcloud',type:'WebDAV',address:'https://cloud.example.com/remote.php/dav/files/lin',location:'cloud.example.com · /Cinema',rootPath:'/Cinema',status:'available',lastScan:'昨天',icon:'ph-cloud'}
    ];
  const getSourceById = id => sources.find(source => source.id === id) || null;
  window.PersonalCinemaMediaSourceMock = { sources, getSourceById };
  document.querySelectorAll('input[name="mediaSourceId"]').forEach(input => {
    input.closest('label').querySelector('span').textContent = getSourceById(input.value)?.name || '';
  });
})();

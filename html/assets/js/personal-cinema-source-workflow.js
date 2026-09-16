// Connection, directory configuration and scan execution are separate states.
(() => {
  const mock = window.PersonalCinemaMediaSourceMock;
  const detailHref = id => `personal-cinema-media-source-detail.html?source=${encodeURIComponent(id)}`;
  function getScanStartHref(id) {
    const source = mock.getSourceById(id);
    if (!source || source.status !== 'available') return detailHref(id);
    if (!mock.enabledRoots(source).length) return `${detailHref(id)}#scan-roots`;
    return `personal-cinema-scan-task.html?autostart=1&source=${encodeURIComponent(id)}`;
  }
  function sourceStatusMarkup(source) {
    if (source.status === 'testing') return '<span class="spinner" aria-hidden="true"></span><span>正在测试</span>';
    if (source.status === 'available') return '<svg aria-hidden="true"><use href="#ph-check-circle"></use></svg><span>已连接</span>';
    return '<svg aria-hidden="true"><use href="#ph-x"></use></svg><span>连接异常</span>';
  }
  const scanLabel = source => source.status !== 'available' ? '检查连接' : !source.scanRoots.length ? '选择扫描目录' : !mock.enabledRoots(source).length ? '启用扫描目录' : '立即扫描';
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  window.PersonalCinemaSourceWorkflow = { getScanStartHref, sourceStatusMarkup, scanLabel, escapeHtml };
})();

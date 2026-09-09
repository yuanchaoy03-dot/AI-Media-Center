// Scan workflow fixtures reference Movie IDs. File versions and unresolved items
// are task data; they never create additional entries in the Movie library.
(() => {
  const { getMoviesBySourceId } = window.PersonalCinemaLibraryMock;
  const tasks = [
    {
      id: 'scan_20260903_1032', sourceId: 'source-home-nas', status: 'completed', time: '8 分钟前',
      recognizedMovieIds: ['movie-dune', 'movie-interstellar', 'movie-dune-part-two',
        'movie-the-batman', 'movie-mad-max-fury-road', 'movie-blade-runner-2049'],
      pendingIds: ['blade-runner-2049', 'alien-1979', 'prisoners-2013'],
      // Probe degradation overlaps successful imports; skipped files do not.
      degradedMovieId: 'movie-dune', skippedFiles: ['random_test_clip.mp4'],
      results: {
        'movie-dune': { quality: '4K HDR', filename: 'Dune.2021.2160p.UHD.BluRay.REMUX.HEVC.HDR.TrueHD.7.1.mkv' },
        'movie-interstellar': { quality: '1080p', filename: 'Interstellar.2014.1080p.BluRay.mkv' },
        'movie-dune-part-two': { quality: '4K HDR', filename: 'Dune.Part.Two.2024.2160p.HDR.mkv' },
        'movie-the-batman': { quality: '4K HDR', filename: 'The.Batman.2022.2160p.HDR.mkv' },
        'movie-mad-max-fury-road': { quality: '4K HDR', filename: 'Mad.Max.Fury.Road.2015.2160p.HDR.mkv' },
        // The pending WEB-DL is a separate resource version, not this successful file.
        'movie-blade-runner-2049': { quality: '4K', filename: 'Blade.Runner.2049.2017.2160p.BluRay.mkv' }
      }
    },
    { id: 'scan-alist', sourceId: 'source-alist', status: 'completed', time: '23 分钟前',
      recognizedMovieIds: [], pendingIds: [], skippedFiles: [], results: {} },
    { id: 'scan-nextcloud', sourceId: 'source-nextcloud', status: 'completed', time: '昨天',
      recognizedMovieIds: ['movie-oppenheimer'], pendingIds: [], skippedFiles: [],
      results: { 'movie-oppenheimer': { quality: '4K HDR', filename: 'Oppenheimer.2023.2160p.BluRay.REMUX.HDR.mkv' } } }
  ];

  function getAddedMovies(task) {
    const sourceMovies = getMoviesBySourceId(task.sourceId);
    return [...new Set(task.recognizedMovieIds)]
      .map(id => sourceMovies.find(movie => movie.id === id)).filter(Boolean);
  }

  function getPendingIds(task) {
    try {
      const stored = JSON.parse(localStorage.getItem(`personalCinema.matching.${task.id}`) || 'null');
      if (Array.isArray(stored?.pendingIds)) {
        return task.pendingIds.filter(id => stored.pendingIds.includes(id));
      }
    } catch { /* Direct file access may disable storage. */ }
    return [...task.pendingIds];
  }

  function getTask(taskId, sourceId) {
    const seed = tasks.find(task => task.id === taskId && (!sourceId || task.sourceId === sourceId))
      || tasks.find(task => task.sourceId === sourceId)
      || (!sourceId && tasks[0]);
    if (!seed) return { id: taskId || `scan-${sourceId}`, sourceId, recognizedMovieIds: [],
      pendingIds: [], skippedFiles: [], results: {}, attentionCount: 0 };
    return taskId && !tasks.some(task => task.id === taskId) ? withCounts({ ...seed, id: taskId }) : seed;
  }

  function withCounts(task) {
    Object.defineProperties(task, {
      pendingCount: { enumerable: true, get: () => getPendingIds(task).length },
      attentionCount: { enumerable: true, get: () => task.skippedFiles.length + Number(Boolean(task.degradedMovieId)) }
    });
    return task;
  }
  tasks.forEach(withCounts);
  window.PersonalCinemaScanMock = { tasks, getTask, getAddedMovies, getPendingIds };
})();

(() => {
  document.querySelectorAll('video').forEach(video => { video.playsInline = true; if (video.preload === 'auto') video.preload = 'metadata'; });
  document.querySelectorAll('img').forEach(img => { img.decoding = 'async'; });
  document.addEventListener('visibilitychange', () => {
    document.documentElement.classList.toggle('app-hidden', document.hidden);
    if (document.hidden) document.querySelectorAll('audio,video').forEach(media => media.pause());
  });
})();

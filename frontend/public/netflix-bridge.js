// Runs in the PAGE's main world so it can access Netflix's player API.
(function () {
  function getPlayer() {
    const vp = window.netflix?.appContext?.state?.playerApp?.getAPI?.().videoPlayer;
    if (!vp) return null;
    const ids = vp.getAllPlayerSessionIds();
    if (!ids.length) return null;
    return vp.getVideoPlayerBySessionId(ids[0]);
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.source !== 'FLYNX_CONTENT') return;

    const player = getPlayer();
    if (!player) {
      console.warn('[Flynx] Netflix player API not ready');
      return;
    }

    try {
      if (msg.cmd === 'seek') player.seek(msg.time * 1000); // API uses ms
      else if (msg.cmd === 'play') player.play();
      else if (msg.cmd === 'pause') player.pause();
    } catch (e) {
      console.error('[Flynx] bridge error:', e);
    }
  });
})();
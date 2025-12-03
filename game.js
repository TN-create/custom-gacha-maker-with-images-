/**
 * Game module – placeholder for future game logic
 */

const Game = (() => {
  let isRunning = false;
  let playScreen = null;

  function init() {
    playScreen = document.getElementById('playScreen');
    const playBtn = document.getElementById('playBtn');
    if (playBtn) {
      playBtn.addEventListener('click', toggle);
    }
  }

  function start() {
    if (!playScreen) return;
    isRunning = true;
    playScreen.innerHTML = '<p class="play-placeholder">Game is running...</p>';
    // TODO: Implement game logic here
  }

  function stop() {
    if (!playScreen) return;
    isRunning = false;
    playScreen.innerHTML = '<p class="play-placeholder">Game area – press Play to start</p>';
  }

  function toggle() {
    if (isRunning) {
      stop();
    } else {
      start();
    }
    // Update button text
    const playBtn = document.getElementById('playBtn');
    if (playBtn) {
      playBtn.textContent = isRunning ? '⏹ Stop' : '▶ Play';
    }
  }

  return { init, start, stop, toggle };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  Game.init();
});

// js/training/init.js
// 練習局の起動

function initTraining(mode, match) {
  gameMode = mode || 'training';
  isPractice = (gameMode === 'practice');
  if (isPractice) {
    var defaultMatch = {
      rounds: 4, redDora: true, kyokuIndex: 1, maxKyoku: 4,
      roundName: '東風戦', kyokuWind: '東', kyokuNum: 1, honba: 0, riichiPool: 0,
      scores: { you: 25000, p2: 25000, p3: 25000, p4: 25000 }, dealerSeat: 'you',
      cpuLevel: 'hard'
    };
    matchState = Object.assign({}, defaultMatch, match || {});
  } else {
    matchState = match || null;
  }
  allowDamaten = true;
  G = null;

  if (window._tgKeyHandler) {
    window.removeEventListener('keydown', window._tgKeyHandler);
  }
  window._tgKeyHandler = handleKeyDown;
  window.addEventListener('keydown', window._tgKeyHandler);

  G = newGame();
  render();
  if (isPractice && G.dealerSeat !== 'you') {
    setTimeout(advancePracticeTurn, 600);
  }
}
window.initTraining = initTraining;

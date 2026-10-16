// js/game/controls.js
// プレイヤーのクリック操作とイベント登録

function handlePlayerDiscard(tileCode, viaRiichi) {
  if (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline() && typeof OnlinePeer !== 'undefined' && !OnlinePeer.isHost()) {
    OnlineGame.sendGuestDiscard(tileCode, viaRiichi);
  } else {
    afterUserDiscard(tileCode, viaRiichi);
  }
}
window.handlePlayerDiscard = handlePlayerDiscard;

function wireEvents() {
  var root = document.getElementById('tgRoot');
  if (!root) return;

  var toggleDamaten = document.getElementById('toggleDamaten');
  if (toggleDamaten) {
    toggleDamaten.addEventListener('change', function () {
      allowDamaten = this.checked;
      G = newGame();
      render();
    });
  }
  if (G.gameOver) {
    var expandBtn = document.getElementById('btnExpandReveal');
    if (expandBtn) expandBtn.addEventListener('click', function () { G.revealExpanded = true; render(); });
    var retry = document.getElementById('btnRetry');
    if (retry) retry.addEventListener('click', function () {
      G = newGame();
      render();
      if (isPractice && G.dealerSeat !== 'you') {
        setTimeout(advancePracticeTurn, 600);
      }
    });
    var nextKyoku = document.getElementById('btnNextKyoku');
    if (nextKyoku) nextKyoku.addEventListener('click', function () {
      proceedToNextKyoku();
    });
    var finalResult = document.getElementById('btnShowFinalResult');
    if (finalResult) finalResult.addEventListener('click', function () {
      renderMatchFinalResult();
    });
    return;
  }
  if (G.pendingRonOffer) {
    var acceptRon = document.getElementById('btnAcceptRon');
    var passRon = document.getElementById('btnPassRon');
    if (acceptRon) acceptRon.addEventListener('click', function () {
      if (G.pendingRonOffer.local) resolveLocalRonAction(true);
      else OnlineGame.respondRon(true);
    });
    if (passRon) passRon.addEventListener('click', function () {
      if (G.pendingRonOffer.local) resolveLocalRonAction(false);
      else OnlineGame.respondRon(false);
    });
    return;
  }
  if (G.processing) return;

  if (G.pendingCall) {
    var actions = getCallActions();
    root.querySelectorAll('[data-call-action-idx]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(this.getAttribute('data-call-action-idx'), 10);
        executeCallAction(actions[idx]);
      });
    });
    return;
  }

  var tsumoBtn = document.getElementById('btnTsumo');
  if (tsumoBtn) tsumoBtn.addEventListener('click', userTsumo);
  var ankanBtn = document.getElementById('btnAnkan');
  if (ankanBtn) {
    ankanBtn.addEventListener('click', function () {
      var tile = this.getAttribute('data-tile');
      executeAnkan(tile);
    });
  }
  var kakanBtn = document.getElementById('btnKakan');
  if (kakanBtn) {
    kakanBtn.addEventListener('click', function () {
      var tile = this.getAttribute('data-tile');
      executeKakan(tile);
    });
  }

  if (G.players.you.riichi) {
    var forced = document.getElementById('btnForcedDiscard');
    if (forced) forced.addEventListener('click', function () { handlePlayerDiscard(G.lastDrawn, false); });
  } else {
    root.querySelectorAll('.hand-row .tile:not(.disabled)').forEach(function (el) {
      el.addEventListener('click', function () {
        var code = this.getAttribute('data-tile');
        var idx = parseInt(this.getAttribute('data-index'), 10);
        var now = Date.now();
        if (G.lastTileClick && G.lastTileClick.idx === idx && (now - G.lastTileClick.time) < 400) {
          G.lastTileClick = null;
          handlePlayerDiscard(code, false);
          return;
        }
        G.lastTileClick = { code: code, idx: idx, time: now };
        if (G.selectedIndex === idx) {
          G.selectedIndex = null;
          G.selected = null;
        } else {
          G.selectedIndex = idx;
          G.selected = code;
        }
        render();
      });
    });
    var discardBtn = document.getElementById('btnDiscard');
    if (discardBtn) discardBtn.addEventListener('click', function () { handlePlayerDiscard(G.selected, false); });
    var riichiBtn = document.getElementById('btnRiichi');
    if (riichiBtn) riichiBtn.addEventListener('click', function () { handlePlayerDiscard(G.selected, true); });
    var cancelBtn = document.getElementById('btnCancel');
    if (cancelBtn) cancelBtn.addEventListener('click', function () { G.selected = null; G.selectedIndex = null; render(); });
  }
}
window.wireEvents = wireEvents;


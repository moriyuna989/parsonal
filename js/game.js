// =====================================================================
// js/game.js
// 対局エントリーポイント・イベントバインド・キーボード操作
// =====================================================================

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
    if (forced) forced.addEventListener('click', function () { afterUserDiscard(G.lastDrawn, false); });
  } else {
    root.querySelectorAll('.hand-row .tile:not(.disabled)').forEach(function (el) {
      el.addEventListener('click', function () {
        var code = this.getAttribute('data-tile');
        var idx = parseInt(this.getAttribute('data-index'), 10);
        var now = Date.now();
        if (G.lastTileClick && G.lastTileClick.idx === idx && (now - G.lastTileClick.time) < 400) {
          G.lastTileClick = null;
          afterUserDiscard(code, false);
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
    if (discardBtn) discardBtn.addEventListener('click', function () { afterUserDiscard(G.selected, false); });
    var riichiBtn = document.getElementById('btnRiichi');
    if (riichiBtn) riichiBtn.addEventListener('click', function () { afterUserDiscard(G.selected, true); });
    var cancelBtn = document.getElementById('btnCancel');
    if (cancelBtn) cancelBtn.addEventListener('click', function () { G.selected = null; G.selectedIndex = null; render(); });
  }
}
window.wireEvents = wireEvents;

function handleKeyDown(e) {
  if (!document.getElementById('tgRoot') || !G) return;

  // 局終了時（和了・流局）のEnterキー操作
  if (G.gameOver) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!G.revealExpanded) {
        var expandBtn = document.getElementById('btnExpandReveal');
        if (expandBtn) {
          expandBtn.click();
        } else {
          G.revealExpanded = true;
          render();
        }
      } else {
        var nextKyoku = document.getElementById('btnNextKyoku');
        if (nextKyoku) {
          nextKyoku.click();
          return;
        }
        var finalResult = document.getElementById('btnShowFinalResult');
        if (finalResult) {
          finalResult.click();
          return;
        }
        var retry = document.getElementById('btnRetry');
        if (retry) {
          retry.click();
          return;
        }
      }
    }
    return;
  }

  if (G.processing) return;

  // 鳴き（ポン・チー・スルー）の選択プロンプト表示中
  if (G.pendingCall) {
    var actions = getCallActions();
    if (!actions.length) return;

    var key = e.key ? e.key.toLowerCase() : '';

    // 矢印キー移動（← / →）
    if (e.key === 'ArrowLeft' || e.key === 'Left') {
      e.preventDefault();
      if (G.pendingCallIndex === null || G.pendingCallIndex === undefined || G.pendingCallIndex < 0) {
        G.pendingCallIndex = actions.length - 1;
      } else {
        G.pendingCallIndex = Math.max(0, G.pendingCallIndex - 1);
      }
      render();
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'Right') {
      e.preventDefault();
      if (G.pendingCallIndex === null || G.pendingCallIndex === undefined || G.pendingCallIndex < 0) {
        G.pendingCallIndex = 0;
      } else {
        G.pendingCallIndex = Math.min(actions.length - 1, G.pendingCallIndex + 1);
      }
      render();
      return;
    }

    // Space または Enter で選択中のアクションを実行
    if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter') {
      e.preventDefault();
      if (G.pendingCallIndex !== null && G.pendingCallIndex !== undefined && G.pendingCallIndex >= 0 && G.pendingCallIndex < actions.length) {
        executeCallAction(actions[G.pendingCallIndex]);
      }
      return;
    }

    // ダイレクトキー: Esc または S でスルー
    if (e.key === 'Escape' || key === 's') {
      e.preventDefault();
      executeCallPass();
      return;
    }

    // ダイレクトキー: P でポン
    if (key === 'p') {
      var ponAct = actions.find(function (a) { return a.type === 'pon'; });
      if (ponAct) {
        e.preventDefault();
        executeCallPon();
        return;
      }
    }

    // ダイレクトキー: K でカン
    if (key === 'k') {
      var kanAct = actions.find(function (a) { return a.type === 'kan'; });
      if (kanAct) {
        e.preventDefault();
        executeCallKan();
        return;
      }
    }

    // ダイレクトキー: C でチー
    if (key === 'c') {
      var chiActs = actions.filter(function (a) { return a.type === 'chi'; });
      if (chiActs.length === 1) {
        e.preventDefault();
        executeCallChi(chiActs[0].combo[0], chiActs[0].combo[1]);
        return;
      } else if (chiActs.length > 1) {
        e.preventDefault();
        var firstChiIdx = actions.findIndex(function (a) { return a.type === 'chi'; });
        G.pendingCallIndex = firstChiIdx;
        render();
        return;
      }
    }

    // 数字キー 1〜9 で直接実行
    var num = parseInt(e.key, 10);
    if (!isNaN(num) && num >= 1 && num <= actions.length) {
      e.preventDefault();
      executeCallAction(actions[num - 1]);
      return;
    }

    return;
  }

  // Escapeキーで選択解除
  if (e.key === 'Escape') {
    if (G.selected) {
      e.preventDefault();
      G.selected = null;
      G.selectedIndex = null;
      render();
      return;
    }
  }

  var keyLower = e.key ? e.key.toLowerCase() : '';

  // Rキー または Shift+Space でリーチ判断・実行
  var tiles = getDisplayedTiles();
  if ((keyLower === 'r' || (e.shiftKey && (e.key === ' ' || e.code === 'Space'))) && !G.players.you.isOpen && !G.players.you.riichi && tiles.length) {
    var opts = computeUserOptions();
    var riichiCandidates = tiles.filter(function (code) { return opts.tenpaiIfDiscard[code]; });
    if (riichiCandidates.length > 0) {
      e.preventDefault();
      // 現在選択されている牌がリーチ可能牌なら、そのままリーチ宣言して切る
      if (G.selected && opts.tenpaiIfDiscard[G.selected]) {
        afterUserDiscard(G.selected, true);
        return;
      }
      // 未選択または非リーチ牌が選ばれている場合、リーチ可能牌を自動選択
      var nextRiichiIdx = tiles.findIndex(function (code) { return opts.tenpaiIfDiscard[code]; });
      if (nextRiichiIdx !== -1) {
        G.selectedIndex = nextRiichiIdx;
        G.selected = tiles[nextRiichiIdx];
        render();
        return;
      }
    }
  }

  if (keyLower === 'k') {
    var kanInfo = G.justDrew ? checkConcealedKan(G.players.you) : null;
    if (kanInfo && kanInfo.canAnkan) {
      e.preventDefault();
      executeAnkan(kanInfo.ankanList[0]);
      return;
    } else if (kanInfo && kanInfo.canKakan) {
      e.preventDefault();
      executeKakan(kanInfo.kakanList[0].tile);
      return;
    }
  }
  if (keyLower === 't') {
    var canTsumo = G.justDrew && canPlayerWinWith('you', G.lastDrawn, true);
    if (canTsumo) {
      e.preventDefault();
      userTsumo();
      return;
    }
  }

  if (!tiles.length) return;

  if (e.key === 'ArrowLeft' || e.key === 'Left') {
    e.preventDefault();
    if (G.players.you.riichi) return;
    if (G.selectedIndex === null || G.selectedIndex === undefined || G.selectedIndex < 0) {
      G.selectedIndex = tiles.length - 1;
    } else {
      G.selectedIndex = Math.max(0, G.selectedIndex - 1);
    }
    G.selected = tiles[G.selectedIndex];
    render();
  } else if (e.key === 'ArrowRight' || e.key === 'Right') {
    e.preventDefault();
    if (G.players.you.riichi) return;
    if (G.selectedIndex === null || G.selectedIndex === undefined || G.selectedIndex < 0) {
      G.selectedIndex = 0;
    } else {
      G.selectedIndex = Math.min(tiles.length - 1, G.selectedIndex + 1);
    }
    G.selected = tiles[G.selectedIndex];
    render();
  } else if (e.key === ' ' || e.code === 'Space') {
    e.preventDefault();
    if (G.players.you.riichi) {
      afterUserDiscard(G.lastDrawn, false);
    } else if (G.selectedIndex !== null && G.selectedIndex !== undefined && G.selectedIndex >= 0 && G.selectedIndex < tiles.length) {
      var targetTile = tiles[G.selectedIndex];
      afterUserDiscard(targetTile, false);
    }
  }
}
window.handleKeyDown = handleKeyDown;

function initTraining(mode, match) {
  gameMode = mode || 'training';
  isPractice = (gameMode === 'practice');
  if (isPractice && !match) {
    match = {
      rounds: 4, redDora: true, kyokuIndex: 1, maxKyoku: 4,
      roundName: '東風戦', kyokuWind: '東', kyokuNum: 1, honba: 0, riichiPool: 0,
      scores: { you: 25000, p2: 25000, p3: 25000, p4: 25000 }, dealerSeat: 'you',
      cpuLevel: 'hard'
    };
  }
  matchState = match || null;
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

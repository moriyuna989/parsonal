// js/online/sync.js
// 手番・対局状態の同期

function notifyGuestTurn(logicalSeat, drawTile) {
  if (!OnlinePeer.isHost() || !G) return;
  var slot = OnlineGameRuntime.seatsConfig.find(function (s) { return s.seat === logicalSeat; });
  if (!slot || !slot.id) return;

  OnlinePeer.sendTo(slot.id, {
    type: 'ONLINE_YOUR_TURN',
    draw: drawTile,
    doraIndicators: G.doraIndicators,
    remainingPool: poolTotal(G.pool),
    lastDrawWasLastLiveTile: G.lastDrawWasLastLiveTile,
    lastDrawWasRinshan: G.lastDrawWasRinshan,
    firstTurnUninterrupted: G.firstTurnUninterrupted,
    firstTsumoSeat: G.firstTsumoSeat,
    firstTsumoAvailable: G.firstTsumoAvailable,
    firstDrawWindowSeat: G.firstDrawWindowSeat
  });

  // 他のゲストにもターンの移行と最新卓状態を通知
  syncOnlineStateToAll();
}

// ゲスト側：ホストからツモ番通知を受け取った時の処理
function handleGuestYourTurn(msg) {
  if (!G) return;
  G.currentTurnSeat = 'you';
  if (msg.draw) {
    G.players.you.hand.push(msg.draw);
    G.lastDrawn = msg.draw;
    G.justDrew = true;
    G.log.push('あなたのツモ番です: ' + tileName(msg.draw) + ' をツモりました。');
  }
  G.processing = false;
  if (msg.doraIndicators) G.doraIndicators = msg.doraIndicators;
  if (msg.remainingPool !== undefined) { G.pool = new Array(34).fill(0); G.pool[0] = msg.remainingPool; }
  G.lastDrawWasLastLiveTile = !!msg.lastDrawWasLastLiveTile;
  G.lastDrawWasRinshan = !!msg.lastDrawWasRinshan;
  G.firstTurnUninterrupted = !!msg.firstTurnUninterrupted;
  G.firstTsumoSeat = msg.firstTsumoSeat ? logicalToLocalSeat(msg.firstTsumoSeat) : null;
  G.firstTsumoAvailable = !!msg.firstTsumoAvailable;
  G.firstDrawWindowSeat = msg.firstDrawWindowSeat ? logicalToLocalSeat(msg.firstDrawWindowSeat) : null;
  clearTemporaryFuriten('you');
  render();
}

// ゲスト側：牌を切ってホストへ送信
function sendGuestDiscard(tileCode, viaRiichi) {
  if (!G || G.currentTurnSeat !== 'you') return;
  var idx = G.players.you.hand.indexOf(tileCode);
  if (idx !== -1) {
    G.players.you.hand.splice(idx, 1);
  }
  G.players.you.river.push(tileCode);
  recordDiscardScoringContext('you');
  G.lastDiscardSeat = 'you';
  G.selected = null;
  G.selectedIndex = null;
  G.justDrew = false;
  G.processing = true; // 打牌後はホストの同期を待つ
  if (!viaRiichi && G.players.you.riichi) {
    G.players.you.ippatsu = false;
  }
  G.log.push('あなたが' + tileName(tileCode) + 'を切りました。' + (viaRiichi ? '（リーチ宣言）' : ''));
  render();

  OnlinePeer.sendToHost({
    type: 'GUEST_DISCARD',
    seat: OnlineGameRuntime.myLogicalSeat,
    tile: tileCode,
    riichi: viaRiichi
  });
}

// ホスト側：状態の同期ブロードキャスト
function syncOnlineStateToAll() {
  if (!OnlinePeer.isHost() || !G) return;

  var rivers = {};
  var melds = {};
  var riichiStates = {};
  var doubleRiichiStates = {};
  var ippatsuStates = {};
  OnlineGameRuntime.SEATS_ORDER.forEach(function (s) {
    if (G.players[s]) {
      rivers[s] = G.players[s].river;
      melds[s] = G.players[s].melds;
      riichiStates[s] = G.players[s].riichi;
      doubleRiichiStates[s] = G.players[s].doubleRiichi;
      ippatsuStates[s] = G.players[s].ippatsu;
    }
  });

  OnlineGameRuntime.seatsConfig.forEach(function (slot) {
    if (slot.seat !== 'you' && !slot.isCpu && slot.id) {
      OnlinePeer.sendTo(slot.id, {
        type: 'ONLINE_SYNC_TURN',
        currentTurnSeat: G.currentTurnSeat,
        rivers: rivers,
        melds: melds,
        riichiStates: riichiStates,
        doubleRiichiStates: doubleRiichiStates,
        ippatsuStates: ippatsuStates,
        lastDiscardSeat: G.lastDiscardSeat,
        doraIndicators: G.doraIndicators,
        lastDrawWasLastLiveTile: G.lastDrawWasLastLiveTile,
        lastDrawWasRinshan: G.lastDrawWasRinshan,
        lastDiscardWasLastLiveTile: G.lastDiscardWasLastLiveTile,
        firstTurnUninterrupted: G.firstTurnUninterrupted,
        firstTsumoSeat: G.firstTsumoSeat,
        firstTsumoAvailable: G.firstTsumoAvailable,
        firstDrawWindowSeat: G.firstDrawWindowSeat,
        remainingPool: poolTotal(G.pool),
        scores: matchState ? matchState.scores : null,
        riichiPool: matchState ? matchState.riichiPool : 0
      });
    }
  });
}

// ゲスト側：ホストからの卓同期受信
function handleGuestSyncTurn(msg) {
  if (!G) return;
  var localCurrentTurn = logicalToLocalSeat(msg.currentTurnSeat);
  G.currentTurnSeat = localCurrentTurn;
  if (msg.remainingPool !== undefined) { G.pool = new Array(34).fill(0); G.pool[0] = msg.remainingPool; }
  G.doraIndicators = msg.doraIndicators;
  G.lastDrawWasLastLiveTile = !!msg.lastDrawWasLastLiveTile;
  G.lastDrawWasRinshan = !!msg.lastDrawWasRinshan;
  G.lastDiscardWasLastLiveTile = !!msg.lastDiscardWasLastLiveTile;
  G.firstTurnUninterrupted = !!msg.firstTurnUninterrupted;
  G.firstTsumoSeat = msg.firstTsumoSeat ? logicalToLocalSeat(msg.firstTsumoSeat) : null;
  G.firstTsumoAvailable = !!msg.firstTsumoAvailable;
  G.firstDrawWindowSeat = msg.firstDrawWindowSeat ? logicalToLocalSeat(msg.firstDrawWindowSeat) : null;
  G.lastDiscardSeat = logicalToLocalSeat(msg.lastDiscardSeat);

  OnlineGameRuntime.SEATS_ORDER.forEach(function (locSeat) {
    var logSeat = localToLogicalSeat(locSeat);
    if (G.players[locSeat]) {
      G.players[locSeat].river = (msg.rivers && msg.rivers[logSeat]) ? msg.rivers[logSeat].slice() : [];
      G.players[locSeat].melds = (msg.melds && msg.melds[logSeat]) ? msg.melds[logSeat].slice() : [];
      G.players[locSeat].riichi = (msg.riichiStates && msg.riichiStates[logSeat]) || false;
      G.players[locSeat].doubleRiichi = (msg.doubleRiichiStates && msg.doubleRiichiStates[logSeat]) || false;
      G.players[locSeat].ippatsu = (msg.ippatsuStates && msg.ippatsuStates[logSeat]) || false;
    }
    if (matchState && msg.scores && msg.scores[logSeat] !== undefined) {
      matchState.scores[locSeat] = msg.scores[logSeat];
    }
  });
  if (matchState && msg.riichiPool !== undefined) {
    matchState.riichiPool = msg.riichiPool;
  }

  G.processing = (localCurrentTurn !== 'you');
  render();
}

// ホスト側：局終了の同期送信
function syncRoundOver() {
  if (!OnlinePeer.isHost() || !G) return;
  var allHands = {};
  var rivers = {};
  var melds = {};
  var riichiStates = {};
  var doubleRiichiStates = {};
  var ippatsuStates = {};
  OnlineGameRuntime.SEATS_ORDER.forEach(function (s) {
    allHands[s] = G.players[s] ? G.players[s].hand.slice() : [];
    rivers[s] = G.players[s] ? G.players[s].river.slice() : [];
    melds[s] = G.players[s] ? G.players[s].melds.slice() : [];
    riichiStates[s] = !!(G.players[s] && G.players[s].riichi);
    doubleRiichiStates[s] = !!(G.players[s] && G.players[s].doubleRiichi);
    ippatsuStates[s] = !!(G.players[s] && G.players[s].ippatsu);
  });
  OnlineGameRuntime.seatsConfig.forEach(function (slot) {
    if (slot.seat !== 'you' && !slot.isCpu && slot.id) {
      OnlinePeer.sendTo(slot.id, {
        type: 'ONLINE_ROUND_OVER',
        outcome: G.outcome,
        allHands: allHands,
        rivers: rivers,
        melds: melds,
        riichiStates: riichiStates,
        doubleRiichiStates: doubleRiichiStates,
        ippatsuStates: ippatsuStates,
        doraIndicators: G.doraIndicators,
        uraIndicators: G.uraIndicators,
        scores: matchState ? matchState.scores : null,
        riichiPool: matchState ? matchState.riichiPool : 0
      });
    }
  });
}


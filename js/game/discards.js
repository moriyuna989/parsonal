// js/game/discards.js
// 打牌・リーチ・捨て牌後の判定

function computeUserOptions() {
  var hand = G.players.you.hand;
  var meldCount = G.players.you.melds.length;
  var rs = riichiSeatsActive();
  var safeSet = null;
  if (rs.length) {
    var sets = rs.map(computeSafeSetFor);
    safeSet = sets.reduce(function (acc, s) { return new Set([...acc].filter(function (x) { return s.has(x); })); });
  }
  var tenpaiIfDiscard = {};
  Array.from(new Set(hand)).forEach(function (code) {
    var copy = hand.slice(); copy.splice(copy.indexOf(code), 1);
    tenpaiIfDiscard[code] = !G.lastDrawWasLastLiveTile && poolTotal(G.pool) > 0 && findWaitsOpen(copy, meldCount).length > 0;
  });
  return { safeSet: safeSet, tenpaiIfDiscard: tenpaiIfDiscard };
}
window.computeUserOptions = computeUserOptions;

function getDisplayedTiles() {
  var hand = G.players.you.hand;
  var rest = hand.slice();
  var showDrawn = G.justDrew && rest.includes(G.lastDrawn);
  var drawnIdx = showDrawn ? rest.lastIndexOf(G.lastDrawn) : -1;
  if (drawnIdx !== -1) rest.splice(drawnIdx, 1);
  rest = sortTiles(rest);
  if (showDrawn) rest.push(G.lastDrawn);
  return rest;
}
window.getDisplayedTiles = getDisplayedTiles;

function commitRiichiDeclaration(seat, doubleRiichi) {
  var player = G.players[seat];
  if (!player || player.riichi) return;
  player.riichi = true;
  player.doubleRiichi = !!doubleRiichi;
  player.riichiTurn = player.river.length;
  player.ippatsu = true;
  if (isPractice && matchState) {
    matchState.scores[seat] -= 1000;
    matchState.riichiPool = (matchState.riichiPool || 0) + 1;
  }
}
window.commitRiichiDeclaration = commitRiichiDeclaration;

function afterUserDiscard(tileCode, viaRiichi) {
  var user = G.players.you;
  if (viaRiichi) {
    var riichiIdx = user.hand.indexOf(tileCode);
    if (riichiIdx === -1 || user.riichi || user.isOpen || G.lastDrawWasLastLiveTile || poolTotal(G.pool) <= 0 ||
        (isPractice && matchState && matchState.scores.you < 1000)) return;
    var riichiHandCheck = user.hand.slice();
    riichiHandCheck.splice(riichiIdx, 1);
    if (!findWaitsOpen(riichiHandCheck, (user.melds || []).length).length) return;
  }
  var doubleRiichi = !!viaRiichi && !!G.firstTurnUninterrupted && !G.players.you.firstDiscardDone;
  var idx = G.players.you.hand.indexOf(tileCode);
  G.players.you.hand.splice(idx, 1);
  G.players.you.river.push(tileCode);
  recordDiscardScoringContext('you');
  G.lastDiscardSeat = 'you';
  G.selected = null;
  G.selectedIndex = null;
  G.lastTileClick = null;
  G.justDrew = false;
  if (!viaRiichi && G.players.you.riichi) {
    G.players.you.ippatsu = false;
  }
  G.log.push('あなたが' + tileName(tileCode) + 'を切りました。' + (viaRiichi ? '（リーチ宣言）' : ''));
  var continueAfterDiscard = function () {
    if (viaRiichi) commitRiichiDeclaration('you', doubleRiichi);
    G.players.you.wait = findWaitsOpen(G.players.you.hand, G.players.you.melds.length);
    startCallWindow(tileCode, 'you', function () {
      if (isPractice) {
        G.currentTurnSeat = nextSeat('you');
        G.processing = true;
        render();
        if (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline()) OnlineGame.syncOnlineStateToAll();
        setTimeout(advancePracticeTurn, 550);
      } else runOpponentsSequence();
    });
  };
  var ron = checkRon(tileCode, 'you', continueAfterDiscard);
  if (ron === 'pending') return;
  if (ron) {
    G.gameOver = true;
    var ronScore = G.players[ron].tpl ? scoreTemplateWin(ron, false, tileCode) : scorePlayerWin(ron, G.players[ron].hand.concat([tileCode]), tileCode, false);
    G.outcome = { type: 'user_dealin', to: ron, tile: tileCode, score: ronScore };
    render();
    if (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline()) {
      OnlineGame.syncRoundOver();
    }
    return;
  }
  continueAfterDiscard();
}
window.afterUserDiscard = afterUserDiscard;

// ホスト側：オンライン参加者（ゲスト）の打牌を受信して実行
function executeOnlineGuestDiscard(seat, tileCode, viaRiichi, senderId) {
  if (!G || G.gameOver) return;
  if (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline() && OnlinePeer.isHost()) {
    if (!OnlineGame.isGuestPeer(seat, senderId) || G.currentTurnSeat !== seat) return;
  }
  var p = G.players[seat];
  if (!p) return;
  var doubleRiichi = !!viaRiichi && !!G.firstTurnUninterrupted && !p.firstDiscardDone;
  var expectedLen = 14 - 3 * (p.melds ? p.melds.length : 0);
  if (p.hand.length !== expectedLen || !p.hand.includes(tileCode)) return;
  if (p.riichi && (viaRiichi || !isSameTileType(tileCode, G.lastDrawn))) return;
  if (viaRiichi) {
    if (p.riichi || p.isOpen || poolTotal(G.pool) <= 0 || !matchState || matchState.scores[seat] < 1000) return;
    var riichiHand = p.hand.slice();
    riichiHand.splice(riichiHand.indexOf(tileCode), 1);
    if (!findWaitsOpen(riichiHand, (p.melds || []).length).length) return;
  }
  var idx = p.hand.indexOf(tileCode);
  if (idx !== -1) {
    p.hand.splice(idx, 1);
  } else return;
  p.river.push(tileCode);
  recordDiscardScoringContext(seat);
  G.lastDiscardSeat = seat;
  G.justDrew = false;
  p.wait = findWaitsOpen(p.hand, (p.melds || []).length);
  p.isTenpai = p.wait.length > 0;
  if (!viaRiichi && p.riichi) {
    p.ippatsu = false;
  }
  var seatName = (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline()) ? OnlineGame.getSeatDisplayName(seat) : (SEAT_NAME[seat] || seat);
  G.log.push(seatName + 'が' + tileName(tileCode) + 'を切りました。' + (viaRiichi ? '（リーチ宣言）' : ''));

  var continueAfterDiscard = function () {
    if (viaRiichi) commitRiichiDeclaration(seat, doubleRiichi);
    startCallWindow(tileCode, seat, function () {
      G.currentTurnSeat = nextSeat(seat);
      if (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline()) OnlineGame.syncOnlineStateToAll();
      setTimeout(advancePracticeTurn, 550);
    });
  };
  var ron = checkRon(tileCode, seat, continueAfterDiscard);
  if (ron === 'pending') return;
  if (ron) {
    G.processing = false;
    G.gameOver = true;
    if (ron === 'you') {
      G.outcome = {
        type: 'user_ron',
        via: seat,
        tile: tileCode,
        score: scorePlayerWin('you', G.players.you.hand.concat([tileCode]), tileCode, false)
      };
    } else {
      G.outcome = {
        type: 'other_ron',
        ronner: ron,
        discarder: seat,
        tile: tileCode,
        score: scorePlayerWin(ron, G.players[ron].hand.concat([tileCode]), tileCode, false)
      };
    }
    render();
    if (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline()) {
      OnlineGame.syncRoundOver();
    }
    return;
  }

  continueAfterDiscard();
}
window.executeOnlineGuestDiscard = executeOnlineGuestDiscard;


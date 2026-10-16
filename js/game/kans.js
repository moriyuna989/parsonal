// js/game/kans.js
// 槓と嶺上牌の処理

function openKanDora() {
  if (!G.doraIndicators) G.doraIndicators = [G.doraIndicator];
  if (!G.uraIndicators) G.uraIndicators = [G.uraIndicator];
  if (G.doraIndicators.length < 5) {
    var newDora = drawRandom(G.pool);
    var newUra = drawRandom(G.pool);
    if (newDora) G.doraIndicators.push(newDora);
    if (newUra) G.uraIndicators.push(newUra);
    G.log.push('カンドラが開かれました: ' + tileName(newDora));
  }
}
window.openKanDora = openKanDora;

function drawRinshan() {
  if (poolTotal(G.pool) <= 0) return null;
  return drawRandom(G.pool);
}
window.drawRinshan = drawRinshan;

function checkConcealedKan(player) {
  if (!player || totalKanCount() >= 4) return { canAnkan: false, ankanList: [], canKakan: false, kakanList: [] };
  var seat = G && SEATS.find(function (s) { return G.players[s] === player; });
  var hand = player.hand;
  var counts = tilesToCounts(hand);
  var ankanList = [];
  for (var i = 0; i < 34; i++) {
    if (counts[i] === 4) {
      var cand = hand.find(function (t) { return tileIndex(t) === i; });
      if (cand && canAnkanForSeat(seat, cand)) ankanList.push(cand);
    }
  }
  var kakanList = [];
  (player.melds || []).forEach(function (m) {
    if (m.type === 'pon') {
      var ponIdx = tileIndex(m.tiles[0]);
      var matchInHand = hand.find(function (t) { return tileIndex(t) === ponIdx; });
      if (matchInHand && canKakanForSeat(seat, matchInHand)) {
        kakanList.push({ tile: matchInHand, meld: m });
      }
    }
  });
  return { canAnkan: ankanList.length > 0, ankanList: ankanList, canKakan: kakanList.length > 0, kakanList: kakanList };
}
window.checkConcealedKan = checkConcealedKan;

function canAnkanForSeat(seat, targetTile) {
  var player = G && G.players[seat];
  if (!player || !G.justDrew || G.lastDrawWasLastLiveTile || totalKanCount() >= 4 || G.currentTurnSeat !== seat || !G.lastDrawn || !player.hand.includes(G.lastDrawn)) return false;
  var targetIdx = tileIndex(targetTile);
  if (tileIndex(G.lastDrawn) !== targetIdx || player.hand.filter(function (t) { return tileIndex(t) === targetIdx; }).length !== 4) return false;
  if (!player.riichi) return true;
  var before = player.hand.slice();
  before.splice(before.indexOf(G.lastDrawn), 1);
  var beforeWaits = findWaitsOpen(before, (player.melds || []).length).map(tileIndex).sort();
  var after = player.hand.filter(function (t) { return tileIndex(t) !== targetIdx; });
  var afterWaits = findWaitsOpen(after, (player.melds || []).length + 1).map(tileIndex).sort();
  return beforeWaits.length === afterWaits.length && beforeWaits.every(function (idx, i) { return idx === afterWaits[i]; });
}
window.canAnkanForSeat = canAnkanForSeat;

function canKakanForSeat(seat, targetTile) {
  var player = G && G.players[seat];
  if (!player || player.riichi || !G.justDrew || G.lastDrawWasLastLiveTile || totalKanCount() >= 4 || G.currentTurnSeat !== seat || !G.lastDrawn || !player.hand.includes(G.lastDrawn)) return false;
  var targetIdx = tileIndex(targetTile);
  return tileIndex(G.lastDrawn) === targetIdx && player.hand.some(function (t) { return tileIndex(t) === targetIdx; }) &&
    (player.melds || []).some(function (m) { return m.type === 'pon' && tileIndex(m.tiles[0]) === targetIdx; });
}
window.canKakanForSeat = canKakanForSeat;

function syncAcceptedKan(seat) {
  if (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline() && OnlinePeer.isHost()) {
    if (seat !== 'you' && OnlineGame.isGuestSeat(seat)) OnlineGame.syncGuestCallAccepted(seat);
    OnlineGame.syncOnlineStateToAll();
  }
}

function executeAnkanForSeat(seat, targetTile) {
  if (!canAnkanForSeat(seat, targetTile)) return false;
  var player = G.players[seat];
  var targetIdx = tileIndex(targetTile);
  var removed = [];
  for (var i = player.hand.length - 1; i >= 0; i--) {
    if (tileIndex(player.hand[i]) === targetIdx && removed.length < 4) removed.push(player.hand.splice(i, 1)[0]);
  }
  player.melds.push({ type: 'kan', subType: 'ankan', tiles: removed, concealed: true });
  G.log.push((seat === 'you' ? 'あなたが' : OnlineGame.getSeatDisplayName(seat) + 'が') + tileName(targetTile) + 'を暗槓しました。');
  cancelAllIppatsu();
  openKanDora();
  var rinshan = drawRinshan();
  if (!rinshan) {
    G.gameOver = true;
    G.processing = false;
    G.outcome = { type: 'ryuukyoku' };
    render();
    if (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline() && OnlinePeer.isHost()) OnlineGame.syncRoundOver();
    return true;
  }
  clearTemporaryFuriten(seat);
  player.hand.push(rinshan);
  G.currentTurnSeat = seat;
  G.lastDrawn = rinshan;
  G.lastDrawWasLastLiveTile = false;
  G.lastDrawWasRinshan = true;
  G.lastDiscardWasLastLiveTile = false;
  G.justDrew = true;
  G.processing = seat !== 'you';
  G.log.push((seat === 'you' ? 'あなたは' : OnlineGame.getSeatDisplayName(seat) + 'は') + '嶺上牌から ' + tileName(rinshan) + ' をツモりました。');
  render();
  syncAcceptedKan(seat);
  return true;
}
window.executeAnkanForSeat = executeAnkanForSeat;

function executeKakanForSeat(seat, targetTile) {
  if (!canKakanForSeat(seat, targetTile)) return false;
  var player = G.players[seat];
  var targetIdx = tileIndex(targetTile);
  var tile = player.hand.find(function (t) { return tileIndex(t) === targetIdx; });
  var completeKakan = function () {
    G.lastWinWasChankan = false;
    var tileIndexInHand = player.hand.findIndex(function (t) { return t === tile; });
    if (tileIndexInHand === -1) return;
    player.hand.splice(tileIndexInHand, 1);
    var meld = player.melds.find(function (m) { return m.type === 'pon' && tileIndex(m.tiles[0]) === targetIdx; });
    if (!meld) { player.hand.push(tile); return; }
    meld.type = 'kan';
    meld.subType = 'kakan';
    meld.tiles.push(tile);
    meld.kakanTile = tile;
    G.log.push((seat === 'you' ? 'あなたが' : OnlineGame.getSeatDisplayName(seat) + 'が') + tileName(tile) + 'を加槓しました。');
    cancelAllIppatsu();
    openKanDora();
    var rinshan = drawRinshan();
    if (!rinshan) {
      G.gameOver = true;
      G.processing = false;
      G.outcome = { type: 'ryuukyoku' };
      render();
      if (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline() && OnlinePeer.isHost()) OnlineGame.syncRoundOver();
      return;
    }
    clearTemporaryFuriten(seat);
    player.hand.push(rinshan);
    G.currentTurnSeat = seat;
    G.lastDrawn = rinshan;
    G.lastDrawWasLastLiveTile = false;
    G.lastDrawWasRinshan = true;
    G.lastDiscardWasLastLiveTile = false;
    G.justDrew = true;
    G.processing = seat !== 'you';
    G.log.push((seat === 'you' ? 'あなたは' : OnlineGame.getSeatDisplayName(seat) + 'は') + '嶺上牌から ' + tileName(rinshan) + ' をツモりました。捨てる牌を選んでください。');
    render();
    syncAcceptedKan(seat);
  };

  G.lastWinWasChankan = true;
  var ron = checkRon(tile, seat, completeKakan);
  if (ron === 'pending') return true;
  if (ron) {
    G.gameOver = true;
    G.processing = false;
    G.outcome = ron === 'you'
      ? { type: 'user_ron', via: seat, tile: tile, score: scorePlayerWin('you', G.players.you.hand.concat([tile]), tile, false) }
      : { type: 'other_ron', ronner: ron, discarder: seat, tile: tile, score: scorePlayerWin(ron, G.players[ron].hand.concat([tile]), tile, false) };
    render();
    if (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline() && OnlinePeer.isHost()) OnlineGame.syncRoundOver();
    return true;
  }
  completeKakan();
  return true;
}
window.executeKakanForSeat = executeKakanForSeat;

function executeCallKan() {
  var pc = G.pendingCall;
  if (!pc || totalKanCount() >= 4 || !checkUserCallOptions(pc.tile, pc.fromSeat, 'you').canKan) return false;
  var hand = G.players.you.hand;
  var targetIdx = tileIndex(pc.tile);
  var removed = [];
  for (var i = hand.length - 1; i >= 0; i--) {
    if (tileIndex(hand[i]) === targetIdx && removed.length < 3) {
      removed.push(hand.splice(i, 1)[0]);
    }
  }
  var meldTiles = [pc.tile].concat(removed);
  var minkan = { type: 'kan', subType: 'minkan', tiles: meldTiles, from: pc.fromSeat, calledTile: pc.tile };
  recordPaoResponsibility('you', minkan);
  G.players.you.melds.push(minkan);
  G.players.you.isOpen = true;
  G.players[pc.fromSeat].river.pop();
  G.log.push('あなたが' + tileName(pc.tile) + 'をカン（大明槓）しました。');
  cancelAllIppatsu();
  openKanDora();
  G.pendingCall = null;
  G.pendingCallIndex = null;
  G.processing = false;
  G.currentTurnSeat = 'you';

  var rinshan = drawRinshan();
  if (!rinshan) {
    G.gameOver = true;
    G.outcome = { type: 'ryuukyoku' };
    render();
    if (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline() && OnlinePeer.isHost()) OnlineGame.syncRoundOver();
    return true;
  }
  G.players.you.hand.push(rinshan);
  G.lastDrawn = rinshan;
  G.lastDrawWasLastLiveTile = false;
  G.lastDrawWasRinshan = true;
  clearTemporaryFuriten('you');
  G.justDrew = true;
  G.log.push('嶺上牌から ' + tileName(rinshan) + ' をツモりました。捨てる牌を選んでください。');
  render();
  syncAcceptedKan('you');
  return true;
}
window.executeCallKan = executeCallKan;

function executeAnkan(targetTile) {
  if (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline() && !OnlinePeer.isHost()) {
    OnlineGame.requestKan('ankan', targetTile);
    return;
  }
  executeAnkanForSeat('you', targetTile);
}
window.executeAnkan = executeAnkan;

function executeKakan(targetTile) {
  if (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline() && !OnlinePeer.isHost()) {
    OnlineGame.requestKan('kakan', targetTile);
    return;
  }
  executeKakanForSeat('you', targetTile);
}
window.executeKakan = executeKakan;


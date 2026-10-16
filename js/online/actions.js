// js/online/actions.js
// ロン・鳴き・ツモの要求と応答

function handleGuestAction(msg, senderId) {
  if (!OnlinePeer.isHost() || !G || G.gameOver) return;
  var slot = OnlineGameRuntime.seatsConfig.find(function (s) { return s.id === senderId; });
  if (!slot || slot.seat !== msg.seat) return;
  if (msg.action === 'ron' || msg.action === 'pass_ron') {
    resolveRemoteRonAction(slot.seat, msg.offerId, msg.action === 'ron');
    return;
  }
  if (msg.action === 'call' || msg.action === 'pass_call') {
    resolveRemoteCallAction(slot.seat, msg.offerId, msg.action === 'call' ? msg.callAction : { type: 'pass' });
    return;
  }
  if (msg.action === 'ankan' || msg.action === 'kakan') {
    if (slot.seat !== G.currentTurnSeat) return;
    if (msg.action === 'ankan') executeAnkanForSeat(slot.seat, msg.tile);
    else executeKakanForSeat(slot.seat, msg.tile);
    return;
  }
  if (msg.action !== 'tsumo' || slot.seat !== G.currentTurnSeat) return;
  var player = G.players[slot.seat];
  var winTile = G.lastDrawn;
  if (!player || !winTile || !player.hand.includes(winTile) || !canPlayerWinWith(slot.seat, winTile, true)) return;
  var score = scorePlayerWin(slot.seat, player.hand.slice(), winTile, true);
  if (score.noYaku || !score.isComplete) return;
  G.gameOver = true;
  G.processing = false;
  G.outcome = { type: 'opp_tsumo', seat: slot.seat, tile: winTile, score: score };
  render();
  syncRoundOver();
}

function handleGuestRonOffer(msg) {
  if (OnlinePeer.isHost() || !G) return;
  G.pendingRonOffer = {
    offerId: msg.offerId,
    tile: msg.tile,
    fromSeat: logicalToLocalSeat(msg.discarderSeat)
  };
  G.processing = false;
  render();
}

function offerRon(logicalSeat, tile, discarderSeat, offerId) {
  if (!OnlinePeer.isHost()) return;
  var slot = OnlineGameRuntime.seatsConfig.find(function (s) { return s.seat === logicalSeat; });
  if (!slot || slot.isCpu || !slot.id) return;
  OnlinePeer.sendTo(slot.id, { type: 'ONLINE_RON_OFFER', offerId: offerId, tile: tile, discarderSeat: discarderSeat });
}

function respondRon(accepted) {
  if (OnlinePeer.isHost() || !G || !G.pendingRonOffer) return;
  var offer = G.pendingRonOffer;
  G.pendingRonOffer = null;
  if (!accepted) {
    G.players.you.passFuriten = true;
    if (G.players.you.riichi) G.players.you.permanentPassFuriten = true;
  }
  G.processing = true;
  render();
  OnlinePeer.sendToHost({
    type: 'GUEST_ACTION',
    action: accepted ? 'ron' : 'pass_ron',
    offerId: offer.offerId,
    seat: OnlineGameRuntime.myLogicalSeat
  });
}

function offerCall(logicalSeat, offer, offerId) {
  if (!OnlinePeer.isHost()) return;
  var slot = OnlineGameRuntime.seatsConfig.find(function (s) { return s.seat === logicalSeat; });
  if (!slot || slot.isCpu || !slot.id) return;
  OnlinePeer.sendTo(slot.id, {
    type: 'ONLINE_CALL_OFFER', offerId: offerId, tile: offer.tile,
    fromSeat: offer.fromSeat, canPon: offer.canPon, canKan: offer.canKan,
    chiOptions: offer.chiOptions
  });
}

function handleGuestCallOffer(msg) {
  if (OnlinePeer.isHost() || !G) return;
  G.pendingCall = {
    remoteOfferId: msg.offerId,
    tile: msg.tile,
    fromSeat: logicalToLocalSeat(msg.fromSeat),
    callerSeat: 'you',
    canPon: !!msg.canPon,
    canKan: !!msg.canKan,
    chiOptions: msg.chiOptions || []
  };
  G.pendingCallIndex = null;
  G.processing = false;
  render();
}

function respondCall(action) {
  if (OnlinePeer.isHost() || !G || !G.pendingCall || !G.pendingCall.remoteOfferId) return;
  var offer = G.pendingCall;
  G.pendingCall = null;
  G.processing = true;
  render();
  OnlinePeer.sendToHost({
    type: 'GUEST_ACTION',
    action: action.type === 'pass' ? 'pass_call' : 'call',
    callAction: action,
    offerId: offer.remoteOfferId,
    seat: OnlineGameRuntime.myLogicalSeat
  });
}

function syncGuestCallAccepted(logicalSeat) {
  if (!OnlinePeer.isHost() || !G) return;
  var slot = OnlineGameRuntime.seatsConfig.find(function (s) { return s.seat === logicalSeat; });
  if (!slot || slot.isCpu || !slot.id) return;
  var player = G.players[logicalSeat];
  OnlinePeer.sendTo(slot.id, {
    type: 'ONLINE_CALL_ACCEPTED',
    seat: logicalSeat,
    hand: player.hand,
    melds: player.melds,
    isOpen: !!player.isOpen,
    lastDrawn: G.lastDrawn,
    justDrew: G.justDrew,
    currentTurnSeat: G.currentTurnSeat,
    doraIndicators: G.doraIndicators,
    lastDrawWasLastLiveTile: G.lastDrawWasLastLiveTile,
    lastDrawWasRinshan: G.lastDrawWasRinshan,
    firstTurnUninterrupted: G.firstTurnUninterrupted,
    firstDrawWindowSeat: G.firstDrawWindowSeat,
    firstTsumoSeat: G.firstTsumoSeat,
    firstTsumoAvailable: G.firstTsumoAvailable,
    remainingPool: poolTotal(G.pool)
  });
}

function handleGuestCallAccepted(msg) {
  if (OnlinePeer.isHost() || !G || msg.seat !== OnlineGameRuntime.myLogicalSeat) return;
  G.players.you.hand = (msg.hand || []).slice();
  G.players.you.melds = (msg.melds || []).slice();
  G.players.you.isOpen = msg.isOpen === undefined ? true : !!msg.isOpen;
  G.currentTurnSeat = 'you';
  G.lastDrawn = msg.lastDrawn || null;
  G.justDrew = !!msg.justDrew;
  if (msg.doraIndicators) G.doraIndicators = msg.doraIndicators;
  if (msg.remainingPool !== undefined) { G.pool = new Array(34).fill(0); G.pool[0] = msg.remainingPool; }
  G.lastDrawWasLastLiveTile = !!msg.lastDrawWasLastLiveTile;
  G.lastDrawWasRinshan = !!msg.lastDrawWasRinshan;
  G.firstTurnUninterrupted = !!msg.firstTurnUninterrupted;
  G.firstDrawWindowSeat = msg.firstDrawWindowSeat ? logicalToLocalSeat(msg.firstDrawWindowSeat) : null;
  G.firstTsumoSeat = msg.firstTsumoSeat ? logicalToLocalSeat(msg.firstTsumoSeat) : null;
  G.firstTsumoAvailable = !!msg.firstTsumoAvailable;
  G.pendingCall = null;
  G.pendingCallOffer = null;
  G.processing = false;
  render();
}

function requestTsumo() {
  if (OnlinePeer.isHost() || !G) return false;
  G.processing = true;
  render();
  OnlinePeer.sendToHost({ type: 'GUEST_ACTION', action: 'tsumo', seat: OnlineGameRuntime.myLogicalSeat });
  return true;
}

function requestKan(action, tile) {
  if (OnlinePeer.isHost() || !G || (action !== 'ankan' && action !== 'kakan')) return false;
  G.processing = true;
  render();
  OnlinePeer.sendToHost({ type: 'GUEST_ACTION', action: action, seat: OnlineGameRuntime.myLogicalSeat, tile: tile });
  return true;
}

// ゲスト側：局終了通知を受信した時の処理
function handleGuestRoundOver(msg) {
  if (!G) return;
  G.gameOver = true;
  G.outcome = msg.outcome;
  if (G.outcome) {
    if (G.outcome.seat) G.outcome.seat = logicalToLocalSeat(G.outcome.seat);
    if (G.outcome.winnerSeat) G.outcome.winnerSeat = logicalToLocalSeat(G.outcome.winnerSeat);
    if (G.outcome.ronSeat) G.outcome.ronSeat = logicalToLocalSeat(G.outcome.ronSeat);
    if (G.outcome.to) G.outcome.to = logicalToLocalSeat(G.outcome.to);
    if (G.outcome.via) G.outcome.via = logicalToLocalSeat(G.outcome.via);
    if (G.outcome.ronner) G.outcome.ronner = logicalToLocalSeat(G.outcome.ronner);
    if (G.outcome.discarder) G.outcome.discarder = logicalToLocalSeat(G.outcome.discarder);
    if (G.outcome.score && Array.isArray(G.outcome.score.pao)) {
      G.outcome.score.pao.forEach(function (entry) {
        if (entry.responsibleSeat) entry.responsibleSeat = logicalToLocalSeat(entry.responsibleSeat);
      });
    }
  }
  OnlineGameRuntime.SEATS_ORDER.forEach(function (locSeat) {
    var logSeat = localToLogicalSeat(locSeat);
    if (G.players[locSeat] && msg.allHands && msg.allHands[logSeat]) {
      G.players[locSeat].hand = msg.allHands[logSeat].slice();
    }
    if (G.players[locSeat]) {
      if (msg.rivers && msg.rivers[logSeat]) G.players[locSeat].river = msg.rivers[logSeat].slice();
      if (msg.melds && msg.melds[logSeat]) G.players[locSeat].melds = msg.melds[logSeat].slice();
      if (msg.riichiStates) G.players[locSeat].riichi = !!msg.riichiStates[logSeat];
      if (msg.doubleRiichiStates) G.players[locSeat].doubleRiichi = !!msg.doubleRiichiStates[logSeat];
      if (msg.ippatsuStates) G.players[locSeat].ippatsu = !!msg.ippatsuStates[logSeat];
    }
    if (matchState && msg.scores && msg.scores[logSeat] !== undefined) {
      matchState.scores[locSeat] = msg.scores[logSeat];
    }
  });
  if (matchState && msg.riichiPool !== undefined) matchState.riichiPool = msg.riichiPool;
  if (msg.doraIndicators) G.doraIndicators = msg.doraIndicators.slice();
  if (msg.uraIndicators) G.uraIndicators = msg.uraIndicators.slice();
  G.processing = false;
  render();
}


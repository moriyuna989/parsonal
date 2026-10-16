// js/game/round_scoring.js
// 和了判定・局面情報・和了点の計算

function scoreUserWin(fullConcealedTiles, winTile, isTsumo) {
  return scorePlayerWin('you', fullConcealedTiles, winTile, isTsumo);
}



function checkRon(discardCode, discarderSeat, resumeAfterPass) {
  var candidates = [];
  var seat = nextSeat(discarderSeat);
  for (var i = 0; i < 3; i++) {
    var player = G.players[seat];
    if (player) {
      var waits = findWaitsOpen(player.hand || [], (player.melds || []).length);
      var waitIndices = waits.map(tileIndex);
      var riverFuriten = (player.river || []).some(function (t) { return waitIndices.includes(tileIndex(t)); });
      var furiten = riverFuriten || !!player.passFuriten;
      if (!furiten && waits.some(function (t) { return tileIndex(t) === tileIndex(discardCode); }) && canPlayerWinWith(seat, discardCode, false)) {
        candidates.push(seat);
      }
    }
    seat = nextSeat(seat);
  }
  return advanceRonCandidate(discardCode, discarderSeat, candidates, 0, resumeAfterPass, false);
}
window.checkRon = checkRon;

function clearTemporaryFuriten(seat) {
  var player = G && G.players && G.players[seat];
  if (player && !player.permanentPassFuriten) player.passFuriten = false;
}
window.clearTemporaryFuriten = clearTemporaryFuriten;

function advanceRonCandidate(tile, discarderSeat, candidates, index, resumeAfterPass, shouldResume) {
  if (index >= candidates.length) {
    G.pendingRon = null;
    if (shouldResume && resumeAfterPass) resumeAfterPass();
    return null;
  }
  var seat = candidates[index];
  if (seat === 'you') {
    var localOfferId = 'ron-local-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    G.pendingRon = { tile: tile, discarderSeat: discarderSeat, candidates: candidates, index: index, resumeAfterPass: resumeAfterPass, offerId: localOfferId };
    G.pendingRonOffer = { local: true, offerId: localOfferId, tile: tile, fromSeat: discarderSeat };
    G.processing = true;
    render();
    return 'pending';
  }
  if (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline() && OnlineGame.isGuestSeat(seat)) {
    var offerId = 'ron-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    G.pendingRon = { tile: tile, discarderSeat: discarderSeat, candidates: candidates, index: index, resumeAfterPass: resumeAfterPass, offerId: offerId };
    G.processing = true;
    OnlineGame.offerRon(seat, tile, discarderSeat, offerId);
    if (OnlinePeer.isHost()) render();
    return 'pending';
  }
  return seat;
}

function resolveRemoteRonAction(seat, offerId, accepted) {
  var pending = G && G.pendingRon;
  if (!pending || pending.offerId !== offerId || pending.candidates[pending.index] !== seat || G.gameOver) return false;
  if (accepted && canPlayerWinWith(seat, pending.tile, false)) {
    finalizeRemoteRon(seat, pending.tile, pending.discarderSeat);
    return true;
  }
  var player = G.players[seat];
  player.passFuriten = true;
  if (player.riichi) player.permanentPassFuriten = true;
  var nextCandidate = advanceRonCandidate(pending.tile, pending.discarderSeat, pending.candidates, pending.index + 1, pending.resumeAfterPass, true);
  if (nextCandidate && nextCandidate !== 'pending') finalizeRemoteRon(nextCandidate, pending.tile, pending.discarderSeat);
  return true;
}
window.resolveRemoteRonAction = resolveRemoteRonAction;

function finalizeRemoteRon(seat, tile, discarderSeat) {
  var winner = G.players[seat];
  G.gameOver = true;
  G.processing = false;
  G.pendingRon = null;
  G.pendingRonOffer = null;
  G.outcome = {
    type: 'other_ron', ronner: seat, discarder: discarderSeat, tile: tile,
    score: scorePlayerWin(seat, winner.hand.concat([tile]), tile, false)
  };
  render();
  if (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline()) OnlineGame.syncRoundOver();
}

// 旧テンプレート専用採点を共通採点エンジンへ委譲する。
function scoringContextForSeat(seat, isTsumo) {
  var player = G.players[seat];
  return {
    isTsumo: isTsumo,
    isOpen: !!player.isOpen,
    dealer: seat === G.dealerSeat,
    riichi: !!player.riichi,
    doubleRiichi: !!player.doubleRiichi,
    ippatsu: !!player.ippatsu,
    seatWindNum: windCharToNum(G.seatWind[seat]),
    roundWindNum: windCharToNum(G.kyokuWind),
    doraIndicators: G.doraIndicators || (G.doraIndicator ? [G.doraIndicator] : []),
    uraIndicators: G.uraIndicators || (G.uraIndicator ? [G.uraIndicator] : []),
    haitei: !!G.lastDrawWasLastLiveTile,
    houtei: !!G.lastDiscardWasLastLiveTile,
    rinshan: !!G.lastDrawWasRinshan,
    chankan: !!G.lastWinWasChankan,
    tenhou: !!isTsumo && !!G.firstTsumoAvailable && G.firstTsumoSeat === seat,
    chiihou: !!isTsumo && seat !== G.dealerSeat && !!G.firstTurnUninterrupted && G.firstDrawWindowSeat === seat,
    paoResponsibility: player.paoResponsibility || {}
  };
}

function scorePlayerWin(seat, fullConcealedTiles, winTile, isTsumo) {
  var player = G.players[seat];
  var result = scoreHand(fullConcealedTiles, winTile, player.melds || [], scoringContextForSeat(seat, isTsumo));
  result.dealer = seat === G.dealerSeat;
  result.isTsumo = isTsumo;
  result.breakdownParts = result.breakdownParts || [];
  return result;
}
window.scorePlayerWin = scorePlayerWin;

function scoreTemplateWin(seat, isTsumo, winTile) {
  var player = G.players[seat];
  var fullConcealedTiles = player.hand.slice();
  if (!isTsumo) fullConcealedTiles.push(winTile);
  return scorePlayerWin(seat, fullConcealedTiles, winTile, isTsumo);
}
window.scoreTemplateWin = scoreTemplateWin;

function canPlayerWinWith(seat, winTile, isTsumo) {
  var player = G.players[seat];
  if (!player) return false;
  var concealed = player.hand.slice();
  if (!isTsumo) concealed.push(winTile);
  var score = scorePlayerWin(seat, concealed, winTile, isTsumo);
  return score.isComplete && !score.noYaku && score.han >= 1;
}
window.canPlayerWinWith = canPlayerWinWith;

function recordDiscardScoringContext(seat) {
  if (!G) return;
  if (G.initialDrawSeat === seat) G.initialDrawSeat = null;
  G.lastDiscardWasLastLiveTile = !!G.lastDrawWasLastLiveTile && !G.lastDrawWasRinshan;
  if (G.players[seat]) G.players[seat].firstDiscardDone = true;
  if (G.firstTsumoAvailable && G.firstTsumoSeat === seat) {
    G.firstTsumoAvailable = false;
    G.firstTsumoSeat = null;
    G.firstDrawWindowSeat = nextSeat(seat);
  } else if (G.firstTurnUninterrupted && G.firstDrawWindowSeat === seat) {
    var nextFirstDraw = nextSeat(seat);
    G.firstDrawWindowSeat = nextFirstDraw === G.dealerSeat ? null : nextFirstDraw;
  }
}
window.recordDiscardScoringContext = recordDiscardScoringContext;

function resolveLocalRonAction(accepted) {
  var pending = G && G.pendingRon;
  if (!pending || pending.candidates[pending.index] !== 'you' || G.gameOver) return false;
  var tile = pending.tile;
  var discarderSeat = pending.discarderSeat;
  if (accepted && canPlayerWinWith('you', tile, false)) {
    G.gameOver = true;
    G.processing = false;
    G.pendingRon = null;
    G.pendingRonOffer = null;
    G.outcome = {
      type: 'user_ron', via: discarderSeat, tile: tile,
      score: scorePlayerWin('you', G.players.you.hand.concat([tile]), tile, false)
    };
    render();
    if (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline() && OnlinePeer.isHost()) OnlineGame.syncRoundOver();
    return true;
  }
  G.players.you.passFuriten = true;
  if (G.players.you.riichi) G.players.you.permanentPassFuriten = true;
  G.pendingRonOffer = null;
  var nextCandidate = advanceRonCandidate(tile, discarderSeat, pending.candidates, pending.index + 1, pending.resumeAfterPass, true);
  if (nextCandidate && nextCandidate !== 'pending') finalizeRemoteRon(nextCandidate, tile, discarderSeat);
  return true;
}
window.resolveLocalRonAction = resolveLocalRonAction;

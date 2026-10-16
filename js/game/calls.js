// js/game/calls.js
// 鳴き候補と鳴き処理

function checkUserCallOptions(tile, fromSeat, callerSeat) {
  var callSeat = callerSeat || 'you';
  var player = G.players[callSeat];
  if (!player || player.riichi) {
    return { canPon: false, canKan: false, chiOptions: [] };
  }
  var hand = player.hand;
  var targetIdx = tileIndex(tile);
  var matchCount = hand.filter(function (t) { return tileIndex(t) === targetIdx; }).length;
  var canPon = matchCount >= 2;
  var canKan = matchCount >= 3 && totalKanCount() < 4;
  var chiOptions = [];
  if (nextSeat(fromSeat) === callSeat) {
    var t = parseTile(tile);
    if (t.suit !== 'z') {
      [[t.num - 2, t.num - 1], [t.num - 1, t.num + 1], [t.num + 1, t.num + 2]].forEach(function (c) {
        if (c[0] >= 1 && c[1] <= 9) {
          var t1 = c[0] + t.suit, t2 = c[1] + t.suit;
          var cands1 = Array.from(new Set(hand.filter(function (h) { return tileIndex(h) === tileIndex(t1); })));
          var cands2 = Array.from(new Set(hand.filter(function (h) { return tileIndex(h) === tileIndex(t2); })));
          cands1.forEach(function (cand1) {
            cands2.forEach(function (cand2) {
              chiOptions.push([cand1, cand2]);
            });
          });
        }
      });
    }
  }
  return { canPon: canPon, canKan: canKan, chiOptions: chiOptions };
}
window.checkUserCallOptions = checkUserCallOptions;

function totalKanCount() {
  return G ? SEATS.reduce(function (sum, seat) {
    return sum + (G.players[seat] ? (G.players[seat].melds || []).filter(function (m) { return m.type === 'kan'; }).length : 0);
  }, 0) : 0;
}
window.totalKanCount = totalKanCount;

function recordPaoResponsibility(seat, meld) {
  var player = G && G.players && G.players[seat];
  if (!player || !meld || !meld.from) return;
  var isCalledSet = meld.type === 'pon' || (meld.type === 'kan' && meld.subType === 'minkan');
  var isOpenKan = meld.type === 'kan' && meld.subType === 'minkan';
  if (!isCalledSet) return;
  var idx = tileIndex(meld.tiles[0]);
  var priorMelds = player.melds || [];
  function priorSetKindsInRange(firstIdx, lastIdx) {
    return new Set(priorMelds.filter(function (m) {
      var meldIdx = tileIndex(m.tiles[0]);
      return (m.type === 'pon' || m.type === 'kan') && meldIdx >= firstIdx && meldIdx <= lastIdx;
    }).map(function (m) { return tileIndex(m.tiles[0]); })).size;
  }
  if (idx >= tileIndex('5z') && idx <= tileIndex('7z') && priorSetKindsInRange(tileIndex('5z'), tileIndex('7z')) >= 2 && !(player.paoResponsibility && player.paoResponsibility.daisangen)) {
    player.paoResponsibility = player.paoResponsibility || {};
    player.paoResponsibility.daisangen = meld.from;
  }
  if (idx >= tileIndex('1z') && idx <= tileIndex('4z') && priorSetKindsInRange(tileIndex('1z'), tileIndex('4z')) >= 3 && !(player.paoResponsibility && player.paoResponsibility.daisuushii)) {
    player.paoResponsibility = player.paoResponsibility || {};
    player.paoResponsibility.daisuushii = meld.from;
  }
  if (isOpenKan && priorMelds.filter(function (m) { return m.type === 'kan'; }).length >= 3 && !(player.paoResponsibility && player.paoResponsibility.suukantsu)) {
    player.paoResponsibility = player.paoResponsibility || {};
    player.paoResponsibility.suukantsu = meld.from;
  }
}
window.recordPaoResponsibility = recordPaoResponsibility;

function startCallWindow(tile, fromSeat, resumeAfterPass) {
  if (G.lastDiscardWasLastLiveTile) {
    G.pendingCallWindow = null;
    G.pendingCall = null;
    G.pendingCallIndex = null;
    if (resumeAfterPass) resumeAfterPass();
    return;
  }
  var candidates = [];
  var seat = nextSeat(fromSeat);
  for (var i = 0; i < 3; i++) {
    var canRespond = seat === 'you' || (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline() && OnlineGame.isGuestSeat(seat));
    if (canRespond) {
      var options = checkUserCallOptions(tile, fromSeat, seat);
      if (options.canPon || options.canKan || options.chiOptions.length) {
        candidates.push({ seat: seat, options: options, distance: i, priority: (options.canPon || options.canKan) ? 0 : 1 });
      }
    }
    seat = nextSeat(seat);
  }
  candidates.sort(function (a, b) { return a.priority - b.priority || a.distance - b.distance; });
  G.pendingCallWindow = { tile: tile, fromSeat: fromSeat, candidates: candidates, index: 0, resumeAfterPass: resumeAfterPass, offerId: null };
  advanceCallWindow(0);
}
window.startCallWindow = startCallWindow;

function advanceCallWindow(index) {
  var pending = G && G.pendingCallWindow;
  if (!pending) return;
  if (index >= pending.candidates.length) {
    var resume = pending.resumeAfterPass;
    G.pendingCallWindow = null;
    G.pendingCall = null;
    G.pendingCallIndex = null;
    if (resume) resume();
    return;
  }
  pending.index = index;
  var candidate = pending.candidates[index];
  var offer = {
    tile: pending.tile,
    fromSeat: pending.fromSeat,
    callerSeat: candidate.seat,
    canPon: candidate.options.canPon,
    canKan: candidate.options.canKan,
    chiOptions: candidate.options.chiOptions
  };
  if (candidate.seat === 'you') {
    G.pendingCall = offer;
    G.pendingCallIndex = null;
    G.processing = false;
    render();
  } else {
    G.pendingCall = null;
    G.pendingCallIndex = null;
    pending.offerId = 'call-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    G.processing = true;
    OnlineGame.offerCall(candidate.seat, offer, pending.offerId);
    render();
  }
}

function resolveRemoteCallAction(seat, offerId, action) {
  var pending = G && G.pendingCallWindow;
  if (!pending || pending.offerId !== offerId || G.gameOver) return false;
  var candidate = pending.candidates[pending.index];
  if (!candidate || candidate.seat !== seat) return false;
  if (action.type === 'pass') {
    advanceCallWindow(pending.index + 1);
    return true;
  }
  var legal = checkUserCallOptions(pending.tile, pending.fromSeat, seat);
  if (action.type === 'pon' && legal.canPon) return applyCallForSeat(seat, action, pending);
  if (action.type === 'kan' && legal.canKan) return applyCallForSeat(seat, action, pending);
  if (action.type === 'chi' && Array.isArray(action.combo) && action.combo.length === 2 && legal.chiOptions.some(function (combo) {
    return combo.every(function (t, i) { return tileIndex(t) === tileIndex(action.combo[i]); });
  })) return applyCallForSeat(seat, action, pending);
  return false;
}
window.resolveRemoteCallAction = resolveRemoteCallAction;

function applyCallForSeat(seat, action, pending) {
  var player = G.players[seat];
  var fromSeat = pending.fromSeat;
  var tile = pending.tile;
  var hand = player.hand;
  var meld;
  if (action.type === 'pon' || action.type === 'kan') {
    var need = action.type === 'pon' ? 2 : 3;
    var removed = [];
    for (var i = hand.length - 1; i >= 0 && removed.length < need; i--) {
      if (tileIndex(hand[i]) === tileIndex(tile)) removed.push(hand.splice(i, 1)[0]);
    }
    if (removed.length !== need) return false;
    meld = { type: action.type === 'pon' ? 'pon' : 'kan', tiles: [tile].concat(removed), from: fromSeat, calledTile: tile };
    if (action.type === 'kan') meld.subType = 'minkan';
  } else if (action.type === 'chi') {
    var combo = action.combo || [];
    if (combo.length !== 2) return false;
    var t1 = hand.findIndex(function (t) { return t === combo[0]; });
    if (t1 === -1) t1 = hand.findIndex(function (t) { return tileIndex(t) === tileIndex(combo[0]); });
    if (t1 === -1) return false;
    var used1 = hand.splice(t1, 1)[0];
    var t2 = hand.findIndex(function (t) { return t === combo[1]; });
    if (t2 === -1) t2 = hand.findIndex(function (t) { return tileIndex(t) === tileIndex(combo[1]); });
    if (t2 === -1) { hand.push(used1); return false; }
    var used2 = hand.splice(t2, 1)[0];
    meld = { type: 'chi', tiles: [tile].concat(sortTiles([used1, used2])), from: fromSeat, calledTile: tile };
  } else return false;

  recordPaoResponsibility(seat, meld);
  player.melds.push(meld);
  player.isOpen = true;
  if (G.players[fromSeat] && G.players[fromSeat].river.length) G.players[fromSeat].river.pop();
  G.log.push((seat === 'you' ? 'あなたが' : (OnlineGame.getSeatDisplayName(seat) + 'が')) + tileName(tile) + 'を' + (action.type === 'chi' ? 'チー' : action.type === 'pon' ? 'ポン' : 'カン') + 'しました。');
  cancelAllIppatsu();
  G.pendingCall = null;
  G.pendingCallIndex = null;
  G.pendingCallWindow = null;
  G.currentTurnSeat = seat;
  G.lastDiscardWasLastLiveTile = false;

  if (action.type === 'kan') {
    openKanDora();
    var rinshan = drawRinshan();
    if (!rinshan) {
      G.gameOver = true; G.processing = false; G.outcome = { type: 'ryuukyoku' }; render();
      if (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline() && OnlinePeer.isHost()) OnlineGame.syncRoundOver();
      return true;
    }
    clearTemporaryFuriten(seat);
    player.hand.push(rinshan);
    G.lastDrawn = rinshan;
    G.lastDrawWasLastLiveTile = false;
    G.lastDrawWasRinshan = true;
    G.justDrew = seat === 'you';
    G.log.push((seat === 'you' ? 'あなたは' : OnlineGame.getSeatDisplayName(seat) + 'は') + '嶺上牌から ' + tileName(rinshan) + ' をツモりました。');
  } else {
    G.justDrew = false;
  }
  G.processing = seat !== 'you';
  render();
  if (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline() && OnlinePeer.isHost()) {
    if (seat !== 'you' && OnlineGame.isGuestSeat(seat)) OnlineGame.syncGuestCallAccepted(seat);
    OnlineGame.syncOnlineStateToAll();
  }
  return true;
}


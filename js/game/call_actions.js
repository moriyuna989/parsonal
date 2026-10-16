// js/game/call_actions.js
// プレイヤーの鳴き・ツモ操作

function executeCallPon() {
  var pc = G.pendingCall;
  var hand = G.players.you.hand;
  var targetIdx = tileIndex(pc.tile);
  var removed = [];
  for (var i = hand.length - 1; i >= 0; i--) {
    if (tileIndex(hand[i]) === targetIdx && removed.length < 2) {
      removed.push(hand.splice(i, 1)[0]);
    }
  }
  var pon = { type: 'pon', tiles: [pc.tile].concat(removed), from: pc.fromSeat, calledTile: pc.tile };
  recordPaoResponsibility('you', pon);
  G.players.you.melds.push(pon);
  G.players.you.isOpen = true;
  G.players[pc.fromSeat].river.pop();
  G.log.push('あなたが' + tileName(pc.tile) + 'をポンしました。捨てる牌を選んでください。');
  cancelAllIppatsu();
  G.pendingCall = null;
  G.pendingCallIndex = null;
  G.justDrew = false;
  G.processing = false;
  G.currentTurnSeat = 'you';
  render();
}
window.executeCallPon = executeCallPon;

function executeCallChi(t1, t2) {
  var pc = G.pendingCall;
  var hand = G.players.you.hand;
  hand.splice(hand.indexOf(t1), 1);
  hand.splice(hand.indexOf(t2), 1);
  var chiTiles = [pc.tile].concat(sortTiles([t1, t2]));
  G.players.you.melds.push({ type: 'chi', tiles: chiTiles, from: pc.fromSeat, calledTile: pc.tile });
  G.players.you.isOpen = true;
  G.players[pc.fromSeat].river.pop();
  G.log.push('あなたが' + tileName(pc.tile) + 'をチーしました。捨てる牌を選んでください。');
  cancelAllIppatsu();
  G.pendingCall = null;
  G.pendingCallIndex = null;
  G.justDrew = false;
  G.processing = false;
  G.currentTurnSeat = 'you';
  render();
}
window.executeCallChi = executeCallChi;

function executeCallPass() {
  if (G.pendingCall && G.pendingCall.remoteOfferId && typeof OnlineGame !== 'undefined' && OnlineGame.isOnline() && !OnlinePeer.isHost()) {
    OnlineGame.respondCall({ type: 'pass' });
    return;
  }
  if (G.pendingCallWindow) {
    advanceCallWindow(G.pendingCallWindow.index + 1);
    return;
  }
  var pc = G.pendingCall;
  var fromSeat = pc ? pc.fromSeat : G.lastDiscardSeat;
  G.pendingCall = null;
  G.pendingCallIndex = null;
  G.processing = true;
  render();
  if (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline()) {
    OnlineGame.syncOnlineStateToAll();
  }
  if (isPractice) {
    G.currentTurnSeat = nextSeat(fromSeat);
    setTimeout(advancePracticeTurn, 400);
  } else {
    setTimeout(advanceOpponentQueue, 400);
  }
}
window.executeCallPass = executeCallPass;

function getCallActions() {
  if (!G.pendingCall) return [];
  var pc = G.pendingCall;
  var actions = [];
  if (pc.canKan) {
    actions.push({ type: 'kan', label: 'カン (K)', keyHint: 'K' });
  }
  if (pc.canPon) {
    actions.push({ type: 'pon', label: 'ポン (P)', keyHint: 'P' });
  }
  pc.chiOptions.forEach(function (combo, idx) {
    var hint = (pc.chiOptions.length === 1 && !pc.canPon && !pc.canKan) ? 'C' : '' + (actions.length + 1);
    actions.push({
      type: 'chi',
      idx: idx,
      combo: combo,
      label: 'チー (' + hint + ')（' + tileName(combo[0]) + '・' + tileName(combo[1]) + '）',
      keyHint: hint
    });
  });
  actions.push({ type: 'pass', label: 'スルー (Esc)', keyHint: 'Esc' });
  return actions;
}
window.getCallActions = getCallActions;

function executeCallAction(action) {
  if (!action) return;
  if (G.pendingCall && G.pendingCall.remoteOfferId && typeof OnlineGame !== 'undefined' && OnlineGame.isOnline() && !OnlinePeer.isHost()) {
    OnlineGame.respondCall(action);
    return;
  }
  if (G.pendingCallWindow && G.pendingCallWindow.candidates[G.pendingCallWindow.index].seat === 'you') {
    if (action.type === 'pass') { executeCallPass(); return; }
    applyCallForSeat('you', action, G.pendingCallWindow);
    return;
  }
  if (action.type === 'kan') {
    executeCallKan();
  } else if (action.type === 'pon') {
    executeCallPon();
  } else if (action.type === 'chi') {
    executeCallChi(action.combo[0], action.combo[1]);
  } else if (action.type === 'pass') {
    executeCallPass();
  }
}
window.executeCallAction = executeCallAction;

function userTsumo() {
  if (!canPlayerWinWith('you', G.lastDrawn, true)) return;
  if (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline() && !OnlinePeer.isHost()) {
    OnlineGame.requestTsumo();
    return;
  }
  G.gameOver = true;
  G.outcome = { type: 'user_tsumo', tile: G.lastDrawn, score: scoreUserWin(G.players.you.hand, G.lastDrawn, true) };
  render();
  if (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline()) {
    OnlineGame.syncRoundOver();
  }
}
window.userTsumo = userTsumo;

// =====================================================================
// js/game_flow.js
// 対局進行・ターン制御・ツモ/打牌・鳴き（副露/槓）処理
// =====================================================================

function checkUserCallOptions(tile, fromSeat) {
  if (G.players.you.riichi) {
    return { canPon: false, canKan: false, chiOptions: [] };
  }
  var hand = G.players.you.hand;
  var targetIdx = tileIndex(tile);
  var matchCount = hand.filter(function (t) { return tileIndex(t) === targetIdx; }).length;
  var canPon = matchCount >= 2;
  var canKan = matchCount >= 3;
  var chiOptions = [];
  if (fromSeat === 'p4') {
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
    tenpaiIfDiscard[code] = findWaitsOpen(copy, meldCount).length > 0;
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

function afterUserDiscard(tileCode, viaRiichi) {
  var idx = G.players.you.hand.indexOf(tileCode);
  G.players.you.hand.splice(idx, 1);
  G.players.you.river.push(tileCode);
  G.lastDiscardSeat = 'you';
  G.selected = null;
  G.selectedIndex = null;
  G.lastTileClick = null;
  G.justDrew = false;
  if (viaRiichi) {
    G.players.you.riichi = true;
    G.players.you.riichiTurn = G.players.you.river.length;
    G.players.you.ippatsu = true;
    if (isPractice && matchState) {
      matchState.scores.you -= 1000;
      matchState.riichiPool = (matchState.riichiPool || 0) + 1;
    }
  } else if (G.players.you.riichi) {
    G.players.you.ippatsu = false;
  }
  G.log.push('あなたが' + tileName(tileCode) + 'を切りました。' + (viaRiichi ? '（リーチ宣言）' : ''));
  var ron = checkRon(tileCode, 'you');
  if (ron) {
    G.gameOver = true;
    var ronScore = G.players[ron].tpl ? scoreTemplateWin(ron, false, tileCode) : scorePlayerWin(ron, G.players[ron].hand.concat([tileCode]), tileCode, false);
    G.outcome = { type: 'user_dealin', to: ron, tile: tileCode, score: ronScore };
    render();
    return;
  }
  G.players.you.wait = findWaitsOpen(G.players.you.hand, G.players.you.melds.length);

  if (isPractice) {
    G.currentTurnSeat = nextSeat('you');
    G.processing = true;
    render();
    setTimeout(advancePracticeTurn, 550);
  } else {
    runOpponentsSequence();
  }
}
window.afterUserDiscard = afterUserDiscard;

function opponentTurn(seat) {
  if (poolTotal(G.pool) <= 0) return { type: 'ryuukyoku' };
  var draw = drawRandom(G.pool);
  var p = G.players[seat];
  if (p.isTenpai) {
    if (p.wait.includes(draw)) return { type: 'opp_tsumo', seat: seat, tile: draw, score: scoreTemplateWin(seat, true, draw) };
    p.river.push(draw);
    G.lastDiscardSeat = seat;
    G.log.push(SEAT_NAME[seat] + 'が' + tileName(draw) + 'をツモ切りしました。');
    var ron = checkRon(draw, seat);
    if (ron) return ron === 'you'
      ? { type: 'user_ron', via: seat, tile: draw, score: scoreUserWin(G.players.you.hand.concat([draw]), draw, false) }
      : { type: 'other_ron', ronner: ron, discarder: seat, tile: draw, score: scoreTemplateWin(ron, false, draw) };
    return { type: 'continue', tile: draw };
  } else {
    var rs = riichiSeatsActive();
    var discard, wasSafe = false;
    if (rs.length) {
      var safeSets = rs.map(computeSafeSetFor);
      var safeIntersect = safeSets.reduce(function (acc, s) { return new Set([...acc].filter(function (x) { return s.has(x); })); });
      var candTypes = new Set(p.hand.concat([draw]).filter(function (t) { return safeIntersect.has(t); }));
      if (candTypes.size) {
        var arr = [...candTypes]; discard = arr[Math.floor(Math.random() * arr.length)];
        var newHand = p.hand.concat([draw]); newHand.splice(newHand.indexOf(discard), 1); p.hand = newHand;
        wasSafe = true;
      } else { discard = draw; }
    } else { discard = draw; }
    p.river.push(discard);
    G.lastDiscardSeat = seat;
    G.log.push(SEAT_NAME[seat] + 'が' + tileName(discard) + 'を切りました。' + (wasSafe ? '（安全牌）' : ''));
    var ron2 = checkRon(discard, seat);
    if (ron2) return ron2 === 'you'
      ? { type: 'user_ron', via: seat, tile: discard, score: scoreUserWin(G.players.you.hand.concat([discard]), discard, false) }
      : { type: 'other_ron', ronner: ron2, discarder: seat, tile: discard, score: scoreTemplateWin(ron2, false, discard) };
    return { type: 'continue', tile: discard };
  }
}

function advancePracticeTurn() {
  if (!isPractice || !G || G.gameOver) return;
  var seat = G.currentTurnSeat;
  if (!seat || !G.players || !G.players[seat]) return;


  if (seat === 'you') {
    if (poolTotal(G.pool) <= 0) {
      G.processing = false;
      G.gameOver = true;
      G.outcome = { type: 'ryuukyoku' };
      render();
      return;
    }
    var draw = drawRandom(G.pool);
    G.players.you.hand.push(draw);
    G.lastDrawn = draw;
    G.justDrew = true;
    G.processing = false;
    G.log.push('あなたは ' + tileName(draw) + ' をツモりました。');
    render();
    return;
  }

  if (poolTotal(G.pool) <= 0) {
    G.processing = false;
    G.gameOver = true;
    G.outcome = { type: 'ryuukyoku' };
    render();
    return;
  }

  var p = G.players[seat];
  var draw = drawRandom(G.pool);
  p.hand.push(draw);

  if (isComplete14(p.hand)) {
    var winScore = scorePlayerWin(seat, p.hand, draw, true);
    if (winScore.han >= 1) {
      G.processing = false;
      G.gameOver = true;
      G.outcome = { type: 'opp_tsumo', seat: seat, tile: draw, score: winScore };
      render();
      return;
    }
  }

  if (!p.riichi) {
    var cpuCounts = tilesToCounts(p.hand);
    for (var ci = 0; ci < 34; ci++) {
      if (cpuCounts[ci] === 4) {
        var kanCode = indexToCode(ci);
        var removedCpu = [];
        for (var rci = p.hand.length - 1; rci >= 0; rci--) {
          if (tileIndex(p.hand[rci]) === ci && removedCpu.length < 4) {
            removedCpu.push(p.hand.splice(rci, 1)[0]);
          }
        }
        p.melds.push({ type: 'kan', subType: 'ankan', tiles: removedCpu, concealed: true });
        G.log.push(SEAT_NAME[seat] + 'が' + tileName(kanCode) + 'を暗槓しました。');
        cancelAllIppatsu();
        openKanDora();
        var rinshanCpu = drawRinshan();
        if (rinshanCpu) {
          p.hand.push(rinshanCpu);
          draw = rinshanCpu;
        }
        break;
      }
    }
  }

  var discard;
  if (p.riichi) {
    p.ippatsu = false;
    discard = draw;
    p.hand.splice(p.hand.lastIndexOf(draw), 1);
    G.log.push(SEAT_NAME[seat] + 'が' + tileName(discard) + 'をツモ切りしました。');
  } else {
    var cpuLevel = (matchState && matchState.cpuLevel) || 'hard';
    var tenpaiInfo = checkCpuTenpaiAndDiscard(p.hand);
    var riichiDecision = tenpaiInfo.canTenpai ? evaluateCpuRiichiDecisionByLevel(seat, p.hand, tenpaiInfo, cpuLevel) : { shouldRiichi: false };

    if (tenpaiInfo.canTenpai && !p.riichi && riichiDecision.shouldRiichi) {
      p.riichi = true;
      p.riichiTurn = p.river.length + 1;
      p.ippatsu = true;
      p.isTenpai = true;
      p.wait = tenpaiInfo.waits;
      if (!G.tenpaiSeats.includes(seat)) G.tenpaiSeats.push(seat);
      if (isPractice && matchState) {
        matchState.scores[seat] -= 1000;
        matchState.riichiPool = (matchState.riichiPool || 0) + 1;
      }
      discard = tenpaiInfo.discardTile;
      p.hand.splice(p.hand.indexOf(discard), 1);
      G.log.push(SEAT_NAME[seat] + 'が' + tileName(discard) + 'を切りました。（リーチ宣言）');
    } else if (tenpaiInfo.canTenpai && !p.riichi && !riichiDecision.shouldRiichi) {
      // テンパイしたがダマテン（好形手変わり待ち、または他家リーチへの対応）
      p.isTenpai = true;
      p.wait = tenpaiInfo.waits;
      if (!G.tenpaiSeats.includes(seat)) G.tenpaiSeats.push(seat);
      var rs = riichiSeatsActive().filter(function (s) { return s !== seat; });
      if (rs.length > 0) {
        // 他家リーチがあるなら安全牌を優先して切る
        discard = chooseCpuDiscardByLevel(seat, p.hand, cpuLevel);
      } else {
        discard = tenpaiInfo.discardTile;
      }
      p.hand.splice(p.hand.indexOf(discard), 1);
      G.log.push(SEAT_NAME[seat] + 'が' + tileName(discard) + 'を切りました。');
    } else {
      // 通常打牌（選択されたCPUレベルに応じた打牌）
      discard = chooseCpuDiscardByLevel(seat, p.hand, cpuLevel);
      p.hand.splice(p.hand.indexOf(discard), 1);
      G.log.push(SEAT_NAME[seat] + 'が' + tileName(discard) + 'を切りました。');
    }
  }

  p.river.push(discard);
  G.lastDiscardSeat = seat;

  if (!p.riichi) {
    p.wait = findWaitsOpen(p.hand, p.melds ? p.melds.length : 0);
    p.isTenpai = (p.wait.length > 0);
    if (p.isTenpai) {
      if (!G.tenpaiSeats.includes(seat)) G.tenpaiSeats.push(seat);
    } else {
      var tIdx = G.tenpaiSeats.indexOf(seat);
      if (tIdx !== -1) G.tenpaiSeats.splice(tIdx, 1);
    }
  }

  var ron = checkRon(discard, seat);
  if (ron) {
    G.processing = false;
    G.gameOver = true;
    if (ron === 'you') {
      G.outcome = {
        type: 'user_ron',
        via: seat,
        tile: discard,
        score: scorePlayerWin('you', G.players.you.hand.concat([discard]), discard, false)
      };
    } else {
      G.outcome = {
        type: 'other_ron',
        ronner: ron,
        discarder: seat,
        tile: discard,
        score: scorePlayerWin(ron, G.players[ron].hand.concat([discard]), discard, false)
      };
    }
    render();
    return;
  }

  render();
  var callOpts = checkUserCallOptions(discard, seat);
  if (callOpts.canPon || callOpts.chiOptions.length || callOpts.canKan) {
    G.pendingCall = { tile: discard, fromSeat: seat, canPon: callOpts.canPon, canKan: callOpts.canKan, chiOptions: callOpts.chiOptions };
    G.pendingCallIndex = null;
    G.processing = false;
    render();
    return;
  }

  G.currentTurnSeat = nextSeat(seat);
  setTimeout(advancePracticeTurn, 550);
}
window.advancePracticeTurn = advancePracticeTurn;

function runOpponentsSequence() {
  G.pendingOpponentQueue = ['p2', 'p3', 'p4'];
  G.processing = true;
  render();
  setTimeout(advanceOpponentQueue, 400);
}

function advanceOpponentQueue() {
  if (!G || !G.pendingOpponentQueue || G.gameOver) return;
  if (!G.pendingOpponentQueue.length) {
    if (poolTotal(G.pool) <= 0) { G.processing = false; G.gameOver = true; G.outcome = { type: 'ryuukyoku' }; render(); return; }
    var draw = drawRandom(G.pool);
    G.players.you.hand.push(draw);
    G.lastDrawn = draw;
    G.justDrew = true;
    G.log.push('あなたは ' + tileName(draw) + ' をツモりました。');
    G.processing = false;
    render();
    return;
  }
  var seat = G.pendingOpponentQueue.shift();
  var res = opponentTurn(seat);
  if (res.type !== 'continue') { G.processing = false; G.gameOver = true; G.outcome = res; render(); return; }
  render();
  var callOpts = checkUserCallOptions(res.tile, seat);
  if (callOpts.canPon || callOpts.chiOptions.length || callOpts.canKan) {
    G.pendingCall = { tile: res.tile, fromSeat: seat, canPon: callOpts.canPon, canKan: callOpts.canKan, chiOptions: callOpts.chiOptions };
    G.pendingCallIndex = null;
    G.processing = false;
    render();
    return;
  }
  setTimeout(advanceOpponentQueue, 550);
}

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
  var hand = player.hand;
  var counts = tilesToCounts(hand);
  var ankanList = [];
  for (var i = 0; i < 34; i++) {
    if (counts[i] === 4) {
      var cand = hand.find(function (t) { return tileIndex(t) === i; });
      if (cand) ankanList.push(cand);
    }
  }
  var kakanList = [];
  (player.melds || []).forEach(function (m) {
    if (m.type === 'pon') {
      var ponIdx = tileIndex(m.tiles[0]);
      var matchInHand = hand.find(function (t) { return tileIndex(t) === ponIdx; });
      if (matchInHand) {
        kakanList.push({ tile: matchInHand, meld: m });
      }
    }
  });
  return { canAnkan: ankanList.length > 0, ankanList: ankanList, canKakan: kakanList.length > 0, kakanList: kakanList };
}
window.checkConcealedKan = checkConcealedKan;

function executeCallKan() {
  var pc = G.pendingCall;
  var hand = G.players.you.hand;
  var targetIdx = tileIndex(pc.tile);
  var removed = [];
  for (var i = hand.length - 1; i >= 0; i--) {
    if (tileIndex(hand[i]) === targetIdx && removed.length < 3) {
      removed.push(hand.splice(i, 1)[0]);
    }
  }
  var meldTiles = [pc.tile].concat(removed);
  G.players.you.melds.push({ type: 'kan', subType: 'minkan', tiles: meldTiles, from: pc.fromSeat, calledTile: pc.tile });
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
    return;
  }
  G.players.you.hand.push(rinshan);
  G.lastDrawn = rinshan;
  G.justDrew = true;
  G.log.push('嶺上牌から ' + tileName(rinshan) + ' をツモりました。捨てる牌を選んでください。');
  render();
}
window.executeCallKan = executeCallKan;

function executeAnkan(targetTile) {
  var hand = G.players.you.hand;
  var targetIdx = tileIndex(targetTile);
  var removed = [];
  for (var i = hand.length - 1; i >= 0; i--) {
    if (tileIndex(hand[i]) === targetIdx && removed.length < 4) {
      removed.push(hand.splice(i, 1)[0]);
    }
  }
  G.players.you.melds.push({ type: 'kan', subType: 'ankan', tiles: removed, concealed: true });
  G.log.push('あなたが' + tileName(targetTile) + 'を暗槓しました。');
  cancelAllIppatsu();
  openKanDora();

  var rinshan = drawRinshan();
  if (!rinshan) {
    G.gameOver = true;
    G.outcome = { type: 'ryuukyoku' };
    render();
    return;
  }
  G.players.you.hand.push(rinshan);
  G.lastDrawn = rinshan;
  G.justDrew = true;
  G.log.push('嶺上牌から ' + tileName(rinshan) + ' をツモりました。捨てる牌を選んでください。');
  render();
}
window.executeAnkan = executeAnkan;

function executeKakan(targetTile) {
  var hand = G.players.you.hand;
  var targetIdx = tileIndex(targetTile);
  var idx = hand.findIndex(function (t) { return tileIndex(t) === targetIdx; });
  if (idx !== -1) {
    var tile = hand.splice(idx, 1)[0];
    var meld = G.players.you.melds.find(function (m) { return m.type === 'pon' && tileIndex(m.tiles[0]) === targetIdx; });
    if (meld) {
      meld.type = 'kan';
      meld.subType = 'kakan';
      meld.tiles.push(tile);
      meld.kakanTile = tile;
    }
    G.log.push('あなたが' + tileName(tile) + 'を加槓しました。');
    cancelAllIppatsu();
    openKanDora();

    var rinshan = drawRinshan();
    if (!rinshan) {
      G.gameOver = true;
      G.outcome = { type: 'ryuukyoku' };
      render();
      return;
    }
    G.players.you.hand.push(rinshan);
    G.lastDrawn = rinshan;
    G.justDrew = true;
    G.log.push('嶺上牌から ' + tileName(rinshan) + ' をツモりました。捨てる牌を選んでください。');
    render();
  }
}
window.executeKakan = executeKakan;

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
  G.players.you.melds.push({ type: 'pon', tiles: [pc.tile].concat(removed), from: pc.fromSeat, calledTile: pc.tile });
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
  var pc = G.pendingCall;
  var fromSeat = pc ? pc.fromSeat : G.lastDiscardSeat;
  G.pendingCall = null;
  G.pendingCallIndex = null;
  G.processing = true;
  render();
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
  G.gameOver = true;
  G.outcome = { type: 'user_tsumo', tile: G.lastDrawn, score: scoreUserWin(G.players.you.hand, G.lastDrawn, true) };
  render();
}
window.userTsumo = userTsumo;

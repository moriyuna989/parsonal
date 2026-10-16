// js/game/turns.js
// CPUと練習局の手番進行

function opponentTurn(seat) {
  if (poolTotal(G.pool) <= 0) return { type: 'ryuukyoku' };
  var draw = drawRandom(G.pool);
  var p = G.players[seat];
  G.lastDrawWasLastLiveTile = poolTotal(G.pool) === 0;
  G.lastDrawWasRinshan = false;
  clearTemporaryFuriten(seat);
  if (p.isTenpai) {
    if (p.wait.includes(draw)) {
      var templateScore = scoreTemplateWin(seat, true, draw);
      if (templateScore.isComplete && !templateScore.noYaku) return { type: 'opp_tsumo', seat: seat, tile: draw, score: templateScore };
    }
    p.river.push(draw);
    recordDiscardScoringContext(seat);
    G.lastDiscardSeat = seat;
    G.log.push(SEAT_NAME[seat] + 'が' + tileName(draw) + 'をツモ切りしました。');
    var ron = checkRon(draw, seat, function () { G.processing = true; setTimeout(advanceOpponentQueue, 400); });
    if (ron === 'pending') return { type: 'pending_ron' };
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
    recordDiscardScoringContext(seat);
    G.lastDiscardSeat = seat;
    G.log.push(SEAT_NAME[seat] + 'が' + tileName(discard) + 'を切りました。' + (wasSafe ? '（安全牌）' : ''));
    var ron2 = checkRon(discard, seat, function () { G.processing = true; setTimeout(advanceOpponentQueue, 400); });
    if (ron2 === 'pending') return { type: 'pending_ron' };
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
      if (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline()) {
        OnlineGame.syncRoundOver();
      }
      return;
    }
    var draw = drawRandom(G.pool);
    G.lastDrawWasLastLiveTile = poolTotal(G.pool) === 0;
    G.lastDrawWasRinshan = false;
    clearTemporaryFuriten('you');
    G.players.you.hand.push(draw);
    G.lastDrawn = draw;
    G.justDrew = true;
    G.processing = false;
    G.log.push('あなたは ' + tileName(draw) + ' をツモりました。');
    render();
    if (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline()) {
      OnlineGame.syncOnlineStateToAll();
    }
    return;
  }

  // オンライン対戦で人間のゲストプレイヤーのターンの場合
  if (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline() && OnlineGame.isGuestSeat(seat)) {
    if (poolTotal(G.pool) <= 0) {
      G.processing = false;
      G.gameOver = true;
      G.outcome = { type: 'ryuukyoku' };
      render();
      OnlineGame.syncRoundOver();
      return;
    }
    var initialGuestDraw = G.initialDrawSeat === seat && G.lastDrawn && G.players[seat].hand.includes(G.lastDrawn);
    var drawGuest = initialGuestDraw ? null : drawRandom(G.pool);
    if (initialGuestDraw) G.initialDrawSeat = null;
    else {
      G.lastDrawWasLastLiveTile = poolTotal(G.pool) === 0;
      G.lastDrawWasRinshan = false;
      clearTemporaryFuriten(seat);
      G.players[seat].hand.push(drawGuest);
      G.lastDrawn = drawGuest;
    }
    G.justDrew = true;
    G.processing = true; // ホスト側はゲストの打牌を待つ
    var gName = OnlineGame.getSeatDisplayName(seat);
    G.log.push(gName + 'のツモ番です。');
    render();

    // ゲストへ「あなたのターンです」を送信（ツモ牌を同封）
    OnlineGame.notifyGuestTurn(seat, drawGuest);
    return; // CPU打牌には進まずここで待機！
  }

  if (poolTotal(G.pool) <= 0) {
    G.processing = false;
    G.gameOver = true;
    G.outcome = { type: 'ryuukyoku' };
    render();
    if (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline()) {
      OnlineGame.syncRoundOver();
    }
    return;
  }

  var p = G.players[seat];
  var initialCpuDraw = G.initialDrawSeat === seat && G.lastDrawn && p.hand.includes(G.lastDrawn);
  var draw = initialCpuDraw ? G.lastDrawn : drawRandom(G.pool);
  if (initialCpuDraw) G.initialDrawSeat = null;
  else {
    G.lastDrawWasLastLiveTile = poolTotal(G.pool) === 0;
    G.lastDrawWasRinshan = false;
    clearTemporaryFuriten(seat);
  }
  if (!initialCpuDraw) p.hand.push(draw);

  if (isComplete14(p.hand)) {
    var winScore = scorePlayerWin(seat, p.hand, draw, true);
    if (winScore.isComplete && !winScore.noYaku && winScore.han >= 1) {
      G.processing = false;
      G.gameOver = true;
      G.outcome = { type: 'opp_tsumo', seat: seat, tile: draw, score: winScore };
      render();
      if (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline()) {
        OnlineGame.syncRoundOver();
      }
      return;
    }
  }

  if (!p.riichi && !G.lastDrawWasLastLiveTile && totalKanCount() < 4) {
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
        if (!rinshanCpu) {
          G.processing = false;
          G.gameOver = true;
          G.outcome = { type: 'ryuukyoku' };
          render();
          if (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline()) OnlineGame.syncRoundOver();
          return;
        }
        p.hand.push(rinshanCpu);
        draw = rinshanCpu;
        clearTemporaryFuriten(seat);
        G.lastDrawWasLastLiveTile = false;
        G.lastDrawWasRinshan = true;
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
      p.doubleRiichi = !!G.firstTurnUninterrupted && !p.firstDiscardDone;
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
  recordDiscardScoringContext(seat);
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

  var continueAfterDiscard = function () {
    startCallWindow(discard, seat, function () {
      G.currentTurnSeat = nextSeat(seat);
      if (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline()) OnlineGame.syncOnlineStateToAll();
      setTimeout(advancePracticeTurn, 550);
    });
  };
  var ron = checkRon(discard, seat, continueAfterDiscard);
  if (ron === 'pending') return;
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
    if (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline()) {
      OnlineGame.syncRoundOver();
    }
    return;
  }

  continueAfterDiscard();
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
    G.lastDrawWasLastLiveTile = poolTotal(G.pool) === 0;
    G.lastDrawWasRinshan = false;
    clearTemporaryFuriten('you');
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
  if (res.type === 'pending_ron') return;
  if (res.type !== 'continue') { G.processing = false; G.gameOver = true; G.outcome = res; render(); return; }
  startCallWindow(res.tile, seat, function () { setTimeout(advanceOpponentQueue, 550); });
}


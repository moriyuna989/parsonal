// js/game/settlement.js
// 局の点数精算と次局進行

function settleScores(o) {
  if (!isPractice || !matchState || G.scoresSettled) return;
  G.scoresSettled = true;

  var diffs = { you: 0, p2: 0, p3: 0, p4: 0 };
  var honbaBonus = (G.honba || 0) * 300;
  var honbaTsumoChild = (G.honba || 0) * 100;
  var honbaTsumoDealer = (G.honba || 0) * 100;
  var riichiBonus = (matchState.riichiPool || 0) * 1000;

  function paoSeats(score) {
    return Array.from(new Set((score.pao || []).map(function (entry) { return entry.responsibleSeat; }).filter(Boolean)));
  }

  function chargePaoHonba(responsibleSeats, honbaAmount) {
    if (!responsibleSeats.length || !honbaAmount) return;
    var baseShare = Math.floor(honbaAmount / responsibleSeats.length / 100) * 100;
    var remainder = honbaAmount - baseShare * responsibleSeats.length;
    responsibleSeats.forEach(function (seat, index) {
      var share = baseShare + (index < remainder / 100 ? 100 : 0);
      diffs[seat] -= share;
    });
  }

  function transferPaoHonba(responsibleSeats, payer, honbaAmount) {
    if (!responsibleSeats.length || !honbaAmount) return;
    diffs[payer] += honbaAmount;
    chargePaoHonba(responsibleSeats, honbaAmount);
  }

  function applyPaoRon(score, discarder) {
    var liable = score.pao || [];
    if (!liable.length) return;
    var oneYakuman = scorePoints(13, 0, !!score.dealer, false, 1).total;
    liable.forEach(function (entry) {
      if (entry.responsibleSeat === discarder) return;
      var half = oneYakuman / 2;
      diffs[discarder] += half;
      diffs[entry.responsibleSeat] -= half;
    });
    transferPaoHonba(paoSeats(score), discarder, honbaBonus);
  }

  function applyPaoTsumo(score, winner) {
    var liable = score.pao || [];
    if (!liable.length) return;
    var oneYakuman = scorePoints(13, 0, !!score.dealer, true, 1);
    liable.forEach(function (entry) {
      SEATS.forEach(function (seat) {
        if (seat === winner) return;
        var ordinaryShare = score.dealer ? oneYakuman.perAll : (seat === G.dealerSeat ? oneYakuman.perDealer : oneYakuman.perNonDealer);
        diffs[seat] += ordinaryShare;
      });
      diffs[entry.responsibleSeat] -= oneYakuman.total;
    });
    SEATS.forEach(function (seat) {
      if (seat === winner) return;
      var ordinaryHonba = score.dealer ? honbaTsumoDealer : (seat === G.dealerSeat ? honbaTsumoDealer : honbaTsumoChild);
      diffs[seat] += ordinaryHonba;
    });
    // With multiple liable players, split the 300-point honba in 100-point units.
    chargePaoHonba(paoSeats(score), honbaBonus);
  }

  if (o.type === 'user_dealin') {
    var winScore = o.score.total + honbaBonus;
    diffs.you -= winScore;
    diffs[o.to] += winScore + riichiBonus;
    applyPaoRon(o.score, 'you');
    matchState.riichiPool = 0;
  } else if (o.type === 'opp_tsumo') {
    var winner = o.seat;
    if (o.score.dealer) {
      var payEach = o.score.perAll + honbaTsumoDealer;
      SEATS.forEach(function (s) {
        if (s === winner) {
          diffs[s] += (payEach * 3) + riichiBonus;
        } else {
          diffs[s] -= payEach;
        }
      });
    } else {
      var payDealer = o.score.perDealer + honbaTsumoDealer;
      var payChild = o.score.perNonDealer + honbaTsumoChild;
      SEATS.forEach(function (s) {
        if (s === winner) {
          diffs[s] += (payDealer + payChild * 2) + riichiBonus;
        } else if (s === G.dealerSeat) {
          diffs[s] -= payDealer;
        } else {
          diffs[s] -= payChild;
        }
      });
    }
    applyPaoTsumo(o.score, winner);
    matchState.riichiPool = 0;
  } else if (o.type === 'other_ron') {
    var winScore = o.score.total + honbaBonus;
    diffs[o.discarder] -= winScore;
    diffs[o.ronner] += winScore + riichiBonus;
    applyPaoRon(o.score, o.discarder);
    matchState.riichiPool = 0;
  } else if (o.type === 'user_ron') {
    var winScore = o.score.total + honbaBonus;
    diffs[o.via] -= winScore;
    diffs.you += winScore + riichiBonus;
    applyPaoRon(o.score, o.via);
    matchState.riichiPool = 0;
  } else if (o.type === 'user_tsumo') {
    if (o.score.dealer) {
      var payEach = o.score.perAll + honbaTsumoDealer;
      SEATS.forEach(function (s) {
        if (s === 'you') {
          diffs.you += (payEach * 3) + riichiBonus;
        } else {
          diffs[s] -= payEach;
        }
      });
    } else {
      var payDealer = o.score.perDealer + honbaTsumoDealer;
      var payChild = o.score.perNonDealer + honbaTsumoChild;
      SEATS.forEach(function (s) {
        if (s === 'you') {
          diffs.you += (payDealer + payChild * 2) + riichiBonus;
        } else if (s === G.dealerSeat) {
          diffs[s] -= payDealer;
        } else {
          diffs[s] -= payChild;
        }
      });
    }
    applyPaoTsumo(o.score, 'you');
    matchState.riichiPool = 0;
  } else if (o.type === 'ryuukyoku') {
    var tenpaiList = [];
    SEATS.forEach(function (s) {
      var p = G.players[s];
      var expectedLen = 13 - 3 * (p.melds ? p.melds.length : 0);
      var w = (p.hand.length === expectedLen) ? findWaitsOpen(p.hand, p.melds ? p.melds.length : 0) : [];
      if (w.length > 0) tenpaiList.push(s);
    });
    var tCount = tenpaiList.length;
    if (tCount === 1) {
      SEATS.forEach(function (s) {
        if (tenpaiList.includes(s)) diffs[s] += 3000;
        else diffs[s] -= 1000;
      });
    } else if (tCount === 2) {
      SEATS.forEach(function (s) {
        if (tenpaiList.includes(s)) diffs[s] += 1500;
        else diffs[s] -= 1500;
      });
    } else if (tCount === 3) {
      SEATS.forEach(function (s) {
        if (tenpaiList.includes(s)) diffs[s] += 1000;
        else diffs[s] -= 3000;
      });
    }
  }

  SEATS.forEach(function (s) {
    matchState.scores[s] += diffs[s];
  });
  G.settleDiffs = diffs;
}
window.settleScores = settleScores;

function checkKyokuResultStatus() {
  if (!isPractice || !matchState) return { isFinished: true, isRenchan: false };
  var hasBust = SEATS.some(function (s) { return matchState.scores[s] < 0; });
  if (hasBust) return { isFinished: true, isRenchan: false, reason: 'bust' };

  if (matchState.rounds === 1) {
    return { isFinished: true, isRenchan: false, reason: 'rounds_done' };
  }

  var o = G.outcome;
  var isRenchan = false;
  if (o.type === 'user_tsumo') {
    isRenchan = (G.dealerSeat === 'you');
  } else if (o.type === 'user_ron') {
    isRenchan = (G.dealerSeat === 'you');
  } else if (o.type === 'opp_tsumo') {
    isRenchan = (G.dealerSeat === o.seat);
  } else if (o.type === 'other_ron') {
    isRenchan = (G.dealerSeat === o.ronner);
  } else if (o.type === 'ryuukyoku') {
    var dealerP = G.players[G.dealerSeat];
    var expectedLen = 13 - 3 * (dealerP.melds ? dealerP.melds.length : 0);
    var dealerWaits = (dealerP.hand.length === expectedLen) ? findWaitsOpen(dealerP.hand, dealerP.melds ? dealerP.melds.length : 0) : [];
    isRenchan = (dealerWaits.length > 0);
  }

  var isLastKyoku = false;
  if (matchState.rounds === 4 && matchState.kyokuWind === '東' && matchState.kyokuNum === 4) {
    isLastKyoku = true;
  } else if (matchState.rounds === 8 && matchState.kyokuWind === '南' && matchState.kyokuNum === 4) {
    isLastKyoku = true;
  }

  if (isLastKyoku && !isRenchan) {
    return { isFinished: true, isRenchan: false, reason: 'last_kyoku_passed' };
  }

  return { isFinished: false, isRenchan: isRenchan };
}
window.checkKyokuResultStatus = checkKyokuResultStatus;

function proceedToNextKyoku() {
  if (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline() && !OnlinePeer.isHost()) {
    OnlineGame.requestNextKyoku();
    return;
  }
  var st = checkKyokuResultStatus();
  if (st.isFinished) {
    renderMatchFinalResult();
    return;
  }

  if (st.isRenchan) {
    matchState.honba += 1;
  } else {
    matchState.dealerSeat = nextSeat(matchState.dealerSeat);
    matchState.honba = (G.outcome.type === 'ryuukyoku') ? matchState.honba + 1 : 0;
    matchState.kyokuNum += 1;
    if (matchState.kyokuNum > 4) {
      if (matchState.kyokuWind === '東') {
        matchState.kyokuWind = '南';
        matchState.kyokuNum = 1;
      }
    }
  }
  matchState.kyokuIndex += 1;

  G = newGame();
  render();
  if (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline() && OnlinePeer.isHost()) OnlineGame.syncNextKyoku();
  if (isPractice && G.dealerSeat !== 'you') {
    setTimeout(advancePracticeTurn, 600);
  }
}
window.proceedToNextKyoku = proceedToNextKyoku;


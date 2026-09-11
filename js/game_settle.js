// =====================================================================
// js/game_settle.js
// 局清算・スコア移動・連荘/輪荘/終了判定・Mリーグ順位点・最終結果画面
// =====================================================================

function settleScores(o) {
  if (!isPractice || !matchState || G.scoresSettled) return;
  G.scoresSettled = true;

  var diffs = { you: 0, p2: 0, p3: 0, p4: 0 };
  var honbaBonus = (G.honba || 0) * 300;
  var honbaTsumoChild = (G.honba || 0) * 100;
  var honbaTsumoDealer = (G.honba || 0) * 100;
  var riichiBonus = (matchState.riichiPool || 0) * 1000;

  if (o.type === 'user_dealin') {
    var winScore = o.score.total + honbaBonus;
    diffs.you -= winScore;
    diffs[o.to] += winScore + riichiBonus;
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
    matchState.riichiPool = 0;
  } else if (o.type === 'other_ron') {
    var winScore = o.score.total + honbaBonus;
    diffs[o.discarder] -= winScore;
    diffs[o.ronner] += winScore + riichiBonus;
    matchState.riichiPool = 0;
  } else if (o.type === 'user_ron') {
    var winScore = o.score.total + honbaBonus;
    diffs[o.via] -= winScore;
    diffs.you += winScore + riichiBonus;
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
  if (isPractice && G.dealerSeat !== 'you') {
    setTimeout(advancePracticeTurn, 600);
  }
}
window.proceedToNextKyoku = proceedToNextKyoku;

function calculateMLeaguePoints(scores, riichiPool) {
  var seatsOrder = SEATS.slice();
  var finalScores = {};
  seatsOrder.forEach(function (s) {
    finalScores[s] = scores[s];
  });

  // 最終局終了時に残った供託リーチ棒はトップ加算（同点は起家優先）
  if (riichiPool && riichiPool > 0) {
    var maxScore = -Infinity;
    var topSeat = seatsOrder[0];
    seatsOrder.forEach(function (s) {
      if (finalScores[s] > maxScore) {
        maxScore = finalScores[s];
        topSeat = s;
      }
    });
    finalScores[topSeat] += riichiPool * 1000;
  }

  var ranked = seatsOrder.map(function (s) {
    return {
      seat: s,
      name: SEAT_NAME[s],
      score: finalScores[s],
      seatIndex: seatsOrder.indexOf(s)
    };
  }).sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score;
    return a.seatIndex - b.seatIndex;
  });

  // 順位点（オカ20pt込み: 1位+50, 2位+10, 3位-10, 4位-30）
  var baseUma = [50.0, 10.0, -10.0, -30.0];
  var results = [];

  var i = 0;
  while (i < ranked.length) {
    var j = i;
    while (j < ranked.length && ranked[j].score === ranked[i].score) {
      j++;
    }
    var count = j - i;
    var umaSum = 0;
    for (var k = i; k < j; k++) {
      umaSum += baseUma[k];
    }
    var avgUma = umaSum / count;

    for (var k = i; k < j; k++) {
      var r = ranked[k];
      var rawPt = (r.score - 30000) / 1000;
      var totalPt = rawPt + avgUma;
      totalPt = Math.round(totalPt * 10) / 10;
      if (Object.is(totalPt, -0)) totalPt = 0;

      results.push({
        seat: r.seat,
        name: r.name,
        rank: i + 1,
        isTie: count > 1,
        score: r.score,
        diff: r.score - 25000,
        point: totalPt
      });
    }
    i = j;
  }

  return results;
}
window.calculateMLeaguePoints = calculateMLeaguePoints;

function renderMatchFinalResult() {
  if (window._tgKeyHandler) {
    window.removeEventListener('keydown', window._tgKeyHandler);
    window._tgKeyHandler = null;
  }

  var handleFinalResultKeyDown = function (e) {
    if (e.key === 'Enter') {
      var restartBtn = document.getElementById('btnRestartSameMatch');
      if (restartBtn) {
        e.preventDefault();
        restartBtn.click();
      }
    }
  };
  window._tgKeyHandler = handleFinalResultKeyDown;
  window.addEventListener('keydown', window._tgKeyHandler);

  var ranking = calculateMLeaguePoints(matchState.scores, matchState.riichiPool);
  var youResult = ranking.find(function (r) { return r.seat === 'you'; });
  var youRank = youResult ? youResult.rank : 1;
  var youPointStr = (youResult && youResult.point > 0 ? '+' : '') + (youResult ? youResult.point.toFixed(1) : '0.0') + 'pt';
  var youPointCls = (youResult && youResult.point >= 0) ? 'plus' : 'minus';

  var rankBadge = '';
  var comment = '';
  if (youRank === 1) {
    rankBadge = '<span class="rank-badge rank-1" style="display:inline-block; padding:4px 14px; border-radius:999px; background:var(--accent); color:#fff; font-weight:800;">1位（トップ！）</span>';
    comment = '見事な勝利です！トップ獲得おめでとうございます！';
  } else if (youRank === 2) {
    rankBadge = '<span class="rank-badge rank-2" style="display:inline-block; padding:4px 14px; border-radius:999px; background:var(--surface); border:1px solid var(--line); color:var(--ink); font-weight:800;">2位</span>';
    comment = '惜しくも2位！手堅い立ち回りでした。';
  } else if (youRank === 3) {
    rankBadge = '<span class="rank-badge rank-3" style="display:inline-block; padding:4px 14px; border-radius:999px; background:var(--surface); border:1px solid var(--line); color:var(--ink); font-weight:800;">3位</span>';
    comment = '3位でした。次回はトップを目指しましょう！';
  } else {
    rankBadge = '<span class="rank-badge rank-4" style="display:inline-block; padding:4px 14px; border-radius:999px; background:rgba(245,101,101,0.15); border:1px solid var(--bad); color:var(--bad); font-weight:800;">4位（ラス）</span>';
    comment = '悔しいラスとなりました。守備とアタリ牌回避を活かしてリベンジしましょう！';
  }

  var tableRows = ranking.map(function (r) {
    var isYou = (r.seat === 'you');
    var diffStr = (r.diff > 0 ? '+' : '') + r.diff.toLocaleString() + '点';
    var pointStr = (r.point > 0 ? '+' : '') + r.point.toFixed(1) + 'pt';
    var pointCls = r.point >= 0 ? 'point-plus' : 'point-minus';
    var rankDisplay = r.isTie ? (r.rank + '位タイ') : (r.rank);
    return '<tr' + (isYou ? ' class="highlight-you"' : '') + '>' +
      '<td style="text-align:center; font-weight:700;"><span class="rank-badge">' + rankDisplay + '</span></td>' +
      '<td style="font-weight:700;">' + r.name + (isYou ? '（あなた）' : '') + '</td>' +
      '<td style="text-align:right; font-weight:700; font-family:monospace;">' + r.score.toLocaleString() + '点</td>' +
      '<td style="text-align:right; font-size:12px; font-weight:700;" class="' + (r.diff >= 0 ? 'score-diff-plus' : 'score-diff-minus') + '">' + diffStr + '</td>' +
      '<td style="text-align:right; font-size:14px;" class="' + pointCls + '">' + pointStr + '</td>' +
      '</tr>';
  }).join('');

  var html = '<div class="match-result-card">' +
    '<div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">' +
      '<div class="match-result-eyebrow">対局終了 - 最終成績</div>' +
      '<span class="mleague-badge">Mリーグルール</span>' +
    '</div>' +
    '<div class="match-result-title">' + matchState.roundName + ' 結果</div>' +
    '<div style="display:flex; align-items:center; gap:10px; margin-bottom:8px; flex-wrap:wrap;">' +
      rankBadge +
      '<span class="your-point-badge ' + youPointCls + '">' + youPointStr + '</span>' +
    '</div>' +
    '<div class="match-result-comment">' + comment + '</div>' +
    '<table class="match-result-table">' +
    '<thead><tr><th>順位</th><th>対局者</th><th style="text-align:right;">最終持ち点</th><th style="text-align:right;">収支</th><th style="text-align:right;">pt</th></tr></thead>' +
    '<tbody>' + tableRows + '</tbody>' +
    '</table>' +
    '<div class="match-rule-footnote">' +
      '<strong>【Mリーグルール計算方式】</strong> 25,000点持ち／30,000点返し（オカ20pt）、順位ウマ 1位:+30 / 2位:+10 / 3位:-10 / 4位:-30（実質順位点: +50 / +10 / -10 / -30）。小数点第1位まで計算。' +
    '</div>' +
    '<div class="match-result-actions">' +
    '<button class="btn-main" id="btnRestartSameMatch">同じ設定でもう一度 (Enter)</button>' +
    '<button class="btn-secondary" id="btnBackToSettings">対局設定に戻る</button>' +
    '<button class="btn-secondary" id="btnBackToHome">ホームに戻る</button>' +
    '</div>' +
    '</div>';

  var root = document.getElementById('tgRoot');
  if (root) root.innerHTML = html;

  document.getElementById('btnRestartSameMatch').addEventListener('click', function () {
    if (window._tgKeyHandler) {
      window.removeEventListener('keydown', window._tgKeyHandler);
      window._tgKeyHandler = null;
    }
    startPracticeMatch(practiceConfig);
  });
  document.getElementById('btnBackToSettings').addEventListener('click', function () {
    if (window._tgKeyHandler) {
      window.removeEventListener('keydown', window._tgKeyHandler);
      window._tgKeyHandler = null;
    }
    goPractice();
  });
  document.getElementById('btnBackToHome').addEventListener('click', function () {
    if (window._tgKeyHandler) {
      window.removeEventListener('keydown', window._tgKeyHandler);
      window._tgKeyHandler = null;
    }
    goHome();
  });
}
window.renderMatchFinalResult = renderMatchFinalResult;

function settleScoreDiffHtml() {
  if (!isPractice || !G.settleDiffs) return '';
  var chips = SEATS.map(function (s) {
    var diff = G.settleDiffs[s];
    var sign = diff > 0 ? '+' : '';
    var colorCls = diff > 0 ? 'good' : (diff < 0 ? 'bad' : 'neutral');
    return '<span class="settle-chip ' + colorCls + '">' + SEAT_NAME[s] + ': ' + sign + diff.toLocaleString() + '点 (' + matchState.scores[s].toLocaleString() + '点)</span>';
  }).join(' ');
  return '<div class="settle-diff-strip"><div class="settle-diff-label">【持ち点移動】</div>' + chips + '</div>';
}
window.settleScoreDiffHtml = settleScoreDiffHtml;

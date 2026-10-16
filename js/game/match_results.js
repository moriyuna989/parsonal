// js/game/match_results.js
// 半荘集計と最終結果表示

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

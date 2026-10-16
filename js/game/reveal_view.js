// js/game/reveal_view.js
// 和了時の手牌公開と点数表示

function handRow(seat) {
  var p = G.players[seat];
  var tiles = sortTiles(p.hand);
  var html = tiles.map(function (c) { return tileEl(c); }).join('');
  return '<div class="tiles-wrap"><div class="tiles-row">' + html + '</div></div>' +
    '<div class="footnote">待ち: ' + p.wait.map(tileName).join('・') + '</div>' + damatenNoteHtml(seat);
}

// Determines who won, how, and (for ron) which discard/discarder was involved, so the table
// can mark the winner's seat and the ronned tile directly, not just describe it in text.
function getOutcomeHighlights() {
  if (!G.gameOver || !G.outcome) return { winnerSeat: null, winType: null, ronSeat: null, ronTile: null };
  var o = G.outcome;
  if (o.type === 'user_dealin') return { winnerSeat: o.to, winType: 'ron', ronSeat: 'you', ronTile: o.tile };
  if (o.type === 'opp_tsumo') return { winnerSeat: o.seat, winType: 'tsumo', ronSeat: null, ronTile: null };
  if (o.type === 'other_ron') return { winnerSeat: o.ronner, winType: 'ron', ronSeat: o.discarder, ronTile: o.tile };
  if (o.type === 'user_ron') return { winnerSeat: 'you', winType: 'ron', ronSeat: o.via, ronTile: o.tile };
  if (o.type === 'user_tsumo') return { winnerSeat: 'you', winType: 'tsumo', ronSeat: null, ronTile: null };
  return { winnerSeat: null, winType: null, ronSeat: null, ronTile: null };
}

// Shows every player's hand at once, used whenever anyone wins or on ryuukyoku (so you can study the whole board).
function allHandsHtml() {
  var hl = getOutcomeHighlights();
  var winTile = (G.outcome && G.outcome.tile) ? G.outcome.tile : hl.ronTile;
  var isRyuukyoku = G.outcome && G.outcome.type === 'ryuukyoku';

  return ['you', 'p2', 'p3', 'p4'].map(function (seat) {
    var p = G.players[seat];
    var info = (typeof OnlineGame !== 'undefined') ? OnlineGame.getSeatInfo(seat) : { name: (seat === 'you' ? 'あなた' : SEAT_NAME[seat]), tagType: (seat === 'you' ? 'tag-me' : 'tag-cpu'), tagText: (seat === 'you' ? 'あなた' : 'CPU') };
    var label = info.name + ' <span class="player-identity-tag ' + info.tagType + '">' + info.tagText + '</span>';
    var isWinner = hl.winnerSeat === seat;
    var winBadge = isWinner ? '<span class="badge-wintype ' + (hl.winType === 'tsumo' ? 'tsumo' : 'ron') + '">' + (hl.winType === 'tsumo' ? 'ツモ' : 'ロン') + '</span>' : '';

    var isTenpai = false;
    var waits = [];
    var handForWait = p.hand.slice();
    if (isWinner && hl.winType === 'tsumo' && winTile) {
      var wIdx = handForWait.lastIndexOf(winTile);
      if (wIdx !== -1) handForWait.splice(wIdx, 1);
    }
    var expectedLen = 13 - 3 * (p.melds ? p.melds.length : 0);
    if (handForWait.length === expectedLen) {
      waits = findWaitsOpen(handForWait, p.melds ? p.melds.length : 0);
      isTenpai = (waits.length > 0);
    } else if (p.wait && p.wait.length > 0) {
      waits = p.wait;
      isTenpai = true;
    }

    var statusBadge = '';
    if (isRyuukyoku) {
      if (isTenpai) {
        statusBadge = '<span class="pill good" style="margin-left:8px;">聴牌</span>';
      } else {
        statusBadge = '<span class="pill" style="margin-left:8px; opacity:0.75;">ノーテン</span>';
      }
    }

    var tilesHtml;
    if (isWinner && winTile) {
      var handCopy = p.hand.slice();
      if (hl.winType === 'tsumo') {
        var idx = handCopy.lastIndexOf(winTile);
        if (idx !== -1) handCopy.splice(idx, 1);
      }
      var sortedBase = sortTiles(handCopy);
      var baseHtml = sortedBase.map(function (c) { return tileEl(c); }).join('');
      var winTileHtml = tileEl(winTile, 'win-tile');
      tilesHtml = '<div class="tiles-wrap"><div class="tiles-row">' + baseHtml + winTileHtml + '</div></div>';
    } else {
      var tiles = sortTiles(p.hand);
      tilesHtml = '<div class="tiles-wrap"><div class="tiles-row">' + tiles.map(function (c) { return tileEl(c); }).join('') + '</div></div>';
    }

    var meldsHtml = (p.melds && p.melds.length)
      ? '<div class="you-melds" style="margin-top:6px;">' + renderMeldsHtml(p.melds, seat) + '</div>'
      : '';

    var waitHtml = '';
    if (isTenpai) {
      waitHtml = '<div class="footnote">待ち: ' + waits.map(tileName).join('・') + '</div>' + (seat !== 'you' ? damatenNoteHtml(seat) : '');
    } else if (isRyuukyoku) {
      waitHtml = '<div class="footnote" style="color:var(--ink-soft);">ノーテン（聴牌していません）</div>';
    }

    return '<div class="reveal-sub reveal-sub-row">' + label + winBadge + statusBadge + '</div>' + tilesHtml + meldsHtml + waitHtml;
  }).join('');
}

function scoreBlockHtml(score, isRiichi) {
  if (!score) return '';
  if (score.noYaku) return '<div class="score-block"><div class="score-line">役なし（本来は成立しない上がりです）</div></div>';
  var line = score.han + '翻' + (score.tierName ? '（' + score.tierName + '）' : score.fu + '符');
  var payLine;
  if (score.isTsumo && score.pao && score.pao.length) {
    payLine = '責任払いを含む合計 ' + score.total.toLocaleString() + '点';
  } else if (score.isTsumo) {
    payLine = score.dealer
      ? (score.perAll.toLocaleString() + '点オール（合計 ' + score.total.toLocaleString() + '点）')
      : (score.perNonDealer.toLocaleString() + '・' + score.perDealer.toLocaleString() + '点（合計 ' + score.total.toLocaleString() + '点）');
  } else {
    payLine = score.total.toLocaleString() + '点';
  }
  var doraHtml = doraIndicatorsHtml(isRiichi);
  var paoHtml = (score.pao || []).map(function (entry) {
    var seatInfo = typeof OnlineGame !== 'undefined' ? OnlineGame.getSeatInfo(entry.responsibleSeat) : null;
    var seatName = seatInfo ? seatInfo.name : (SEAT_NAME[entry.responsibleSeat] || entry.responsibleSeat);
    return '<div class="score-line">' + entry.yaku + 'の責任払い: ' + seatName + '</div>';
  }).join('');
  return '<div class="score-block">' +
    doraHtml +
    '<div class="score-line">' + score.breakdownParts.join(' + ') + ' = ' + line + '</div>' +
    '<div class="score-total">' + payLine + '</div>' +
    paoHtml +
    '</div>';
}

function doraIndicatorsHtml(isRiichi) {
  var doraList = G.doraIndicators || (G.doraIndicator ? [G.doraIndicator] : []);
  var uraList = G.uraIndicators || (G.uraIndicator ? [G.uraIndicator] : []);

  var doraTilesHtml = doraList.map(function (d) { return tileEl(d); }).join('');
  var uraTilesHtml = uraList.map(function (u) { return tileEl(u); }).join('');

  var uraNote = isRiichi ? '' : '<span class="dora-strip-sub">（※リーチ時のみ有効）</span>';

  return '<div class="dora-strip">' +
    '<div class="dora-strip-item">' +
      '<span class="dora-strip-label">ドラ表示牌</span>' +
      '<div class="dora-strip-tiles">' + doraTilesHtml + '</div>' +
    '</div>' +
    '<div class="dora-strip-item">' +
      '<span class="dora-strip-label">裏ドラ表示牌' + uraNote + '</span>' +
      '<div class="dora-strip-tiles">' + uraTilesHtml + '</div>' +
    '</div>' +
  '</div>';
}

function revealHtml() {
  var o = G.outcome;
  var isAuthoritativeClient = typeof OnlineGame === 'undefined' || !OnlineGame.isOnline() || OnlinePeer.isHost();
  if (isPractice && matchState && isAuthoritativeClient) {
    settleScores(o);
  }
  var getSeatLabel = function (s) {
    if (!s) return '';
    if (typeof OnlineGame !== 'undefined') return OnlineGame.getSeatInfo(s).name;
    return s === 'you' ? 'あなた' : (SEAT_NAME[s] || s);
  };
  var cls = 'neutral', headline = '', winBadge = '', body = '';
  if (o.type === 'user_dealin') {
    cls = 'bad'; winBadge = 'ロン';
    headline = '放銃… ' + getSeatLabel(o.to) + 'に振り込みました';
    var isWinnerRiichi = G.players[o.to] ? G.players[o.to].riichi : false;
    body = '<div class="footnote">切った牌: ' + tileName(o.tile) + '</div>' + scoreBlockHtml(o.score, isWinnerRiichi) + allHandsHtml();
  } else if (o.type === 'opp_tsumo') {
    cls = 'bad'; winBadge = 'ツモ';
    headline = getSeatLabel(o.seat) + 'がツモあがりしました';
    var isWinnerRiichi = G.players[o.seat] ? G.players[o.seat].riichi : false;
    body = '<div class="footnote">ツモ牌: ' + tileName(o.tile) + '</div>' + scoreBlockHtml(o.score, isWinnerRiichi) + allHandsHtml();
  } else if (o.type === 'other_ron') {
    cls = 'neutral'; winBadge = 'ロン';
    headline = getSeatLabel(o.ronner) + 'が' + getSeatLabel(o.discarder) + 'から' + tileName(o.tile) + 'でロンしました';
    var isWinnerRiichi = G.players[o.ronner] ? G.players[o.ronner].riichi : false;
    body = '<div class="footnote">あなたは直接関係していません。</div>' + scoreBlockHtml(o.score, isWinnerRiichi) + allHandsHtml();
  } else if (o.type === 'ryuukyoku') {
    cls = 'neutral';
    headline = '流局しました';
    body = '<div class="footnote">山の牌がなくなりました。全員の手牌と聴牌状況を確認しましょう。</div>' + allHandsHtml();
  } else if (o.type === 'user_ron') {
    cls = 'good'; winBadge = 'ロン';
    headline = 'あがり！ ' + getSeatLabel(o.via) + 'から' + tileName(o.tile) + 'でロン';
    body = scoreBlockHtml(o.score, G.players.you.riichi) + allHandsHtml();
  } else if (o.type === 'user_tsumo') {
    cls = 'good'; winBadge = 'ツモ';
    headline = 'ツモあがり！お見事です';
    body = scoreBlockHtml(o.score, G.players.you.riichi) + allHandsHtml();
  }
  var badgeHtml = winBadge ? '<span class="badge-wintype ' + (winBadge === 'ツモ' ? 'tsumo' : 'ron') + '">' + winBadge + '</span>' : '';
  var headlineRow = '<div class="reveal-headline-row"><div class="reveal-headline ' + cls + '">' + headline + '</div>' + badgeHtml + '</div>';

  var actionButtonsHtml = '';
  if (isPractice && matchState) {
    var st = checkKyokuResultStatus();
    if (st.isFinished) {
      actionButtonsHtml = '<button class="btn-main" id="btnShowFinalResult">対局結果（最終リザルト）を見る (Enter)</button>';
    } else {
      var nextDesc = st.isRenchan
        ? ('連荘: ' + matchState.kyokuWind + matchState.kyokuNum + '局 ' + (matchState.honba + 1) + '本場')
        : ('次局へ: ' + (matchState.kyokuNum === 4 ? (matchState.kyokuWind === '東' ? '南1局' : '終了') : (matchState.kyokuWind + (matchState.kyokuNum + 1) + '局')));
      actionButtonsHtml = '<button class="btn-main" id="btnNextKyoku">次局へ進む（' + nextDesc + '） (Enter)</button>';
    }
  } else {
    actionButtonsHtml = '<button class="btn-main" id="btnRetry">もう一度 (Enter)</button>';
  }

  if (!G.revealExpanded) {
    return '<div class="reveal-box">' + headlineRow + settleScoreDiffHtml() +
      '<button class="btn-main" id="btnExpandReveal">点数と手牌を見る (Enter)</button></div>';
  }
  return '<div class="reveal-box">' + headlineRow + settleScoreDiffHtml() + body + actionButtonsHtml + '</div>';
}


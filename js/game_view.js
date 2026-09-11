// =====================================================================
// js/game_view.js
// 卓・手牌・河・中央情報・開帳・UIコンポーネントHTML生成およびrender
// =====================================================================

function riverHtml(seat) {
  var p = G.players[seat];
  var hl = getOutcomeHighlights();
  var html = p.river.map(function (c, i) {
    var classes = [];
    if (p.riichi && p.riichiTurn === i + 1) classes.push('riichi-tile');
    if (i === p.river.length - 1) {
      if (G.gameOver && hl.ronSeat === seat) classes.push('ron-target');
      else if (!G.gameOver && G.lastDiscardSeat === seat) classes.push('latest');
    }
    return tileEl(c, classes.join(' '));
  }).join('');
  return '<div class="opp-river">' + html + '</div>';
}

function winnerBadgeHtml(seat) {
  var hl = getOutcomeHighlights();
  if (!(G.gameOver && hl.winnerSeat === seat)) return '';
  return '<span class="badge-wintype ' + (hl.winType === 'tsumo' ? 'tsumo' : 'ron') + '">' + (hl.winType === 'tsumo' ? 'ツモ' : 'ロン') + '</span>';
}

function isWinnerBlock(seat) {
  var hl = getOutcomeHighlights();
  return G.gameOver && hl.winnerSeat === seat;
}

function oppBlockHtml(seat) {
  var p = G.players[seat];
  var badges = '';
  if (seat === G.dealerSeat) badges += '<span class="badge-oya">親</span>';
  badges += '<span class="badge-wind">' + G.seatWind[seat] + '家</span>';
  if (p.riichi) {
    badges += '<span class="badge-riichi">リーチ</span>';
    if (p.ippatsu) badges += '<span class="badge-ippatsu">一発</span>';
    badges += '<span class="riichi-stick" title="リーチ棒 (1,000点)"></span>';
  }
  badges += winnerBadgeHtml(seat);
  var scoreTag = matchState ? '<span class="seat-score-tag">' + matchState.scores[seat].toLocaleString() + '点</span>' : '';
  var meldsHtml = (p.melds && p.melds.length)
    ? '<div class="opp-melds">' + renderMeldsHtml(p.melds, seat, 'compact') + '</div>'
    : '';

  var info = (typeof OnlineGame !== 'undefined') ? OnlineGame.getSeatInfo(seat) : { name: SEAT_NAME[seat], tagType: 'tag-cpu', tagText: 'CPU' };
  var tagBadge = '<span class="player-identity-tag ' + info.tagType + '">' + info.tagText + '</span>';

  return '<div class="opp-block' + (isWinnerBlock(seat) ? ' winner-block' : '') + '"><div class="opp-head"><span class="opp-name">' + info.name + '</span>' + tagBadge + scoreTag + badges + meldsHtml + '</div>' + riverHtml(seat) + '</div>';
}

function youMiniHtml() {
  var badges = '';
  if (G.dealerSeat === 'you') badges += '<span class="badge-oya">親</span>';
  badges += '<span class="badge-wind">' + G.seatWind.you + '家</span>';
  if (G.players.you.riichi) {
    badges += '<span class="badge-riichi">リーチ</span>';
    if (G.players.you.ippatsu) badges += '<span class="badge-ippatsu">一発</span>';
    badges += '<span class="riichi-stick" title="リーチ棒 (1,000点)"></span>';
  }
  badges += winnerBadgeHtml('you');
  var scoreTag = matchState ? '<span class="seat-score-tag">' + matchState.scores.you.toLocaleString() + '点</span>' : '';

  var info = (typeof OnlineGame !== 'undefined') ? OnlineGame.getSeatInfo('you') : { name: 'あなた', tagType: 'tag-me', tagText: 'あなた' };
  var tagBadge = '<span class="player-identity-tag ' + info.tagType + '">' + info.tagText + '</span>';

  return '<div class="opp-block' + (isWinnerBlock('you') ? ' winner-block' : '') + '"><div class="opp-head"><span class="opp-name">' + info.name + '</span>' + tagBadge + scoreTag + badges + '</div>' + riverHtml('you') + '</div>';
}

function wallVisualHtml() {
  var remaining = poolTotal(G.pool);
  var stacks = Math.ceil(remaining / 2);
  var html = '';
  for (var i = 0; i < stacks; i++) html += '<span class="wall-stack"></span>';
  return '<div class="wall-row">' + html + '</div>';
}

function centerInfoHtml() {
  var doraList = G.doraIndicators || [G.doraIndicator];
  var doraTilesHtml = doraList.map(function (d) { return tileEl(d); }).join('');
  var kyokuTitle = G.kyokuWind + G.kyokuNumber + '局' + (G.honba > 0 ? ' ' + G.honba + '本場' : '');
  var matchSub = (matchState && matchState.roundName) ? '<div style="font-size:11px;color:var(--ink-soft);font-weight:700;">' + matchState.roundName + ' 第' + matchState.kyokuIndex + '/' + matchState.maxKyoku + '局</div>' : '';

  var riichiPoolCount = 0;
  if (isPractice && matchState) {
    riichiPoolCount = matchState.riichiPool || 0;
  } else {
    riichiPoolCount = riichiSeatsActive().length;
  }
  var riichiPoolHtml = '';
  if (riichiPoolCount > 0) {
    riichiPoolHtml = '<div class="riichi-pool-banner" title="供託リーチ棒: ' + (riichiPoolCount * 1000).toLocaleString() + '点">' +
      '<span class="riichi-stick large"></span>' +
      '<span>× ' + riichiPoolCount + ' (' + (riichiPoolCount * 1000).toLocaleString() + '点)</span>' +
      '</div>';
  }

  var isAgari = G.gameOver && G.outcome && G.outcome.type !== 'ryuukyoku';
  var uraHtml = '';
  if (isAgari) {
    var uraList = G.uraIndicators || (G.uraIndicator ? [G.uraIndicator] : []);
    var uraTilesHtml = uraList.map(function (u) { return tileEl(u); }).join('');
    uraHtml = '<div class="dora-mini" style="margin-top:4px;"><div class="dora-group">' + uraTilesHtml + '</div><span>裏ドラ表示' + (uraList.length > 1 ? ' (' + uraList.length + '枚)' : '') + '</span></div>';
  }

  return matchSub +
    '<div class="kyoku-line">' + kyokuTitle + '</div>' +
    riichiPoolHtml +
    '<div class="dora-mini"><div class="dora-group">' + doraTilesHtml + '</div><span>ドラ表示' + (doraList.length > 1 ? ' (' + doraList.length + '枚)' : '') + '</span></div>' +
    uraHtml +
    wallVisualHtml() +
    '<div>あと' + Math.floor(poolTotal(G.pool) / 4) + '巡</div>';
}

function logHtml() {
  var recent = G.log.slice(-6);
  return '<div class="log-box">' + recent.map(function (l) { return '<div>' + l + '</div>'; }).join('') + '</div>';
}

function youMeldsHtml() {
  var melds = G.players.you.melds;
  if (!melds || !melds.length) return '';
  return '<div class="you-melds">' + renderMeldsHtml(melds, 'you') + '</div>';
}

function youHandHtml() {
  var tiles = getDisplayedTiles();
  var showDrawn = G.justDrew && G.players.you.hand.includes(G.lastDrawn);
  var drawnIdx = showDrawn ? tiles.length - 1 : -1;

  var isLocked = G.players.you.riichi;
  var opts = computeUserOptions();

  function tileButton(code, idx) {
    var isDrawn = (idx === drawnIdx);
    var classes = [];
    if (isDrawn) classes.push('drawn');
    if (isRedTile(code)) classes.push('red-tile');
    var isSelected = (G.selectedIndex !== null && G.selectedIndex !== undefined && G.selectedIndex >= 0)
      ? (G.selectedIndex === idx)
      : (G.selected === code);
    if (isSelected) classes.push('selected');
    if (opts.safeSet && opts.safeSet.has(code)) classes.push('safe');
    if (!isLocked && opts.tenpaiIfDiscard[code]) classes.push('riichi-ok');
    var disabled = isLocked && !isDrawn;
    if (disabled) classes.push('disabled');
    return '<span class="tile ' + classes.join(' ') + '" data-tile="' + code + '" data-index="' + idx + '" data-drawn="' + (isDrawn ? '1' : '0') + '">' + tileGlyph(code) + '</span>';
  }
  var html = tiles.map(function (c, idx) { return tileButton(c, idx); }).join('');
  return '<div class="hand-row">' + html + '</div>';
}

function controlsHtml() {
  var hand = G.players.you.hand;
  var canTsumo = G.justDrew && canPlayerWinWith('you', G.lastDrawn, true);
  var kanInfo = G.justDrew ? checkConcealedKan(G.players.you) : { canAnkan: false, canKakan: false };
  var html = '<div class="tg-controls">';
  if (canTsumo) html += '<button class="btn-main" id="btnTsumo">ツモ！ (T)</button>';
  if (kanInfo.canAnkan) {
    var ankanTile = kanInfo.ankanList[0];
    html += '<button class="btn-main" id="btnAnkan" data-tile="' + ankanTile + '">カン (K)（暗槓: ' + tileName(ankanTile) + '）</button>';
  } else if (kanInfo.canKakan) {
    var kakanObj = kanInfo.kakanList[0];
    html += '<button class="btn-main" id="btnKakan" data-tile="' + kakanObj.tile + '">カン (K)（加槓: ' + tileName(kakanObj.tile) + '）</button>';
  }
  if (G.players.you.riichi) {
    html += '<button class="btn-main" id="btnForcedDiscard">' + tileName(G.lastDrawn) + ' を切る (Space)</button>';
  } else if (G.selected) {
    var opts = computeUserOptions();
    html += '<button class="btn-main" id="btnDiscard">この牌を切る (Space)</button>';
    if (!G.players.you.isOpen && opts.tenpaiIfDiscard[G.selected]) html += '<button class="btn-main" id="btnRiichi">リーチして切る (R)</button>';
    html += '<button class="btn-ghost2" id="btnCancel">キャンセル (Esc)</button>';
  }
  html += '</div>';
  return html;
}

function legendHtml() {
  return '<div class="legend-row"><span><span class="legend-dot"></span>安全牌（現物）</span><span><span class="legend-flag">⚑</span>切るとリーチ可</span>' +
    '<span><span class="legend-ring"></span>直前に切った牌</span>' +
    '<span class="kb-guide"><span class="kb-key">←</span><span class="kb-key">→</span> 牌選択 / <span class="kb-key">Space</span> 捨てる / <span class="kb-key">R</span> リーチ / <span class="kb-key">Esc</span> 取消</span></div>';
}

function pendingCallHtml() {
  var pc = G.pendingCall;
  var actions = getCallActions();
  var html = '<div class="call-prompt"><div class="call-prompt-title">' + SEAT_NAME[pc.fromSeat] + 'が捨てた' + tileName(pc.tile) + '、鳴きますか？</div><div class="tg-controls">';
  actions.forEach(function (act, i) {
    var isSelected = (G.pendingCallIndex === i);
    var cls = act.type === 'pass' ? 'btn-ghost2' : 'btn-main';
    if (isSelected) cls += ' selected';
    html += '<button class="' + cls + '" data-call-action-idx="' + i + '">' + act.label + '</button>';
  });
  html += '<span class="kb-guide" style="align-self:center;"><span class="kb-key">←</span><span class="kb-key">→</span> 選択 / <span class="kb-key">Space</span> 決定</span>';
  html += '</div></div>';
  return html;
}

function youStatusHtml() {
  var wait = G.players.you.hand.length === youRestLen() ? findWaitsOpen(G.players.you.hand, G.players.you.melds.length) : null;
  var badges = '';
  if (G.players.you.riichi) {
    badges += '<span class="pill riichi" style="display:inline-flex;align-items:center;gap:6px;">リーチ中' +
      (G.players.you.ippatsu ? ' <span class="badge-ippatsu" style="font-size:10px;padding:1px 6px;">一発</span>' : '') +
      ' <span class="riichi-stick"></span></span>';
  } else if (G.players.you.isOpen) badges += '<span class="pill">鳴きあり（リーチ不可）</span>';
  if (wait && wait.length) {
    badges += '<span class="pill good">待ち: ' + wait.map(tileName).join('・') + '</span>';
    if (isFuritenYou()) badges += '<span class="pill riichi">フリテン</span>';
  }
  if (!badges) return '';
  return '<div class="you-head">' + badges + '</div>';
}

function damatenNoteHtml(seat) {
  var p = G.players[seat];
  if (!p.riichi && p.tenpaiSinceTurn) return '<div class="footnote">（' + p.tenpaiSinceTurn + '巡目から聴牌していました・ダマテン）</div>';
  return '';
}

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
  if (score.isTsumo) {
    payLine = score.dealer
      ? (score.perAll.toLocaleString() + '点オール（合計 ' + score.total.toLocaleString() + '点）')
      : (score.perNonDealer.toLocaleString() + '・' + score.perDealer.toLocaleString() + '点（合計 ' + score.total.toLocaleString() + '点）');
  } else {
    payLine = score.total.toLocaleString() + '点';
  }
  var doraHtml = doraIndicatorsHtml(isRiichi);
  return '<div class="score-block">' +
    doraHtml +
    '<div class="score-line">' + score.breakdownParts.join(' + ') + ' = ' + line + '</div>' +
    '<div class="score-total">' + payLine + '</div>' +
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
  if (isPractice && matchState) {
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

function settingsRowHtml() {
  if (isPractice) {
    var cpuLevel = (matchState && matchState.cpuLevel) || 'hard';
    var levelText = cpuLevel === 'easy' ? 'CPU: 初級' : (cpuLevel === 'normal' ? 'CPU: 中級' : 'CPU: 上級（仲林プロAI）');
    return '<div class="settings-row" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">' +
      '<span style="font-size:12px; font-weight:700; color:var(--accent); background:var(--surface-alt); border:1px solid var(--line); border-radius:999px; padding:3px 12px;">実践編（対局モード）</span>' +
      '<span style="font-size:12px; font-weight:700; color:var(--ink); background:var(--surface); border:1px solid var(--line); border-radius:999px; padding:3px 10px;">' + levelText + '</span>' +
      '</div>';
  }
  return '<div class="settings-row"><label class="toggle-switch">' +
    '<input type="checkbox" id="toggleDamaten"' + (allowDamaten ? ' checked' : '') + ' />' +
    '<span class="track"></span><span>ダマテンあり（相手がリーチせず聴牌を隠すことがある）</span>' +
    '</label></div>';
}

function render() {
  var html = '<div class="card">';
  html += settingsRowHtml();
  html += '<div class="table-grid">' +
    '<div class="seat-toimen">' + oppBlockHtml('p3') + '</div>' +
    '<div class="seat-kamicha">' + oppBlockHtml('p4') + '</div>' +
    '<div class="seat-center">' + centerInfoHtml() + '</div>' +
    '<div class="seat-shimocha">' + oppBlockHtml('p2') + '</div>' +
    '<div class="seat-you-mini">' + youMiniHtml() + '</div>' +
    '</div>';
  html += '<div class="you-block">';
  if (G.gameOver) {
    // reveal shown separately below
  } else if (G.processing) {
    html += youStatusHtml();
    html += youMeldsHtml();
    html += youHandHtml();
    html += '<div class="processing-note">相手の番です…</div>';
  } else if (G.pendingCall) {
    html += youStatusHtml();
    html += youMeldsHtml();
    html += youHandHtml();
    html += pendingCallHtml();
  } else {
    html += youStatusHtml();
    html += youMeldsHtml();
    html += youHandHtml();
    html += legendHtml();
    html += controlsHtml();
  }
  html += '</div>';
  if (G.gameOver) html += revealHtml();
  html += '</div>';

  var root = document.getElementById('tgRoot');
  if (root) root.innerHTML = html;
  if (typeof wireEvents === 'function') {
    wireEvents();
  } else if (window.wireEvents) {
    window.wireEvents();
  }
}
window.render = render;


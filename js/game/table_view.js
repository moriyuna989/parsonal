// js/game/table_view.js
// 対局卓・手牌・操作候補の表示

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

function pendingRonOfferHtml() {
  var offer = G.pendingRonOffer;
  var fromName = typeof OnlineGame !== 'undefined' ? OnlineGame.getSeatInfo(offer.fromSeat).name : SEAT_NAME[offer.fromSeat];
  return '<div class="call-prompt"><div class="call-prompt-title">' + fromName + 'の' + tileName(offer.tile) + '、ロンしますか？</div>' +
    '<div class="tg-controls"><button class="btn-main" id="btnAcceptRon">ロン</button>' +
    '<button class="btn-ghost2" id="btnPassRon">見逃す</button></div></div>';
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
    if (isFuritenYou() || G.players.you.passFuriten) badges += '<span class="pill riichi">フリテン</span>';
  }
  if (!badges) return '';
  return '<div class="you-head">' + badges + '</div>';
}

function damatenNoteHtml(seat) {
  var p = G.players[seat];
  if (!p.riichi && p.tenpaiSinceTurn) return '<div class="footnote">（' + p.tenpaiSinceTurn + '巡目から聴牌していました・ダマテン）</div>';
  return '';
}


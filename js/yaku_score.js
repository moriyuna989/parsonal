// =====================================================================
// js/yaku_score.js
// 役判定・符計算・点数計算エンジンおよび練習用手牌テンプレート
// =====================================================================

function decomposeSuitTrack(arr, suitLetter, groups) {
  var i = 0; while (i < 9 && arr[i] === 0) i++;
  if (i === 9) return true;
  if (arr[i] >= 3) {
    arr[i] -= 3;
    groups.push({ type: 'triplet', tiles: [(i + 1) + suitLetter, (i + 1) + suitLetter, (i + 1) + suitLetter], concealed: true });
    if (decomposeSuitTrack(arr, suitLetter, groups)) { arr[i] += 3; return true; }
    groups.pop(); arr[i] += 3;
  }
  if (i <= 6 && arr[i + 1] > 0 && arr[i + 2] > 0) {
    arr[i]--; arr[i + 1]--; arr[i + 2]--;
    groups.push({ type: 'run', tiles: [(i + 1) + suitLetter, (i + 2) + suitLetter, (i + 3) + suitLetter], concealed: true });
    if (decomposeSuitTrack(arr, suitLetter, groups)) { arr[i]++; arr[i + 1]++; arr[i + 2]++; return true; }
    groups.pop(); arr[i]++; arr[i + 1]++; arr[i + 2]++;
  }
  return false;
}

function decomposeHonorsTrack(arr, groups) {
  for (var i = 0; i < 7; i++) {
    if (arr[i] === 3) groups.push({ type: 'triplet', tiles: [(i + 1) + 'z', (i + 1) + 'z', (i + 1) + 'z'], concealed: true });
    else if (arr[i] !== 0) return false;
  }
  return true;
}

function decomposeConcealed(concealedTiles) {
  var counts = tilesToCounts(concealedTiles);
  for (var i = 0; i < 34; i++) {
    if (counts[i] >= 2) {
      counts[i] -= 2;
      var groups = [];
      var m = counts.slice(0, 9), p = counts.slice(9, 18), s = counts.slice(18, 27), z = counts.slice(27, 34);
      var ok = decomposeSuitTrack(m, 'm', groups) && decomposeSuitTrack(p, 'p', groups) && decomposeSuitTrack(s, 's', groups) && decomposeHonorsTrack(z, groups);
      counts[i] += 2;
      if (ok) return { pairTile: indexToCode(i), groups: groups };
    }
  }
  return null;
}

function analyzeWait(winTile, pairTile, groups) {
  var winIdx = tileIndex(winTile);
  if (winIdx === tileIndex(pairTile)) return { waitType: 'tanki', groupIndex: -1 };
  for (var gi = 0; gi < groups.length; gi++) {
    var g = groups[gi];
    var hasWinTile = g.tiles.some(function (t) { return tileIndex(t) === winIdx; });
    if (!hasWinTile) continue;
    if (g.type === 'triplet' || g.type === 'kan') return { waitType: 'shanpon', groupIndex: gi };
    var n = parseTile(g.tiles[0]).num;
    var winNum = parseTile(winTile).num;
    var pos = winNum - n;
    if (pos === 1) return { waitType: 'kanchan', groupIndex: gi };
    if (pos === 0) return { waitType: (n === 7 ? 'penchan' : 'ryanmen'), groupIndex: gi };
    return { waitType: (n === 1 ? 'penchan' : 'ryanmen'), groupIndex: gi };
  }
  return { waitType: 'tanki', groupIndex: -1 };
}

function computeUserFu(fullGroups, pairTile, waitInfo, isTsumo, isOpenHand, seatWindNum, roundWindNum, pinfuApplies) {
  var fu = 20;
  fullGroups.forEach(function (g, idx) {
    if (g.type !== 'triplet' && g.type !== 'kan') return;
    var term = isTerminalOrHonor(g.tiles[0]);
    var concealed = g.concealed;
    if (waitInfo.waitType === 'shanpon' && idx === waitInfo.groupIndex && !isTsumo) concealed = false;
    if (g.type === 'kan') {
      var kanBase = term ? 32 : 16;
      if (!concealed) kanBase = kanBase / 2;
      fu += kanBase;
    } else {
      var base = term ? 8 : 4;
      if (!concealed) base = base / 2;
      fu += base;
    }
  });
  var pt = parseTile(pairTile);
  if (pt.suit === 'z') {
    if (pt.num >= 5) fu += 2;
    else {
      if (pt.num === seatWindNum) fu += 2;
      if (pt.num === roundWindNum) fu += 2;
    }
  }
  fu += (waitInfo.waitType === 'ryanmen' || waitInfo.waitType === 'shanpon') ? 0 : 2;
  if (isTsumo) {
    if (!pinfuApplies) fu += 2;
  } else {
    if (!isOpenHand) fu += 10;
  }
  return Math.ceil(fu / 10) * 10;
}

function computeUserYakuHan(fullGroups, pairTile, waitInfo, ctx) {
  var names = [];
  var han = 0;
  var allTiles = fullGroups.reduce(function (a, g) { return a.concat(g.tiles); }, [pairTile]);
  var allSimple = allTiles.every(function (t) { return !isTerminalOrHonor(t); });
  var allRuns = fullGroups.every(function (g) { return g.type === 'run'; });
  var allTriplets = fullGroups.every(function (g) { return g.type === 'triplet' || g.type === 'kan'; });
  var pairIsHonor = parseTile(pairTile).suit === 'z';
  var pinfuApplies = !ctx.isOpen && allRuns && !pairIsHonor && waitInfo.waitType === 'ryanmen';

  if (ctx.riichi) { names.push('リーチ'); han += 1; }
  if (ctx.riichi && ctx.ippatsu) { names.push('一発'); han += 1; }
  if (ctx.isTsumo && !ctx.isOpen) { names.push('ツモ'); han += 1; }
  if (allSimple) { names.push('タンヤオ'); han += 1; }
  if (pinfuApplies) { names.push('平和'); han += 1; }
  fullGroups.forEach(function (g) {
    if (g.type !== 'triplet' && g.type !== 'kan') return;
    var t = parseTile(g.tiles[0]);
    if (t.suit !== 'z') return;
    if (t.num >= 5) { names.push('役牌(' + HONOR_NAME[t.num] + ')'); han += 1; }
    else {
      if (t.num === ctx.seatWindNum) { names.push('役牌(自風' + HONOR_NAME[t.num] + ')'); han += 1; }
      if (t.num === ctx.roundWindNum) { names.push('役牌(場風' + HONOR_NAME[t.num] + ')'); han += 1; }
    }
  });
  if (allTriplets) { names.push('対々和'); han += 2; }
  var suits = new Set(allTiles.map(function (t) { return parseTile(t).suit; }).filter(function (s) { return s !== 'z'; }));
  var hasHonor = allTiles.some(function (t) { return parseTile(t).suit === 'z'; });
  if (suits.size === 1) {
    if (hasHonor) { names.push('混一色'); han += ctx.isOpen ? 2 : 3; }
    else { names.push('清一色'); han += ctx.isOpen ? 5 : 6; }
  }
  var allTermHonor = fullGroups.every(function (g) { return g.tiles.some(isTerminalOrHonor); }) && isTerminalOrHonor(pairTile);
  if (allTermHonor) { names.push('チャンタ'); han += ctx.isOpen ? 1 : 2; }
  ['m', 'p', 's'].forEach(function (suit) {
    var starts = fullGroups.filter(function (g) { return g.type === 'run' && parseTile(g.tiles[0]).suit === suit; }).map(function (g) { return parseTile(g.tiles[0]).num; });
    if (starts.includes(1) && starts.includes(4) && starts.includes(7)) { names.push('一気通貫'); han += ctx.isOpen ? 1 : 2; }
  });
  var runStartsBySuit = { m: new Set(), p: new Set(), s: new Set() };
  fullGroups.forEach(function (g) { if (g.type === 'run') { var t = parseTile(g.tiles[0]); runStartsBySuit[t.suit].add(t.num); } });
  for (var n = 1; n <= 7; n++) {
    if (runStartsBySuit.m.has(n) && runStartsBySuit.p.has(n) && runStartsBySuit.s.has(n)) { names.push('三色同順'); han += ctx.isOpen ? 1 : 2; break; }
  }
  if (!ctx.isOpen) {
    var runKeys = fullGroups.filter(function (g) { return g.type === 'run'; }).map(function (g) { return g.tiles.join(','); });
    var seen = {}; var hasDup = false;
    runKeys.forEach(function (k) { if (seen[k]) hasDup = true; seen[k] = true; });
    if (hasDup) { names.push('一盃口'); han += 1; }
  }
  var pureYakuNames = names.slice();
  var pureYakuHan = han;
  var hasYaku = (pureYakuHan >= 1);

  if (ctx.doraCount > 0) { names.push('ドラ' + ctx.doraCount); han += ctx.doraCount; }
  if (ctx.redDoraCount > 0) { names.push('赤ドラ' + ctx.redDoraCount); han += ctx.redDoraCount; }
  if (ctx.riichi && ctx.uraDoraCount > 0) { names.push('裏ドラ' + ctx.uraDoraCount); han += ctx.uraDoraCount; }
  return { names: names, han: han, pinfuApplies: pinfuApplies, hasYaku: hasYaku, pureYakuHan: pureYakuHan, pureYakuNames: pureYakuNames };
}

function windCharToNum(ch) {
  return { '東': 1, '南': 2, '西': 3, '北': 4 }[ch];
}

function meldTiles(m) {
  if (m.type === 'run') return [m.start + m.suit, (m.start + 1) + m.suit, (m.start + 2) + m.suit];
  return [m.num + m.suit, m.num + m.suit, m.num + m.suit];
}

function templateFullTiles(t) {
  if (t.isYakuman) return t.tiles13.concat([t.winTile]);
  if (t.isChiitoi) { var a = []; t.pairs.forEach(function (p) { a.push(p.num + p.suit, p.num + p.suit); }); return a; }
  var a = [];
  t.melds.forEach(function (m) { a = a.concat(meldTiles(m)); });
  a.push(t.pair.num + t.pair.suit, t.pair.num + t.pair.suit);
  return a;
}

function templateConcealed13(t) {
  var full = templateFullTiles(t);
  var idx = full.indexOf(t.winTile);
  var c = full.slice();
  if (idx !== -1) c.splice(idx, 1);
  else c.pop();
  return c;
}

function computeFu(t, isTsumo, seatWindNum, roundWindNum) {
  if (t.isChiitoi) return 25;
  if (t.isYakuman) return 0;
  var fu = 20;
  t.melds.forEach(function (m) {
    if (m.type === 'run') return;
    var code = m.num + m.suit;
    if (m.type === 'kan') {
      var base = isTerminalOrHonor(code) ? 32 : 16;
      if (!m.concealed) base = base / 2;
      fu += base;
    } else {
      var base = isTerminalOrHonor(code) ? 8 : 4;
      if (!m.concealed) base = base / 2;
      fu += base;
    }
  });
  if (t.pair.suit === 'z') {
    if (t.pair.num >= 5) fu += 2;
    else {
      if (seatWindNum && t.pair.num === seatWindNum) fu += 2;
      if (roundWindNum && t.pair.num === roundWindNum) fu += 2;
    }
  }
  fu += (t.waitType === 'ryanmen') ? 0 : 2;
  if (isTsumo) { if (!t.pinfu) fu += 2; } else { if (!t.isOpen) fu += 10; }
  return Math.ceil(fu / 10) * 10;
}

var TEMPLATES = [
  {
    id: 'pinfu_basic', weight: 100, isOpen: false, pinfu: true, waitType: 'ryanmen', riichiMode: 'optional',
    melds: [{ type: 'run', suit: 'm', start: 2, concealed: true }, { type: 'run', suit: 'm', start: 6, concealed: true },
    { type: 'run', suit: 'p', start: 3, concealed: true }, { type: 'run', suit: 's', start: 4, concealed: true }],
    pair: { suit: 'p', num: 9 }, winTile: '4m',
    yakuHanRon: 1, yakuHanTsumo: 2, yakuNamesRon: ['平和'], yakuNamesTsumo: ['平和', 'ツモ']
  },
  {
    id: 'tanyao_pinfu', weight: 80, isOpen: false, pinfu: true, waitType: 'ryanmen', riichiMode: 'optional',
    melds: [{ type: 'run', suit: 'm', start: 4, concealed: true }, { type: 'run', suit: 'p', start: 2, concealed: true },
    { type: 'run', suit: 'p', start: 6, concealed: true }, { type: 'run', suit: 's', start: 4, concealed: true }],
    pair: { suit: 's', num: 8 }, winTile: '6m',
    yakuHanRon: 2, yakuHanTsumo: 3, yakuNamesRon: ['タンヤオ', '平和'], yakuNamesTsumo: ['タンヤオ', '平和', 'ツモ']
  },
  {
    id: 'riichi_nomi', weight: 70, isOpen: false, pinfu: false, waitType: 'kanchan', riichiMode: 'forced',
    melds: [{ type: 'run', suit: 'm', start: 1, concealed: true }, { type: 'run', suit: 'p', start: 4, concealed: true },
    { type: 'triplet', suit: 's', num: 8, concealed: true }, { type: 'run', suit: 's', start: 1, concealed: true }],
    pair: { suit: 'p', num: 9 }, winTile: '2m',
    yakuHanRon: 0, yakuHanTsumo: 1, yakuNamesRon: [], yakuNamesTsumo: ['ツモ']
  },
  {
    id: 'yakuhai_chun_open', weight: 60, isOpen: true, pinfu: false, waitType: 'shanpon', riichiMode: 'none', openMeldLabel: 'ポン：中',
    melds: [{ type: 'triplet', suit: 'z', num: 7, concealed: false, from: 'toimen' }, { type: 'run', suit: 'm', start: 3, concealed: true },
    { type: 'run', suit: 'p', start: 6, concealed: true }, { type: 'triplet', suit: 's', num: 2, concealed: true }],
    pair: { suit: 'm', num: 8 }, winTile: '2s',
    yakuHanRon: 1, yakuHanTsumo: 1, yakuNamesRon: ['役牌(中)'], yakuNamesTsumo: ['役牌(中)']
  },
  {
    id: 'tanyao_open', weight: 60, isOpen: true, pinfu: false, waitType: 'ryanmen', riichiMode: 'none', openMeldLabel: 'チー：3-4-5筒',
    melds: [{ type: 'run', suit: 'p', start: 3, concealed: false, from: 'kamicha' }, { type: 'run', suit: 'm', start: 3, concealed: true },
    { type: 'run', suit: 's', start: 6, concealed: true }, { type: 'triplet', suit: 'm', num: 6, concealed: true }],
    pair: { suit: 's', num: 4 }, winTile: '5m',
    yakuHanRon: 1, yakuHanTsumo: 1, yakuNamesRon: ['タンヤオ'], yakuNamesTsumo: ['タンヤオ']
  },
  {
    id: 'toitoi_open', weight: 30, isOpen: true, pinfu: false, waitType: 'shanpon', riichiMode: 'none', openMeldLabel: 'ポン：發、ポン：3萬',
    melds: [{ type: 'triplet', suit: 'z', num: 6, concealed: false, from: 'kamicha' }, { type: 'triplet', suit: 'm', num: 3, concealed: false, from: 'toimen' },
    { type: 'triplet', suit: 'p', num: 8, concealed: true }, { type: 'triplet', suit: 's', num: 5, concealed: true }],
    pair: { suit: 'p', num: 1 }, winTile: '8p',
    yakuHanRon: 3, yakuHanTsumo: 3, yakuNamesRon: ['役牌(發)', '対々和'], yakuNamesTsumo: ['役牌(發)', '対々和']
  },
  {
    id: 'honitsu_open', weight: 20, isOpen: true, pinfu: false, waitType: 'ryanmen', riichiMode: 'none', openMeldLabel: 'ポン：白',
    melds: [{ type: 'triplet', suit: 'z', num: 5, concealed: false, from: 'toimen' }, { type: 'run', suit: 's', start: 2, concealed: true },
    { type: 'run', suit: 's', start: 6, concealed: true }, { type: 'triplet', suit: 'z', num: 7, concealed: true }],
    pair: { suit: 's', num: 9 }, winTile: '4s',
    yakuHanRon: 4, yakuHanTsumo: 4, yakuNamesRon: ['役牌(白)', '役牌(中)', '混一色'], yakuNamesTsumo: ['役牌(白)', '役牌(中)', '混一色']
  },
  {
    id: 'ittsu_closed', weight: 30, isOpen: false, pinfu: false, waitType: 'penchan', riichiMode: 'optional',
    melds: [{ type: 'run', suit: 'm', start: 1, concealed: true }, { type: 'run', suit: 'm', start: 4, concealed: true },
    { type: 'run', suit: 'm', start: 7, concealed: true }, { type: 'triplet', suit: 'p', num: 5, concealed: true }],
    pair: { suit: 's', num: 3 }, winTile: '3m',
    yakuHanRon: 2, yakuHanTsumo: 3, yakuNamesRon: ['一気通貫'], yakuNamesTsumo: ['一気通貫', 'ツモ']
  },
  {
    id: 'sanshoku_closed', weight: 30, isOpen: false, pinfu: true, waitType: 'ryanmen', riichiMode: 'optional',
    melds: [{ type: 'run', suit: 'm', start: 2, concealed: true }, { type: 'run', suit: 'p', start: 2, concealed: true },
    { type: 'run', suit: 's', start: 2, concealed: true }, { type: 'run', suit: 'p', start: 6, concealed: true }],
    pair: { suit: 's', num: 8 }, winTile: '4m',
    yakuHanRon: 3, yakuHanTsumo: 4, yakuNamesRon: ['平和', '三色同順'], yakuNamesTsumo: ['平和', '三色同順', 'ツモ']
  },
  {
    id: 'pinfu_iipeikou', weight: 40, isOpen: false, pinfu: true, waitType: 'ryanmen', riichiMode: 'optional',
    melds: [{ type: 'run', suit: 'p', start: 2, concealed: true }, { type: 'run', suit: 'p', start: 2, concealed: true },
    { type: 'run', suit: 'm', start: 4, concealed: true }, { type: 'run', suit: 's', start: 6, concealed: true }],
    pair: { suit: 'm', num: 8 }, winTile: '8s',
    yakuHanRon: 2, yakuHanTsumo: 3, yakuNamesRon: ['平和', '一盃口'], yakuNamesTsumo: ['平和', '一盃口', 'ツモ']
  },
  {
    id: 'tanyao_sanshoku', weight: 20, isOpen: false, pinfu: false, waitType: 'ryanmen', riichiMode: 'optional',
    melds: [{ type: 'run', suit: 'm', start: 4, concealed: true }, { type: 'run', suit: 'p', start: 4, concealed: true },
    { type: 'run', suit: 's', start: 4, concealed: true }, { type: 'run', suit: 's', start: 6, concealed: true }],
    pair: { suit: 'p', num: 3 }, winTile: '8s',
    yakuHanRon: 3, yakuHanTsumo: 4, yakuNamesRon: ['タンヤオ', '三色同順'], yakuNamesTsumo: ['タンヤオ', '三色同順', 'ツモ']
  },
  {
    id: 'chiitoitsu_tanyao', weight: 40, isChiitoi: true, isOpen: false, riichiMode: 'optional',
    pairs: [{ suit: 'm', num: 2 }, { suit: 'm', num: 4 }, { suit: 'p', num: 6 }, { suit: 'p', num: 3 },
    { suit: 's', num: 5 }, { suit: 's', num: 7 }, { suit: 's', num: 4 }],
    winTile: '4s', yakuHanRon: 3, yakuHanTsumo: 4, yakuNamesRon: ['七対子', 'タンヤオ'], yakuNamesTsumo: ['七対子', 'タンヤオ', 'ツモ']
  },
  {
    id: 'junchan_open', weight: 2, isOpen: true, pinfu: false, waitType: 'ryanmen', riichiMode: 'none', openMeldLabel: 'ポン：9萬',
    melds: [{ type: 'triplet', suit: 'm', num: 9, concealed: false, from: 'shimocha' }, { type: 'run', suit: 'p', start: 1, concealed: true },
    { type: 'run', suit: 'p', start: 7, concealed: true }, { type: 'run', suit: 's', start: 1, concealed: true }],
    pair: { suit: 's', num: 1 }, winTile: '3s',
    yakuHanRon: 1, yakuHanTsumo: 1, yakuNamesRon: ['純全帯幺九'], yakuNamesTsumo: ['純全帯幺九']
  },
  {
    id: 'chiitoitsu_honitsu', weight: 10, isChiitoi: true, isOpen: false, riichiMode: 'optional',
    pairs: [{ suit: 'p', num: 1 }, { suit: 'p', num: 3 }, { suit: 'p', num: 5 }, { suit: 'p', num: 7 },
    { suit: 'p', num: 9 }, { suit: 'z', num: 5 }, { suit: 'z', num: 6 }],
    winTile: '6z', yakuHanRon: 5, yakuHanTsumo: 6, yakuNamesRon: ['七対子', '混一色'], yakuNamesTsumo: ['七対子', '混一色', 'ツモ']
  }
];

var TEMPLATES_TOTAL_WEIGHT = TEMPLATES.reduce(function (sum, t) { return sum + t.weight; }, 0);

function pickWeightedTemplate() {
  var r = Math.random() * TEMPLATES_TOTAL_WEIGHT;
  for (var i = 0; i < TEMPLATES.length; i++) {
    r -= TEMPLATES[i].weight;
    if (r <= 0) return TEMPLATES[i];
  }
  return TEMPLATES[TEMPLATES.length - 1];
}

function tierForHan(han) {
  if (han >= 13) return { name: '役満', nondealer: 32000, dealer: 48000 };
  if (han >= 11) return { name: '三倍満', nondealer: 24000, dealer: 36000 };
  if (han >= 8) return { name: '倍満', nondealer: 16000, dealer: 24000 };
  if (han >= 6) return { name: '跳満', nondealer: 12000, dealer: 18000 };
  if (han === 5) return { name: '満貫', nondealer: 8000, dealer: 12000 };
  return null;
}

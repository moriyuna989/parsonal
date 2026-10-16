// =====================================================================
// 共通の和了形・役・符・点数判定
// yaku_score.js の牌テンプレート定義の後に読み込む。
// =====================================================================

function enumerateSuitDecompositions(counts, suit) {
  var out = [];
  function walk(current, groups) {
    var i = current.findIndex(function (n) { return n > 0; });
    if (i === -1) { out.push(groups.slice()); return; }
    if (current[i] >= 3) {
      current[i] -= 3;
      groups.push({ type: 'triplet', tiles: [(i + 1) + suit, (i + 1) + suit, (i + 1) + suit], concealed: true });
      walk(current, groups);
      groups.pop(); current[i] += 3;
    }
    if (i <= 6 && current[i + 1] > 0 && current[i + 2] > 0) {
      current[i]--; current[i + 1]--; current[i + 2]--;
      groups.push({ type: 'run', tiles: [(i + 1) + suit, (i + 2) + suit, (i + 3) + suit], concealed: true });
      walk(current, groups);
      groups.pop(); current[i]++; current[i + 1]++; current[i + 2]++;
    }
  }
  walk(counts.slice(), []);
  return out;
}

function enumerateStandardDecompositions(tiles, requiredMelds) {
  var counts = tilesToCounts(tiles);
  var results = [];
  for (var i = 0; i < 34; i++) {
    if (counts[i] < 2) continue;
    counts[i] -= 2;
    var suited = [];
    ['m', 'p', 's'].forEach(function (suit, idx) {
      suited.push(enumerateSuitDecompositions(counts.slice(idx * 9, idx * 9 + 9), suit));
    });
    var honorGroups = [];
    var honorsOk = true;
    for (var h = 0; h < 7; h++) {
      var n = counts[27 + h];
      if (n === 0) continue;
      if (n !== 3) { honorsOk = false; break; }
      honorGroups.push({ type: 'triplet', tiles: [(h + 1) + 'z', (h + 1) + 'z', (h + 1) + 'z'], concealed: true });
    }
    if (honorsOk) {
      suited[0].forEach(function (m) { suited[1].forEach(function (p) { suited[2].forEach(function (s) {
        var groups = m.concat(p, s, honorGroups);
        if (groups.length === requiredMelds) results.push({ pairTile: indexToCode(i), groups: groups });
      }); }); });
    }
    counts[i] += 2;
  }
  return results;
}

function normalizeScoringMeld(m) {
  var type = m.type;
  var tiles = (m.tiles || []).slice();
  if (type === 'chi') type = 'run';
  if (type === 'pon') type = 'triplet';
  if (type === 'kan') return { type: 'kan', tiles: tiles, concealed: m.subType === 'ankan' || m.concealed === true, open: m.subType !== 'ankan' && m.concealed !== true };
  if (type === 'run') tiles.sort(function (a, b) { return tileIndex(a) - tileIndex(b); });
  return { type: type, tiles: tiles, concealed: false, open: true };
}

function scoringWaitPlacements(decomposition, winTile) {
  var winIdx = tileIndex(winTile);
  var placements = [];
  if (tileIndex(decomposition.pairTile) === winIdx) placements.push({ waitType: 'tanki', groupIndex: -1 });
  decomposition.groups.forEach(function (g, gi) {
    if (!g.tiles.some(function (t) { return tileIndex(t) === winIdx; })) return;
    if (g.type === 'triplet' || g.type === 'kan') {
      placements.push({ waitType: 'shanpon', groupIndex: gi });
      return;
    }
    var start = parseTile(g.tiles[0]).num;
    var pos = parseTile(winTile).num - start;
    if (pos === 1) placements.push({ waitType: 'kanchan', groupIndex: gi });
    else if (pos === 0) placements.push({ waitType: start === 7 ? 'penchan' : 'ryanmen', groupIndex: gi });
    else if (pos === 2) placements.push({ waitType: start === 1 ? 'penchan' : 'ryanmen', groupIndex: gi });
  });
  return placements;
}

function isValueHonorPair(pairTile, ctx) {
  var p = parseTile(pairTile);
  if (p.suit !== 'z') return false;
  return p.num >= 5 || p.num === ctx.seatWindNum || p.num === ctx.roundWindNum;
}

function countIdenticalRunPairs(groups) {
  var counts = {};
  groups.filter(function (g) { return g.type === 'run'; }).forEach(function (g) {
    var key = g.tiles.map(function (t) { return tileIndex(t); }).join(':');
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.keys(counts).reduce(function (sum, k) { return sum + Math.floor(counts[k] / 2); }, 0);
}

function detectYakuman(groups, pairTile, allTiles, ctx, specialShape) {
  var yakuman = [];
  var sets = groups.filter(function (g) { return g.type !== 'run'; });
  var tripletCounts = {};
  sets.forEach(function (g) { tripletCounts[tileIndex(g.tiles[0])] = (tripletCounts[tileIndex(g.tiles[0])] || 0) + 1; });
  var dragonTriplets = [5, 6, 7].filter(function (n) { return tripletCounts[tileIndex(n + 'z')]; }).length;
  var windTriplets = [1, 2, 3, 4].filter(function (n) { return tripletCounts[tileIndex(n + 'z')]; }).length;
  var concealedSets = sets.filter(function (g) { return g.concealed && !g.completedByRon; }).length;
  var kanCount = groups.filter(function (g) { return g.type === 'kan'; }).length;

  if (specialShape === 'kokushi') yakuman.push('国士無双');
  if (ctx.tenhou) yakuman.push('天和');
  if (ctx.chiihou) yakuman.push('地和');
  if (!specialShape) {
    if (dragonTriplets === 3) yakuman.push('大三元');
    if (windTriplets === 4) yakuman.push('大四喜');
    else if (windTriplets === 3 && parseTile(pairTile).suit === 'z' && parseTile(pairTile).num <= 4) yakuman.push('小四喜');
    if (concealedSets === 4) yakuman.push('四暗刻');
    if (kanCount === 4) yakuman.push('四槓子');
  }
  if (allTiles.every(function (t) { return parseTile(t).suit === 'z'; })) yakuman.push('字一色');
  if (allTiles.every(function (t) { var p = parseTile(t); return p.suit !== 'z' && (p.num === 1 || p.num === 9); })) yakuman.push('清老頭');
  var green = new Set(['2s', '3s', '4s', '6s', '8s', '6z']);
  if (allTiles.every(function (t) { return green.has((parseTile(t).num) + parseTile(t).suit); })) yakuman.push('緑一色');
  if (!specialShape && !ctx.isOpen && allTiles.length === 14) {
    var tileKinds = new Set(allTiles.map(function (t) { return tileIndex(t); }));
    var suitCodes = new Set(Array.from(tileKinds).map(indexToCode).map(function (t) { return parseTile(t).suit; }));
    if (suitCodes.size === 1 && !suitCodes.has('z')) {
      var suit = Array.from(suitCodes)[0];
      var counts = tilesToCounts(allTiles);
      var basePattern = suit === 'm' ? 0 : (suit === 'p' ? 9 : 18);
      var nineGatesBase = [3, 1, 1, 1, 1, 1, 1, 1, 3];
      var ok = true;
      for (var n = 0; n < 9; n++) if (counts[basePattern + n] < nineGatesBase[n]) ok = false;
      if (ok && allTiles.length === 14) yakuman.push('九蓮宝燈');
    }
  }
  return yakuman;
}

function paoForYakuman(yakuman, responsibility) {
  var paoYakuKeys = [
    { name: '大三元', key: 'daisangen' },
    { name: '大四喜', key: 'daisuushii' },
    { name: '四槓子', key: 'suukantsu' }
  ];
  return paoYakuKeys.filter(function (item) {
    return yakuman.includes(item.name) && responsibility && responsibility[item.key];
  }).map(function (item) {
    return { yaku: item.name, responsibleSeat: responsibility[item.key] };
  });
}

function calculateHandYaku(groups, pairTile, allTiles, waitInfo, ctx, isChiitoi) {
  var names = [];
  var han = 0;
  var closed = !ctx.isOpen;
  var allSimple = allTiles.every(function (t) { return !isTerminalOrHonor(t); });
  var allRuns = !isChiitoi && groups.length === 4 && groups.every(function (g) { return g.type === 'run'; });
  var allSets = !isChiitoi && groups.length === 4 && groups.every(function (g) { return g.type !== 'run'; });
  var pinfu = closed && allRuns && !isValueHonorPair(pairTile, ctx) && waitInfo.waitType === 'ryanmen';
  function add(name, value) { names.push(name); han += value; }

  if (ctx.doubleRiichi) add('ダブルリーチ', 2);
  else if (ctx.riichi) add('リーチ', 1);
  if (ctx.riichi && ctx.ippatsu) add('一発', 1);
  if (ctx.isTsumo && closed) add('門前清自摸和', 1);
  if (ctx.haitei && ctx.isTsumo && !ctx.rinshan) add('海底摸月', 1);
  if (ctx.houtei && !ctx.isTsumo) add('河底撈魚', 1);
  if (ctx.rinshan) add('嶺上開花', 1);
  if (ctx.chankan) add('搶槓', 1);
  if (allSimple) add('断么九', 1);
  if (pinfu) add('平和', 1);

  groups.forEach(function (g) {
    if (g.type === 'run') return;
    var p = parseTile(g.tiles[0]);
    if (p.suit !== 'z') return;
    if (p.num >= 5) add('役牌(' + HONOR_NAME[p.num] + ')', 1);
    else {
      if (p.num === ctx.seatWindNum) add('役牌(自風' + HONOR_NAME[p.num] + ')', 1);
      if (p.num === ctx.roundWindNum) add('役牌(場風' + HONOR_NAME[p.num] + ')', 1);
    }
  });

  if (allSets) add('対々和', 2);
  var concealedTriplets = groups.filter(function (g) { return g.type !== 'run' && g.concealed && !g.completedByRon; }).length;
  if (!isChiitoi && concealedTriplets >= 3) add('三暗刻', 2);
  if (!isChiitoi && groups.filter(function (g) { return g.type === 'kan'; }).length >= 3) add('三槓子', 2);

  var tripletNumsBySuit = { m: new Set(), p: new Set(), s: new Set() };
  groups.filter(function (g) { return g.type !== 'run'; }).forEach(function (g) {
    var p = parseTile(g.tiles[0]);
    if (p.suit !== 'z') tripletNumsBySuit[p.suit].add(p.num);
  });
  if ([...tripletNumsBySuit.m].some(function (n) { return tripletNumsBySuit.p.has(n) && tripletNumsBySuit.s.has(n); })) add('三色同刻', 2);

  var dragonSetCount = groups.filter(function (g) { var p = parseTile(g.tiles[0]); return g.type !== 'run' && p.suit === 'z' && p.num >= 5; }).length;
  if (dragonSetCount === 2 && parseTile(pairTile).suit === 'z' && parseTile(pairTile).num >= 5) add('小三元', 2);
  if (allTiles.every(isTerminalOrHonor)) add('混老頭', 2);

  if (isChiitoi) add('七対子', 2);
  else {
    var everySetHasTerminal = groups.every(function (g) { return g.type === 'run' ? (parseTile(g.tiles[0]).num === 1 || parseTile(g.tiles[0]).num === 7) : g.tiles.some(isTerminalOrHonor); });
    var hasRun = groups.some(function (g) { return g.type === 'run'; });
    var hasHonor = allTiles.some(function (t) { return parseTile(t).suit === 'z'; });
    if (everySetHasTerminal && isTerminalOrHonor(pairTile) && hasRun) {
      add(hasHonor ? '混全帯么九' : '純全帯么九', hasHonor ? (ctx.isOpen ? 1 : 2) : (ctx.isOpen ? 2 : 3));
    }
    if (allSets) { /* 対々和 already scored; terminals/honors are handled by 混老頭 */ }
  }

  var suits = new Set(allTiles.map(function (t) { return parseTile(t).suit; }).filter(function (s) { return s !== 'z'; }));
  var hasHonor = allTiles.some(function (t) { return parseTile(t).suit === 'z'; });
  if (suits.size === 1) add(hasHonor ? '混一色' : '清一色', hasHonor ? (ctx.isOpen ? 2 : 3) : (ctx.isOpen ? 5 : 6));

  ['m', 'p', 's'].forEach(function (suit) {
    var starts = groups.filter(function (g) { return g.type === 'run' && parseTile(g.tiles[0]).suit === suit; }).map(function (g) { return parseTile(g.tiles[0]).num; });
    if ([1, 4, 7].every(function (n) { return starts.includes(n); })) add('一気通貫', ctx.isOpen ? 1 : 2);
  });
  var runStarts = { m: new Set(), p: new Set(), s: new Set() };
  groups.filter(function (g) { return g.type === 'run'; }).forEach(function (g) { var p = parseTile(g.tiles[0]); runStarts[p.suit].add(p.num); });
  if ([1, 2, 3, 4, 5, 6, 7].some(function (n) { return runStarts.m.has(n) && runStarts.p.has(n) && runStarts.s.has(n); })) add('三色同順', ctx.isOpen ? 1 : 2);

  if (closed && !isChiitoi) {
    var duplicatePairs = countIdenticalRunPairs(groups);
    if (duplicatePairs >= 2) add('二盃口', 3);
    else if (duplicatePairs === 1) add('一盃口', 1);
  }

  var yakuman = detectYakuman(groups, pairTile, allTiles, ctx, null);
  var pureYakuHan = han;
  if (ctx.doraCount > 0) { names.push('ドラ' + ctx.doraCount); han += ctx.doraCount; }
  if (ctx.redDoraCount > 0) { names.push('赤ドラ' + ctx.redDoraCount); han += ctx.redDoraCount; }
  if (ctx.riichi && ctx.uraDoraCount > 0) { names.push('裏ドラ' + ctx.uraDoraCount); han += ctx.uraDoraCount; }
  return { names: names, han: han, pureYakuHan: pureYakuHan, hasYaku: pureYakuHan > 0, pinfu: pinfu, yakuman: yakuman };
}

function calculateFuForHand(groups, pairTile, waitInfo, ctx, pinfu) {
  if (ctx.isChiitoi) return 25;
  if (pinfu && ctx.isTsumo) return 20;
  var fu = 20;
  groups.forEach(function (g) {
    if (g.type === 'run') return;
    var terminal = isTerminalOrHonor(g.tiles[0]);
    var concealed = g.concealed && !g.completedByRon;
    var base = g.type === 'kan' ? (terminal ? 32 : 16) : (terminal ? 8 : 4);
    if (!concealed) base /= 2;
    fu += base;
  });
  var pair = parseTile(pairTile);
  if (pair.suit === 'z') {
    if (pair.num >= 5) fu += 2;
    else if (pair.num === ctx.seatWindNum || pair.num === ctx.roundWindNum) fu += 2;
  }
  if (['tanki', 'kanchan', 'penchan'].includes(waitInfo.waitType)) fu += 2;
  if (ctx.isTsumo && !pinfu) fu += 2;
  if (!ctx.isTsumo && !ctx.isOpen) fu += 10;
  if (!ctx.isTsumo && ctx.isOpen && fu === 20) fu += 10;
  return Math.ceil(fu / 10) * 10;
}

function scorePoints(han, fu, isDealer, isTsumo, yakumanUnits) {
  var base;
  var tierName = null;
  if (yakumanUnits > 0) {
    base = 8000 * yakumanUnits;
    tierName = yakumanUnits === 1 ? '役満' : yakumanUnits + '倍役満';
  } else if (han >= 11) { base = 6000; tierName = '三倍満'; }
  else if (han >= 8) { base = 4000; tierName = '倍満'; }
  else if (han >= 6) { base = 3000; tierName = '跳満'; }
  else if (han >= 5) { base = 2000; tierName = '満貫'; }
  else {
    base = fu * Math.pow(2, han + 2);
    if (base >= 2000) { base = 2000; tierName = '満貫'; }
  }
  var total, perAll = null, perDealer = null, perNonDealer = null;
  if (isTsumo) {
    if (isDealer) { perAll = roundUp100(base * 2); total = perAll * 3; }
    else { perDealer = roundUp100(base * 2); perNonDealer = roundUp100(base); total = perDealer + perNonDealer * 2; }
  } else total = roundUp100(base * (isDealer ? 6 : 4));
  return { total: total, perAll: perAll, perDealer: perDealer, perNonDealer: perNonDealer, tierName: tierName };
}

function scoreHand(fullConcealedTiles, winTile, melds, context) {
  var ctx = Object.assign({
    isTsumo: false, isOpen: false, riichi: false, doubleRiichi: false, ippatsu: false,
    seatWindNum: 0, roundWindNum: 0, doraIndicators: [], uraIndicators: [],
    haitei: false, houtei: false, rinshan: false, chankan: false, tenhou: false, chiihou: false,
    paoResponsibility: {}
  }, context || {});
  ctx.tenhou = !!ctx.tenhou && !!ctx.isTsumo;
  ctx.chiihou = !!ctx.chiihou && !!ctx.isTsumo;
  melds = (melds || []).map(normalizeScoringMeld);
  ctx.isOpen = !!ctx.isOpen || melds.some(function (m) { return m.open; });
  var allTiles = fullConcealedTiles.concat.apply(fullConcealedTiles.slice(), melds.map(function (m) { return m.tiles; }));
  var tileCounts = tilesToCounts(allTiles);
  if (tileCounts.some(function (n) { return n > 4; })) return { isComplete: false, noYaku: false, han: 0, fu: 0, total: 0, breakdownParts: [] };
  var doraTargets = (ctx.doraIndicators || []).filter(Boolean).map(nextTile);
  var uraTargets = ctx.riichi ? (ctx.uraIndicators || []).filter(Boolean).map(nextTile) : [];
  ctx.doraCount = allTiles.reduce(function (sum, t) {
    return sum + doraTargets.filter(function (d) { return isSameTileType(t, d); }).length;
  }, 0);
  ctx.redDoraCount = allTiles.filter(isRedTile).length;
  ctx.uraDoraCount = allTiles.reduce(function (sum, t) {
    return sum + uraTargets.filter(function (d) { return isSameTileType(t, d); }).length;
  }, 0);

  var requiredSets = 4 - melds.length;
  var decompositions = enumerateStandardDecompositions(fullConcealedTiles, requiredSets);
  var counts = tilesToCounts(fullConcealedTiles);
  var isKokushi = melds.length === 0 && isKokushiComplete(counts);
  var isChiitoi = melds.length === 0 && isChiitoiComplete(counts);
  var candidates = [];

  if (isKokushi) {
    var kokushiNames = ['国士無双'];
    var yakumanUnits = 1 + (ctx.tenhou ? 1 : 0) + (ctx.chiihou ? 1 : 0);
    candidates.push(Object.assign({ isComplete: true, noYaku: false, han: 13 * yakumanUnits, fu: 0, yakumanUnits: yakumanUnits, breakdownParts: ctx.tenhou ? ['天和', '国士無双'] : (ctx.chiihou ? ['地和', '国士無双'] : kokushiNames), isTsumo: ctx.isTsumo }, scorePoints(13, 0, ctx.dealer, ctx.isTsumo, yakumanUnits)));
  } else {
    if (isChiitoi) {
      var chiitoiGroups = [];
      counts.forEach(function (n, i) { if (n === 2) chiitoiGroups.push({ type: 'pair', tiles: [indexToCode(i), indexToCode(i)] }); });
      var chiitoiPair = chiitoiGroups.length ? chiitoiGroups[0].tiles[0] : '';
      var chiitoi = calculateHandYaku([], chiitoiPair, allTiles, { waitType: 'tanki' }, ctx, true);
      var yakumanList = detectYakuman([], chiitoiPair, allTiles, ctx, 'chiitoi');
      if (yakumanList.length) {
        var units = yakumanList.length;
        candidates.push(Object.assign({ isComplete: true, noYaku: false, han: units * 13, fu: 0, yakumanUnits: units, breakdownParts: yakumanList, pao: [], isTsumo: ctx.isTsumo }, scorePoints(13, 0, ctx.dealer, ctx.isTsumo, units)));
      } else {
        var fuChiitoi = 25;
        var pointsChiitoi = scorePoints(chiitoi.han, fuChiitoi, ctx.dealer, ctx.isTsumo, 0);
        candidates.push(Object.assign({ isComplete: true, noYaku: !chiitoi.hasYaku, han: chiitoi.han, fu: fuChiitoi, yakumanUnits: 0, breakdownParts: chiitoi.names, isTsumo: ctx.isTsumo }, pointsChiitoi));
      }
    }
    decompositions.forEach(function (d) {
      var fullGroups = d.groups.concat(melds);
      scoringWaitPlacements(d, winTile).forEach(function (waitInfo) {
        var groups = fullGroups.map(function (g, i) {
          var groupIndex = i;
          var copy = { type: g.type, tiles: g.tiles.slice(), concealed: !!g.concealed, open: !!g.open, completedByRon: false };
          if (!ctx.isTsumo && waitInfo.waitType === 'shanpon' && waitInfo.groupIndex === groupIndex) copy.completedByRon = true;
          return copy;
        });
        var yaku = calculateHandYaku(groups, d.pairTile, allTiles, waitInfo, ctx, false);
        var yakuman = yaku.yakuman.slice();
        if (yakuman.length) {
          var units = yakuman.length;
          candidates.push(Object.assign({ isComplete: true, noYaku: false, han: 13 * units, fu: 0, yakumanUnits: units, breakdownParts: yakuman, pao: paoForYakuman(yakuman, ctx.paoResponsibility), waitType: waitInfo.waitType, isTsumo: ctx.isTsumo }, scorePoints(13, 0, ctx.dealer, ctx.isTsumo, units)));
          return;
        }
        var fu = calculateFuForHand(groups, d.pairTile, waitInfo, ctx, yaku.pinfu);
        var points = scorePoints(yaku.han, fu, ctx.dealer, ctx.isTsumo, 0);
        candidates.push(Object.assign({ isComplete: true, noYaku: !yaku.hasYaku, han: yaku.han, fu: fu, yakumanUnits: 0, breakdownParts: yaku.names, waitType: waitInfo.waitType, isTsumo: ctx.isTsumo }, points));
      });
    });
  }

  if (!candidates.length) return { isComplete: false, noYaku: false, han: 0, fu: 0, total: 0, breakdownParts: [] };
  candidates.sort(function (a, b) {
    if (a.noYaku !== b.noYaku) return a.noYaku ? 1 : -1;
    if (b.total !== a.total) return b.total - a.total;
    if (b.han !== a.han) return b.han - a.han;
    return b.fu - a.fu;
  });
  return candidates[0];
}


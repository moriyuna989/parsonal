// =====================================================================
// js/game/cpu_ai.js
// 仲林圭プロAI思考ロジック（麻雀の教科書：安全度・牌効率・リーチ判断）
// =====================================================================

// 場に見えている全ての牌の枚数（各プレイヤーの河＋副露＋ドラ表示牌）を集計
function computeAllVisibleCounts() {
  var counts = new Array(34).fill(0);
  if (!G || !G.players) return counts;
  SEATS.forEach(function (s) {
    var p = G.players[s];
    if (!p) return;
    p.river.forEach(function (t) { counts[tileIndex(t)]++; });
    if (p.melds) {
      p.melds.forEach(function (m) {
        var isConcealedKan = m.type === 'kan' && (m.subType === 'ankan' || m.concealed);
        var visibleMeldTiles = isConcealedKan ? [(m.tiles && m.tiles[1]) || m.tiles[0], (m.tiles && m.tiles[2]) || m.tiles[0]] : m.tiles;
        visibleMeldTiles.forEach(function (t) { if (t) counts[tileIndex(t)]++; });
      });
    }
  });
  var doraList = G.doraIndicators || [G.doraIndicator];
  doraList.forEach(function (t) { if (t) counts[tileIndex(t)]++; });
  return counts;
}

// 特定の席に対してスジ（両面否定）になっているかの判定
function isSujiForSeat(tileCode, targetSeat) {
  var t = parseTile(tileCode);
  if (t.suit === 'z') return false;
  var river = G.players[targetSeat].river;
  var suit = t.suit;
  var num = t.num;
  if (num === 1) return river.includes('4' + suit);
  if (num === 2) return river.includes('5' + suit);
  if (num === 3) return river.includes('6' + suit);
  if (num === 4) return river.includes('1' + suit) && river.includes('7' + suit);
  if (num === 5) return river.includes('2' + suit) && river.includes('8' + suit);
  if (num === 6) return river.includes('3' + suit) && river.includes('9' + suit);
  if (num === 7) return river.includes('4' + suit);
  if (num === 8) return river.includes('5' + suit);
  if (num === 9) return river.includes('6' + suit);
  return false;
}

// 役牌（白發中、自風、場風）かどうかの判定
function isYakuhai(tileCode, seat) {
  var t = parseTile(tileCode);
  if (t.suit !== 'z') return false;
  if (t.num >= 5) return true; // 白・發・中
  var seatWind = G.seatWind ? G.seatWind[seat] : null;
  var roundWind = G.kyokuWind;
  var name = HONOR_NAME[t.num];
  return (name === seatWind || name === roundWind);
}

// 仲林流・安全度評価アルゴリズム（「アガれない75%の守備思考」）
// 数値が小さいほど安全（0: 完全安牌、100以上: 危険牌）
function evaluateTileSafetyNakabayashi(tileCode, hand, riichiSeats, visibleCounts) {
  var idx = tileIndex(tileCode);
  var t = parseTile(tileCode);

  // 1. 現物判定（全リーチ者に対して現物なら最高安全度）
  var isAllGenbutsu = riichiSeats.every(function (s) {
    return computeSafeSetFor(s).has(tileCode);
  });
  if (isAllGenbutsu) return 0; // 完全安牌（共通現物）

  var genbutsuCount = riichiSeats.filter(function (s) {
    return computeSafeSetFor(s).has(tileCode);
  }).length;
  if (genbutsuCount > 0) {
    // 一部に対する現物
    return 14 - (genbutsuCount * 4);
  }

  // 手牌内の枚数も含めた見えている総枚数
  var inHand = hand.filter(function (x) { return tileIndex(x) === idx; }).length;
  var totalSeen = visibleCounts[idx] + inHand;

  // 2. 字牌の安全度判定
  if (t.suit === 'z') {
    if (totalSeen >= 4) return 2;  // 4枚見え字牌（国士以外当たらない極安牌）
    if (totalSeen === 3) return 8;  // 地獄単騎以外当たらない
    if (totalSeen === 2) return 18; // 2枚見え字牌
    return 50; // 生牌の字牌
  }

  // 3. スジ判定
  var allSuji = riichiSeats.every(function (s) { return isSujiForSeat(tileCode, s); });
  if (allSuji) {
    if (t.num === 1 || t.num === 9) return 16; // 1・9のスジ
    if (t.num === 2 || t.num === 8) return 26; // 2・8のスジ
    if (t.num === 3 || t.num === 7) return 36; // 3・7のスジ
    return 24; // 4・5・6の両スジ
  }

  // 4. ノーチャンス（カベ）判定
  var suitBase = t.suit === 'm' ? 0 : (t.suit === 'p' ? 9 : 18);
  if (t.num === 1 && (visibleCounts[suitBase + 1] >= 4)) return 14; // 2が4枚見えの1
  if (t.num === 9 && (visibleCounts[suitBase + 7] >= 4)) return 14; // 8が4枚見えの9
  if (t.num === 2 && (visibleCounts[suitBase + 2] >= 4)) return 24; // 3が4枚見えの2
  if (t.num === 8 && (visibleCounts[suitBase + 5] >= 4)) return 24; // 7が4枚見えの8

  // 5. 無筋（危険度）
  var baseRisk = 70;
  if (t.num === 1 || t.num === 9) baseRisk = 55;
  else if (t.num === 2 || t.num === 8) baseRisk = 68;
  else if (t.num === 3 || t.num === 7) baseRisk = 82;
  else baseRisk = 92; // 4, 5, 6 の無筋

  // ドラ・赤ドラなら放銃時の打点が高いためさらに危険度加算
  var doraTargets = (G.doraIndicators || [G.doraIndicator]).map(nextTile);
  var isTargetDora = doraTargets.some(function (dt) { return isSameTileType(tileCode, dt); });
  var isTargetRed = isRedTile(tileCode);
  if (isTargetDora && isTargetRed) {
    baseRisk += 45; // 表ドラ＋赤ドラの2飜重複牌は超危険
  } else if (isTargetDora || isTargetRed) {
    baseRisk += 25;
  }

  // リーチ者の中に一発巡目の他家がいる場合、一発放銃による失点（+1飜）を防ぐため危険牌のリスクを底上げ
  var hasIppatsu = riichiSeats.some(function (s) { return G.players[s] && G.players[s].ippatsu; });
  if (hasIppatsu) {
    baseRisk += 15;
  }

  return baseRisk;
}

// 仲林流・攻撃時の牌の不要度評価（「麻雀の教科書：オタ風処理・役牌重視・5ブロック良形変化」）
// 数値が大きいほど不要（早く切るべき牌）
function evaluateTileWasteNakabayashi(tileCode, hand, seat, counts) {
  var t = parseTile(tileCode);
  var idx = tileIndex(tileCode);
  var c = counts[idx];
  var turn = (G && G.players && G.players[seat]) ? (G.players[seat].river.length + 1) : 1;

  // ドラ・赤ドラ判定
  var doraTargets = (G && G.doraIndicators ? G.doraIndicators : [G ? G.doraIndicator : null]).filter(Boolean).map(nextTile);
  var isTargetDora = doraTargets.some(function (dt) { return isSameTileType(tileCode, dt); });
  var isTargetRed = isRedTile(tileCode);
  var isDora = isTargetDora || isTargetRed;

  // 字牌の価値付け
  if (t.suit === 'z') {
    if (c >= 3) return 5;  // 暗刻・槓子
    if (c === 2) return 20; // トイツ（雀頭・刻子候補）
    // 孤立字牌
    if (isYakuhai(tileCode, seat)) {
      // 役牌（三元牌・自風・場風）: 重なりによる特急券
      // 序盤（1〜4巡目）は孤立1・9牌より大切に残す
      if (turn <= 4) return 65;
      return 80;
    } else {
      // オタ風（役にならない客風）: 教科書通り序盤（1〜4巡目）に最優先で切る
      if (turn <= 4) return 100;
      return 88;
    }
  }

  // 数牌の暗刻・トイツ
  if (c >= 3) return 10;
  if (c === 2) return 25;

  // 数牌（ターツ・孤立牌）
  var suitBase = t.suit === 'm' ? 0 : (t.suit === 'p' ? 9 : 18);
  var n = t.num - 1;
  var hasNeighbor1 = (n > 0 && counts[suitBase + n - 1] > 0);
  var hasNeighbor2 = (n < 8 && counts[suitBase + n + 1] > 0);
  var hasGap1 = (n > 1 && counts[suitBase + n - 2] > 0);
  var hasGap2 = (n < 7 && counts[suitBase + n + 2] > 0);

  var waste = 50;
  if (hasNeighbor1 && hasNeighbor2) {
    // リャンメン完成面子構成牌
    waste = 12;
  } else if (hasNeighbor1 || hasNeighbor2) {
    // 2枚連番（ペンチャンまたはリャンメン）
    if (t.num === 1 || t.num === 9) waste = 46; // ペンチャン 1-2, 8-9
    else waste = 28; // リャンメン両面ターツ
  } else if (hasGap1 || hasGap2) {
    // カンチャン
    if (t.num === 1 || t.num === 9) waste = 58;
    else waste = 44;
  } else {
    // 完全孤立牌
    if (t.num === 1 || t.num === 9) {
      // 孤立端牌（1・9）: オタ風の次に処理
      waste = 85;
    } else if (t.num === 2 || t.num === 8) {
      waste = 68;
    } else {
      // 孤立中張牌（3〜7）: リャンメン良形変化の種として大切に保持
      waste = 50;
    }
  }

  // ドラ・赤ドラは手放さない（不要度を大幅減算）
  if (isTargetDora && isTargetRed) {
    waste -= 65; // 赤ドラ＋表ドラの超勝負手牌は手放さない
  } else if (isDora) {
    waste -= 35;
  }

  return Math.max(1, waste);
}

// 仲林流・リーチ判断アルゴリズム（「麻雀の教科書：好形愚形・打点・先制追っかけ」）
function evaluateCpuRiichiDecisionNakabayashi(seat, hand, tenpaiInfo) {
  var p = G.players[seat];
  var waits = tenpaiInfo.waits || [];
  var isGoodWait = waits.length >= 2; // 両面以上なら好形
  var turn = p.river.length + 1;
  var isDealer = (G.dealerSeat === seat);
  var rs = riichiSeatsActive().filter(function (s) { return s !== seat; });
  var isChase = (rs.length > 0); // 他家にリーチがいる（追っかけ）

  // 和了時の想定打点を算出
  var testTile = waits[0];
  var concealedCopy = hand.filter(function (t, i) { return i !== hand.indexOf(tenpaiInfo.discardTile); }).concat([testTile]);
  var winScore = scorePlayerWin(seat, concealedCopy, testTile, false);
  var isHighTier = (winScore.han >= 3 || winScore.total >= 7700);

  if (!isChase) {
    // 【先制テンパイ】
    if (isGoodWait) {
      // 先制好形は即リーチ（教科書の鉄則！）
      return { shouldRiichi: true, discardTile: tenpaiInfo.discardTile };
    } else {
      // 愚形（カンチャン・ペンチャン）
      if (turn <= 5 && !isHighTier && !isDealer) {
        // 序盤の安手愚形は、良形変化（手変わり）を狙ってダマテン
        return { shouldRiichi: false, discardTile: tenpaiInfo.discardTile };
      }
      // 打点十分、親番、または中盤以降なら堂々と愚形でもリーチ
      return { shouldRiichi: true, discardTile: tenpaiInfo.discardTile };
    }
  } else {
    // 【追っかけテンパイ（他家にリーチあり）】
    // 仲林流「75%の守備思考」: 無謀な突撃は厳禁
    if (isGoodWait && isHighTier) {
      // 好形かつ高打点（満貫以上）なら追っかけリーチで堂々勝負！
      return { shouldRiichi: true, discardTile: tenpaiInfo.discardTile };
    }
    if (isGoodWait && isDealer) {
      // 親の好形なら勝負リーチ
      return { shouldRiichi: true, discardTile: tenpaiInfo.discardTile };
    }
    // 愚形、または安手ならリーチせずダマテン、または安全牌を切ってオリる
    return { shouldRiichi: false, discardTile: tenpaiInfo.discardTile };
  }
}

// 仲林流・CPU総合打牌決定（攻撃と徹底守備の完全両立）
function chooseCpuDiscardNakabayashi(seat, hand) {
  var rs = riichiSeatsActive().filter(function (s) { return s !== seat; });
  var visibleCounts = computeAllVisibleCounts();

  if (rs.length > 0) {
    // 相手にリーチが入っている局面：仲林流「75%の守備思考（ベタオリ）」
    var bestSafeTile = hand[0];
    var minRisk = 9999;
    for (var i = 0; i < hand.length; i++) {
      var t = hand[i];
      var risk = evaluateTileSafetyNakabayashi(t, hand, rs, visibleCounts) + Math.random() * 2;
      if (risk < minRisk) {
        minRisk = risk;
        bestSafeTile = t;
      }
    }
    return bestSafeTile;
  }

  // 相手にリーチがいない局面：仲林流「教科書の牌効率と序盤整理」
  var counts = tilesToCounts(hand);
  var bestTile = hand[0];
  var maxWaste = -9999;
  for (var i = 0; i < hand.length; i++) {
    var tile = hand[i];
    var waste = evaluateTileWasteNakabayashi(tile, hand, seat, counts) + Math.random() * 3;
    if (waste > maxWaste) {
      maxWaste = waste;
      bestTile = tile;
    }
  }
  return bestTile;
}

// 互換性エイリアス
function chooseCpuDiscard(hand, safeSet) {
  return chooseCpuDiscardNakabayashi('p2', hand);
}

function evaluateTileWaste(code, counts) {
  return evaluateTileWasteNakabayashi(code, [], 'p2', counts);
}

function checkCpuTenpaiAndDiscard(hand) {
  var uniqueTiles = Array.from(new Set(hand));
  for (var i = 0; i < uniqueTiles.length; i++) {
    var tile = uniqueTiles[i];
    var copy = hand.slice();
    copy.splice(copy.indexOf(tile), 1);
    var waits = findWaits(copy);
    if (waits.length > 0) {
      return { canTenpai: true, discardTile: tile, waits: waits };
    }
  }
  return { canTenpai: false };
}

// レベル別打牌選択（初級・中級・上級）
function chooseCpuDiscardByLevel(seat, hand, level) {
  level = level || 'hard';

  // 【初級】守備を考慮せず、自分の手牌の牌効率だけで打牌（相手のリーチを無視・全ツッパ）
  if (level === 'easy') {
    var counts = tilesToCounts(hand);
    var bestTile = hand[0];
    var maxWaste = -9999;
    for (var i = 0; i < hand.length; i++) {
      var tile = hand[i];
      // 簡易牌効率＋ランダムブレ（初級らしさ）
      var waste = evaluateTileWasteNakabayashi(tile, hand, seat, counts) + Math.random() * 25;
      if (waste > maxWaste) {
        maxWaste = waste;
        bestTile = tile;
      }
    }
    return bestTile;
  }

  // 【中級】相手にリーチがいる場合、現物があれば現物を優先。現物が無ければ通常の牌効率で打牌（スジ等の精密計算はなし）
  if (level === 'normal') {
    var rs = riichiSeatsActive().filter(function (s) { return s !== seat; });
    if (rs.length > 0) {
      // 現物を探す
      var genbutsuTiles = hand.filter(function (t) {
        return rs.some(function (s) { return computeSafeSetFor(s).has(t); });
      });
      if (genbutsuTiles.length > 0) {
        var allGenbutsu = genbutsuTiles.filter(function (t) {
          return rs.every(function (s) { return computeSafeSetFor(s).has(t); });
        });
        if (allGenbutsu.length > 0) {
          return allGenbutsu[Math.floor(Math.random() * allGenbutsu.length)];
        }
        return genbutsuTiles[Math.floor(Math.random() * genbutsuTiles.length)];
      }
      var honorTiles = hand.filter(function (t) { return parseTile(t).suit === 'z'; });
      if (honorTiles.length > 0) {
        return honorTiles[Math.floor(Math.random() * honorTiles.length)];
      }
    }
    var counts = tilesToCounts(hand);
    var bestTile = hand[0];
    var maxWaste = -9999;
    for (var i = 0; i < hand.length; i++) {
      var tile = hand[i];
      var waste = evaluateTileWasteNakabayashi(tile, hand, seat, counts) + Math.random() * 8;
      if (waste > maxWaste) {
        maxWaste = waste;
        bestTile = tile;
      }
    }
    return bestTile;
  }

  // 【上級】仲林圭プロAI（最高精度の押し引きとベタオリ）
  return chooseCpuDiscardNakabayashi(seat, hand);
}
window.chooseCpuDiscardByLevel = chooseCpuDiscardByLevel;

// レベル別リーチ判断（初級・中級・上級）
function evaluateCpuRiichiDecisionByLevel(seat, hand, tenpaiInfo, level) {
  level = level || 'hard';

  // 【初級】テンパイしたら形や打点・他家リーチに関係なく100%即リーチ
  if (level === 'easy') {
    return { shouldRiichi: true, discardTile: tenpaiInfo.discardTile };
  }

  // 【中級】好形なら即リーチ、愚形でも他家リーチがなければ60%リーチ、追っかけは好形のみ
  if (level === 'normal') {
    var waits = tenpaiInfo.waits || [];
    var isGoodWait = waits.length >= 2;
    var rs = riichiSeatsActive().filter(function (s) { return s !== seat; });
    var isChase = (rs.length > 0);

    if (!isChase) {
      if (isGoodWait) return { shouldRiichi: true, discardTile: tenpaiInfo.discardTile };
      return { shouldRiichi: Math.random() < 0.6, discardTile: tenpaiInfo.discardTile };
    } else {
      return { shouldRiichi: isGoodWait, discardTile: tenpaiInfo.discardTile };
    }
  }

  // 【上級】仲林圭プロAIの緻密なリーチ判断
  return evaluateCpuRiichiDecisionNakabayashi(seat, hand, tenpaiInfo);
}
window.evaluateCpuRiichiDecisionByLevel = evaluateCpuRiichiDecisionByLevel;

// ---------------------------------------------------------------------
// Advanced CPU decision layer
// The original heuristics above remain available for easy/normal levels.
// This layer is used only by the advanced CPU and evaluates every discard.
// ---------------------------------------------------------------------

function cpuThreatSeatsFor(seat) {
  if (!G || !G.players) return [];
  return SEATS.filter(function (target) {
    if (target === seat || !G.players[target]) return false;
    var p = G.players[target];
    // A human riichi is a real threat too.  For an open hand, use only
    // public signals (melds and turn count), never its hidden wait state.
    return !!p.riichi || (!!p.isOpen && (p.melds || []).length > 0 && (p.river || []).length >= 4);
  });
}

// 暗槓だけは門前として扱い、ポン・チー・大明槓・加槓がある手は
// リーチできない。古い状態で isOpen だけが残っている場合も、
// 副露情報があればその内容を優先する。
function cpuCanDeclareRiichi(seat) {
  var player = G && G.players && G.players[seat];
  if (!player) return false;
  var melds = player.melds || [];
  if (!melds.length) return !player.isOpen;
  if (melds.some(function (meld) {
    return meld && !(meld.concealed === true || (meld.type === 'kan' && meld.subType === 'ankan'));
  })) return false;
  return true;
}
window.cpuCanDeclareRiichi = cpuCanDeclareRiichi;

function cpuSetHasTileType(set, tileCode) {
  if (!set || !tileCode) return false;
  if (set.has(tileCode)) return true;
  var values = Array.from(set);
  for (var i = 0; i < values.length; i++) {
    var value = values[i];
    if (isSameTileType(value, tileCode)) return true;
  }
  return false;
}

function cpuRiverHasTileType(river, tileCode) {
  return (river || []).some(function (code) { return isSameTileType(code, tileCode); });
}

function cpuSujiForSeat(tileCode, targetSeat) {
  var t = parseTile(tileCode);
  if (t.suit === 'z' || !G.players[targetSeat]) return false;
  var river = G.players[targetSeat].river || [];
  var suit = t.suit;
  var num = t.num;
  if (num === 1) return cpuRiverHasTileType(river, '4' + suit);
  if (num === 2) return cpuRiverHasTileType(river, '5' + suit);
  if (num === 3) return cpuRiverHasTileType(river, '6' + suit);
  if (num === 4) return cpuRiverHasTileType(river, '1' + suit) && cpuRiverHasTileType(river, '7' + suit);
  if (num === 5) return cpuRiverHasTileType(river, '2' + suit) && cpuRiverHasTileType(river, '8' + suit);
  if (num === 6) return cpuRiverHasTileType(river, '3' + suit) && cpuRiverHasTileType(river, '9' + suit);
  if (num === 7) return cpuRiverHasTileType(river, '4' + suit);
  if (num === 8) return cpuRiverHasTileType(river, '5' + suit);
  if (num === 9) return cpuRiverHasTileType(river, '6' + suit);
  return false;
}

function cpuDoraRisk(tileCode) {
  var indicators = (G && (G.doraIndicators || (G.doraIndicator ? [G.doraIndicator] : []))) || [];
  var isDora = indicators.filter(Boolean).some(function (indicator) {
    return isSameTileType(tileCode, nextTile(indicator));
  });
  return (isDora ? 0.20 : 0) + (isRedTile(tileCode) ? 0.14 : 0);
}

function cpuBaseTileRisk(tileCode, visibleCounts) {
  var t = parseTile(tileCode);
  var count = visibleCounts[tileIndex(tileCode)] || 0;
  if (count >= 4) return 0;
  if (t.suit === 'z') return count >= 3 ? 0.10 : (count === 2 ? 0.30 : 0.62);
  if (t.num === 1 || t.num === 9) return 0.36;
  if (t.num === 2 || t.num === 8) return 0.50;
  if (t.num === 3 || t.num === 7) return 0.66;
  return 0.80;
}

function cpuTileRiskAgainst(tileCode, targetSeat, visibleCounts) {
  var target = G.players[targetSeat];
  if (!target) return 0;
  var safeSet = target.riichi ? computeSafeSetFor(targetSeat) : new Set(target.river || []);
  if (cpuSetHasTileType(safeSet, tileCode)) return 0;

  var risk = cpuBaseTileRisk(tileCode, visibleCounts);
  if (cpuSujiForSeat(tileCode, targetSeat)) {
    var number = parseTile(tileCode).num;
    risk *= (number === 1 || number === 9) ? 0.38 : (number === 2 || number === 8 ? 0.52 : 0.68);
  }
  var t = parseTile(tileCode);
  var suitBase = t.suit === 'm' ? 0 : (t.suit === 'p' ? 9 : 18);
  if (t.suit !== 'z') {
    if ((t.num === 1 && visibleCounts[suitBase + 1] >= 4) ||
        (t.num === 9 && visibleCounts[suitBase + 7] >= 4) ||
        (t.num === 2 && visibleCounts[suitBase + 2] >= 4) ||
        (t.num === 8 && visibleCounts[suitBase + 5] >= 4)) {
      risk *= 0.72;
    }
  }
  if (target.ippatsu) risk += 0.10;
  if (!target.riichi) risk *= 0.78;
  return Math.min(1, risk + cpuDoraRisk(tileCode));
}

function evaluateTileSafetyNakabayashi(tileCode, hand, threatSeats, visibleCounts) {
  var threats = (threatSeats || []).filter(function (seat) { return G.players[seat]; });
  if (!threats.length) return 0;
  var risks = threats.map(function (seat) { return cpuTileRiskAgainst(tileCode, seat, visibleCounts); });
  // A tile safe against one opponent still has to pass every other opponent.
  var survival = risks.reduce(function (product, risk) { return product * (1 - risk); }, 1);
  return Math.min(100, (1 - survival) * 100);
}

function cpuStandardShanten(counts, openMelds) {
  var best = 8;
  function visit(index, melds, taatsu, pair) {
    while (index < 34 && counts[index] === 0) index++;
    if (index >= 34) {
      var usableTaatsu = Math.min(taatsu, 4 - melds);
      best = Math.min(best, 8 - melds * 2 - usableTaatsu - pair);
      return;
    }
    // Skip one tile.  This branch is needed for isolated tiles and excess copies.
    counts[index]--;
    visit(index, melds, taatsu, pair);
    counts[index]++;

    if (counts[index] >= 3) {
      counts[index] -= 3;
      visit(index, melds + 1, taatsu, pair);
      counts[index] += 3;
    }
    if (index < 27 && index % 9 <= 6 && counts[index + 1] > 0 && counts[index + 2] > 0) {
      counts[index]--; counts[index + 1]--; counts[index + 2]--;
      visit(index, melds + 1, taatsu, pair);
      counts[index]++; counts[index + 1]++; counts[index + 2]++;
    }
    if (!pair && counts[index] >= 2) {
      counts[index] -= 2;
      visit(index, melds, taatsu, 1);
      counts[index] += 2;
    }
    if (taatsu < 4 - melds && counts[index] >= 2) {
      counts[index] -= 2;
      visit(index, melds, taatsu + 1, pair);
      counts[index] += 2;
    }
    if (taatsu < 4 - melds && index < 27 && index % 9 <= 7 && counts[index + 1] > 0) {
      counts[index]--; counts[index + 1]--;
      visit(index, melds, taatsu + 1, pair);
      counts[index]++; counts[index + 1]++;
    }
    if (taatsu < 4 - melds && index < 27 && index % 9 <= 6 && counts[index + 2] > 0) {
      counts[index]--; counts[index + 2]--;
      visit(index, melds, taatsu + 1, pair);
      counts[index]++; counts[index + 2]++;
    }
  }
  visit(0, openMelds || 0, 0, 0);
  return best;
}

function cpuCalculateShanten(hand, openMelds) {
  var counts = tilesToCounts(hand);
  var standard = cpuStandardShanten(counts.slice(), openMelds || 0);
  var chiitoi = (openMelds || 0) ? 99 : 6;
  var kokushi = (openMelds || 0) ? 99 : 13;
  if (!(openMelds || 0)) {
    var pairCount = 0;
    var terminals = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
    var allDistinct = 0;
    for (var i = 0; i < 34; i++) {
      if (counts[i] > 0) allDistinct++;
      if (counts[i] >= 2) pairCount++;
    }
    chiitoi = 6 - pairCount + Math.max(0, 7 - allDistinct);
    var terminalDistinct = terminals.filter(function (index) { return counts[index] > 0; }).length;
    var terminalPair = terminals.some(function (index) { return counts[index] >= 2; });
    kokushi = 13 - terminalDistinct - (terminalPair ? 1 : 0);
  }
  return Math.min(standard, chiitoi, kokushi);
}

function cpuEstimateCandidateValue(seat, afterHand, waits, includeScore) {
  if (!includeScore || !waits.length || typeof scorePlayerWin !== 'function') return 0;
  var values = waits.map(function (wait) {
    try {
      var score = scorePlayerWin(seat, afterHand.concat([wait]), wait, false);
      return score && score.isComplete && !score.noYaku ? (score.total || 0) : 0;
    } catch (err) { return 0; }
  });
  if (!values.length) return 0;
  return Math.min(1, Math.max.apply(Math, values) / 12000);
}

function cpuLearningWeights() {
  if (typeof CpuLearning !== 'undefined' && CpuLearning.getWeights) return CpuLearning.getWeights();
  return { progress: 1, ukeire: 0.7, wait: 0.8, value: 0.35, safety: 0.2, danger: 1.15, humanStyle: {} };
}

function cpuBuildDiscardCandidates(seat, hand, options) {
  options = options || {};
  var cacheKey = seat + '|' + (options.includeScore !== false ? 'score' : 'shape') + '|' + hand.slice().sort().join(',') +
    '|' + (G.players[seat] && G.players[seat].river ? G.players[seat].river.length : 0) +
    '|' + SEATS.map(function (target) { return G.players[target] && G.players[target].riichi ? target : ''; }).join(',') +
    '|' + (G.doraIndicators || []).join(',');
  if (G._cpuCandidateCache && G._cpuCandidateCache.key === cacheKey) return G._cpuCandidateCache.value;
  var player = G.players[seat] || { melds: [] };
  var meldCount = (player.melds || []).length;
  var visibleCounts = computeAllVisibleCounts();
  var threats = cpuThreatSeatsFor(seat);
  var weights = cpuLearningWeights();
  var uniqueTiles = Array.from(new Set(hand));
  var candidates = [];
  var turn = (G.players[seat] && G.players[seat].river ? G.players[seat].river.length : 0) + 1;

  uniqueTiles.forEach(function (tile) {
    var after = hand.slice();
    var index = after.indexOf(tile);
    if (index === -1) return;
    after.splice(index, 1);
    var waits = findWaitsOpen(after, meldCount);
    var shanten = cpuCalculateShanten(after, meldCount);
    var remaining = visibleCounts.slice();
    after.forEach(function (code) { remaining[tileIndex(code)]++; });
    var ukeire = 0;
    for (var i = 0; i < 34; i++) {
      if (remaining[i] >= 4) continue;
      var draw = indexToCode(i);
      var test = after.concat([draw]);
      if (cpuCalculateShanten(test, meldCount) < shanten) ukeire += Math.max(0, 4 - remaining[i]);
    }
    var risk = evaluateTileSafetyNakabayashi(tile, hand, threats, visibleCounts);
    var risk01 = Math.min(1, risk / 100);
    var wait01 = Math.min(1, waits.length / 12);
    var candidate = {
      tile: tile,
      waits: waits,
      shanten: shanten,
      ukeire: ukeire,
      risk: risk,
      value: cpuEstimateCandidateValue(seat, after, waits, options.includeScore !== false),
      features: {
        progress: Math.max(0, Math.min(1, (8 - shanten) / 8)),
        ukeire: Math.max(0, Math.min(1, ukeire / 24)),
        wait: wait01,
        value: 0,
        safety: 1 - risk01,
        danger: risk01
      }
    };
    candidate.features.value = candidate.value;
    candidate.score = weights.progress * candidate.features.progress +
      weights.ukeire * candidate.features.ukeire +
      weights.wait * candidate.features.wait +
      weights.value * candidate.features.value +
      weights.safety * candidate.features.safety -
      weights.danger * candidate.features.danger;
    if (weights.humanStyle) {
      Object.keys(candidate.features).forEach(function (key) {
        candidate.score += 0.10 * (candidate.features[key] - 0.5) * (weights.humanStyle[key] || 0);
      });
    }
    // Preserve the existing shape heuristic as a small tie breaker.
    candidate.score += evaluateTileWasteNakabayashi(tile, hand, seat, tilesToCounts(hand)) * 0.002;
    candidate.turn = turn;
    candidates.push(candidate);
  });
  G._cpuCandidateCache = { key: cacheKey, value: candidates };
  return candidates;
}
window.cpuBuildDiscardCandidates = cpuBuildDiscardCandidates;

function cpuBestCandidate(candidates) {
  return candidates.reduce(function (best, candidate) {
    if (!best || candidate.score > best.score + 0.0001) return candidate;
    if (Math.abs(candidate.score - best.score) <= 0.0001 && Math.random() < 0.35) return candidate;
    return best;
  }, null);
}

function chooseCpuDiscardNakabayashi(seat, hand) {
  var candidates = cpuBuildDiscardCandidates(seat, hand, { includeScore: true });
  var best = cpuBestCandidate(candidates);
  if (!best) return hand[0];
  return best.tile;
}

function checkCpuTenpaiAndDiscard(hand, seat, level) {
  var uniqueTiles = Array.from(new Set(hand));
  var hardMode = !level || level === 'hard';
  if (!hardMode) {
    var openMeldCount = G && G.players && G.players[seat] ? (G.players[seat].melds || []).length : 0;
    for (var i = 0; i < uniqueTiles.length; i++) {
      var firstTile = uniqueTiles[i];
      var firstCopy = hand.slice();
      firstCopy.splice(firstCopy.indexOf(firstTile), 1);
      var firstWaits = findWaitsOpen(firstCopy, openMeldCount);
      if (firstWaits.length > 0) return { canTenpai: true, discardTile: firstTile, waits: firstWaits };
    }
    return { canTenpai: false };
  }
  var candidates = cpuBuildDiscardCandidates(seat || 'p2', hand, { includeScore: true }).filter(function (c) { return c.waits.length > 0; });
  var best = cpuBestCandidate(candidates);
  if (!best) return { canTenpai: false };
  return { canTenpai: true, discardTile: best.tile, waits: best.waits, candidate: best };
}

function evaluateCpuRiichiDecisionNakabayashi(seat, hand, tenpaiInfo) {
  if (!cpuCanDeclareRiichi(seat)) return { shouldRiichi: false, discardTile: tenpaiInfo.discardTile };
  var p = G.players[seat];
  var candidate = tenpaiInfo.candidate || cpuBuildDiscardCandidates(seat, hand, { includeScore: true }).find(function (c) { return c.tile === tenpaiInfo.discardTile; });
  var waits = tenpaiInfo.waits || [];
  var threats = cpuThreatSeatsFor(seat);
  var turn = p.river.length + 1;
  var value = candidate ? candidate.value : 0;
  var danger = candidate ? candidate.features.danger : 1;
  var goodWait = waits.length >= 2;
  if (!threats.length) return { shouldRiichi: goodWait || value >= 0.45 || turn >= 7, discardTile: tenpaiInfo.discardTile };
  // Against a live threat, only chase with a meaningful wait or hand value.
  return {
    shouldRiichi: danger < 0.45 && (goodWait || value >= 0.55) && (p.isOpen || turn >= 5),
    discardTile: tenpaiInfo.discardTile
  };
}

function evaluateCpuRiichiDecisionByLevel(seat, hand, tenpaiInfo, level) {
  level = level || 'hard';
  if (!cpuCanDeclareRiichi(seat)) return { shouldRiichi: false, discardTile: tenpaiInfo.discardTile };
  if (level === 'easy') return { shouldRiichi: true, discardTile: tenpaiInfo.discardTile };
  if (level === 'normal') {
    var waits = tenpaiInfo.waits || [];
    var threats = riichiSeatsActive().filter(function (s) { return s !== seat; });
    return { shouldRiichi: !threats.length ? (waits.length >= 2 || Math.random() < 0.6) : waits.length >= 2, discardTile: tenpaiInfo.discardTile };
  }
  return evaluateCpuRiichiDecisionNakabayashi(seat, hand, tenpaiInfo);
}

// ---------------------------------------------------------------------
// 上級CPUの鳴き判断
// 鳴き自体を目的にせず、「鳴いた直後に一枚切った手」を通常の打牌候補と
// 同じ観点で評価する。評価中は実ゲームの手牌・副露を変更しない。
function cpuCallYakuPotential(seat, callTile, handAfterCall) {
  var tile = parseTile(callTile);
  var bonus = 0;
  if (tile.suit === 'z' && isYakuhai(callTile, seat)) bonus += 0.46;
  if (tile.suit === 'z' && !isYakuhai(callTile, seat)) bonus -= 0.16;

  var suited = handAfterCall.filter(function (code) { return parseTile(code).suit !== 'z'; });
  if (tile.suit !== 'z' && suited.length) {
    var sameSuit = suited.filter(function (code) { return parseTile(code).suit === tile.suit; }).length;
    var ratio = sameSuit / suited.length;
    if (ratio >= 0.78) bonus += 0.28; // 混一色・清一色の方向
    else if (ratio >= 0.62) bonus += 0.12;
  }

  var hasSimpleOnly = handAfterCall.every(function (code) {
    var t = parseTile(code); return t.suit !== 'z' && t.num >= 2 && t.num <= 8;
  });
  if (hasSimpleOnly) bonus += 0.22; // 断么九の見込み
  return bonus;
}

function cpuCallDoraPotential(handAfterCall) {
  var indicators = (G && (G.doraIndicators || (G.doraIndicator ? [G.doraIndicator] : []))) || [];
  var doraTypes = indicators.filter(Boolean).map(nextTile);
  var count = handAfterCall.filter(function (code) {
    return doraTypes.some(function (dora) { return isSameTileType(code, dora); }) || isRedTile(code);
  }).length;
  return Math.min(0.30, count * 0.035);
}

function cpuCallPostDiscardBest(seat, handAfterCall, meldCount) {
  var visibleCounts = computeAllVisibleCounts();
  var threats = cpuThreatSeatsFor(seat);
  var unique = Array.from(new Set(handAfterCall));
  var best = null;
  unique.forEach(function (discard) {
    var after = handAfterCall.slice();
    var discardIndex = after.indexOf(discard);
    if (discardIndex < 0) return;
    after.splice(discardIndex, 1);
    var shanten = cpuCalculateShanten(after, meldCount);
    var waits = findWaitsOpen(after, meldCount);
    var remaining = visibleCounts.slice();
    after.forEach(function (code) { remaining[tileIndex(code)]++; });
    var ukeire = 0;
    for (var i = 0; i < 34; i++) {
      if (remaining[i] >= 4) continue;
      var draw = indexToCode(i);
      if (cpuCalculateShanten(after.concat([draw]), meldCount) < shanten) {
        ukeire += Math.max(0, 4 - remaining[i]);
      }
    }
    var risk = evaluateTileSafetyNakabayashi(discard, handAfterCall, threats, visibleCounts);
    var value = cpuEstimateCandidateValue(seat, after, waits, true);
    var score = ((8 - shanten) / 8) * 1.25 + Math.min(1, ukeire / 24) * 0.82 +
      Math.min(1, waits.length / 12) * 0.72 + value * 0.34 - Math.min(1, risk / 100) * 0.92;
    var candidate = { tile: discard, hand: after, shanten: shanten, waits: waits, ukeire: ukeire, risk: risk, value: value, score: score };
    if (!best || candidate.score > best.score) best = candidate;
  });
  return best;
}

function cpuCallActionHand(seat, action) {
  var player = G.players[seat];
  if (!player) return null;
  var targetIdx = tileIndex(action.tile);
  var hand = player.hand.slice();
  if (action.type === 'pon' || action.type === 'kan') {
    var need = action.type === 'pon' ? 2 : 3;
    var removed = 0;
    for (var i = hand.length - 1; i >= 0 && removed < need; i--) {
      if (tileIndex(hand[i]) === targetIdx) { hand.splice(i, 1); removed++; }
    }
    return removed === need ? hand : null;
  }
  if (action.type === 'chi') {
    var combo = action.combo || [];
    if (combo.length !== 2) return null;
    for (var c = 0; c < combo.length; c++) {
      var index = hand.findIndex(function (code) { return code === combo[c]; });
      if (index < 0) index = hand.findIndex(function (code) { return tileIndex(code) === tileIndex(combo[c]); });
      if (index < 0) return null;
      hand.splice(index, 1);
    }
    return hand;
  }
  return null;
}

function chooseCpuCallActionForSeat(seat, tile, fromSeat) {
  var player = G && G.players && G.players[seat];
  if (!player || player.riichi || typeof checkUserCallOptions !== 'function') return { type: 'pass' };
  var legal = checkUserCallOptions(tile, fromSeat, seat);
  var actions = [];
  if (legal.canKan) actions.push({ type: 'kan', tile: tile });
  if (legal.canPon) actions.push({ type: 'pon', tile: tile });
  (legal.chiOptions || []).forEach(function (combo) {
    actions.push({ type: 'chi', tile: tile, combo: combo });
  });
  if (!actions.length) return { type: 'pass' };

  var baseCandidates = cpuBuildDiscardCandidates(seat, player.hand.slice(), { includeScore: true });
  var base = cpuBestCandidate(baseCandidates);
  var baseScore = base ? base.score : -Infinity;
  var baseShanten = base ? base.shanten : 8;
  var best = null;
  var seen = {};
  actions.forEach(function (action) {
    var key = action.type + '|' + tileIndex(action.tile) + '|' + ((action.combo || []).map(tileIndex).join(','));
    if (seen[key]) return;
    seen[key] = true;
    var handAfterCall = cpuCallActionHand(seat, action);
    if (!handAfterCall) return;
    var post = cpuCallPostDiscardBest(seat, handAfterCall, (player.melds || []).length + 1);
    if (!post) return;
    var yaku = cpuCallYakuPotential(seat, tile, handAfterCall);
    var dora = cpuCallDoraPotential(handAfterCall);
    var openPenalty = action.type === 'kan' ? 0.06 : 0.12;
    var score = post.score + yaku + dora - openPenalty;
    var candidate = { action: action, score: score, post: post, yaku: yaku };
    if (!best || candidate.score > best.score) best = candidate;
  });
  if (!best) return { type: 'pass' };

  // 鳴き後の一打が、鳴かずに進める手を明確に上回る場合だけ鳴く。
  // 役の見込みがない鳴きや、向聴数を悪化させる鳴きは見送る。
  var improvesShape = best.post.shanten < baseShanten || best.post.ukeire >= (base && base.ukeire || 0) + 2;
  var hasYaku = best.yaku >= 0.20;
  if (best.post.shanten > baseShanten) return { type: 'pass' };
  if (!improvesShape && !hasYaku) return { type: 'pass' };
  if (best.score < baseScore + 0.08 && !(hasYaku && best.post.shanten <= baseShanten && best.post.ukeire >= (base && base.ukeire || 0) - 1)) return { type: 'pass' };
  return best.action;
}

window.chooseCpuCallActionForSeat = chooseCpuCallActionForSeat;
window.chooseCpuDiscardNakabayashi = chooseCpuDiscardNakabayashi;
window.checkCpuTenpaiAndDiscard = checkCpuTenpaiAndDiscard;
window.evaluateCpuRiichiDecisionByLevel = evaluateCpuRiichiDecisionByLevel;


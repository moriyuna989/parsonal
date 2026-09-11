// =====================================================================
// js/cpu_ai.js
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
        m.tiles.forEach(function (t) { counts[tileIndex(t)]++; });
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


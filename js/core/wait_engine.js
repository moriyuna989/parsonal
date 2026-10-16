// =====================================================================
// js/core/wait_engine.js
// 面子分解・和了形チェック・待ち牌算出エンジン
// =====================================================================

//codeは牌が来る（3m,7pなど）
//全体が格納されてるところからのインデックス
function tileIndex(code) {
  var t = parseTile(code);
  if (t.suit === 'm') return t.num - 1;
  if (t.suit === 'p') return 9 + t.num - 1;
  if (t.suit === 's') return 18 + t.num - 1;
  return 27 + t.num - 1;
}

//インデックスから牌を返す
function indexToCode(i) {
  if (i < 9) return (i + 1) + 'm';
  if (i < 18) return (i - 9 + 1) + 'p';
  if (i < 27) return (i - 18 + 1) + 's';
  return (i - 27 + 1) + 'z';
}

//手牌の中にどの牌が何枚あるかを数える配列を返す
function tilesToCounts(tiles) {
  var c = new Array(34).fill(0);
  tiles.forEach(function (t) { c[tileIndex(t)]++; });
  return c;
}

//手牌の中ですべて作ることができるかの関数（判定のみで面子の分解は行わない）
function canDecomposeSuit(arr) {
  var i = 0; while (i < 9 && arr[i] === 0) i++;
  if (i === 9) return true;
  if (arr[i] >= 3) {
    arr[i] -= 3;
    if (canDecomposeSuit(arr)) { arr[i] += 3; return true; }
    arr[i] += 3;
  }
  if (i <= 6 && arr[i + 1] > 0 && arr[i + 2] > 0) {
    arr[i]--; arr[i + 1]--; arr[i + 2]--;
    if (canDecomposeSuit(arr)) { arr[i]++; arr[i + 1]++; arr[i + 2]++; return true; }
    arr[i]++; arr[i + 1]++; arr[i + 2]++;
  }
  return false;
}

//字牌の判定（3枚か1枚か）
function canDecomposeHonors(arr) {
  for (var i = 0; i < 7; i++) {
    if (arr[i] !== 0 && arr[i] !== 3) return false;
  }
  return true;
}

//雀頭を抜いて完成するかどうか（判定のみで面子の分解は行わない）
function isCompleteStandard(counts) {
  for (var i = 0; i < 34; i++) {
    if (counts[i] >= 2) {
      counts[i] -= 2;
      var m = counts.slice(0, 9), p = counts.slice(9, 18), s = counts.slice(18, 27), z = counts.slice(27, 34);
      var ok = canDecomposeSuit(m) && canDecomposeSuit(p) && canDecomposeSuit(s) && canDecomposeHonors(z);
      counts[i] += 2;
      if (ok) return true;
    }
  }
  return false;
}

//チートイツの判定（7組の雀頭）
function isChiitoiComplete(counts) {
  var pairs = 0, distinct = 0;
  for (var i = 0; i < 34; i++) {
    if (counts[i] > 0) {
      distinct++;
      if (counts[i] === 2) pairs++;
      else return false;
    }
  }
  return distinct === 7 && pairs === 7;
}

//国士無双の判定（１３么九牌がすべて揃っていて、そのうち１つが２枚以上）
function isKokushiComplete(counts) {
  var termIdx = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
  var pairFound = false, total = 0;
  for (var i = 0; i < 34; i++) {
    if (counts[i] === 0) continue;
    if (termIdx.indexOf(i) === -1) return false;
    total += counts[i];
    if (counts[i] === 2) {
      if (pairFound) return false;
      pairFound = true;
    } else if (counts[i] !== 1) {
      return false;
    }
  }
  return pairFound && total === 14 && termIdx.every(function (idx) { return counts[idx] > 0; });
}

//14枚でアガリ形が作れているかの判定
function isComplete14(tiles) {
  var c = tilesToCounts(tiles);
  var sum = c.reduce(function (a, b) { return a + b; }, 0);
  if (sum !== 14) return false;
  return isKokushiComplete(c) || isChiitoiComplete(c) || isCompleteStandard(c);
}


//待ち牌の算出（13枚の手牌に１枚足して14枚でアガリ形が作れる牌を探す）
function findWaits(tiles13) {
  var waits = [];
  var counts13 = tilesToCounts(tiles13);
  for (var i = 0; i < 34; i++) {
    if (counts13[i] >= 4) continue;
    if (isComplete14(tiles13.concat([indexToCode(i)]))) waits.push(indexToCode(i));
  }
  return waits;
}

// 鳴き手（副露）を考慮した和了判定
function isCompleteConcealed(concealedTiles, openMeldCount) {
  var expected = 14 - 3 * (openMeldCount || 0);
  if (concealedTiles.length !== expected) return false;
  var c = tilesToCounts(concealedTiles);
  if (!openMeldCount) return isKokushiComplete(c) || isChiitoiComplete(c) || isCompleteStandard(c);
  return isCompleteStandard(c);
}
//泣きが含まれている状態のアガリ形の待ち牌を算出する関数
function findWaitsOpen(concealedTiles, openMeldCount) {
  var waits = [];
  var counts = tilesToCounts(concealedTiles);
  for (var i = 0; i < 34; i++) {
    if (counts[i] >= 4) continue;
    if (isCompleteConcealed(concealedTiles.concat([indexToCode(i)]), openMeldCount)) waits.push(indexToCode(i));
  }
  return waits;
}

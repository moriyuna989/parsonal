// js/scoring/legacy.js
// 既存の手牌分解・役・符ヘルパー

function decomposeSuitTrack(arr, suitLetter, groups) {
  //arr→牌の種類別配列、suitLetter→牌の種類を区別する文字列、groups→面子を格納する辞書型配列

  var i = 0; while (i < 9 && arr[i] === 0) i++;
  //その種類の牌を一枚も持っていないとき、true返す
  if (i === 9) return true;

  //刻子があるとき、面子としてgroupsに追加
  if (arr[i] >= 3) {
    arr[i] -= 3;
    groups.push({ type: 'triplet', tiles: [(i + 1) + suitLetter, (i + 1) + suitLetter, (i + 1) + suitLetter], concealed: true });
    //刻子を作ったことで、面子が完成しなくならないかチェック、 trueが返ってくると成功
    if (decomposeSuitTrack(arr, suitLetter, groups)) { arr[i] += 3; return true; }
    //成功しなかった場合、刻子として面子が完成していない→groupsからも削除、牌の枚数も戻す
    groups.pop(); arr[i] += 3;
  }
  //順子があるとき、面子としてgroupsに追加
  if (i <= 6 && arr[i + 1] > 0 && arr[i + 2] > 0) {
    arr[i]--; arr[i + 1]--; arr[i + 2]--;
    groups.push({ type: 'run', tiles: [(i + 1) + suitLetter, (i + 2) + suitLetter, (i + 3) + suitLetter], concealed: true });
    //順子を作ったことで、面子が完成しなくならないかチェック、 trueが返ってくると成功
    if (decomposeSuitTrack(arr, suitLetter, groups)) { arr[i]++; arr[i + 1]++; arr[i + 2]++; return true; }
    //成功しなかった場合、順子として面子が完成していない→groupsからも削除、牌の枚数も戻す
    groups.pop(); arr[i]++; arr[i + 1]++; arr[i + 2]++;
  }
  //どちらも作れなかった場合、その種類の牌は面子として完成していない→false返す
  return false;
}

function decomposeHonorsTrack(arr, groups) {
  for (var i = 0; i < 7; i++) {
    //字牌が刻子になっていたら、面子としてgroupsに追加
    if (arr[i] === 3) groups.push({ type: 'triplet', tiles: [(i + 1) + 'z', (i + 1) + 'z', (i + 1) + 'z'], concealed: true });
    //刻子以外で字牌の枚数が1枚でもあればfalse返す
    else if (arr[i] !== 0) return false;
  }
  //刻子になっている、または字牌がない場合、trueを返す
  return true;
}

function decomposeConcealed(concealedTiles) {
  //手牌の構成要素が、何が何枚あるかをcountsに格納
  var counts = tilesToCounts(concealedTiles);
  for (var i = 0; i < 34; i++) {
    //雀頭候補を順番に試していく
    if (counts[i] >= 2) {
      counts[i] -= 2;
      var groups = [];
      //各種類の牌の枚数をスライス
      var m = counts.slice(0, 9), p = counts.slice(9, 18), s = counts.slice(18, 27), z = counts.slice(27, 34);
      //萬子・筒子・索子であればdecomposeSuitTrackを呼び出し、字牌であればdecomposeHonorsTrackを呼び出す
      //全て成功すればok=true、失敗すればok=false
      var ok = decomposeSuitTrack(m, 'm', groups) && decomposeSuitTrack(p, 'p', groups) && decomposeSuitTrack(s, 's', groups) && decomposeHonorsTrack(z, groups);
      counts[i] += 2;
      //成功した場合は、雀頭と面子を返す
      if (ok) return { pairTile: indexToCode(i), groups: groups };
    }
  }
  //成功しなかった場合、アガリ形ではないと判断しnullを返す
  return null;
}

function analyzeWait(winTile, pairTile, groups) {
  //アガリ牌の文字列を数値に変換
  var winIdx = tileIndex(winTile);
  //アガリ牌が雀頭の場合（単騎待ちの場合）
  if (winIdx === tileIndex(pairTile)) return { waitType: 'tanki', groupIndex: -1 };
  //面子を順番に見ていく
  for (var gi = 0; gi < groups.length; gi++) {
    var g = groups[gi];
    //アガリ牌が面子に含まれているか
    var hasWinTile = g.tiles.some(function (t) { return tileIndex(t) === winIdx; });
    if (!hasWinTile) continue;
    //刻子（塔子）の場合（双碰待ちの場合）
    if (g.type === 'triplet' || g.type === 'kan') return { waitType: 'shanpon', groupIndex: gi };
    var n = parseTile(g.tiles[0]).num;
    var winNum = parseTile(winTile).num;
    var pos = winNum - n;
    //カンチャン待ちの場合、一番小さい牌とアガリ牌の数字の差は１
    if (pos === 1) return { waitType: 'kanchan', groupIndex: gi };
    //両面かペンチャン待ちの場合、一番小さい牌とアガリ牌の数字の差は０（例：36ｓ待ちで3ｓ自摸、ペン7m待ちで7m自摸）
    if (pos === 0) return { waitType: (n === 7 ? 'penchan' : 'ryanmen'), groupIndex: gi };
    //両面かペンチャン待ちの場合、一番大きい牌とアガリ牌の数字の差は２（例：47p待ちで7p自摸、ペン3s待ちで3s自摸）
    return { waitType: (n === 1 ? 'penchan' : 'ryanmen'), groupIndex: gi };
  }
  //面子にアガリ牌がなかった場合は単騎待ち
  return { waitType: 'tanki', groupIndex: -1 };
}

function computeUserFu(fullGroups, pairTile, waitInfo, isTsumo, isOpenHand, seatWindNum, roundWindNum, pinfuApplies) {
  var fu = 20;
  //面子の符計算
  fullGroups.forEach(function (g, idx) {
    //順子のため何も足されない
    if (g.type !== 'triplet' && g.type !== 'kan') return;
    //１・９・字牌かチェック
    var term = isTerminalOrHonor(g.tiles[0]);
    //鳴きありかチェック
    var concealed = g.concealed;
    //シャンポン待ちで、ツモではない場合、鳴きありと判定する
    if (waitInfo.waitType === 'shanpon' && idx === waitInfo.groupIndex && !isTsumo) concealed = false;
    //符計算
    if (g.type === 'kan') {
      //カンの時
      //１・９・字牌の場合32,2～8なら16
      var kanBase = term ? 32 : 16;
      //鳴きありの場合、点数が半分になる
      if (!concealed) kanBase = kanBase / 2;
      fu += kanBase;
    } else {
      //刻子の時
      var base = term ? 8 : 4;
      if (!concealed) base = base / 2;
      fu += base;
    }
  });
  //雀頭の符計算
  var pt = parseTile(pairTile);
  //字牌の時
  if (pt.suit === 'z') {
    //白発中の場合
    if (pt.num >= 5) fu += 2;
    //場風・自風の場合
    else {
      if (pt.num === seatWindNum) fu += 2;
      if (pt.num === roundWindNum) fu += 2;
    }
  }
  //待ちの符計算
  //両面かシャンポン待ちでなければ2加算
  fu += (waitInfo.waitType === 'ryanmen' || waitInfo.waitType === 'shanpon') ? 0 : 2;
  if (isTsumo) {
    //平和じゃなければ自摸で2加算
    if (!pinfuApplies) fu += 2;
  } else {
    if (!isOpenHand) fu += 10;
  }
  return Math.ceil(fu / 10) * 10;
}

function computeUserYakuHan(fullGroups, pairTile, waitInfo, ctx) {
  //役の名前格納配列
  var names = [];
  //翻数カウント
  var han = 0;
  //面子ごとの格納から、全て結合した牌の配列を格納
  var allTiles = fullGroups.reduce(function (a, g) { return a.concat(g.tiles); }, [pairTile]);
  //全て１・９・字牌以外か（allTilesから一つずつチェックし、true/false）
  var allSimple = allTiles.every(function (t) { return !isTerminalOrHonor(t); });
  //全て順子か（fullGroupsから面子を一つずつチェックし、true/false）
  var allRuns = fullGroups.every(function (g) { return g.type === 'run'; });
  //全て刻子か（fullGroupsから面子を一つずつチェックし、true/false）
  var allTriplets = fullGroups.every(function (g) { return g.type === 'triplet' || g.type === 'kan'; });
  //雀頭が字牌か（boolean）
  var pairIsHonor = parseTile(pairTile).suit === 'z';
  //平和の条件
  var pinfuApplies = !ctx.isOpen && allRuns && !pairIsHonor && waitInfo.waitType === 'ryanmen';

  //頻出役
  if (ctx.riichi) { names.push('リーチ'); han += 1; }
  if (ctx.riichi && ctx.ippatsu) { names.push('一発'); han += 1; }
  if (ctx.isTsumo && !ctx.isOpen) { names.push('ツモ'); han += 1; }
  if (allSimple) { names.push('タンヤオ'); han += 1; }
  if (pinfuApplies) { names.push('平和'); han += 1; }

  //役牌
  fullGroups.forEach(function (g) {
    if (g.type !== 'triplet' && g.type !== 'kan') return;
    var t = parseTile(g.tiles[0]);
    if (t.suit !== 'z') return;
    //白発中の場合
    if (t.num >= 5) { names.push('役牌(' + HONOR_NAME[t.num] + ')'); han += 1; }
    else {
      //自風、場風の場合
      if (t.num === ctx.seatWindNum) { names.push('役牌(自風' + HONOR_NAME[t.num] + ')'); han += 1; }
      if (t.num === ctx.roundWindNum) { names.push('役牌(場風' + HONOR_NAME[t.num] + ')'); han += 1; }
    }
  });

  //対々和
  if (allTriplets) { names.push('対々和'); han += 2; }

  //混一色、清一色
  //字牌以外の牌の種類だけを取り出す（setなので、全て一緒だったらsizeは１）
  var suits = new Set(allTiles.map(function (t) { return parseTile(t).suit; }).filter(function (s) { return s !== 'z'; }));
  //条件に合うものがあればtrueを返す（字牌が一つでもあるかどうか）
  var hasHonor = allTiles.some(function (t) { return parseTile(t).suit === 'z'; });
  if (suits.size === 1) {
    //字牌があればホンイツ、なければ清一色
    if (hasHonor) { names.push('混一色'); han += ctx.isOpen ? 2 : 3; }
    else { names.push('清一色'); han += ctx.isOpen ? 5 : 6; }
  }

  //全て1・9・字牌の時
  var allTermHonor = fullGroups.every(function (g) { return g.tiles.some(isTerminalOrHonor); }) && isTerminalOrHonor(pairTile);
  if (allTermHonor) { names.push('チャンタ'); han += ctx.isOpen ? 1 : 2; }


  ['m', 'p', 's'].forEach(function (suit) {
    //同じ牌の種類で1スタート4スタート7スタートの順子があるか
    var starts = fullGroups.filter(function (g) { return g.type === 'run' && parseTile(g.tiles[0]).suit === suit; }).map(function (g) { return parseTile(g.tiles[0]).num; });
    if (starts.includes(1) && starts.includes(4) && starts.includes(7)) { names.push('一気通貫'); han += ctx.isOpen ? 1 : 2; }
  });


  var runStartsBySuit = { m: new Set(), p: new Set(), s: new Set() };
  //順子のスタートの番号をsetに格納（同じ番号は重複して格納されない）
  fullGroups.forEach(function (g) { if (g.type === 'run') { var t = parseTile(g.tiles[0]); runStartsBySuit[t.suit].add(t.num); } });
  //1~7までループし、その中で同じスタートの順子があるかチェック
  for (var n = 1; n <= 7; n++) {
    if (runStartsBySuit.m.has(n) && runStartsBySuit.p.has(n) && runStartsBySuit.s.has(n)) { names.push('三色同順'); han += ctx.isOpen ? 1 : 2; break; }
  }

  if (!ctx.isOpen) {
    //順子のみを集めて、1つの順子で1つの文字列にする
    var runKeys = fullGroups.filter(function (g) { return g.type === 'run'; }).map(function (g) { return g.tiles.join(','); });
    var seen = {}; var hasDup = false;
    //重複がある順子があるかチェック
    runKeys.forEach(function (k) { if (seen[k]) hasDup = true; seen[k] = true; });
    if (hasDup) { names.push('一盃口'); han += 1; }
  }

  //純粋な役（ヤクマン以外、ドラ以外）の配列と翻数
  var pureYakuNames = names.slice();
  var pureYakuHan = han;
  //役があるかどうか
  var hasYaku = (pureYakuHan >= 1);

  //ドラ
  if (ctx.doraCount > 0) { names.push('ドラ' + ctx.doraCount); han += ctx.doraCount; }
  if (ctx.redDoraCount > 0) { names.push('赤ドラ' + ctx.redDoraCount); han += ctx.redDoraCount; }
  if (ctx.riichi && ctx.uraDoraCount > 0) { names.push('裏ドラ' + ctx.uraDoraCount); han += ctx.uraDoraCount; }
  return { names: names, han: han, pinfuApplies: pinfuApplies, hasYaku: hasYaku, pureYakuHan: pureYakuHan, pureYakuNames: pureYakuNames };
}

//場風や自風を数値に直すためのメソッド

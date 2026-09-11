// =====================================================================
// js/constants.js
// 牌定義、表示用文字、ソート、DOM生成等の共通ユーティリティ
// =====================================================================

var HONOR_CODEPOINT = { 1: 0x1F000, 2: 0x1F001, 3: 0x1F002, 4: 0x1F003, 5: 0x1F006, 6: 0x1F005, 7: 0x1F004 };
var HONOR_NAME = { 1: '東', 2: '南', 3: '西', 4: '北', 5: '白', 6: '發', 7: '中' };
var SUIT_ORDER = { m: 0, p: 1, s: 2, z: 3 };

function roundUp100(x) {
  return Math.ceil(x / 100) * 100;
}

function isRedTile(code) {
  return code === '0m' || code === '0p' || code === '0s';
}

function parseTile(code) {
  if (!code) return { suit: '', num: 0, isRed: false };
  var suit = code.slice(-1);
  var rawNum = parseInt(code.slice(0, -1), 10);
  var isRed = (rawNum === 0);
  var num = isRed ? 5 : rawNum;
  return { suit: suit, num: num, isRed: isRed };
}

function isSameTileType(a, b) {
  if (!a || !b) return false;
  var ta = parseTile(a);
  var tb = parseTile(b);
  return ta.suit === tb.suit && ta.num === tb.num;
}

function tileGlyph(code) {
  var t = parseTile(code);
  if (t.suit === 'm') return String.fromCodePoint(0x1F006 + t.num);
  if (t.suit === 's') return String.fromCodePoint(0x1F00F + t.num);
  if (t.suit === 'p') return String.fromCodePoint(0x1F018 + t.num);
  return String.fromCodePoint(HONOR_CODEPOINT[t.num]);
}

function tileName(code) {
  var t = parseTile(code);
  if (t.suit === 'z') return HONOR_NAME[t.num];
  var suitName = t.suit === 'm' ? '萬' : (t.suit === 'p' ? '筒' : '索');
  return (t.isRed ? '赤' : '') + t.num + suitName;
}

function isTerminalOrHonor(code) {
  var t = parseTile(code);
  if (t.suit === 'z') return true;
  return t.num === 1 || t.num === 9;
}

function nextTile(code) {
  var t = parseTile(code);
  if (t.suit === 'z') {
    if (t.num <= 4) return ((t.num % 4) + 1) + 'z';
    return (((t.num - 5 + 1) % 3) + 5) + 'z';
  }
  return ((t.num % 9) + 1) + t.suit;
}

function sortKey(code) {
  var t = parseTile(code);
  return SUIT_ORDER[t.suit] * 10 + t.num - (t.isRed ? 0.1 : 0);
}

function sortTiles(arr) {
  return arr.slice().sort(function (a, b) { return sortKey(a) - sortKey(b); });
}

function randomTileCode() {
  if (Math.random() < 27 / 34) {
    var suits = ['m', 'p', 's'];
    return (1 + Math.floor(Math.random() * 9)) + suits[Math.floor(Math.random() * 3)];
  }
  return (1 + Math.floor(Math.random() * 7)) + 'z';
}

function tileEl(code, cls) {
  if (!code) return '<span class="tile' + (cls ? ' ' + cls : '') + '"></span>';
  var t = parseTile(code);
  var classes = [];
  if (cls) classes.push(cls);
  if (t.isRed) classes.push('red-tile');
  return '<span class="tile' + (classes.length ? ' ' + classes.join(' ') : '') + '" data-tile="' + code + '">' + tileGlyph(code) + '</span>';
}

var SEATS_ORDER = ['you', 'p2', 'p3', 'p4'];

function getMeldDirection(ownerSeat, fromSeat) {
  if (!fromSeat) return 'kamicha';
  if (fromSeat === 'kamicha' || fromSeat === 'toimen' || fromSeat === 'shimocha') {
    return fromSeat;
  }
  var ownerIdx = SEATS_ORDER.indexOf(ownerSeat);
  var fromIdx = SEATS_ORDER.indexOf(fromSeat);
  if (ownerIdx === -1 || fromIdx === -1) return 'kamicha';
  var diff = (fromIdx - ownerIdx + 4) % 4;
  if (diff === 1) return 'shimocha'; // 下家（右）
  if (diff === 2) return 'toimen';   // 対面（正面）
  if (diff === 3) return 'kamicha';  // 上家（左）
  return 'kamicha';
}

function renderMeldHtml(m, ownerSeat, extraCls) {
  if (!m) return '';
  var groupCls = 'meld-group' + (extraCls ? ' ' + extraCls : '');

  // 暗槓の場合
  if (m.type === 'kan' && (m.subType === 'ankan' || m.concealed)) {
    var inner1 = (m.tiles && m.tiles[1]) || m.tiles[0];
    var inner2 = (m.tiles && m.tiles[2]) || m.tiles[0];
    return '<div class="' + groupCls + ' kan-meld">' +
      '<span class="meld-col"><span class="tile face-down">🀫</span></span>' +
      '<span class="meld-col">' + tileEl(inner1) + '</span>' +
      '<span class="meld-col">' + tileEl(inner2) + '</span>' +
      '<span class="meld-col"><span class="tile face-down">🀫</span></span>' +
      '</div>';
  }

  var relDir = getMeldDirection(ownerSeat, m.from);

  // チーの場合：常に上家から鳴くため左端（1枚目）が横向き
  if (m.type === 'chi' || m.type === 'run') {
    var tiles = (m.tiles || []).slice();
    if (m.calledTile) {
      var called = m.calledTile;
      var rest = tiles.slice();
      var cIdx = rest.indexOf(called);
      if (cIdx !== -1) rest.splice(cIdx, 1);
      rest = sortTiles(rest);
      tiles = [called].concat(rest);
    }
    return '<div class="' + groupCls + '">' +
      '<span class="meld-col horizontal">' + tileEl(tiles[0]) + '</span>' +
      '<span class="meld-col">' + tileEl(tiles[1]) + '</span>' +
      '<span class="meld-col">' + tileEl(tiles[2]) + '</span>' +
      '</div>';
  }

  // 加槓の場合：元々横に向けていた牌の上に2枚重ねる
  if (m.type === 'kan' && m.subType === 'kakan') {
    var hIdx = relDir === 'toimen' ? 1 : (relDir === 'shimocha' ? 2 : 0);
    var tArr = (m.tiles || []).slice();
    // 3枚の基本牌と4枚目の追加牌
    var baseTiles = tArr.slice(0, 3);
    var extraTile = tArr[3] || baseTiles[0];
    var cols = [];
    for (var i = 0; i < 3; i++) {
      if (i === hIdx) {
        cols.push('<span class="meld-col horizontal kakan">' + tileEl(baseTiles[i]) + tileEl(extraTile) + '</span>');
      } else {
        cols.push('<span class="meld-col">' + tileEl(baseTiles[i]) + '</span>');
      }
    }
    return '<div class="' + groupCls + ' kan-meld">' + cols.join('') + '</div>';
  }

  // 大明槓の場合：上家=左端(0)、対面=2枚目(1)、下家=右端(3)
  if (m.type === 'kan') {
    var hIdxKan = relDir === 'toimen' ? 1 : (relDir === 'shimocha' ? 3 : 0);
    var kanTiles = (m.tiles || []).slice();
    var kanCols = kanTiles.map(function (tile, idx) {
      if (idx === hIdxKan) {
        return '<span class="meld-col horizontal">' + tileEl(tile) + '</span>';
      }
      return '<span class="meld-col">' + tileEl(tile) + '</span>';
    });
    return '<div class="' + groupCls + ' kan-meld">' + kanCols.join('') + '</div>';
  }

  // ポンの場合：上家=左端(0)、対面=中央(1)、下家=右端(2)
  var hIdxPon = relDir === 'toimen' ? 1 : (relDir === 'shimocha' ? 2 : 0);
  var ponTiles = (m.tiles || []).slice();
  // もし鳴いた牌（calledTile）があれば、横向き位置に配置するよう調整
  if (m.calledTile && ponTiles.length === 3) {
    var calledIdx = ponTiles.indexOf(m.calledTile);
    if (calledIdx !== -1 && calledIdx !== hIdxPon) {
      var tmp = ponTiles[hIdxPon];
      ponTiles[hIdxPon] = ponTiles[calledIdx];
      ponTiles[calledIdx] = tmp;
    }
  }
  var ponCols = ponTiles.map(function (tile, idx) {
    if (idx === hIdxPon) {
      return '<span class="meld-col horizontal">' + tileEl(tile) + '</span>';
    }
    return '<span class="meld-col">' + tileEl(tile) + '</span>';
  });
  return '<div class="' + groupCls + '">' + ponCols.join('') + '</div>';
}

function renderMeldsHtml(melds, ownerSeat, extraCls) {
  if (!melds || !melds.length) return '';
  return melds.map(function (m) {
    return renderMeldHtml(m, ownerSeat, extraCls);
  }).join('');
}


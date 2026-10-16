// js/game/state.js
// 対局状態・牌山・局の初期化

var G = null; // current game state
var allowDamaten = true; // if false, every closed tenpai opponent must riichi (no silent tenpai)
var SEAT_NAME = { you: 'あなた', p2: '下家', p3: '対面', p4: '上家' };
var SEATS = ['you', 'p2', 'p3', 'p4'];
var OPP_SEATS = ['p2', 'p3', 'p4'];
var gameMode = 'training';
var isPractice = false;
var matchState = null;

function newPool() {
  var p = new Array(34).fill(4);
  var useRed = isPractice ? (matchState && matchState.redDora) : true;
  p.reds = useRed ? { '0m': 1, '0p': 1, '0s': 1 } : null;
  return p;
}

function poolTotal(p) {
  return p.reduce(function (a, b) { return a + b; }, 0);
}

function removeSpecific(pool, code) {
  pool[tileIndex(code)]--;
  if (pool.reds && pool.reds[code]) { pool.reds[code]--; }
}

function drawRandom(pool) {
  var total = poolTotal(pool); if (total <= 0) return null;
  var r = Math.floor(Math.random() * total);
  for (var i = 0; i < 34; i++) {
    if (r < pool[i]) {
      pool[i]--;
      var code = indexToCode(i);
      if (pool.reds) {
        if (code === '5m' && pool.reds['0m'] > 0 && Math.random() < 1 / (pool[i] + 1)) { pool.reds['0m']--; return '0m'; }
        if (code === '5p' && pool.reds['0p'] > 0 && Math.random() < 1 / (pool[i] + 1)) { pool.reds['0p']--; return '0p'; }
        if (code === '5s' && pool.reds['0s'] > 0 && Math.random() < 1 / (pool[i] + 1)) { pool.reds['0s']--; return '0s'; }
      }
      return code;
    }
    r -= pool[i];
  }
}

function drawRandomExcluding(pool, forbiddenSet) {
  var candidates = [];
  for (var i = 0; i < 34; i++) {
    var code = indexToCode(i);
    if (forbiddenSet.has(code) || (code === '5m' && forbiddenSet.has('0m')) || (code === '5p' && forbiddenSet.has('0p')) || (code === '5s' && forbiddenSet.has('0s'))) continue;
    for (var k = 0; k < pool[i]; k++) candidates.push(i);
  }
  if (!candidates.length) return drawRandom(pool);
  var pick = candidates[Math.floor(Math.random() * candidates.length)];
  pool[pick]--;
  var c = indexToCode(pick);
  if (pool.reds) {
    if (c === '5m' && pool.reds['0m'] > 0 && Math.random() < 1 / (pool[pick] + 1)) { pool.reds['0m']--; return '0m'; }
    if (c === '5p' && pool.reds['0p'] > 0 && Math.random() < 1 / (pool[pick] + 1)) { pool.reds['0p']--; return '0p'; }
    if (c === '5s' && pool.reds['0s'] > 0 && Math.random() < 1 / (pool[pick] + 1)) { pool.reds['0s']--; return '0s'; }
  }
  return c;
}

function randInt(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

// Turn 1 riichi (double riichi) is genuinely rare in real play, so it's only picked with a small
// independent chance; otherwise riichi timing is uniform across the remaining turns.
function pickRiichiTurn(maxTurn) {
  var lastHistoryTurn = maxTurn - 1;
  if (lastHistoryTurn <= 1) return 1;
  if (Math.random() < 0.03) return 1;
  return randInt(2, lastHistoryTurn);
}

function computeSafeSetFor(seat) {
  var R = G.players[seat];
  var safe = new Set();
  R.river.forEach(function (t) {
    safe.add(t);
    var idx = tileIndex(t);
    safe.add(indexToCode(idx));
    if (idx === 4) safe.add('0m');
    if (idx === 13) safe.add('0p');
    if (idx === 22) safe.add('0s');
  });
  SEATS.forEach(function (s) {
    if (s === seat) return;
    var arr = G.players[s].river;
    for (var idx = R.riichiTurn - 1; idx < arr.length; idx++) {
      if (arr[idx] !== undefined) {
        var t = arr[idx];
        safe.add(t);
        var ti = tileIndex(t);
        safe.add(indexToCode(ti));
        if (ti === 4) safe.add('0m');
        if (ti === 13) safe.add('0p');
        if (ti === 22) safe.add('0s');
      }
    }
  });
  return safe;
}
window.computeSafeSetFor = computeSafeSetFor;

function riichiSeatsActive() {
  return OPP_SEATS.filter(function (s) { return G.players[s].riichi; });
}
window.riichiSeatsActive = riichiSeatsActive;

function isFuritenOpp(seat) {
  var p = G.players[seat];
  var riverIndices = p.river.map(tileIndex);
  return p.wait.some(function (w) { return riverIndices.includes(tileIndex(w)); });
}

function isFuritenYou() {
  var p = G.players.you;
  if (p.hand.length !== youRestLen()) return false;
  var wait = findWaitsOpen(p.hand, p.melds.length);
  var riverIndices = p.river.map(tileIndex);
  return wait.some(function (w) { return riverIndices.includes(tileIndex(w)); });
}

function nextSeat(seat) {
  var idx = SEATS.indexOf(seat);
  return SEATS[(idx + 1) % 4];
}

// Concealed-hand tile count the user rests at between turns (13-tile tenpai-equivalent).
function youRestLen() {
  return 13 - 3 * G.players.you.melds.length;
}

function cancelAllIppatsu() {
  if (!G || !G.players) return;
  SEATS.forEach(function (s) {
    if (G.players[s]) G.players[s].ippatsu = false;
  });
  G.firstTurnUninterrupted = false;
  G.firstTsumoAvailable = false;
  G.firstTsumoSeat = null;
  G.firstDrawWindowSeat = null;
}
window.cancelAllIppatsu = cancelAllIppatsu;

function newGame() {
  var pool = newPool();
  var dora1 = drawRandom(pool);
  var ura1 = drawRandom(pool);
  var doraIndicators = [dora1];
  var uraIndicators = [ura1];
  for (var i = 0; i < 12; i++) drawRandom(pool);

  var dealerSeat;
  var kyokuWind, kyokuNumber, honba;
  if (isPractice && matchState) {
    dealerSeat = matchState.dealerSeat;
    kyokuWind = matchState.kyokuWind;
    kyokuNumber = matchState.kyokuNum;
    honba = matchState.honba;
  } else {
    dealerSeat = SEATS[Math.floor(Math.random() * 4)];
    kyokuWind = '東';
    kyokuNumber = 1;
    honba = 0;
  }

  var windNames = ['東', '南', '西', '北'];
  var dealerIdx = SEATS.indexOf(dealerSeat);
  var seatWind = {};
  SEATS.forEach(function (seat) {
    var offset = (SEATS.indexOf(seat) - dealerIdx + 4) % 4;
    seatWind[seat] = windNames[offset];
  });

  if (isPractice) {
    var players = {
      you: { hand: [], river: [], isTenpai: false, wait: [], riichi: false, riichiTurn: null, ippatsu: false, melds: [], isOpen: false, openLabel: null, paoResponsibility: {} },
      p2: { hand: [], river: [], isTenpai: false, wait: [], riichi: false, riichiTurn: null, ippatsu: false, melds: [], isOpen: false, openLabel: null, paoResponsibility: {} },
      p3: { hand: [], river: [], isTenpai: false, wait: [], riichi: false, riichiTurn: null, ippatsu: false, melds: [], isOpen: false, openLabel: null, paoResponsibility: {} },
      p4: { hand: [], river: [], isTenpai: false, wait: [], riichi: false, riichiTurn: null, ippatsu: false, melds: [], isOpen: false, openLabel: null, paoResponsibility: {} }
    };
    SEATS.forEach(function (seat) {
      for (var i = 0; i < 13; i++) players[seat].hand.push(drawRandom(pool));
    });
    players.you.wait = findWaits(players.you.hand);

    var firstDrawn = drawRandom(pool);
    players[dealerSeat].hand.push(firstDrawn);

    var isYouDealer = (dealerSeat === 'you');
    var log = [];
    var matchTitleStr = matchState ? '【' + matchState.roundName + ' 第' + matchState.kyokuIndex + '局】' : '';
    log.push(matchTitleStr + kyokuWind + kyokuNumber + '局' + (honba > 0 ? ' ' + honba + '本場' : '') + '。あなたは' + seatWind.you + '家です。' +
      (isYouDealer ? 'あなたが親です。' : SEAT_NAME[dealerSeat] + 'が親です。'));
    log.push('配牌が完了しました。対局を開始します。');
    if (isYouDealer) {
      log.push('あなたは ' + tileName(firstDrawn) + ' をツモりました。捨てる牌を選んでください。');
    }

    return {
      pool: pool, players: players,
      doraIndicator: dora1, uraIndicator: ura1,
      doraIndicators: doraIndicators, uraIndicators: uraIndicators,
      T_elapsed: 1,
      tenpaiSeats: [], lastDrawn: firstDrawn, initialDrawSeat: dealerSeat, selected: null, selectedIndex: null, log: log,
      dealerSeat: dealerSeat, seatWind: seatWind, kyokuWind: kyokuWind, kyokuNumber: kyokuNumber, honba: honba,
      currentTurnSeat: dealerSeat,
      processing: !isYouDealer, gameOver: false, outcome: null, justDrew: isYouDealer,
      firstTurnUninterrupted: true, firstTsumoSeat: dealerSeat, firstTsumoAvailable: true, firstDrawWindowSeat: null,
      lastDrawWasLastLiveTile: false, lastDrawWasRinshan: false, lastDiscardWasLastLiveTile: false,
      pendingCall: null, pendingCallIndex: null, pendingOpponentQueue: [], revealExpanded: false, lastDiscardSeat: null, lastTileClick: null,
      scoresSettled: false
    };
  }

  var players = { you: { hand: [], river: [], riichi: false, riichiTurn: null, ippatsu: false, wait: [], melds: [], isOpen: false } };
  var tenpaiCount = Math.random() < 0.5 ? 1 : 2;
  var shuffled = OPP_SEATS.slice().sort(function () { return Math.random() - 0.5; });
  var tenpaiSeats = shuffled.slice(0, tenpaiCount);
  var nonTenpaiSeats = shuffled.slice(tenpaiCount);
  var T_elapsed = randInt(3, 12);

  tenpaiSeats.forEach(function (seat) {
    var tpl = pickWeightedTemplate();
    var tiles13 = templateConcealed13(tpl);
    tiles13.forEach(function (c) { removeSpecific(pool, c); });
    var wait = findWaits(tiles13);
    var riichi = tpl.riichiMode === 'forced' ? true
      : tpl.riichiMode === 'none' ? false
        : (allowDamaten ? Math.random() < 0.5 : true);
    var riichiTurn = riichi ? pickRiichiTurn(T_elapsed) : null;
    var tenpaiSinceTurn = riichi ? null : randInt(1, T_elapsed);

    var cpuMelds = [];
    var cpuHand = tiles13.slice();
    if (tpl.isOpen && tpl.melds) {
      tpl.melds.forEach(function (m) {
        if (!m.concealed) {
          var mTiles = meldTiles(m);
          var mFrom = m.from;
          if (m.type === 'run') {
            mFrom = SEATS[(SEATS.indexOf(seat) + 3) % 4];
          } else if (!mFrom || mFrom === 'toimen') {
            mFrom = SEATS[(SEATS.indexOf(seat) + 2) % 4];
          } else if (mFrom === 'kamicha') {
            mFrom = SEATS[(SEATS.indexOf(seat) + 3) % 4];
          } else if (mFrom === 'shimocha') {
            mFrom = SEATS[(SEATS.indexOf(seat) + 1) % 4];
          }
          cpuMelds.push({
            type: m.type === 'run' ? 'chi' : 'pon',
            tiles: mTiles,
            from: mFrom,
            calledTile: mTiles[0]
          });
          mTiles.forEach(function (t) {
            var tIdx = cpuHand.indexOf(t);
            if (tIdx !== -1) cpuHand.splice(tIdx, 1);
          });
        }
      });
    }
    var wait = findWaitsOpen(cpuHand, cpuMelds.length);

    players[seat] = {
      hand: cpuHand, river: [], isTenpai: true, wait: wait, riichi: riichi, riichiTurn: riichiTurn, ippatsu: false,
      isOpen: tpl.isOpen, openLabel: tpl.openMeldLabel || null, tpl: tpl, tenpaiSinceTurn: tenpaiSinceTurn,
      melds: cpuMelds
    };
  });
  nonTenpaiSeats.forEach(function (seat) {
    var hand = []; for (var i = 0; i < 13; i++) hand.push(drawRandom(pool));
    players[seat] = { hand: hand, river: [], isTenpai: false, wait: [], riichi: false, riichiTurn: null, ippatsu: false, isOpen: false, openLabel: null, melds: [] };
  });
  var youHand = []; for (var i = 0; i < 13; i++) youHand.push(drawRandom(pool));
  players.you.hand = youHand;

  var forbiddenAll = new Set();
  tenpaiSeats.forEach(function (seat) { players[seat].wait.forEach(function (w) { forbiddenAll.add(w); }); });

  var gTemp = { players: players };
  function computeSafeSetTemp(riichiSeat) {
    var R = gTemp.players[riichiSeat];
    var safe = new Set(R.river);
    SEATS.forEach(function (s) {
      if (s === riichiSeat) return;
      var arr = gTemp.players[s].river;
      for (var idx = R.riichiTurn - 1; idx < arr.length; idx++) { if (arr[idx] !== undefined) safe.add(arr[idx]); }
    });
    return safe;
  }

  for (var k = 1; k <= T_elapsed - 1; k++) {
    SEATS.forEach(function (seat) {
      var p = players[seat];
      var activeNow = tenpaiSeats.filter(function (s) { return players[s].riichi && players[s].riichiTurn <= k; });
      var chosen;
      if (!p.isTenpai && activeNow.length) {
        var safeSets = activeNow.map(computeSafeSetTemp);
        var safeIntersect = safeSets.reduce(function (acc, s) { return new Set([...acc].filter(function (x) { return s.has(x); })); });
        var candidates = [];
        safeIntersect.forEach(function (code) { var idx = tileIndex(code); for (var c = 0; c < pool[idx]; c++) candidates.push(idx); });
        if (candidates.length) { var pick = candidates[Math.floor(Math.random() * candidates.length)]; pool[pick]--; chosen = indexToCode(pick); }
        else chosen = drawRandomExcluding(pool, forbiddenAll);
      } else {
        chosen = drawRandomExcluding(pool, forbiddenAll);
      }
      p.river.push(chosen);
    });
  }

  players.you.wait = findWaits(players.you.hand);
  var lastDrawn = drawRandom(pool);
  players.you.hand.push(lastDrawn);

  var kyokuWindTraining = Math.random() < 0.5 ? '東' : '南';
  var kyokuNumberTraining = 1 + Math.floor(Math.random() * 4);

  var log = [];
  log.push(kyokuWindTraining + kyokuNumberTraining + '局。あなたは' + seatWind.you + '家です。' +
    (dealerSeat === 'you' ? 'あなたが親です。' : SEAT_NAME[dealerSeat] + 'が親です。'));
  log.push('山を' + (T_elapsed - 1) + '巡経過した局面からスタートします。');
  tenpaiSeats.forEach(function (seat) {
    if (players[seat].riichi) log.push(SEAT_NAME[seat] + 'がリーチを宣言しています。');
  });
  log.push('あなたは ' + tileName(lastDrawn) + ' をツモりました。捨てる牌を選んでください。');

  return {
    pool: pool, players: players,
    doraIndicator: dora1, uraIndicator: ura1,
    doraIndicators: doraIndicators, uraIndicators: uraIndicators,
    T_elapsed: T_elapsed,
    tenpaiSeats: tenpaiSeats, lastDrawn: lastDrawn, selected: null, selectedIndex: null, log: log,
    dealerSeat: dealerSeat, seatWind: seatWind, kyokuWind: kyokuWindTraining, kyokuNumber: kyokuNumberTraining,
    processing: false, gameOver: false, outcome: null, justDrew: true,
    firstTurnUninterrupted: false, firstTsumoSeat: null, firstTsumoAvailable: false, firstDrawWindowSeat: null,
    lastDrawWasLastLiveTile: false, lastDrawWasRinshan: false, lastDiscardWasLastLiveTile: false,
    pendingCall: null, pendingCallIndex: null, pendingOpponentQueue: [], revealExpanded: false, lastDiscardSeat: null, lastTileClick: null
  };
}
window.newGame = newGame;


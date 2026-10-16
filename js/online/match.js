// js/online/match.js
// 対局開始と局情報の配信

function startOnlineMatchAsHost() {
  var app = getAppEl();
  app.innerHTML = shellHtml('ONLINE MATCH', '通信対戦（実践編）', 'tgRoot');
  wireBack();

  var match = {
    rounds: OnlineGameRuntime.matchSettings.rounds,
    redDora: OnlineGameRuntime.matchSettings.redDora,
    cpuLevel: OnlineGameRuntime.matchSettings.cpuLevel,
    kyokuIndex: 1,
    maxKyoku: OnlineGameRuntime.matchSettings.rounds,
    roundName: OnlineGameRuntime.matchSettings.rounds === 1 ? '一局戦' : (OnlineGameRuntime.matchSettings.rounds === 4 ? '東風戦' : '半荘戦'),
    kyokuWind: '東',
    kyokuNum: 1,
    honba: 0,
    riichiPool: 0,
    scores: { you: 25000, p2: 25000, p3: 25000, p4: 25000 },
    dealerSeat: 'you'
  };

  initTraining('practice', match);

  sendCurrentRoundToGuests();
  syncOnlineStateToAll();
}

function sendCurrentRoundToGuests() {
  if (!OnlinePeer.isHost() || !G) return;
  OnlineGameRuntime.seatsConfig.forEach(function (slot) {
    if (slot.seat === 'you' || slot.isCpu || !slot.id) return;
    OnlinePeer.sendTo(slot.id, {
      type: 'ONLINE_START_MATCH',
      seat: slot.seat,
      hand: G.players[slot.seat].hand,
      lastDrawn: G.dealerSeat === slot.seat ? G.lastDrawn : null,
      remainingPool: poolTotal(G.pool),
      doraIndicator: G.doraIndicator,
      matchState: matchState,
      dealerSeat: G.dealerSeat,
      currentTurnSeat: G.currentTurnSeat,
      firstTurnUninterrupted: G.firstTurnUninterrupted,
      firstTsumoSeat: G.firstTsumoSeat,
      firstTsumoAvailable: G.firstTsumoAvailable,
      firstDrawWindowSeat: G.firstDrawWindowSeat,
      seatsConfig: OnlineGameRuntime.seatsConfig
    });
  });
}

function syncNextKyoku() {
  sendCurrentRoundToGuests();
}

function requestNextKyoku() {
  if (OnlinePeer.isHost() || !OnlineGameRuntime.myLogicalSeat) return false;
  OnlinePeer.sendToHost({ type: 'GUEST_NEXT_KYOKU', seat: OnlineGameRuntime.myLogicalSeat });
  return true;
}

// ゲスト側が対局開始通知を受信した時の処理
function handleGuestStartMatch(msg) {
  var app = getAppEl();
  app.innerHTML = shellHtml('ONLINE MATCH', '通信対戦（実践編）', 'tgRoot');
  wireBack();

  OnlineGameRuntime.myLogicalSeat = msg.seat;
  matchState = Object.assign({}, msg.matchState);
  gameMode = 'practice';
  isPractice = true;
  OnlineGameRuntime.seatsConfig = msg.seatsConfig;

  var localCurrentTurn = logicalToLocalSeat(msg.currentTurnSeat);
  var localDealerSeat = logicalToLocalSeat(msg.dealerSeat);
  var localFirstTsumoSeat = msg.firstTsumoSeat ? logicalToLocalSeat(msg.firstTsumoSeat) : null;
  var logicalScores = msg.matchState.scores || {};
  matchState.scores = {};
  OnlineGameRuntime.SEATS_ORDER.forEach(function (locSeat) {
    matchState.scores[locSeat] = logicalScores[localToLogicalSeat(locSeat)];
  });
  matchState.dealerSeat = localDealerSeat;

  // 相対座席に基づく自風計算
  var seatWinds = {};
  OnlineGameRuntime.SEATS_ORDER.forEach(function (locSeat) {
    var logSeat = localToLogicalSeat(locSeat);
    var dIdx = OnlineGameRuntime.SEATS_ORDER.indexOf(msg.dealerSeat);
    var lIdx = OnlineGameRuntime.SEATS_ORDER.indexOf(logSeat);
    var wIdx = (lIdx - dIdx + 4) % 4;
    var winds = ['東', '南', '西', '北'];
    seatWinds[locSeat] = winds[wIdx];
  });

  // ゲスト視点では、手前（you）に自分の手牌を配置
  G = {
    pool: (function () { var p = new Array(34).fill(0); p[0] = msg.remainingPool || 0; return p; })(),
    players: {
      you: { hand: (msg.hand || []).slice(), river: [], isTenpai: false, wait: [], riichi: false, melds: [] },
      p2: { hand: [], river: [], isTenpai: false, wait: [], riichi: false, melds: [] },
      p3: { hand: [], river: [], isTenpai: false, wait: [], riichi: false, melds: [] },
      p4: { hand: [], river: [], isTenpai: false, wait: [], riichi: false, melds: [] }
    },
    doraIndicator: msg.doraIndicator,
    doraIndicators: [msg.doraIndicator],
    currentTurnSeat: localCurrentTurn,
    dealerSeat: localDealerSeat,
    initialDrawSeat: localDealerSeat,
    firstTurnUninterrupted: !!msg.firstTurnUninterrupted,
    firstTsumoSeat: localFirstTsumoSeat,
    firstTsumoAvailable: !!msg.firstTsumoAvailable,
    firstDrawWindowSeat: msg.firstDrawWindowSeat ? logicalToLocalSeat(msg.firstDrawWindowSeat) : null,
    lastDrawWasLastLiveTile: false,
    lastDrawWasRinshan: false,
    lastDiscardWasLastLiveTile: false,
    seatWind: seatWinds,
    kyokuWind: msg.matchState.kyokuWind,
    kyokuNumber: msg.matchState.kyokuNum,
    honba: msg.matchState.honba,
    log: ['オンライン対局を開始しました。あなたは ' + seatWinds.you + '家 です。'],
    processing: (localCurrentTurn !== 'you'),
    gameOver: false,
    outcome: null,
    justDrew: (localCurrentTurn === 'you'),
    lastDrawn: msg.lastDrawn || null
  };

  render();
}

// ホスト側：ゲストのツモ番になったことを該当ゲストへ通知

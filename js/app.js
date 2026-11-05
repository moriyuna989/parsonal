// =====================================================================
// js/app.js
// ルーター・画面遷移・全体エントリーポイント
// =====================================================================

var appEl = document.getElementById('app');
var practiceConfig = { rounds: 4, redDora: true, cpuLevel: 'hard' };
var replayWorking = null;
var REPLAY_STORAGE_KEY = 'mahjong:lastMatchReplay:v1';

function startReplayMatch(match, viewerSeat, seatsConfig) {
  replayWorking = {
    version: 1,
    roundName: match.roundName,
    viewerSeat: viewerSeat,
    names: {},
    rounds: []
  };
  (seatsConfig || []).forEach(function (slot) { replayWorking.names[slot.seat] = slot.name; });
}

function captureReplaySnapshot(eventText) {
  if (!replayWorking || !isPractice || !matchState || !G || !G.players) return;
  if (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline() && !OnlinePeer.isHost()) return;

  var roundIndex = matchState.kyokuIndex;
  var round = replayWorking.rounds.find(function (r) { return r.index === roundIndex; });
  if (!round) {
    round = { index: roundIndex, title: G.kyokuWind + G.kyokuNumber + '局' + (G.honba ? ' ' + G.honba + '本場' : ''), frames: [] };
    replayWorking.rounds.push(round);
  }
  var frame = {
    event: eventText || G.log[G.log.length - 1] || '対局開始',
    dealer: G.dealerSeat,
    turn: G.currentTurnSeat,
    lastDiscard: G.lastDiscardSeat || null,
    dora: (G.doraIndicators || (G.doraIndicator ? [G.doraIndicator] : [])).slice(),
    scores: Object.assign({}, matchState.scores),
    remaining: poolTotal(G.pool),
    hands: {}, rivers: {}, melds: {}, riichi: {}, winds: {},
    gameOver: !!G.gameOver,
    outcome: G.outcome ? { type: G.outcome.type, tile: G.outcome.tile || null,
      winner: G.outcome.type === 'user_ron' || G.outcome.type === 'user_tsumo' ? 'you' :
        (G.outcome.seat || G.outcome.ronner || G.outcome.to || null) } : null
  };
  SEATS.forEach(function (seat) {
    var p = G.players[seat];
    frame.hands[seat] = p.hand.slice();
    frame.rivers[seat] = p.river.slice();
    frame.melds[seat] = JSON.parse(JSON.stringify(p.melds || []));
    frame.riichi[seat] = !!p.riichi;
    frame.winds[seat] = G.seatWind[seat];
  });
  var previous = round.frames[round.frames.length - 1];
  if (!previous || JSON.stringify(previous) !== JSON.stringify(frame)) round.frames.push(frame);
  if (G.gameOver && checkKyokuResultStatus().isFinished) saveLastReplay(replayWorking);
}

function receiveReplayRound(round, finished) {
  if (!replayWorking || !round || !Array.isArray(round.frames)) return;
  var copy = JSON.parse(JSON.stringify(round));
  var index = replayWorking.rounds.findIndex(function (r) { return r.index === copy.index; });
  if (index === -1) replayWorking.rounds.push(copy);
  else replayWorking.rounds[index] = copy;
  replayWorking.rounds.sort(function (a, b) { return a.index - b.index; });
  if (finished) saveLastReplay(replayWorking);
}

function saveLastReplay(replay) {
  if (!replay || !replay.rounds.length) return;
  try { localStorage.setItem(REPLAY_STORAGE_KEY, JSON.stringify(replay)); }
  catch (err) { console.warn('リプレイを保存できませんでした', err); }
}

function loadLastReplay() {
  try {
    var replay = JSON.parse(localStorage.getItem(REPLAY_STORAGE_KEY));
    return replay && replay.version === 1 && Array.isArray(replay.rounds) && replay.rounds.length ? replay : null;
  } catch (err) { return null; }
}

function escapeReplayText(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
  });
}

function openLastReplay() {
  var replay = loadLastReplay();
  if (!replay) return;
  if (window._tgKeyHandler) {
    window.removeEventListener('keydown', window._tgKeyHandler);
    window._tgKeyHandler = null;
  }
  if (!appEl) appEl = document.getElementById('app');
  appEl.innerHTML = shellHtml('MATCH REPLAY', '前回の対局をリプレイ', 'replayRoot');
  wireBack();
  var frames = [];
  replay.rounds.forEach(function (round) {
    (round.frames || []).forEach(function (frame, index) {
      frames.push({ round: round, frame: frame, step: index });
    });
  });
  if (!frames.length) return;
  var cursor = 0;
  var showAllHands = false;
  var seats = ['you', 'p2', 'p3', 'p4'];
  var viewerIndex = seats.indexOf(replay.viewerSeat);
  if (viewerIndex < 0) viewerIndex = 0;
  var displayOrder = [0, 1, 2, 3].map(function (offset) { return seats[(viewerIndex + offset) % 4]; });

  function seatLabel(seat) {
    if (seat === replay.viewerSeat) return 'あなた';
    return escapeReplayText(replay.names[seat] || SEAT_NAME[seat] || seat);
  }
  function replayTile(code, frame) {
    var isDora = (frame.dora || []).some(function (indicator) {
      return isSameTileType(code, nextTile(indicator));
    });
    return tileEl(code, isDora ? 'dora-tile' : '');
  }
  function draw() {
    var item = frames[cursor];
    var frame = item.frame;
    var roundButtons = replay.rounds.map(function (round) {
      var target = frames.findIndex(function (entry) { return entry.round.index === round.index; });
      return '<button class="btn-secondary" data-replay-round="' + target + '"' +
        (round.index === item.round.index ? ' style="border-color:var(--accent);"' : '') + '>' + escapeReplayText(round.title) + '</button>';
    }).join('');
    var seatsHtml = displayOrder.map(function (seat) {
      var hand = frame.hands[seat] || [];
      var revealHand = showAllHands || seat === replay.viewerSeat;
      var handHtml = revealHand
        ? sortTiles(hand).map(function (tile) { return replayTile(tile, frame); }).join('')
        : '<span style="color:var(--ink-soft);">手牌 ' + hand.length + '枚（非表示）</span>';
      var meldHtml = (frame.melds[seat] || []).length
        ? '<div class="you-melds" style="margin-top:6px;">' + renderMeldsHtml(frame.melds[seat], seat, null,
          function (tile) { return replayTile(tile, frame); }) + '</div>' : '';
      var riverHtml = (frame.rivers[seat] || []).map(function (tile) { return replayTile(tile, frame); }).join('');
      return '<div style="border:1px solid var(--line); border-radius:10px; padding:10px; margin-top:10px;">' +
        '<div style="font-weight:700; margin-bottom:6px;">' + seatLabel(seat) + ' · ' + escapeReplayText(frame.winds[seat] || '') + '家' +
        (frame.dealer === seat ? ' · 親' : '') + (frame.riichi[seat] ? ' · リーチ' : '') +
        (frame.turn === seat && !frame.gameOver ? ' · 手番' : '') +
        ' · ' + Number(frame.scores[seat] || 0).toLocaleString() + '点</div>' +
        '<div class="tiles-wrap"><div class="tiles-row">' + handHtml + '</div></div>' + meldHtml +
        '<div style="font-size:12px; color:var(--ink-soft); margin-top:8px;">捨て牌</div>' +
        '<div class="tiles-wrap"><div class="tiles-row">' + riverHtml + '</div></div></div>';
    }).join('');
    var indicatorHtml = (frame.dora || []).map(function (tile) { return tileEl(tile); }).join('');
    var outcomeLabels = { user_dealin: '放銃', opp_tsumo: 'ツモ', other_ron: 'ロン',
      ryuukyoku: '流局', user_ron: 'ロン', user_tsumo: 'ツモ' };
    var outcomeHtml = frame.gameOver && frame.outcome
      ? '<div style="font-weight:700; margin:8px 0;">局終了: ' +
        escapeReplayText(outcomeLabels[frame.outcome.type] || frame.outcome.type) +
        (frame.outcome.winner ? ' · ' + seatLabel(frame.outcome.winner) : '') +
        (frame.outcome.tile ? ' · 和了牌 ' + tileEl(frame.outcome.tile) : '') + '</div>' : '';
    var root = document.getElementById('replayRoot');
    root.innerHTML = '<div class="card">' +
      '<div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px;">' + roundButtons + '</div>' +
      '<div style="font-weight:700;">' + escapeReplayText(item.round.title) + ' · 場面 ' + (item.step + 1) + '/' + item.round.frames.length + '</div>' +
      '<div style="margin:6px 0;">' + escapeReplayText(frame.event) + '</div>' +
      outcomeHtml +
      '<div style="font-size:12px;">残り牌: ' + frame.remaining + '枚 · ドラ表示牌 ' + indicatorHtml + '</div>' +
      '<div style="margin-top:12px;"><label><input type="checkbox" id="replayShowAll"' + (showAllHands ? ' checked' : '') + '> 全員の手牌を見る</label></div>' +
      seatsHtml +
      '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:16px;">' +
      '<button class="btn-secondary" id="replayPrev"' + (cursor === 0 ? ' disabled' : '') + '>← 前へ</button>' +
      '<button class="btn-main" id="replayNext"' + (cursor === frames.length - 1 ? ' disabled' : '') + '>次へ →</button>' +
      '<span style="align-self:center; font-size:12px;">' + (cursor + 1) + ' / ' + frames.length + '</span></div></div>';
    root.querySelectorAll('[data-replay-round]').forEach(function (button) {
      button.addEventListener('click', function () { cursor = Number(button.getAttribute('data-replay-round')); draw(); });
    });
    document.getElementById('replayShowAll').addEventListener('change', function () { showAllHands = this.checked; draw(); });
    document.getElementById('replayPrev').addEventListener('click', function () { if (cursor > 0) { cursor--; draw(); } });
    document.getElementById('replayNext').addEventListener('click', function () { if (cursor < frames.length - 1) { cursor++; draw(); } });
  }
  draw();
}

function shellHtml(eyebrow, title, bodyId) {
  return '<div class="stage"><div class="topbar"><span class="back-link" id="backHome">← ホーム</span></div>' +
    '<div class="masthead"><div class="eyebrow">' + eyebrow + '</div><h1>' + title + '</h1></div>' +
    '<div id="' + bodyId + '"></div></div>';
}

function wireBack() {
  var backBtn = document.getElementById('backHome');
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      if (window._tgKeyHandler) {
        window.removeEventListener('keydown', window._tgKeyHandler);
        window._tgKeyHandler = null;
      }
      if (typeof OnlinePeer !== 'undefined' && OnlinePeer.disconnect) {
        OnlinePeer.disconnect();
      }
      goHome();
    });
  }
}

function homeHtml() {
  return '<div class="stage">' +
    '<div class="masthead"><div class="eyebrow">MAHJONG TRAINING</div><h1>麻雀トレーニング</h1></div>' +
    '<div class="home-cards">' +
    '<button class="nav-card" id="navPractice"><span class="nav-title">実践編（対局）</span>' +
    '<span class="nav-desc">配牌（0巡目）から局をプレイします。他プレイヤーと一緒にツモ・打牌を進め、テンパイやアガリを目指します。</span></button>' +
    '<button class="nav-card" id="navOnline" style="border-color: rgba(30, 144, 255, 0.4);"><span class="nav-title" style="color: #1e90ff;">通信対戦（オンライン） 🌐</span>' +
    '<span class="nav-desc">インターネット経由で離れた友達とリアルタイム対戦！足りない枠はCPUが自動で埋めてすぐに対戦可能です。</span></button>' +
    (loadLastReplay() ? '<button class="nav-card" id="navReplay"><span class="nav-title">前回の対局をリプレイ</span>' +
    '<span class="nav-desc">直前の1試合を振り返り、各局の全員の手牌を確認できます。</span></button>' : '') +
    '<button class="nav-card" id="navTraining"><span class="nav-title">アタリ牌回避訓練場</span>' +
    '<span class="nav-desc">相手のリーチに対してどの牌を切るか練習します。あがる・振り込む・流局するまで対局が続きます。</span></button>' +
    '<button class="nav-card" id="navQuiz"><span class="nav-title">点数計算ドリル</span>' +
    '<span class="nav-desc">アガリの手牌から翻・符・点数を自分で計算する全10問のドリルです。</span></button>' +
    '</div></div>';
}

function wireHome() {
  var btnPractice = document.getElementById('navPractice');
  if (btnPractice) btnPractice.addEventListener('click', goPractice);

  var btnOnline = document.getElementById('navOnline');
  if (btnOnline) btnOnline.addEventListener('click', goOnline);

  var btnReplay = document.getElementById('navReplay');
  if (btnReplay) btnReplay.addEventListener('click', openLastReplay);

  var btnTraining = document.getElementById('navTraining');
  if (btnTraining) btnTraining.addEventListener('click', goTraining);

  var btnQuiz = document.getElementById('navQuiz');
  if (btnQuiz) btnQuiz.addEventListener('click', goQuiz);
}

function goHome() {
  if (!appEl) appEl = document.getElementById('app');
  appEl.innerHTML = homeHtml();
  wireHome();
}

function goOnline() {
  if (typeof OnlineGame !== 'undefined' && OnlineGame.openOnlineLobby) {
    OnlineGame.openOnlineLobby();
  }
}

function goQuiz() {
  if (!appEl) appEl = document.getElementById('app');
  appEl.innerHTML = shellHtml('MAHJONG SCORING DRILL', '点数計算ドリル', 'quizRoot') +
    '<div class="footnote" id="quizFootnote"></div>';
  wireBack();
  initQuiz();
}

function renderPracticeSettings() {
  if (!appEl) appEl = document.getElementById('app');
  appEl.innerHTML = shellHtml('PRACTICE MATCH', '実践編（対局）設定', 'settingsRoot');
  wireBack();
  var root = document.getElementById('settingsRoot');
  root.innerHTML = '<div class="settings-card">' +
    '<div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 6px;">' +
      '<h2 class="settings-title" style="margin-bottom: 0;">対局ルール設定</h2>' +
      '<span class="mleague-badge">Mリーグルール採用</span>' +
    '</div>' +
    '<div class="settings-desc">対局の長さ（局数）、赤ドラ、およびCPUの強さを選択してください。</div>' +
    '<div class="settings-rule-box">' +
      '<div><strong>【採用ルール】</strong> 25,000点持ち／30,000点返し（オカ20pt）、順位ウマ 1位:+30 / 2位:+10 / 3位:-10 / 4位:-30（実質順位点 +50 / +10 / -10 / -30）</div>' +
      '<div style="margin-top: 4px; font-size: 11px;">※対局終了時の最終持ち点から、Mリーグ公式ルールに基づき最終成績ポイント（pt）が算出されます。</div>' +
    '</div>' +
    '<div class="settings-group">' +
      '<div class="settings-label">局数（試合の長さ）</div>' +
      '<div class="settings-options" id="optRoundsGroup">' +
        '<div class="settings-option' + (practiceConfig.rounds === 1 ? ' selected' : '') + '" data-val="1">一局戦<span class="opt-sub">全1局</span></div>' +
        '<div class="settings-option' + (practiceConfig.rounds === 4 ? ' selected' : '') + '" data-val="4">東風戦<span class="opt-sub">全4局（推奨）</span></div>' +
        '<div class="settings-option' + (practiceConfig.rounds === 8 ? ' selected' : '') + '" data-val="8">半荘戦<span class="opt-sub">全8局</span></div>' +
      '</div>' +
    '</div>' +
    '<div class="settings-group">' +
      '<div class="settings-label">赤牌（赤ドラ）</div>' +
      '<div class="settings-options" id="optRedGroup">' +
        '<div class="settings-option' + (practiceConfig.redDora ? ' selected' : '') + '" data-val="1">あり<span class="opt-sub">赤5萬・赤5筒・赤5索 各1枚（Mリーグ準拠）</span></div>' +
        '<div class="settings-option' + (!practiceConfig.redDora ? ' selected' : '') + '" data-val="0">なし<span class="opt-sub">赤牌なし</span></div>' +
      '</div>' +
    '</div>' +
    '<div class="settings-group">' +
      '<div class="settings-label">CPUレベル（対戦相手の強さ）</div>' +
      '<div class="settings-options" id="optCpuLevelGroup">' +
        '<div class="settings-option' + (practiceConfig.cpuLevel === 'easy' ? ' selected' : '') + '" data-val="easy">初級<span class="opt-sub">攻撃重視・守備甘め</span></div>' +
        '<div class="settings-option' + (practiceConfig.cpuLevel === 'normal' ? ' selected' : '') + '" data-val="normal">中級<span class="opt-sub">標準的・現物警戒</span></div>' +
        '<div class="settings-option' + (practiceConfig.cpuLevel === 'hard' ? ' selected' : '') + '" data-val="hard">上級<span class="opt-sub">仲林プロAI・徹底守備（推奨）</span></div>' +
      '</div>' +
    '</div>' +
    '<button class="btn-main" id="btnStartPracticeMatch" style="margin-top: 10px; width: 100%;">対局を開始する</button>' +
  '</div>';

  var roundOpts = root.querySelectorAll('#optRoundsGroup .settings-option');
  roundOpts.forEach(function (el) {
    el.addEventListener('click', function () {
      roundOpts.forEach(function (o) { o.classList.remove('selected'); });
      el.classList.add('selected');
      practiceConfig.rounds = parseInt(el.getAttribute('data-val'), 10);
    });
  });

  var redOpts = root.querySelectorAll('#optRedGroup .settings-option');
  redOpts.forEach(function (el) {
    el.addEventListener('click', function () {
      redOpts.forEach(function (o) { o.classList.remove('selected'); });
      el.classList.add('selected');
      practiceConfig.redDora = (el.getAttribute('data-val') === '1');
    });
  });

  var cpuOpts = root.querySelectorAll('#optCpuLevelGroup .settings-option');
  cpuOpts.forEach(function (el) {
    el.addEventListener('click', function () {
      cpuOpts.forEach(function (o) { o.classList.remove('selected'); });
      el.classList.add('selected');
      practiceConfig.cpuLevel = el.getAttribute('data-val');
    });
  });

  document.getElementById('btnStartPracticeMatch').addEventListener('click', function () {
    startPracticeMatch(practiceConfig);
  });
}

function goPractice() {
  renderPracticeSettings();
}

function startPracticeMatch(config) {
  if (typeof OnlineGameRuntime !== 'undefined') OnlineGameRuntime.isOnline = false;
  if (!appEl) appEl = document.getElementById('app');
  appEl.innerHTML = shellHtml('PRACTICE MATCH', '実践編（対局）', 'tgRoot');
  wireBack();
  var match = {
    rounds: config.rounds,
    redDora: config.redDora,
    cpuLevel: config.cpuLevel || 'hard',
    kyokuIndex: 1,
    maxKyoku: config.rounds,
    roundName: config.rounds === 1 ? '一局戦' : (config.rounds === 4 ? '東風戦' : '半荘戦'),
    kyokuWind: '東',
    kyokuNum: 1,
    honba: 0,
    riichiPool: 0,
    scores: { you: 25000, p2: 25000, p3: 25000, p4: 25000 },
    dealerSeat: SEATS[Math.floor(Math.random() * SEATS.length)]
  };
  startReplayMatch(match, 'you', null);
  initTraining('practice', match);
}

function goTraining() {
  if (!appEl) appEl = document.getElementById('app');
  appEl.innerHTML = shellHtml('DEAL-IN AVOIDANCE DOJO', 'アタリ牌回避訓練場', 'tgRoot');
  wireBack();
  initTraining('training');
}

// ================= BOOT =================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', goHome);
} else {
  goHome();
}

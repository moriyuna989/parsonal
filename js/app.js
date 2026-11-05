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

function ensureReplayStyles() {
  if (document.getElementById('replayLayoutStyles')) return;
  var style = document.createElement('style');
  style.id = 'replayLayoutStyles';
  style.textContent =
    'body.replay-mode{height:100dvh;overflow:hidden;padding:0 12px;box-sizing:border-box}' +
    'body.replay-mode>#app{height:100%;min-height:0;width:100%}' +
    'body.replay-mode .replay-stage{height:100%;min-height:0;max-width:1180px;gap:5px;padding:6px 0;box-sizing:border-box}' +
    'body.replay-mode .replay-stage .topbar{flex:0 0 auto}' +
    'body.replay-mode .replay-stage .masthead{gap:0;flex:0 0 auto}' +
    'body.replay-mode .replay-stage .masthead h1{font-size:20px}' +
    '#replayRoot{flex:1;min-height:0;overflow:hidden}' +
    '.replay-layout{height:100%;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:6px}' +
    '.replay-toolbar,.replay-controls{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}' +
    '.replay-toolbar select{max-width:52%;padding:7px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);font:inherit}' +
    '.replay-toolbar label{font-size:13px;font-weight:700;white-space:nowrap}' +
    '.replay-table-grid{display:grid;min-height:0;grid-template-columns:minmax(0,1fr) minmax(130px,.7fr) minmax(0,1fr);grid-template-rows:minmax(0,1fr) minmax(70px,.55fr) minmax(0,1fr);grid-template-areas:". toimen ." "kamicha center shimocha" ". you .";gap:6px;align-items:stretch}' +
    '.replay-seat{min-width:0;min-height:0;overflow:hidden;border:1px solid var(--line);border-radius:10px;padding:6px;background:var(--surface-alt);display:flex;flex-direction:column;gap:3px}' +
    '.replay-seat-toimen{grid-area:toimen}.replay-seat-kamicha{grid-area:kamicha}.replay-seat-shimocha{grid-area:shimocha}.replay-seat-you{grid-area:you}' +
    '.replay-seat-head{font-size:12px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.replay-strip{display:flex;align-items:flex-end;gap:2px;min-width:0;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin}' +
    '.replay-strip .tile{font-size:clamp(15px,2.4vw,25px);padding:1px;flex:0 0 auto}' +
    '.replay-river-label{font-size:10px;color:var(--ink-soft)}.replay-melds{min-height:0;overflow:hidden}.replay-melds .meld-group{padding:1px 2px;gap:1px}.replay-melds .meld-group .tile{font-size:16px}' +
    '.replay-center{grid-area:center;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:4px;font-size:12px;color:var(--ink-soft);overflow:hidden}' +
    '.replay-center .tile{font-size:clamp(18px,3vw,28px);padding:1px}' +
    '.replay-center-event{max-width:100%;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;color:var(--ink)}' +
    '.replay-outcome{font-weight:800;color:var(--ink)}' +
    '.replay-controls button{padding:8px 16px}.replay-progress{font-size:12px;font-weight:700;white-space:nowrap}' +
    '@media(max-width:600px){body.replay-mode{padding:0 5px}.replay-table-grid{grid-template-columns:minmax(0,1fr) minmax(48px,.45fr) minmax(0,1fr);grid-template-rows:minmax(0,1fr) minmax(56px,.52fr) minmax(0,1fr);gap:3px}.replay-seat{padding:3px;border-radius:7px;gap:2px}.replay-seat-head{font-size:10px}.replay-strip .tile{font-size:clamp(13px,4vw,18px);padding:0}.replay-river-label{font-size:9px}.replay-melds .meld-group .tile{font-size:12px}.replay-center{font-size:10px;gap:2px}.replay-center .tile{font-size:clamp(15px,4vw,20px)}.replay-controls button{padding:7px 12px}.replay-toolbar select{max-width:48%;font-size:12px}.replay-toolbar label{font-size:11px}}';
  document.head.appendChild(style);
}

function openLastReplay() {
  var replay = loadLastReplay();
  if (!replay) return;
  if (window._tgKeyHandler) {
    window.removeEventListener('keydown', window._tgKeyHandler);
    window._tgKeyHandler = null;
  }
  ensureReplayStyles();
  document.body.classList.add('replay-mode');
  if (!appEl) appEl = document.getElementById('app');
  appEl.innerHTML = shellHtml('MATCH REPLAY', '前回の対局をリプレイ', 'replayRoot');
  var stage = appEl.querySelector('.stage');
  if (stage) stage.classList.add('replay-stage');
  wireBack();
  var frames = [];
  replay.rounds.forEach(function (round) {
    (round.frames || []).forEach(function (frame, index) { frames.push({ round: round, frame: frame, step: index }); });
  });
  if (!frames.length) return;
  var cursor = 0;
  var showAllHands = false;
  var seats = ['you', 'p2', 'p3', 'p4'];
  var viewerIndex = seats.indexOf(replay.viewerSeat);
  if (viewerIndex < 0) viewerIndex = 0;
  var seatByPosition = {
    you: seats[viewerIndex],
    shimocha: seats[(viewerIndex + 1) % 4],
    toimen: seats[(viewerIndex + 2) % 4],
    kamicha: seats[(viewerIndex + 3) % 4]
  };

  function seatLabel(seat) {
    if (seat === replay.viewerSeat) return 'あなた';
    return escapeReplayText((replay.names || {})[seat] || SEAT_NAME[seat] || seat);
  }
  function replayTile(code, frame) {
    var isDora = (frame.dora || []).some(function (indicator) { return isSameTileType(code, nextTile(indicator)); });
    return tileEl(code, isDora ? 'dora-tile' : '');
  }
  function seatHtml(position, frame) {
    var seat = seatByPosition[position];
    var hand = frame.hands[seat] || [];
    var handHtml = showAllHands || seat === replay.viewerSeat
      ? sortTiles(hand).map(function (tile) { return replayTile(tile, frame); }).join('')
      : '<span style="color:var(--ink-soft);font-size:11px;">手牌 ' + hand.length + '枚</span>';
    var meldHtml = (frame.melds[seat] || []).length
      ? '<div class="replay-melds">' + renderMeldsHtml(frame.melds[seat], seat, 'compact', function (tile) { return replayTile(tile, frame); }) + '</div>' : '';
    var riverHtml = (frame.rivers[seat] || []).map(function (tile) { return replayTile(tile, frame); }).join('');
    var score = Number(frame.scores[seat] || 0).toLocaleString();
    return '<section class="replay-seat replay-seat-' + position + '">' +
      '<div class="replay-seat-head">' + seatLabel(seat) + ' ' + escapeReplayText(frame.winds[seat] || '') + '家' +
      (frame.dealer === seat ? ' 親' : '') + (frame.riichi[seat] ? ' リーチ' : '') +
      (frame.turn === seat && !frame.gameOver ? ' 手番' : '') + ' · ' + score + '点</div>' +
      '<div class="replay-strip" aria-label="' + seatLabel(seat) + 'の手牌">' + handHtml + '</div>' + meldHtml +
      '<div class="replay-river-label">捨て牌</div><div class="replay-strip" aria-label="' + seatLabel(seat) + 'の捨て牌">' + riverHtml + '</div></section>';
  }
  function draw() {
    var item = frames[cursor];
    var frame = item.frame;
    var roundOptions = replay.rounds.map(function (round, index) {
      return '<option value="' + index + '"' + (round.index === item.round.index ? ' selected' : '') + '>' + escapeReplayText(round.title) + '</option>';
    }).join('');
    var outcomeLabels = { user_dealin: '放銃', opp_tsumo: 'ツモ', other_ron: 'ロン', ryuukyoku: '流局', user_ron: 'ロン', user_tsumo: 'ツモ' };
    var outcomeHtml = frame.gameOver && frame.outcome
      ? '<div class="replay-outcome">' + escapeReplayText(outcomeLabels[frame.outcome.type] || frame.outcome.type) +
        (frame.outcome.winner ? ' · ' + seatLabel(frame.outcome.winner) : '') +
        (frame.outcome.tile ? ' · ' + tileEl(frame.outcome.tile) : '') + '</div>' : '';
    var doraHtml = (frame.dora || []).map(function (tile) { return tileEl(tile); }).join('');
    var centerEvent = '<div class="replay-center-event">' + escapeReplayText(frame.event) + '</div>' + outcomeHtml;
    var root = document.getElementById('replayRoot');
    root.innerHTML = '<div class="replay-layout">' +
      '<div class="replay-toolbar"><select id="replayRoundSelect" aria-label="局を選択">' + roundOptions + '</select>' +
      '<label><input type="checkbox" id="replayShowAll"' + (showAllHands ? ' checked' : '') + '> 全員の手牌</label></div>' +
      '<div class="replay-table-grid">' + seatHtml('toimen', frame) + seatHtml('kamicha', frame) +
      '<div class="replay-center"><strong>' + escapeReplayText(item.round.title) + ' · ' + (item.step + 1) + '/' + item.round.frames.length + '</strong>' +
      '<span>残り ' + frame.remaining + '枚</span><div>ドラ表示 ' + doraHtml + '</div>' + centerEvent + '</div>' +
      seatHtml('shimocha', frame) + seatHtml('you', frame) + '</div>' +
      '<div class="replay-controls"><button class="btn-secondary" id="replayPrev"' + (cursor === 0 ? ' disabled' : '') + '>← 前へ</button>' +
      '<span class="replay-progress">' + (cursor + 1) + ' / ' + frames.length + '</span>' +
      '<button class="btn-main" id="replayNext"' + (cursor === frames.length - 1 ? ' disabled' : '') + '>次へ →</button></div></div>';
    document.getElementById('replayRoundSelect').addEventListener('change', function () {
      var selectedRound = replay.rounds[Number(this.value)];
      var target = frames.findIndex(function (entry) { return entry.round.index === selectedRound.index; });
      if (target >= 0) { cursor = target; draw(); }
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
      document.body.classList.remove('replay-mode');
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

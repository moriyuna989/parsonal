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
    hands: {}, rivers: {}, melds: {}, riichi: {}, riichiTurns: {}, winds: {},
    drawSeat: G.replayDrawSeat || null,
    drawTile: G.replayDrawTile || null,
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
    frame.riichiTurns[seat] = Number.isFinite(p.riichiTurn) ? p.riichiTurn : null;
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

function ensureResponsiveStyles() {
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
    '.replay-strip{display:flex;align-items:flex-end;gap:2px;width:100%;min-width:0;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;touch-action:pan-x pan-y pinch-zoom}' +
    '.replay-strip .tile{font-size:clamp(15px,2.4vw,25px);padding:1px;flex:0 0 auto}' +
    '.replay-river-label{font-size:10px;color:var(--ink-soft)}.replay-melds{min-height:0;overflow:hidden}.replay-melds .meld-group{padding:1px 2px;gap:1px}.replay-melds .meld-group .tile{font-size:16px}' +
    '.replay-center{grid-area:center;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:4px;font-size:12px;color:var(--ink-soft);overflow:hidden}' +
    '.replay-center .tile{font-size:clamp(18px,3vw,28px);padding:1px}' +
    '.replay-center-event{max-width:100%;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;color:var(--ink)}' +
    '.replay-outcome{font-weight:800;color:var(--ink)}' +
    '.replay-controls button{padding:8px 16px}.replay-progress{font-size:12px;font-weight:700;white-space:nowrap}' +
    '.ron-kb-guide{margin:0 2px}' +
    '@media(max-width:760px){body.game-mode{padding:8px 10px;overflow-x:hidden}.game-mode .stage{gap:10px}.game-mode .masthead h1{font-size:22px}.game-mode #tgRoot,.game-mode #tgRoot>.card{min-width:0;max-width:100%}.game-mode .card{padding:12px;gap:8px;border-radius:14px}.game-mode .table-grid{grid-template-columns:minmax(0,1fr) minmax(100px,.7fr) minmax(0,1fr);gap:4px}.game-mode .table-grid>*{min-width:0}.game-mode .opp-block{min-width:0;overflow:hidden;padding:5px 6px;gap:3px;border-radius:10px}.game-mode .opp-head{font-size:10px;gap:3px}.game-mode .opp-river{grid-template-columns:repeat(6,minmax(0,1fr));gap:1px}.game-mode .opp-river .tile{font-size:clamp(13px,4vw,18px);padding:0}.game-mode .seat-center{font-size:10px;gap:3px;padding:3px 0;min-width:0}.game-mode .seat-center .kyoku-line{font-size:16px}.game-mode .seat-center .dora-mini{gap:3px;flex-wrap:wrap;justify-content:center}.game-mode .seat-center .dora-mini .tile{font-size:18px}.game-mode .you-block,.game-mode .hand-row,.game-mode .you-melds{min-width:0;max-width:100%}.game-mode .you-block{gap:6px;padding-top:8px}.game-mode .hand-row{flex-wrap:nowrap;overflow-x:auto;gap:2px;padding:4px 2px 8px;scrollbar-width:thin}.game-mode .hand-row .tile{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;min-width:30px;min-height:38px;font-size:clamp(22px,7vw,32px);padding:1px}.game-mode .hand-row .tile.drawn{margin-left:8px}.game-mode .meld-group .tile{font-size:20px}.game-mode .tg-controls{gap:6px}.game-mode .tg-controls button{min-height:44px;flex:1 1 120px}.game-mode .call-prompt{padding:10px 12px;gap:8px}.game-mode .legend-row{gap:8px}.game-mode .kb-guide{font-size:10px}}' +
    '@media(max-width:760px) and (orientation:portrait){body.game-mode{padding:8px 4px}.game-mode .stage{width:100%;max-width:none}.game-mode #tgRoot>.card{padding:8px 6px}.game-mode .hand-row,.game-mode .opp-river,.game-mode .you-melds{width:100%;min-width:0;max-width:100%;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;touch-action:pan-x pan-y pinch-zoom}.game-mode .hand-row{display:flex;flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;box-sizing:border-box}.game-mode .opp-river{display:flex;flex-wrap:nowrap;justify-content:flex-start;overflow-x:auto;overflow-y:hidden;box-sizing:border-box}.game-mode .opp-river>.tile{flex:0 0 auto}.game-mode .you-melds{flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden}}' +
    '@media(max-height:500px) and (orientation:landscape){body.game-mode{height:100dvh;min-height:0;overflow:hidden;padding:2px 6px;box-sizing:border-box}body.game-mode>#app{height:100%;min-height:0;width:100%}.game-mode .stage{height:100%;min-height:0;max-width:none;gap:3px}.game-mode .topbar .back-link{font-size:11px}.game-mode .masthead{gap:0}.game-mode .masthead .eyebrow{display:none}.game-mode .masthead h1{font-size:16px}.game-mode #tgRoot{flex:1;min-height:0;overflow:hidden}.game-mode #tgRoot>.card{height:100%;min-height:0;padding:5px;gap:4px;border-radius:9px;overflow:hidden}.game-mode .settings-row{font-size:10px}.game-mode .settings-row span{padding:2px 7px!important;font-size:10px!important}.game-mode .table-grid{flex:1;min-height:0;grid-template-columns:minmax(0,1fr) minmax(100px,.7fr) minmax(0,1fr);grid-template-rows:minmax(0,1fr) auto minmax(0,1fr);gap:3px}.game-mode .opp-block{padding:3px 4px;gap:2px;border-radius:7px}.game-mode .opp-head{font-size:9px;gap:2px}.game-mode .badge-oya,.game-mode .badge-wind,.game-mode .badge-riichi{font-size:9px;padding:1px 4px}.game-mode .opp-river{grid-template-columns:repeat(9,minmax(0,1fr));gap:0;min-height:0}.game-mode .opp-river .tile{font-size:clamp(12px,3.7vh,17px);padding:0;line-height:1}.game-mode .opp-river .tile.riichi-tile{margin:0 2px}.game-mode .seat-center{font-size:9px;gap:1px;padding:1px 0}.game-mode .seat-center .kyoku-line{font-size:14px}.game-mode .seat-center .dora-mini{gap:1px;flex-wrap:wrap;justify-content:center}.game-mode .seat-center .dora-mini .tile{font-size:16px}.game-mode .seat-center .wall-row{display:none}.game-mode .you-block{gap:2px;padding-top:3px}.game-mode .you-head{gap:2px}.game-mode .you-melds{flex-wrap:nowrap;overflow-x:auto;gap:3px}.game-mode .meld-group{padding:1px 2px;gap:1px}.game-mode .meld-group .tile{font-size:16px}.game-mode .meld-col.horizontal{width:21px;height:16px}.game-mode .meld-col.horizontal.kakan{height:31px}.game-mode .hand-row{flex-wrap:nowrap;overflow-x:auto;gap:1px;padding:2px 1px 4px;scrollbar-width:thin}.game-mode .hand-row .tile{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;min-width:26px;min-height:31px;font-size:clamp(18px,4vh,25px);padding:0}.game-mode .hand-row .tile.drawn{margin-left:5px}.game-mode .legend-row{display:none}.game-mode .tg-controls{gap:4px}.game-mode .tg-controls button{min-height:34px;padding:5px 8px;font-size:12px;flex:0 1 auto}.game-mode .call-prompt{padding:5px 8px;gap:4px}.game-mode .call-prompt-title{font-size:11px}.game-mode .call-prompt .tg-controls button{min-height:32px}.game-mode .ron-kb-guide{display:none}.game-mode .processing-note{padding:2px;font-size:11px}.game-mode.game-over-mode #tgRoot>.card{overflow-y:auto}.game-mode.game-over-mode #tgRoot>.card .table-grid{flex:none}.game-mode.game-over-mode #tgRoot>.card .reveal-box{padding:8px;gap:5px}.game-mode.game-over-mode #tgRoot>.card .score-total{font-size:17px}}' +
    '@media(max-width:600px) and (orientation:portrait){body.replay-mode{height:auto;min-height:100dvh;overflow-x:hidden;overflow-y:auto;padding:0 5px}body.replay-mode>#app{height:auto;min-height:100dvh}.replay-stage{height:auto!important;min-height:100dvh!important}#replayRoot{flex:initial;overflow:visible}.replay-layout{height:auto;min-height:0}.replay-table-grid{min-height:450px}}' +
    '@media(max-height:500px) and (orientation:landscape){body.replay-mode{padding:0 6px}.replay-stage{gap:2px;padding:2px 0}.replay-stage .topbar .back-link{font-size:11px}.replay-stage .masthead h1{font-size:16px}.replay-toolbar select{padding:3px 6px;font-size:11px}.replay-toolbar label{font-size:10px}.replay-table-grid{grid-template-columns:minmax(0,1fr) minmax(90px,.45fr) minmax(0,1fr);grid-template-rows:minmax(0,1fr) minmax(42px,.32fr) minmax(0,1fr);gap:3px}.replay-seat{padding:3px;gap:1px;border-radius:6px}.replay-seat-head{font-size:9px}.replay-strip .tile{font-size:clamp(12px,3.7vh,17px);padding:0}.replay-river-label{font-size:8px}.replay-melds .meld-group .tile{font-size:11px}.replay-center{font-size:9px;gap:1px}.replay-center .tile{font-size:clamp(14px,4vh,19px)}.replay-center-event{-webkit-line-clamp:2}.replay-controls button{padding:4px 10px;font-size:12px}.replay-progress{font-size:10px}}' +
    '@media(max-width:600px) and (orientation:portrait){body.replay-mode{padding:0 5px}.replay-table-grid{grid-template-columns:minmax(0,1fr) minmax(90px,.7fr) minmax(0,1fr);grid-template-rows:minmax(0,1fr) minmax(56px,.52fr) minmax(0,1fr);gap:3px}.replay-seat{padding:3px;border-radius:7px;gap:2px}.replay-seat-head{font-size:10px}.replay-strip .tile{font-size:clamp(13px,4vw,18px);padding:0}.replay-river-label{font-size:9px}.replay-melds .meld-group .tile{font-size:12px}.replay-center{font-size:10px;gap:2px}.replay-center .tile{font-size:clamp(15px,4vw,20px)}.replay-controls button{padding:7px 12px}.replay-toolbar select{max-width:48%;font-size:12px}.replay-toolbar label{font-size:11px}}' +
    '.replay-hand-strip{overflow:visible}.replay-hand-row{display:flex;align-items:flex-end;justify-content:center;gap:0;width:100%;min-width:0;overflow:visible}.replay-concealed-hand{display:flex;align-items:flex-end;justify-content:center;min-width:0;flex:1 1 auto;overflow:visible}.replay-concealed-hand .tile{flex:1 1 0;min-width:0;max-width:clamp(22px,5.2vw,42px);font-size:clamp(12px,2.8vw,24px);padding:0}.replay-drawn-tile{flex:0 0 auto;margin-left:clamp(4px,1vw,12px)}.replay-drawn-tile .tile{font-size:clamp(13px,3vw,25px);padding:0}.replay-draw-separator{width:clamp(3px,0.7vw,8px);height:75%;margin-left:clamp(3px,0.8vw,8px);border-left:1px solid var(--line)}.replay-seat-kamicha .replay-hand-row,.replay-seat-shimocha .replay-hand-row{align-items:center}.replay-seat-kamicha .replay-concealed-hand,.replay-seat-shimocha .replay-concealed-hand{gap:0}.replay-seat-kamicha .replay-concealed-hand .tile,.replay-seat-shimocha .replay-concealed-hand .tile{font-size:clamp(10px,2vw,17px);max-width:clamp(16px,3vw,28px)}' +
    '@media(min-width:601px){.replay-table-grid{grid-template-columns:minmax(0,1fr) minmax(90px,.34fr) minmax(0,1fr);grid-template-rows:minmax(0,auto) minmax(64px,.45fr) minmax(0,auto);grid-template-areas:"toimen toimen toimen" "kamicha center shimocha" "you you you"}.replay-seat-toimen .replay-concealed-hand .tile,.replay-seat-you .replay-concealed-hand .tile{font-size:clamp(14px,2.2vw,25px)}}' +
    '@media(max-width:600px) and (orientation:portrait){body.replay-mode{overflow-x:hidden}.replay-table-grid{grid-template-columns:minmax(0,1fr) minmax(64px,.35fr) minmax(0,1fr);grid-template-rows:minmax(0,auto) minmax(48px,.4fr) minmax(0,auto);grid-template-areas:"toimen toimen toimen" "kamicha center shimocha" "you you you";min-height:0}.replay-seat{overflow:hidden}.replay-seat-toimen .replay-concealed-hand .tile,.replay-seat-you .replay-concealed-hand .tile{font-size:clamp(10px,5.2vw,20px)}.replay-drawn-tile .tile{font-size:clamp(11px,5.4vw,21px)}.replay-seat-kamicha .replay-concealed-hand .tile,.replay-seat-shimocha .replay-concealed-hand .tile{font-size:clamp(9px,3.2vw,15px)}}' +
    '@media(max-height:500px) and (orientation:landscape){.replay-table-grid{grid-template-columns:minmax(0,1fr) minmax(70px,.34fr) minmax(0,1fr);grid-template-rows:minmax(0,auto) minmax(42px,.3fr) minmax(0,auto);grid-template-areas:"toimen toimen toimen" "kamicha center shimocha" "you you you"}.replay-seat-toimen .replay-concealed-hand .tile,.replay-seat-you .replay-concealed-hand .tile{font-size:clamp(10px,3.6vh,18px)}.replay-drawn-tile .tile{font-size:clamp(11px,3.8vh,19px)}.replay-seat-kamicha .replay-concealed-hand .tile,.replay-seat-shimocha .replay-concealed-hand .tile{font-size:clamp(8px,2.4vh,13px)}}' +
    '.replay-layout{grid-template-rows:auto auto auto;align-content:start}.replay-table-grid{grid-template-rows:auto auto auto;align-content:start}.replay-drawn-tile{display:flex;align-items:flex-end;gap:2px}.replay-draw-label{font-size:9px;line-height:1;color:var(--ink-soft);writing-mode:vertical-rl}.replay-river{overflow-y:visible;padding:3px 0}.replay-river .tile.riichi-tile{transform:rotate(90deg);margin:0 7px;border-color:#ff3b30!important;background:rgba(255,59,48,.08);box-shadow:0 0 0 2px #ff3b30,0 2px 10px rgba(255,59,48,.4);position:relative;z-index:2}.replay-river .tile.latest{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent),0 2px 6px -1px rgba(0,0,0,.25)}';
  document.head.appendChild(style);
}

function openLastReplay() {
  var replay = loadLastReplay();
  if (!replay) return;
  if (window._tgKeyHandler) {
    window.removeEventListener('keydown', window._tgKeyHandler);
    window._tgKeyHandler = null;
  }
  if (window._replayKeyHandler) {
    window.removeEventListener('keydown', window._replayKeyHandler);
    window._replayKeyHandler = null;
  }
  ensureResponsiveStyles();
  document.body.classList.remove('game-mode', 'game-over-mode');
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
  function moveReplay(delta) {
    var next = cursor + delta;
    if (next < 0 || next >= frames.length || next === cursor) return;
    cursor = next;
    draw();
  }
  var seats = ['you', 'p2', 'p3', 'p4'];
  var viewerIndex = seats.indexOf(replay.viewerSeat);
  if (viewerIndex < 0) viewerIndex = 0;
  var seatByPosition = {
    you: seats[viewerIndex],
    shimocha: seats[(viewerIndex + 1) % 4],
    toimen: seats[(viewerIndex + 2) % 4],
    kamicha: seats[(viewerIndex + 3) % 4]
  };

  var inferredDraws = {};
  function countTiles(list) {
    var counts = {};
    (list || []).forEach(function (tile) { counts[tile] = (counts[tile] || 0) + 1; });
    return counts;
  }
  function inferDrawForFrame(frameIndex) {
    if (Object.prototype.hasOwnProperty.call(inferredDraws, frameIndex)) return inferredDraws[frameIndex];
    var current = frames[frameIndex] && frames[frameIndex].frame;
    if (!current) return inferredDraws[frameIndex] = null;
    if (current.drawSeat && current.drawTile) {
      return inferredDraws[frameIndex] = { seat: current.drawSeat, tile: current.drawTile };
    }
    var previousEntry = frameIndex > 0 ? frames[frameIndex - 1] : null;
    var previous = previousEntry && previousEntry.round.index === frames[frameIndex].round.index ? previousEntry.frame : null;
    if (!previous) return inferredDraws[frameIndex] = null;
    var found = null;
    seats.forEach(function (seat) {
      if (found || !current.hands || !previous.hands) return;
      var before = current.hands[seat] || [];
      var prior = previous.hands[seat] || [];
      if (current.turn && current.turn !== seat) return;
      if (before.length !== prior.length + 1) return;
      var priorCounts = countTiles(prior);
      var added = before.filter(function (tile) {
        if (priorCounts[tile]) { priorCounts[tile]--; return false; }
        return true;
      });
      if (added.length !== 1) return;
      var priorRiver = previous.rivers && previous.rivers[seat] || [];
      var currentRiver = current.rivers && current.rivers[seat] || [];
      if (JSON.stringify(priorRiver) !== JSON.stringify(currentRiver)) return;
      found = { seat: seat, tile: added[0] };
    });
    return inferredDraws[frameIndex] = found;
  }
  function drawInfoForFrame(frameIndex) { return inferDrawForFrame(frameIndex); }

  var inferredRiichiTiles = {};
  function riichiIndexForFrame(frameIndex, seat) {
    var key = frameIndex + ':' + seat;
    if (Object.prototype.hasOwnProperty.call(inferredRiichiTiles, key)) return inferredRiichiTiles[key];
    var current = frames[frameIndex] && frames[frameIndex].frame;
    if (!current || !current.riichi || !current.riichi[seat]) return inferredRiichiTiles[key] = null;
    var storedTurn = current.riichiTurns && current.riichiTurns[seat];
    if (Number.isFinite(storedTurn) && storedTurn > 0) return inferredRiichiTiles[key] = storedTurn - 1;
    var currentRound = frames[frameIndex].round.index;
    for (var i = frameIndex; i > 0; i--) {
      if (frames[i].round.index !== currentRound || frames[i - 1].round.index !== currentRound) break;
      var candidate = frames[i].frame;
      var previous = frames[i - 1].frame;
      if (candidate.riichi && candidate.riichi[seat] && !(previous.riichi && previous.riichi[seat])) {
        var river = candidate.rivers && candidate.rivers[seat] || [];
        return inferredRiichiTiles[key] = river.length ? river.length - 1 : null;
      }
    }
    return inferredRiichiTiles[key] = null;
  }

  function seatLabel(seat) {
    if (seat === replay.viewerSeat) return 'あなた';
    return escapeReplayText((replay.names || {})[seat] || SEAT_NAME[seat] || seat);
  }
  function replayTile(code, frame, extraClass) {
    var isDora = (frame.dora || []).some(function (indicator) { return isSameTileType(code, nextTile(indicator)); });
    var classes = [];
    if (isDora) classes.push('dora-tile');
    if (extraClass) classes.push(extraClass);
    return tileEl(code, classes.join(' '));
  }
  function seatHtml(position, frame, frameIndex) {
    var seat = seatByPosition[position];
    var hand = frame.hands[seat] || [];
    var drawInfo = drawInfoForFrame(frameIndex);
    var drawnTile = drawInfo && drawInfo.seat === seat ? drawInfo.tile : null;
    var concealedHand = hand.slice();
    if (drawnTile) {
      var drawnIndex = concealedHand.indexOf(drawnTile);
      if (drawnIndex !== -1) concealedHand.splice(drawnIndex, 1);
      else drawnTile = null;
    }
    var handHtml = showAllHands || seat === replay.viewerSeat
      ? '<div class="replay-hand-row"><div class="replay-concealed-hand">' + sortTiles(concealedHand).map(function (tile) { return replayTile(tile, frame); }).join('') + '</div>' +
        (drawnTile ? '<span class="replay-draw-separator" aria-hidden="true"></span><div class="replay-drawn-tile"><span class="replay-draw-label">ツモ</span>' + replayTile(drawnTile, frame) + '</div>' : '') + '</div>'
      : '<span style="color:var(--ink-soft);font-size:11px;">手牌 ' + hand.length + '枚</span>';
    var meldHtml = (frame.melds[seat] || []).length
      ? '<div class="replay-melds">' + renderMeldsHtml(frame.melds[seat], seat, 'compact', function (tile) { return replayTile(tile, frame); }) + '</div>' : '';
    var riichiIndex = riichiIndexForFrame(frameIndex, seat);
    var riverHtml = (frame.rivers[seat] || []).map(function (tile, index) {
      return replayTile(tile, frame, index === riichiIndex ? 'riichi-tile' : '');
    }).join('');
    var score = Number(frame.scores[seat] || 0).toLocaleString();
    return '<section class="replay-seat replay-seat-' + position + '">' +
      '<div class="replay-seat-head">' + seatLabel(seat) + ' ' + escapeReplayText(frame.winds[seat] || '') + '家' +
      (frame.dealer === seat ? ' 親' : '') + (frame.riichi[seat] ? ' リーチ' : '') +
      (frame.turn === seat && !frame.gameOver ? ' 手番' : '') + ' · ' + score + '点</div>' +
      '<div class="replay-strip replay-hand-strip" aria-label="' + seatLabel(seat) + 'の手牌">' + handHtml + '</div>' + meldHtml +
      '<div class="replay-river-label">捨て牌</div><div class="replay-strip replay-river" aria-label="' + seatLabel(seat) + 'の捨て牌">' + riverHtml + '</div></section>';
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
      '<div class="replay-table-grid">' + seatHtml('toimen', frame, cursor) + seatHtml('kamicha', frame, cursor) +
      '<div class="replay-center"><strong>' + escapeReplayText(item.round.title) + ' · ' + (item.step + 1) + '/' + item.round.frames.length + '</strong>' +
      '<span>残り ' + frame.remaining + '枚</span><div>ドラ表示 ' + doraHtml + '</div>' + centerEvent + '</div>' +
      seatHtml('shimocha', frame, cursor) + seatHtml('you', frame, cursor) + '</div>' +
      '<div class="replay-controls"><button class="btn-secondary" id="replayPrev"' + (cursor === 0 ? ' disabled' : '') + '>← 前へ</button>' +
      '<span class="replay-progress">' + (cursor + 1) + ' / ' + frames.length + '</span>' +
      '<button class="btn-main" id="replayNext"' + (cursor === frames.length - 1 ? ' disabled' : '') + '>次へ →</button></div></div>';
    document.getElementById('replayRoundSelect').addEventListener('change', function () {
      var selectedRound = replay.rounds[Number(this.value)];
      var target = frames.findIndex(function (entry) { return entry.round.index === selectedRound.index; });
      if (target >= 0) { cursor = target; draw(); }
    });
    document.getElementById('replayShowAll').addEventListener('change', function () { showAllHands = this.checked; draw(); });
    document.getElementById('replayPrev').addEventListener('click', function () { moveReplay(-1); });
    document.getElementById('replayNext').addEventListener('click', function () { moveReplay(1); });
  }
  window._replayKeyHandler = function (event) {
    var target = event.target;
    var tag = target && target.tagName ? target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'select' || tag === 'textarea' || (target && target.isContentEditable)) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      moveReplay(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      moveReplay(-1);
    }
  };
  window.addEventListener('keydown', window._replayKeyHandler);
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
      if (window._replayKeyHandler) {
        window.removeEventListener('keydown', window._replayKeyHandler);
        window._replayKeyHandler = null;
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
  document.body.classList.remove('game-mode', 'game-over-mode', 'replay-mode');
  if (window._replayKeyHandler) {
    window.removeEventListener('keydown', window._replayKeyHandler);
    window._replayKeyHandler = null;
  }
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
        '<div class="settings-option' + (practiceConfig.cpuLevel === 'hard' ? ' selected' : '') + '" data-val="hard">上級<span class="opt-sub">仲林選手を参考にした押し引き学習（推奨）</span></div>' +
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

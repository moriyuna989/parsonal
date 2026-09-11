// =====================================================================
// js/online_game.js
// オンライン通信対局・ロビーUI・P2Pゲーム同期・CPU自動補完
// =====================================================================

var OnlineGame = (function () {
  var isOnline = false;
  var mySeat = 'you'; // 'you' (ホスト), 'p2', 'p3', 'p4'
  var myName = 'プレイヤー';
  var seatsConfig = [
    { seat: 'you', name: 'ホスト', id: null, isCpu: false },
    { seat: 'p2', name: 'CPU (下家)', id: null, isCpu: true },
    { seat: 'p3', name: 'CPU (対面)', id: null, isCpu: true },
    { seat: 'p4', name: 'CPU (上家)', id: null, isCpu: true }
  ];
  var matchSettings = {
    rounds: 4,
    redDora: true,
    cpuLevel: 'hard'
  };

  function getAppEl() {
    return document.getElementById('app');
  }

  // オンラインモード開始（ロビー画面を表示）
  function openOnlineLobby() {
    isOnline = true;
    if (OnlinePeer.getMyId()) {
      renderLobby();
    } else {
      renderEntryMenu();
    }
  }

  // 部屋作成または参加を選ぶ初期画面
  function renderEntryMenu() {
    var app = getAppEl();
    app.innerHTML = shellHtml('ONLINE MULTIPLAYER', '通信対戦（オンライン）', 'onlineRoot');
    wireBack();

    var root = document.getElementById('onlineRoot');
    root.innerHTML = '<div class="online-lobby-card">' +
      '<div class="online-lobby-title">オンライン麻雀対局</div>' +
      '<div class="settings-desc">離れた友達と一緒に麻雀をプレイできます。足りない席はCPUが自動で参戦します。</div>' +
      '<div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-top:20px;">' +
        '<div style="background:var(--surface-alt); border:1px solid var(--line); border-radius:12px; padding:20px; text-align:center;">' +
          '<h3 style="margin-top:0; color:var(--ink);">新しい部屋を作る</h3>' +
          '<p style="font-size:12px; color:var(--ink-soft); margin-bottom:16px;">あなたがホストとなり、部屋コードを発行して友達を招待します。</p>' +
          '<button class="btn-main" id="btnCreateRoom" style="width:100%;">部屋を作成する</button>' +
        '</div>' +
        '<div style="background:var(--surface-alt); border:1px solid var(--line); border-radius:12px; padding:20px; text-align:center;">' +
          '<h3 style="margin-top:0; color:var(--ink);">部屋に参加する</h3>' +
          '<p style="font-size:12px; color:var(--ink-soft); margin-bottom:12px;">友達から教えてもらった部屋コードを入力してください。</p>' +
          '<input type="text" id="inputRoomCode" placeholder="部屋コード (例: A8K2)" maxlength="8" style="width:100%; padding:10px; font-size:16px; font-weight:700; text-align:center; text-transform:uppercase; border:1px solid var(--line); border-radius:8px; margin-bottom:12px; box-sizing:border-box;" />' +
          '<button class="btn-secondary" id="btnJoinRoom" style="width:100%;">部屋に入る</button>' +
        '</div>' +
      '</div>' +
      '<div id="onlineStatusMsg" style="margin-top:16px; text-align:center; font-size:13px; font-weight:700; color:var(--accent);"></div>' +
    '</div>';

    document.getElementById('btnCreateRoom').addEventListener('click', handleCreateRoom);
    document.getElementById('btnJoinRoom').addEventListener('click', handleJoinRoom);
  }

  function handleCreateRoom() {
    var status = document.getElementById('onlineStatusMsg');
    if (status) status.innerText = '部屋を作成中…通信を初期化しています';

    OnlinePeer.createRoom(null, function (code) {
      mySeat = 'you';
      myName = 'ホスト（あなた）';
      seatsConfig = [
        { seat: 'you', name: 'あなた (ホスト)', id: OnlinePeer.getMyId(), isCpu: false },
        { seat: 'p2', name: 'CPU (下家)', id: null, isCpu: true },
        { seat: 'p3', name: 'CPU (対面)', id: null, isCpu: true },
        { seat: 'p4', name: 'CPU (上家)', id: null, isCpu: true }
      ];
      setupHostPeerListeners();
      renderLobby();
    }, function (err) {
      if (status) status.innerText = '部屋の作成に失敗しました: ' + err;
    });
  }

  function handleJoinRoom() {
    var input = document.getElementById('inputRoomCode');
    var code = input ? input.value.trim() : '';
    if (!code) {
      alert('部屋コードを入力してください');
      return;
    }
    var status = document.getElementById('onlineStatusMsg');
    if (status) status.innerText = '部屋「' + code + '」に接続中…';

    OnlinePeer.joinRoom(code, function () {
      myName = 'ゲストプレイヤー';
      setupGuestPeerListeners();
      // ホストに参加表明メッセージを送信
      OnlinePeer.sendToHost({
        type: 'REQ_JOIN',
        guestId: OnlinePeer.getMyId()
      });
    }, function (err) {
      if (status) status.innerText = '部屋が見つからないか接続できませんでした。コードを確認してください。';
    });
  }

  // ホスト側の通信リスナー登録
  function setupHostPeerListeners() {
    OnlinePeer.onMessage(function (msg, senderId) {
      if (msg.type === 'REQ_JOIN') {
        // 空いている席を探して割り当てる
        var emptySlot = seatsConfig.find(function (s) { return s.seat !== 'you' && s.isCpu; });
        if (emptySlot) {
          emptySlot.isCpu = false;
          emptySlot.id = senderId;
          emptySlot.name = 'プレイヤー (' + emptySlot.seat.toUpperCase() + ')';
        }
        // 全員にロビー状態をブロードキャスト
        broadcastLobbyState();
        renderLobby();
      } else if (msg.type === 'GUEST_DISCARD') {
        // ゲストからの打牌を受信
        if (msg.seat === G.currentTurnSeat) {
          executeOnlineDiscard(msg.seat, msg.tile, msg.riichi);
        }
      } else if (msg.type === 'GUEST_CALL_DECISION') {
        handleOnlineCallDecision(msg.seat, msg.decision);
      }
    });

    OnlinePeer.onPeerLeft(function (peerId) {
      var slot = seatsConfig.find(function (s) { return s.id === peerId; });
      if (slot) {
        slot.isCpu = true;
        slot.id = null;
        slot.name = 'CPU (' + slot.seat.toUpperCase() + ')';
        broadcastLobbyState();
        renderLobby();
      }
    });
  }

  // ゲスト側の通信リスナー登録
  function setupGuestPeerListeners() {
    OnlinePeer.onMessage(function (msg) {
      if (msg.type === 'LOBBY_STATE') {
        seatsConfig = msg.seatsConfig;
        matchSettings = msg.matchSettings;
        var mySlot = seatsConfig.find(function (s) { return s.id === OnlinePeer.getMyId(); });
        if (mySlot) mySeat = mySlot.seat;
        renderLobby();
      } else if (msg.type === 'ONLINE_START_MATCH') {
        handleGuestStartMatch(msg);
      } else if (msg.type === 'ONLINE_SYNC_TURN') {
        handleGuestSyncTurn(msg);
      } else if (msg.type === 'ONLINE_ROUND_OVER') {
        handleGuestRoundOver(msg);
      }
    });
  }

  function broadcastLobbyState() {
    OnlinePeer.broadcast({
      type: 'LOBBY_STATE',
      seatsConfig: seatsConfig,
      matchSettings: matchSettings
    });
  }

  // 待合室（ロビー）UIの描画
  function renderLobby() {
    var app = getAppEl();
    app.innerHTML = shellHtml('ONLINE LOBBY', 'オンライン待合室', 'onlineRoot');
    wireBack();

    var isHost = OnlinePeer.isHost();
    var code = OnlinePeer.getRoomCode();

    var slotsHtml = seatsConfig.map(function (s) {
      var isMe = (s.seat === mySeat);
      var tagHtml = s.seat === 'you'
        ? '<span class="online-player-tag host">ホスト</span>'
        : (s.isCpu ? '<span class="online-player-tag cpu">CPU</span>' : '<span class="online-player-tag you">参加中</span>');
      var seatNames = { you: '東家 (親)', p2: '南家', p3: '対面 (西)', p4: '上家 (北)' };
      return '<div class="online-player-slot ' + (!s.isCpu ? 'occupied' : '') + '">' +
        '<div><div class="online-player-seat">' + seatNames[s.seat] + '</div>' +
        '<div class="online-player-name">' + s.name + (isMe ? ' (あなた)' : '') + '</div></div>' +
        tagHtml +
        '</div>';
    }).join('');

    var hostControlsHtml = '';
    if (isHost) {
      hostControlsHtml = '<div class="settings-group" style="margin-top:20px;">' +
        '<div class="settings-label">局数（試合の長さ）</div>' +
        '<div class="settings-options" id="onlineOptRounds">' +
          '<div class="settings-option' + (matchSettings.rounds === 1 ? ' selected' : '') + '" data-val="1">一局戦</div>' +
          '<div class="settings-option' + (matchSettings.rounds === 4 ? ' selected' : '') + '" data-val="4">東風戦（推奨）</div>' +
          '<div class="settings-option' + (matchSettings.rounds === 8 ? ' selected' : '') + '" data-val="8">半荘戦</div>' +
        '</div>' +
      '</div>' +
      '<div class="settings-group">' +
        '<div class="settings-label">CPUレベル（足りない席に入るAI）</div>' +
        '<div class="settings-options" id="onlineOptCpu">' +
          '<div class="settings-option' + (matchSettings.cpuLevel === 'easy' ? ' selected' : '') + '" data-val="easy">初級</div>' +
          '<div class="settings-option' + (matchSettings.cpuLevel === 'normal' ? ' selected' : '') + '" data-val="normal">中級</div>' +
          '<div class="settings-option' + (matchSettings.cpuLevel === 'hard' ? ' selected' : '') + '" data-val="hard">上級（仲林プロAI）</div>' +
        '</div>' +
      '</div>' +
      '<button class="btn-main" id="btnStartOnlineMatch" style="width:100%; margin-top:16px; padding:14px; font-size:16px;">対局を開始する（空き席はCPU）</button>';
    } else {
      hostControlsHtml = '<div style="text-align:center; padding:20px; color:var(--ink-soft); font-weight:700;">' +
        '<div class="online-badge-sync" style="margin-bottom:8px;">接続完了</div>' +
        '<div>ホストが対局を開始するのを待っています…</div></div>';
    }

    var root = document.getElementById('onlineRoot');
    root.innerHTML = '<div class="online-lobby-card">' +
      '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">' +
        '<div class="online-lobby-title">部屋コード: ' + code + '</div>' +
        '<div class="online-badge-sync">オンライン接続中</div>' +
      '</div>' +
      '<div class="online-room-code-box">' +
        '<div><div class="online-room-code-label">友達にこのコードを教えてください</div>' +
        '<div class="online-room-code-val">' + code + '</div></div>' +
        '<button class="online-btn-copy" id="btnCopyCode">コードをコピー</button>' +
      '</div>' +
      '<div style="font-size:13px; font-weight:700; color:var(--ink); margin-bottom:8px;">参加者スロット（全4席）</div>' +
      '<div class="online-player-list">' + slotsHtml + '</div>' +
      hostControlsHtml +
      '</div>';

    document.getElementById('btnCopyCode').addEventListener('click', function () {
      navigator.clipboard.writeText(code).then(function () {
        alert('部屋コード「' + code + '」をクリップボードにコピーしました！');
      });
    });

    if (isHost) {
      var roundOpts = root.querySelectorAll('#onlineOptRounds .settings-option');
      roundOpts.forEach(function (el) {
        el.addEventListener('click', function () {
          roundOpts.forEach(function (o) { o.classList.remove('selected'); });
          el.classList.add('selected');
          matchSettings.rounds = parseInt(el.getAttribute('data-val'), 10);
          broadcastLobbyState();
        });
      });

      var cpuOpts = root.querySelectorAll('#onlineOptCpu .settings-option');
      cpuOpts.forEach(function (el) {
        el.addEventListener('click', function () {
          cpuOpts.forEach(function (o) { o.classList.remove('selected'); });
          el.classList.add('selected');
          matchSettings.cpuLevel = el.getAttribute('data-val');
          broadcastLobbyState();
        });
      });

      document.getElementById('btnStartOnlineMatch').addEventListener('click', startOnlineMatchAsHost);
    }
  }

  // ホストが対局開始をクリックした時の処理
  function startOnlineMatchAsHost() {
    var app = getAppEl();
    app.innerHTML = shellHtml('ONLINE MATCH', '通信対戦（実践編）', 'tgRoot');
    wireBack();

    var match = {
      rounds: matchSettings.rounds,
      redDora: matchSettings.redDora,
      cpuLevel: matchSettings.cpuLevel,
      kyokuIndex: 1,
      maxKyoku: matchSettings.rounds,
      roundName: matchSettings.rounds === 1 ? '一局戦' : (matchSettings.rounds === 4 ? '東風戦' : '半荘戦'),
      kyokuWind: '東',
      kyokuNum: 1,
      honba: 0,
      riichiPool: 0,
      scores: { you: 25000, p2: 25000, p3: 25000, p4: 25000 },
      dealerSeat: 'you'
    };

    initTraining('practice', match);

    // 各ゲストへ対局開始通知（自分の手牌のみ安全に配信）
    seatsConfig.forEach(function (slot) {
      if (slot.seat !== 'you' && !slot.isCpu && slot.id) {
        OnlinePeer.sendTo(slot.id, {
          type: 'ONLINE_START_MATCH',
          seat: slot.seat,
          hand: G.players[slot.seat].hand,
          doraIndicator: G.doraIndicator,
          matchState: match,
          dealerSeat: G.dealerSeat,
          currentTurnSeat: G.currentTurnSeat,
          seatsConfig: seatsConfig
        });
      }
    });

    syncOnlineStateToAll();
  }

  // ゲスト側が対局開始通知を受信した時の処理
  function handleGuestStartMatch(msg) {
    var app = getAppEl();
    app.innerHTML = shellHtml('ONLINE MATCH', '通信対戦（実践編）', 'tgRoot');
    wireBack();

    mySeat = msg.seat;
    matchState = msg.matchState;
    gameMode = 'practice';
    isPractice = true;
    seatsConfig = msg.seatsConfig;

    G = {
      pool: new Array(34).fill(0),
      players: {
        you: { hand: [], river: [], isTenpai: false, wait: [], riichi: false, melds: [] },
        p2: { hand: [], river: [], isTenpai: false, wait: [], riichi: false, melds: [] },
        p3: { hand: [], river: [], isTenpai: false, wait: [], riichi: false, melds: [] },
        p4: { hand: [], river: [], isTenpai: false, wait: [], riichi: false, melds: [] }
      },
      doraIndicator: msg.doraIndicator,
      doraIndicators: [msg.doraIndicator],
      currentTurnSeat: msg.currentTurnSeat,
      dealerSeat: msg.dealerSeat,
      seatWind: { you: '東', p2: '南', p3: '西', p4: '北' },
      kyokuWind: msg.matchState.kyokuWind,
      kyokuNumber: msg.matchState.kyokuNum,
      honba: msg.matchState.honba,
      log: ['オンライン対局を開始しました。あなたは ' + mySeat.toUpperCase() + ' 家です。'],
      processing: (msg.currentTurnSeat !== mySeat),
      gameOver: false,
      outcome: null,
      justDrew: (msg.currentTurnSeat === mySeat)
    };
    G.players[mySeat].hand = msg.hand;

    render();
  }

  // ホストが打牌を処理し、全員に同期する
  function executeOnlineDiscard(seat, tileCode, viaRiichi) {
    afterUserDiscard(tileCode, viaRiichi);
    syncOnlineStateToAll();
  }

  // 状態の同期ブロードキャスト
  function syncOnlineStateToAll() {
    if (!OnlinePeer.isHost() || !G) return;

    seatsConfig.forEach(function (slot) {
      if (slot.seat !== 'you' && !slot.isCpu && slot.id) {
        OnlinePeer.sendTo(slot.id, {
          type: 'ONLINE_SYNC_TURN',
          currentTurnSeat: G.currentTurnSeat,
          rivers: {
            you: G.players.you.river,
            p2: G.players.p2.river,
            p3: G.players.p3.river,
            p4: G.players.p4.river
          },
          melds: {
            you: G.players.you.melds,
            p2: G.players.p2.melds,
            p3: G.players.p3.melds,
            p4: G.players.p4.melds
          },
          riichiStates: {
            you: G.players.you.riichi,
            p2: G.players.p2.riichi,
            p3: G.players.p3.riichi,
            p4: G.players.p4.riichi
          },
          lastDiscardSeat: G.lastDiscardSeat,
          lastTile: G.players[G.lastDiscardSeat] ? G.players[G.lastDiscardSeat].river.slice(-1)[0] : null,
          doraIndicators: G.doraIndicators,
          remainingPool: poolTotal(G.pool),
          scores: matchState ? matchState.scores : null,
          riichiPool: matchState ? matchState.riichiPool : 0
        });
      }
    });
  }

  function handleGuestSyncTurn(msg) {
    if (!G) return;
    G.currentTurnSeat = msg.currentTurnSeat;
    G.doraIndicators = msg.doraIndicators;
    G.lastDiscardSeat = msg.lastDiscardSeat;
    SEATS.forEach(function (s) {
      if (G.players[s]) {
        G.players[s].river = msg.rivers[s] || [];
        G.players[s].melds = msg.melds[s] || [];
        G.players[s].riichi = msg.riichiStates[s] || false;
      }
      if (matchState && msg.scores) {
        matchState.scores[s] = msg.scores[s];
      }
    });
    if (matchState) matchState.riichiPool = msg.riichiPool;

    G.processing = (G.currentTurnSeat !== mySeat);
    render();
  }

  function handleGuestRoundOver(msg) {
    if (!G) return;
    G.gameOver = true;
    G.outcome = msg.outcome;
    SEATS.forEach(function (s) {
      if (G.players[s] && msg.allHands && msg.allHands[s]) {
        G.players[s].hand = msg.allHands[s];
      }
    });
    render();
  }

  return {
    openOnlineLobby: openOnlineLobby,
    isOnline: function () { return isOnline; },
    getMySeat: function () { return mySeat; },
    syncOnlineStateToAll: syncOnlineStateToAll
  };
})();

window.OnlineGame = OnlineGame;

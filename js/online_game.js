// =====================================================================
// js/online_game.js
// オンライン通信対局・ロビーUI・P2Pゲーム同期・CPU自動補完
// =====================================================================

var OnlineGame = (function () {
  var isOnline = false;
  var myLogicalSeat = 'you'; // ホストは 'you'、ゲストは 'p2', 'p3', 'p4'
  var myName = 'プレイヤー';
  var SEATS_ORDER = ['you', 'p2', 'p3', 'p4'];

  var seatsConfig = [
    { seat: 'you', name: 'ホスト（あなた）', id: null, isCpu: false },
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

  // 論理席（ホスト基準） <-> ゲストのローカル席（常に'you'が手前）の相対変換
  function logicalToLocalSeat(logicalSeat) {
    if (OnlinePeer.isHost() || !myLogicalSeat) return logicalSeat;
    var myIdx = SEATS_ORDER.indexOf(myLogicalSeat);
    var logIdx = SEATS_ORDER.indexOf(logicalSeat);
    if (myIdx === -1 || logIdx === -1) return logicalSeat;
    var localIdx = (logIdx - myIdx + 4) % 4;
    return SEATS_ORDER[localIdx];
  }

  function localToLogicalSeat(localSeat) {
    if (OnlinePeer.isHost() || !myLogicalSeat) return localSeat;
    var myIdx = SEATS_ORDER.indexOf(myLogicalSeat);
    var locIdx = SEATS_ORDER.indexOf(localSeat);
    if (myIdx === -1 || locIdx === -1) return localSeat;
    var logIdx = (myIdx + locIdx) % 4;
    return SEATS_ORDER[logIdx];
  }

  // 指定された論理席がゲスト（人間の参加者）かどうか判定（ホスト側用）
  function isGuestSeat(logicalSeat) {
    if (!OnlinePeer.isHost()) return false;
    var slot = seatsConfig.find(function (s) { return s.seat === logicalSeat; });
    return !!(slot && !slot.isCpu && slot.seat !== 'you');
  }

  // 画面UI表示用の席情報（ローカル席 'you', 'p2', 'p3', 'p4' を受け取って名前とタグ情報を返す）
  function getSeatInfo(localSeat) {
    if (!isOnline) {
      return {
        name: localSeat === 'you' ? 'あなた' : (SEAT_NAME[localSeat] || localSeat),
        isCpu: (localSeat !== 'you'),
        isYou: (localSeat === 'you'),
        isHost: (localSeat === 'you'),
        tagType: (localSeat === 'you') ? 'tag-me' : 'tag-cpu',
        tagText: (localSeat === 'you') ? 'あなた' : 'CPU'
      };
    }

    var logSeat = (!OnlinePeer.isHost()) ? localToLogicalSeat(localSeat) : localSeat;
    var slot = seatsConfig.find(function (s) { return s.seat === logSeat; });
    var isMe = (localSeat === 'you');
    var isHostSlot = (logSeat === 'you');

    if (!slot) {
      return {
        name: SEAT_NAME[localSeat] || localSeat,
        isCpu: true,
        isYou: isMe,
        isHost: isHostSlot,
        tagType: 'tag-cpu',
        tagText: 'CPU'
      };
    }

    if (isMe) {
      return {
        name: 'あなた',
        isCpu: false,
        isYou: true,
        isHost: isHostSlot,
        tagType: 'tag-me',
        tagText: isHostSlot ? 'あなた (ホスト)' : 'あなた'
      };
    }

    if (slot.isCpu) {
      return {
        name: slot.name,
        isCpu: true,
        isYou: false,
        isHost: false,
        tagType: 'tag-cpu',
        tagText: 'CPU'
      };
    }

    return {
      name: slot.name,
      isCpu: false,
      isYou: false,
      isHost: isHostSlot,
      tagType: isHostSlot ? 'tag-host' : 'tag-human',
      tagText: isHostSlot ? '対戦相手 (ホスト)' : '対戦相手'
    };
  }

  // 論理席から表示名を取得（ログ等用）
  function getSeatDisplayName(logicalSeat) {
    var slot = seatsConfig.find(function (s) { return s.seat === logicalSeat; });
    if (slot) return slot.name;
    return SEAT_NAME[logicalSeat] || logicalSeat;
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
      myLogicalSeat = 'you';
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
        var emptySlot = seatsConfig.find(function (s) { return s.seat !== 'you' && s.isCpu; });
        if (emptySlot) {
          emptySlot.isCpu = false;
          emptySlot.id = senderId;
          var seatKanjis = { p2: '南家', p3: '西家', p4: '北家' };
          emptySlot.name = '対戦相手 (' + (seatKanjis[emptySlot.seat] || emptySlot.seat.toUpperCase()) + ')';
        }
        broadcastLobbyState();
        renderLobby();
      } else if (msg.type === 'GUEST_DISCARD') {
        // ゲストからの打牌を受信
        if (typeof executeOnlineGuestDiscard === 'function') {
          executeOnlineGuestDiscard(msg.seat, msg.tile, msg.riichi);
        }
      }
    });

    OnlinePeer.onPeerLeft(function (peerId) {
      var slot = seatsConfig.find(function (s) { return s.id === peerId; });
      if (slot) {
        slot.isCpu = true;
        slot.id = null;
        var seatKanjis = { p2: '南家', p3: '西家', p4: '北家' };
        slot.name = 'CPU (' + (seatKanjis[slot.seat] || slot.seat.toUpperCase()) + ')';
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
        if (mySlot) myLogicalSeat = mySlot.seat;
        renderLobby();
      } else if (msg.type === 'ONLINE_START_MATCH') {
        handleGuestStartMatch(msg);
      } else if (msg.type === 'ONLINE_YOUR_TURN') {
        handleGuestYourTurn(msg);
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
      var isMe = (s.seat === myLogicalSeat);
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

    // 各ゲストへ対局開始通知（配牌を安全に配信）
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

    myLogicalSeat = msg.seat;
    matchState = msg.matchState;
    gameMode = 'practice';
    isPractice = true;
    seatsConfig = msg.seatsConfig;

    var localCurrentTurn = logicalToLocalSeat(msg.currentTurnSeat);
    var localDealerSeat = logicalToLocalSeat(msg.dealerSeat);

    // 相対座席に基づく自風計算
    var seatWinds = {};
    SEATS_ORDER.forEach(function (locSeat) {
      var logSeat = localToLogicalSeat(locSeat);
      var dIdx = SEATS_ORDER.indexOf(msg.dealerSeat);
      var lIdx = SEATS_ORDER.indexOf(logSeat);
      var wIdx = (lIdx - dIdx + 4) % 4;
      var winds = ['東', '南', '西', '北'];
      seatWinds[locSeat] = winds[wIdx];
    });

    // ゲスト視点では、手前（you）に自分の手牌を配置
    G = {
      pool: new Array(34).fill(0),
      players: {
        you: { hand: msg.hand || [], river: [], isTenpai: false, wait: [], riichi: false, melds: [] },
        p2: { hand: [], river: [], isTenpai: false, wait: [], riichi: false, melds: [] },
        p3: { hand: [], river: [], isTenpai: false, wait: [], riichi: false, melds: [] },
        p4: { hand: [], river: [], isTenpai: false, wait: [], riichi: false, melds: [] }
      },
      doraIndicator: msg.doraIndicator,
      doraIndicators: [msg.doraIndicator],
      currentTurnSeat: localCurrentTurn,
      dealerSeat: localDealerSeat,
      seatWind: seatWinds,
      kyokuWind: msg.matchState.kyokuWind,
      kyokuNumber: msg.matchState.kyokuNum,
      honba: msg.matchState.honba,
      log: ['オンライン対局を開始しました。あなたは ' + seatWinds.you + '家 です。'],
      processing: (localCurrentTurn !== 'you'),
      gameOver: false,
      outcome: null,
      justDrew: (localCurrentTurn === 'you'),
      lastDrawn: null
    };

    render();
  }

  // ホスト側：ゲストのツモ番になったことを該当ゲストへ通知
  function notifyGuestTurn(logicalSeat, drawTile) {
    if (!OnlinePeer.isHost() || !G) return;
    var slot = seatsConfig.find(function (s) { return s.seat === logicalSeat; });
    if (!slot || !slot.id) return;

    OnlinePeer.sendTo(slot.id, {
      type: 'ONLINE_YOUR_TURN',
      draw: drawTile,
      doraIndicators: G.doraIndicators,
      remainingPool: poolTotal(G.pool)
    });

    // 他のゲストにもターンの移行と最新卓状態を通知
    syncOnlineStateToAll();
  }

  // ゲスト側：ホストからツモ番通知を受け取った時の処理
  function handleGuestYourTurn(msg) {
    if (!G) return;
    G.currentTurnSeat = 'you';
    if (msg.draw) {
      G.players.you.hand.push(msg.draw);
      G.lastDrawn = msg.draw;
      G.justDrew = true;
      G.log.push('あなたのツモ番です: ' + tileName(msg.draw) + ' をツモりました。');
    }
    G.processing = false;
    if (msg.doraIndicators) G.doraIndicators = msg.doraIndicators;
    render();
  }

  // ゲスト側：牌を切ってホストへ送信
  function sendGuestDiscard(tileCode, viaRiichi) {
    if (!G || G.currentTurnSeat !== 'you') return;
    var idx = G.players.you.hand.indexOf(tileCode);
    if (idx !== -1) {
      G.players.you.hand.splice(idx, 1);
    }
    G.players.you.river.push(tileCode);
    G.lastDiscardSeat = 'you';
    G.selected = null;
    G.selectedIndex = null;
    G.justDrew = false;
    G.processing = true; // 打牌後はホストの同期を待つ
    if (viaRiichi) {
      G.players.you.riichi = true;
      G.players.you.riichiTurn = G.players.you.river.length;
      G.players.you.ippatsu = true;
    }
    G.log.push('あなたが' + tileName(tileCode) + 'を切りました。' + (viaRiichi ? '（リーチ宣言）' : ''));
    render();

    OnlinePeer.sendToHost({
      type: 'GUEST_DISCARD',
      seat: myLogicalSeat,
      tile: tileCode,
      riichi: viaRiichi
    });
  }

  // ホスト側：状態の同期ブロードキャスト
  function syncOnlineStateToAll() {
    if (!OnlinePeer.isHost() || !G) return;

    var rivers = {};
    var melds = {};
    var riichiStates = {};
    SEATS_ORDER.forEach(function (s) {
      if (G.players[s]) {
        rivers[s] = G.players[s].river;
        melds[s] = G.players[s].melds;
        riichiStates[s] = G.players[s].riichi;
      }
    });

    seatsConfig.forEach(function (slot) {
      if (slot.seat !== 'you' && !slot.isCpu && slot.id) {
        OnlinePeer.sendTo(slot.id, {
          type: 'ONLINE_SYNC_TURN',
          currentTurnSeat: G.currentTurnSeat,
          rivers: rivers,
          melds: melds,
          riichiStates: riichiStates,
          lastDiscardSeat: G.lastDiscardSeat,
          doraIndicators: G.doraIndicators,
          remainingPool: poolTotal(G.pool),
          scores: matchState ? matchState.scores : null,
          riichiPool: matchState ? matchState.riichiPool : 0
        });
      }
    });
  }

  // ゲスト側：ホストからの卓同期受信
  function handleGuestSyncTurn(msg) {
    if (!G) return;
    var localCurrentTurn = logicalToLocalSeat(msg.currentTurnSeat);
    G.currentTurnSeat = localCurrentTurn;
    G.doraIndicators = msg.doraIndicators;
    G.lastDiscardSeat = logicalToLocalSeat(msg.lastDiscardSeat);

    SEATS_ORDER.forEach(function (locSeat) {
      var logSeat = localToLogicalSeat(locSeat);
      if (G.players[locSeat]) {
        G.players[locSeat].river = (msg.rivers && msg.rivers[logSeat]) ? msg.rivers[logSeat].slice() : [];
        G.players[locSeat].melds = (msg.melds && msg.melds[logSeat]) ? msg.melds[logSeat].slice() : [];
        G.players[locSeat].riichi = (msg.riichiStates && msg.riichiStates[logSeat]) || false;
      }
      if (matchState && msg.scores && msg.scores[logSeat] !== undefined) {
        matchState.scores[locSeat] = msg.scores[logSeat];
      }
    });
    if (matchState && msg.riichiPool !== undefined) {
      matchState.riichiPool = msg.riichiPool;
    }

    G.processing = (localCurrentTurn !== 'you');
    render();
  }

  // ホスト側：局終了の同期送信
  function syncRoundOver() {
    if (!OnlinePeer.isHost() || !G) return;
    var allHands = {};
    SEATS_ORDER.forEach(function (s) {
      allHands[s] = G.players[s] ? G.players[s].hand.slice() : [];
    });
    seatsConfig.forEach(function (slot) {
      if (slot.seat !== 'you' && !slot.isCpu && slot.id) {
        OnlinePeer.sendTo(slot.id, {
          type: 'ONLINE_ROUND_OVER',
          outcome: G.outcome,
          allHands: allHands,
          scores: matchState ? matchState.scores : null,
          riichiPool: matchState ? matchState.riichiPool : 0
        });
      }
    });
  }

  // ゲスト側：局終了通知を受信した時の処理
  function handleGuestRoundOver(msg) {
    if (!G) return;
    G.gameOver = true;
    G.outcome = msg.outcome;
    if (G.outcome) {
      if (G.outcome.seat) G.outcome.seat = logicalToLocalSeat(G.outcome.seat);
      if (G.outcome.winnerSeat) G.outcome.winnerSeat = logicalToLocalSeat(G.outcome.winnerSeat);
      if (G.outcome.ronSeat) G.outcome.ronSeat = logicalToLocalSeat(G.outcome.ronSeat);
      if (G.outcome.to) G.outcome.to = logicalToLocalSeat(G.outcome.to);
      if (G.outcome.via) G.outcome.via = logicalToLocalSeat(G.outcome.via);
      if (G.outcome.ronner) G.outcome.ronner = logicalToLocalSeat(G.outcome.ronner);
      if (G.outcome.discarder) G.outcome.discarder = logicalToLocalSeat(G.outcome.discarder);
    }
    SEATS_ORDER.forEach(function (locSeat) {
      var logSeat = localToLogicalSeat(locSeat);
      if (G.players[locSeat] && msg.allHands && msg.allHands[logSeat]) {
        G.players[locSeat].hand = msg.allHands[logSeat];
      }
      if (matchState && msg.scores && msg.scores[logSeat] !== undefined) {
        matchState.scores[locSeat] = msg.scores[logSeat];
      }
    });
    G.processing = false;
    render();
  }

  return {
    openOnlineLobby: openOnlineLobby,
    isOnline: function () { return isOnline; },
    getMyLogicalSeat: function () { return myLogicalSeat; },
    isGuestSeat: isGuestSeat,
    getSeatInfo: getSeatInfo,
    getSeatDisplayName: getSeatDisplayName,
    notifyGuestTurn: notifyGuestTurn,
    sendGuestDiscard: sendGuestDiscard,
    syncOnlineStateToAll: syncOnlineStateToAll,
    syncRoundOver: syncRoundOver
  };
})();

window.OnlineGame = OnlineGame;

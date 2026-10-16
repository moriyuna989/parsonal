// js/online/lobby.js
// ロビー・ルーム参加処理

function openOnlineLobby() {
  OnlineGameRuntime.isOnline = true;
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
    OnlineGameRuntime.myLogicalSeat = 'you';
    OnlineGameRuntime.myName = 'ホスト（あなた）';
    OnlineGameRuntime.seatsConfig = [
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
    OnlineGameRuntime.myName = 'ゲストプレイヤー';
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
      var emptySlot = OnlineGameRuntime.seatsConfig.find(function (s) { return s.seat !== 'you' && s.isCpu; });
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
        executeOnlineGuestDiscard(msg.seat, msg.tile, msg.riichi, senderId);
      }
    } else if (msg.type === 'GUEST_ACTION') {
      handleGuestAction(msg, senderId);
    } else if (msg.type === 'GUEST_NEXT_KYOKU') {
      var nextSlot = OnlineGameRuntime.seatsConfig.find(function (s) { return s.id === senderId && s.seat === msg.seat; });
      if (nextSlot && G && G.gameOver && typeof proceedToNextKyoku === 'function') proceedToNextKyoku();
    }
  });

  OnlinePeer.onPeerLeft(function (peerId) {
    var slot = OnlineGameRuntime.seatsConfig.find(function (s) { return s.id === peerId; });
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
      OnlineGameRuntime.seatsConfig = msg.seatsConfig;
      OnlineGameRuntime.matchSettings = msg.matchSettings;
      var mySlot = OnlineGameRuntime.seatsConfig.find(function (s) { return s.id === OnlinePeer.getMyId(); });
      if (mySlot) OnlineGameRuntime.myLogicalSeat = mySlot.seat;
      renderLobby();
    } else if (msg.type === 'ONLINE_START_MATCH') {
      handleGuestStartMatch(msg);
    } else if (msg.type === 'ONLINE_YOUR_TURN') {
      handleGuestYourTurn(msg);
    } else if (msg.type === 'ONLINE_SYNC_TURN') {
      handleGuestSyncTurn(msg);
    } else if (msg.type === 'ONLINE_ROUND_OVER') {
      handleGuestRoundOver(msg);
    } else if (msg.type === 'ONLINE_RON_OFFER') {
      handleGuestRonOffer(msg);
    } else if (msg.type === 'ONLINE_CALL_OFFER') {
      handleGuestCallOffer(msg);
    } else if (msg.type === 'ONLINE_CALL_ACCEPTED') {
      handleGuestCallAccepted(msg);
    }
  });
}

function broadcastLobbyState() {
  OnlinePeer.broadcast({
    type: 'LOBBY_STATE',
    seatsConfig: OnlineGameRuntime.seatsConfig,
    matchSettings: OnlineGameRuntime.matchSettings
  });
}

// 待合室（ロビー）UIの描画
function renderLobby() {
  var app = getAppEl();
  app.innerHTML = shellHtml('ONLINE LOBBY', 'オンライン待合室', 'onlineRoot');
  wireBack();

  var isHost = OnlinePeer.isHost();
  var code = OnlinePeer.getRoomCode();

  var slotsHtml = OnlineGameRuntime.seatsConfig.map(function (s) {
    var isMe = (s.seat === OnlineGameRuntime.myLogicalSeat);
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
        '<div class="settings-option' + (OnlineGameRuntime.matchSettings.rounds === 1 ? ' selected' : '') + '" data-val="1">一局戦</div>' +
        '<div class="settings-option' + (OnlineGameRuntime.matchSettings.rounds === 4 ? ' selected' : '') + '" data-val="4">東風戦（推奨）</div>' +
        '<div class="settings-option' + (OnlineGameRuntime.matchSettings.rounds === 8 ? ' selected' : '') + '" data-val="8">半荘戦</div>' +
      '</div>' +
    '</div>' +
    '<div class="settings-group">' +
      '<div class="settings-label">CPUレベル（足りない席に入るAI）</div>' +
      '<div class="settings-options" id="onlineOptCpu">' +
        '<div class="settings-option' + (OnlineGameRuntime.matchSettings.cpuLevel === 'easy' ? ' selected' : '') + '" data-val="easy">初級</div>' +
        '<div class="settings-option' + (OnlineGameRuntime.matchSettings.cpuLevel === 'normal' ? ' selected' : '') + '" data-val="normal">中級</div>' +
        '<div class="settings-option' + (OnlineGameRuntime.matchSettings.cpuLevel === 'hard' ? ' selected' : '') + '" data-val="hard">上級（仲林プロAI）</div>' +
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
        OnlineGameRuntime.matchSettings.rounds = parseInt(el.getAttribute('data-val'), 10);
        broadcastLobbyState();
      });
    });

    var cpuOpts = root.querySelectorAll('#onlineOptCpu .settings-option');
    cpuOpts.forEach(function (el) {
      el.addEventListener('click', function () {
        cpuOpts.forEach(function (o) { o.classList.remove('selected'); });
        el.classList.add('selected');
        OnlineGameRuntime.matchSettings.cpuLevel = el.getAttribute('data-val');
        broadcastLobbyState();
      });
    });

    document.getElementById('btnStartOnlineMatch').addEventListener('click', startOnlineMatchAsHost);
  }
}

// ホストが対局開始をクリックした時の処理

// =====================================================================
// js/online_peer.js
// PeerJS (WebRTC P2P) 通信レイヤー・部屋作成・合流・送受信管理
// =====================================================================

var OnlinePeer = (function () {
  var peer = null;
  var myId = null;
  var isHost = false;
  var roomCode = null;
  var guestConnections = {}; // { guestId: DataConnection }
  var hostConnection = null;  // DataConnection to host (if guest)
  var messageHandlers = [];
  var joinHandlers = [];
  var leaveHandlers = [];

  function generateRoomCode() {
    var chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    var code = '';
    for (var i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  function getHostPeerId(code) {
    return 'ag-mahjong-room-' + code.toUpperCase();
  }

  // ホストとして部屋を開設
  function createRoom(customCode, onSuccess, onError) {
    disconnect();
    isHost = true;
    roomCode = customCode || generateRoomCode();
    var hostId = getHostPeerId(roomCode);

    try {
      peer = new Peer(hostId, {
        debug: 1
      });
    } catch (e) {
      if (onError) onError(e);
      return;
    }

    peer.on('open', function (id) {
      myId = id;
      if (onSuccess) onSuccess(roomCode);
    });

    peer.on('connection', function (conn) {
      guestConnections[conn.peer] = conn;

      conn.on('open', function () {
        // ゲスト参加通知
        joinHandlers.forEach(function (fn) { fn(conn.peer); });
      });

      conn.on('data', function (data) {
        handleIncomingData(data, conn.peer);
      });

      conn.on('close', function () {
        delete guestConnections[conn.peer];
        leaveHandlers.forEach(function (fn) { fn(conn.peer); });
      });

      conn.on('error', function (err) {
        console.warn('Guest conn error:', err);
      });
    });

    peer.on('error', function (err) {
      console.error('Peer error:', err);
      if (err.type === 'unavailable-id') {
        // 部屋コードが重複していた場合は再生成してリトライ
        createRoom(generateRoomCode(), onSuccess, onError);
        return;
      }
      if (onError) onError(err);
    });
  }

  // ゲストとして部屋に参加
  function joinRoom(code, onSuccess, onError) {
    disconnect();
    isHost = false;
    roomCode = code.toUpperCase().trim();
    var hostId = getHostPeerId(roomCode);

    try {
      peer = new Peer({
        debug: 1
      });
    } catch (e) {
      if (onError) onError(e);
      return;
    }

    peer.on('open', function (id) {
      myId = id;
      hostConnection = peer.connect(hostId, {
        reliable: true
      });

      hostConnection.on('open', function () {
        if (onSuccess) onSuccess(roomCode);
      });

      hostConnection.on('data', function (data) {
        handleIncomingData(data, hostId);
      });

      hostConnection.on('close', function () {
        leaveHandlers.forEach(function (fn) { fn(hostId); });
      });

      hostConnection.on('error', function (err) {
        console.error('Host connection error:', err);
        if (onError) onError(err);
      });
    });

    peer.on('error', function (err) {
      console.error('Peer error in join:', err);
      if (onError) onError(err);
    });
  }

  function handleIncomingData(data, senderPeerId) {
    try {
      var msg = typeof data === 'string' ? JSON.parse(data) : data;
      messageHandlers.forEach(function (fn) { fn(msg, senderPeerId); });
    } catch (e) {
      console.error('Data parse error:', e, data);
    }
  }

  // ホストから全ゲストへ一斉送信
  function broadcast(data) {
    if (!isHost) return;
    var payload = typeof data === 'object' ? JSON.stringify(data) : data;
    Object.keys(guestConnections).forEach(function (peerId) {
      var conn = guestConnections[peerId];
      if (conn && conn.open) {
        conn.send(payload);
      }
    });
  }

  // 特定の相手に送信
  function sendTo(targetPeerId, data) {
    var payload = typeof data === 'object' ? JSON.stringify(data) : data;
    if (isHost) {
      var conn = guestConnections[targetPeerId];
      if (conn && conn.open) conn.send(payload);
    } else {
      if (hostConnection && hostConnection.open) hostConnection.send(payload);
    }
  }

  // ゲストからホストへ送信
  function sendToHost(data) {
    if (isHost) {
      // 自分がホストなら即座に内部処理
      handleIncomingData(data, myId);
      return;
    }
    if (hostConnection && hostConnection.open) {
      var payload = typeof data === 'object' ? JSON.stringify(data) : data;
      hostConnection.send(payload);
    }
  }

  function onMessage(fn) { messageHandlers.push(fn); }
  function onPeerJoined(fn) { joinHandlers.push(fn); }
  function onPeerLeft(fn) { leaveHandlers.push(fn); }

  function disconnect() {
    messageHandlers = [];
    joinHandlers = [];
    leaveHandlers = [];
    Object.keys(guestConnections).forEach(function (id) {
      try { guestConnections[id].close(); } catch (e) {}
    });
    guestConnections = {};
    if (hostConnection) {
      try { hostConnection.close(); } catch (e) {}
      hostConnection = null;
    }
    if (peer) {
      try { peer.destroy(); } catch (e) {}
      peer = null;
    }
    myId = null;
    isHost = false;
    roomCode = null;
  }

  return {
    createRoom: createRoom,
    joinRoom: joinRoom,
    broadcast: broadcast,
    sendTo: sendTo,
    sendToHost: sendToHost,
    onMessage: onMessage,
    onPeerJoined: onPeerJoined,
    onPeerLeft: onPeerLeft,
    disconnect: disconnect,
    generateRoomCode: generateRoomCode,
    getRoomCode: function () { return roomCode; },
    isHost: function () { return isHost; },
    getMyId: function () { return myId; },
    getGuestCount: function () { return Object.keys(guestConnections).length; }
  };
})();

window.OnlinePeer = OnlinePeer;

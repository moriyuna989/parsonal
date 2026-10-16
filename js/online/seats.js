// js/online/seats.js
// 席順・座席表示ヘルパー

function getAppEl() {
  return document.getElementById('app');
}

// 論理席（ホスト基準） <-> ゲストのローカル席（常に'you'が手前）の相対変換
function logicalToLocalSeat(logicalSeat) {
  if (OnlinePeer.isHost() || !OnlineGameRuntime.myLogicalSeat) return logicalSeat;
  var myIdx = OnlineGameRuntime.SEATS_ORDER.indexOf(OnlineGameRuntime.myLogicalSeat);
  var logIdx = OnlineGameRuntime.SEATS_ORDER.indexOf(logicalSeat);
  if (myIdx === -1 || logIdx === -1) return logicalSeat;
  var localIdx = (logIdx - myIdx + 4) % 4;
  return OnlineGameRuntime.SEATS_ORDER[localIdx];
}

function localToLogicalSeat(localSeat) {
  if (OnlinePeer.isHost() || !OnlineGameRuntime.myLogicalSeat) return localSeat;
  var myIdx = OnlineGameRuntime.SEATS_ORDER.indexOf(OnlineGameRuntime.myLogicalSeat);
  var locIdx = OnlineGameRuntime.SEATS_ORDER.indexOf(localSeat);
  if (myIdx === -1 || locIdx === -1) return localSeat;
  var logIdx = (myIdx + locIdx) % 4;
  return OnlineGameRuntime.SEATS_ORDER[logIdx];
}

// 指定された論理席がゲスト（人間の参加者）かどうか判定（ホスト側用）
function isGuestSeat(logicalSeat) {
  if (!OnlinePeer.isHost()) return false;
  var slot = OnlineGameRuntime.seatsConfig.find(function (s) { return s.seat === logicalSeat; });
  return !!(slot && !slot.isCpu && slot.seat !== 'you');
}

function isGuestPeer(logicalSeat, peerId) {
  var slot = OnlineGameRuntime.seatsConfig.find(function (s) { return s.seat === logicalSeat; });
  return !!(OnlinePeer.isHost() && slot && !slot.isCpu && slot.seat !== 'you' && slot.id === peerId);
}

// 画面UI表示用の席情報（ローカル席 'you', 'p2', 'p3', 'p4' を受け取って名前とタグ情報を返す）
function getSeatInfo(localSeat) {
  if (!OnlineGameRuntime.isOnline) {
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
  var slot = OnlineGameRuntime.seatsConfig.find(function (s) { return s.seat === logSeat; });
  var isMe = (localSeat === 'you');
  var isHostSlot = (logSeat === 'you');

  if (!slot) {
    return {
      name: isMe ? (isHostSlot ? '自分（ホスト）' : '自分') : 'CPU',
      isCpu: !isMe,
      isYou: isMe,
      isHost: isHostSlot,
      tagType: isMe ? 'tag-me' : 'tag-cpu',
      tagText: isMe ? (isHostSlot ? '自分（ホスト）' : '自分') : 'CPU'
    };
  }

  if (isMe) {
    var myLabel = isHostSlot ? '自分（ホスト）' : '自分';
    return {
      name: myLabel,
      isCpu: false,
      isYou: true,
      isHost: isHostSlot,
      tagType: 'tag-me',
      tagText: myLabel
    };
  }

  if (slot.isCpu) {
    return {
      name: 'CPU',
      isCpu: true,
      isYou: false,
      isHost: false,
      tagType: 'tag-cpu',
      tagText: 'CPU'
    };
  }

  return {
    name: isHostSlot ? 'ホスト' : '対戦相手',
    isCpu: false,
    isYou: false,
    isHost: isHostSlot,
    tagType: isHostSlot ? 'tag-host' : 'tag-human',
    tagText: isHostSlot ? 'ホスト' : '対戦相手'
  };
}

// 論理席から表示名を取得（ログ等用）
function getSeatDisplayName(logicalSeat) {
  var slot = OnlineGameRuntime.seatsConfig.find(function (s) { return s.seat === logicalSeat; });
  if (slot) return slot.name;
  return SEAT_NAME[logicalSeat] || logicalSeat;
}

// オンラインモード開始（ロビー画面を表示）

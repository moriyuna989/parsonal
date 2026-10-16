const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'mahjong_training.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="(js\/[^"]+)"\s*><\/script>/g)]
  .map(match => match[1])
  .filter(file => file !== 'js/app.js');

function createGameContext() {
  const context = {
    console,
    setTimeout: () => 0,
    clearTimeout() {},
    document: { getElementById: () => null }
  };
  context.window = context;
  vm.createContext(context);
  for (const file of scripts) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  context.render = () => {};
  return context;
}

function player(hand, river = []) {
  return { hand, river, melds: [], riichi: false, isOpen: false, ippatsu: false };
}

function verifyGuestCall(type, tile, guestHand) {
  const host = createGameContext();
  const guest = createGameContext();
  const hostMessages = [];
  const guestMessages = [];
  const seats = [
    { seat: 'you', name: 'Host', id: 'host-peer', isCpu: false },
    { seat: 'p2', name: 'Guest', id: 'guest-peer', isCpu: false },
    { seat: 'p3', name: 'CPU', id: null, isCpu: true },
    { seat: 'p4', name: 'CPU', id: null, isCpu: true }
  ];

  host.OnlinePeer = {
    isHost: () => true,
    sendTo: (peerId, message) => hostMessages.push({ peerId, message }),
    broadcast() {}
  };
  guest.OnlinePeer = {
    isHost: () => false,
    sendToHost: message => guestMessages.push(message)
  };
  vm.runInContext('OnlineGameRuntime.isOnline = true; OnlineGameRuntime.seatsConfig = ' + JSON.stringify(seats), host);
  vm.runInContext("OnlineGameRuntime.isOnline = true; OnlineGameRuntime.myLogicalSeat = 'p2'; OnlineGameRuntime.seatsConfig = " + JSON.stringify(seats), guest);

  host.G = {
    players: {
      you: player([], [tile]),
      p2: player(guestHand.slice()),
      p3: player([]),
      p4: player([])
    },
    log: [], currentTurnSeat: 'you', lastDiscardWasLastLiveTile: false,
    gameOver: false, processing: false, doraIndicators: [], pool: new Array(34).fill(1)
  };
  guest.G = {
    players: { you: player(guestHand.slice()), p2: player([]), p3: player([]), p4: player([]) },
    log: [], currentTurnSeat: 'you', lastDiscardWasLastLiveTile: false,
    gameOver: false, processing: true
  };

  host.startCallWindow(tile, 'you', () => {});
  const offer = hostMessages.find(entry => entry.message.type === 'ONLINE_CALL_OFFER');
  assert.ok(offer, `${type}: host sends a call offer`);
  assert.equal(offer.peerId, 'guest-peer');

  guest.handleGuestCallOffer(offer.message);
  const action = guest.getCallActions().find(candidate => candidate.type === type);
  assert.ok(action, `${type}: guest receives an actionable offer`);
  guest.executeCallAction(action);

  const request = guestMessages[0];
  assert.equal(request.type, 'GUEST_ACTION', `${type}: request reaches the host action handler`);
  assert.equal(request.action, 'call');
  host.handleGuestAction(request, 'guest-peer');
  assert.equal(host.G.players.p2.melds[0]?.type, type, `${type}: host applies the call`);

  const accepted = hostMessages.find(entry => entry.message.type === 'ONLINE_CALL_ACCEPTED');
  assert.ok(accepted, `${type}: host returns the accepted call to the guest`);
  guest.handleGuestCallAccepted(accepted.message);
  assert.equal(guest.G.players.you.melds[0]?.type, type, `${type}: guest receives the updated meld`);
  assert.equal(guest.G.processing, false, `${type}: guest can continue after the call`);
}

verifyGuestCall('pon', '5m', ['5m', '5m', '1p']);
verifyGuestCall('chi', '3m', ['1m', '2m', '7p']);
console.log('online guest call tests passed');

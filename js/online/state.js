// js/online/state.js
// オンライン対局の共有状態

const OnlineGameRuntime = {
  isOnline: false,
  myLogicalSeat: 'you', // ホストは 'you'、ゲストは 'p2', 'p3', 'p4'
  myName: 'プレイヤー',
  SEATS_ORDER: ['you', 'p2', 'p3', 'p4'],
  seatsConfig: [
    { seat: 'you', name: 'ホスト（あなた）', id: null, isCpu: false },
    { seat: 'p2', name: 'CPU (下家)', id: null, isCpu: true },
    { seat: 'p3', name: 'CPU (対面)', id: null, isCpu: true },
    { seat: 'p4', name: 'CPU (上家)', id: null, isCpu: true }
  ],
  matchSettings: {
    rounds: 4,
    redDora: true,
    cpuLevel: 'hard'
  },
  internal: {}
};

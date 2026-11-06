// Aggregate, on-device learning for the advanced CPU.
// Only public information and the acting player's own hand are used.

var CPU_LEARNING_STORAGE_KEY = 'mahjong:cpuLearning:v1';

function cpuLearningDefaults() {
  return {
    version: 1,
    observations: 0,
    cpuDecisions: 0,
    outcomeUpdates: 0,
    weights: {
      progress: 1.00,
      ukeire: 0.70,
      wait: 0.80,
      value: 0.35,
      safety: 0.20,
      danger: 1.15
    },
    humanStyle: {
      progress: 0,
      ukeire: 0,
      wait: 0,
      value: 0,
      safety: 0,
      danger: 0
    }
  };
}

function cpuLearningClamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function cpuLearningAuthoritative() {
  try {
    if (typeof OnlineGame !== 'undefined' && OnlineGame.isOnline && OnlineGame.isOnline()) {
      return typeof OnlinePeer === 'undefined' || !OnlinePeer.isHost();
    }
  } catch (err) {
    return false;
  }
  return false;
}

function cpuLearningCanWrite() {
  return !cpuLearningAuthoritative() && typeof localStorage !== 'undefined';
}

function cpuLearningMatchActive() {
  if (typeof isPractice === 'undefined') return true;
  return !!isPractice;
}

function cpuLearningRead() {
  var model = cpuLearningDefaults();
  if (typeof localStorage === 'undefined') return model;
  try {
    var raw = localStorage.getItem(CPU_LEARNING_STORAGE_KEY);
    if (!raw) return model;
    var saved = JSON.parse(raw);
    if (!saved || saved.version !== 1) return model;
    model.observations = Math.max(0, Number(saved.observations) || 0);
    model.cpuDecisions = Math.max(0, Number(saved.cpuDecisions) || 0);
    model.outcomeUpdates = Math.max(0, Number(saved.outcomeUpdates) || 0);
    Object.keys(model.weights).forEach(function (key) {
      var value = saved.weights && saved.weights[key];
      if (typeof value === 'number' && isFinite(value)) model.weights[key] = value;
    });
    Object.keys(model.humanStyle).forEach(function (key) {
      var styleValue = saved.humanStyle && saved.humanStyle[key];
      if (typeof styleValue === 'number' && isFinite(styleValue)) model.humanStyle[key] = styleValue;
    });
  } catch (err) {
    return cpuLearningDefaults();
  }
  return model;
}

var CpuLearning = (function () {
  var model = null;
  var featureKeys = ['progress', 'ukeire', 'wait', 'value', 'safety', 'danger'];

  function getModel() {
    if (!model) model = cpuLearningRead();
    return model;
  }

  function saveModel() {
    if (!cpuLearningCanWrite()) return;
    try { localStorage.setItem(CPU_LEARNING_STORAGE_KEY, JSON.stringify(getModel())); } catch (err) { /* storage is optional */ }
  }

  function featureVector(features) {
    var result = {};
    featureKeys.forEach(function (key) {
      result[key] = cpuLearningClamp(features && features[key], 0, 1);
    });
    return result;
  }

  function dotStyle(features, style) {
    return featureKeys.reduce(function (sum, key) {
      return sum + (features[key] - 0.5) * (style[key] || 0);
    }, 0);
  }

  function isCpuSeat(seat) {
    if (!seat || seat === 'you') return false;
    try {
      if (typeof OnlineGameRuntime !== 'undefined' && OnlineGameRuntime.isOnline && OnlineGameRuntime.seatsConfig) {
        var slot = OnlineGameRuntime.seatsConfig.find(function (entry) { return entry.seat === seat; });
        return !!(slot && slot.isCpu);
      }
    } catch (err) { /* use offline seats below */ }
    return true;
  }

  function getWeights() {
    var current = getModel();
    var result = {};
    featureKeys.forEach(function (key) { result[key] = current.weights[key]; });
    result.humanStyle = Object.assign({}, current.humanStyle);
    return result;
  }

  function recordDecision(seat, selected, candidates) {
    if (!cpuLearningMatchActive() || !G || !selected || !Array.isArray(candidates) || !candidates.length || !isCpuSeat(seat)) return;
    if (cpuLearningAuthoritative()) return;
    if (!G.cpuLearningDecisions) G.cpuLearningDecisions = [];
    G.cpuLearningDecisions.push({
      seat: seat,
      selected: featureVector(selected.features),
      alternatives: candidates.map(function (candidate) { return featureVector(candidate.features); }),
      turn: G.players && G.players[seat] ? G.players[seat].river.length + 1 : 0
    });
    // Keep a round bounded even if a caller accidentally invokes the chooser twice.
    if (G.cpuLearningDecisions.length > 80) G.cpuLearningDecisions.shift();
    getModel().cpuDecisions += 1;
  }

  function observeDiscard(seat, tileCode) {
    if (!cpuLearningMatchActive() || !G || !G.players || !G.players[seat] || !tileCode || cpuLearningAuthoritative()) return;
    if (isCpuSeat(seat)) return;
    if (typeof cpuBuildDiscardCandidates !== 'function') return;
    var hand = G.players[seat].hand.slice();
    var candidates = cpuBuildDiscardCandidates(seat, hand, { includeScore: false });
    var selected = candidates.find(function (candidate) { return candidate.tile === tileCode; });
    if (!selected || !candidates.length) return;
    var mean = {};
    featureKeys.forEach(function (key) {
      mean[key] = candidates.reduce(function (sum, candidate) { return sum + candidate.features[key]; }, 0) / candidates.length;
    });
    var current = getModel();
    featureKeys.forEach(function (key) {
      // Human actions are a weak style signal, deliberately much smaller than outcome feedback.
      current.humanStyle[key] = cpuLearningClamp((current.humanStyle[key] || 0) +
        0.004 * (selected.features[key] - mean[key]), -0.35, 0.35);
    });
    current.observations += 1;
    saveModel();
  }

  function updateFromOutcome(decision, reward, dealtIn) {
    var current = getModel();
    var selected = decision.selected;
    var alternatives = decision.alternatives || [];
    var meanAlternative = {};
    featureKeys.forEach(function (key) {
      var sum = alternatives.reduce(function (total, candidate) { return total + candidate[key]; }, 0);
      meanAlternative[key] = alternatives.length ? sum / alternatives.length : 0.5;
      var advantage = selected[key] - meanAlternative[key];
      current.weights[key] = cpuLearningClamp(current.weights[key] + 0.025 * reward * advantage, 0.05, 2.50);
    });
    if (dealtIn) {
      current.weights.danger = cpuLearningClamp(current.weights.danger + 0.04 * selected.danger, 0.60, 2.50);
      current.weights.safety = cpuLearningClamp(current.weights.safety + 0.025 * selected.safety, 0.20, 1.20);
    }
  }

  function finishRound(outcome) {
    if (!cpuLearningMatchActive() || !G || !Array.isArray(G.cpuLearningDecisions) || !G.cpuLearningDecisions.length || cpuLearningAuthoritative()) return;
    var cpuDecision = G.cpuLearningDecisions[G.cpuLearningDecisions.length - 1];
    var cpuWin = false;
    var cpuDealIn = false;
    if (outcome) {
      if (outcome.type === 'opp_tsumo') cpuWin = isCpuSeat(outcome.seat);
      if (outcome.type === 'other_ron') {
        cpuWin = isCpuSeat(outcome.ronner);
        cpuDealIn = isCpuSeat(outcome.discarder);
      }
      if (outcome.type === 'user_dealin') cpuWin = isCpuSeat(outcome.to);
      if (outcome.type === 'user_ron') cpuDealIn = isCpuSeat(outcome.via);
    }
    if (cpuWin) updateFromOutcome(cpuDecision, 1, false);
    else if (cpuDealIn) updateFromOutcome(cpuDecision, -1, true);
    else updateFromOutcome(cpuDecision, 0.05, false);
    var current = getModel();
    current.outcomeUpdates += 1;
    G.cpuLearningDecisions = [];
    saveModel();
  }

  function resetForTests() {
    model = null;
  }

  return {
    getWeights: getWeights,
    recordDecision: recordDecision,
    observeDiscard: observeDiscard,
    finishRound: finishRound,
    resetForTests: resetForTests,
    isCpuSeat: isCpuSeat
  };
}());

window.CpuLearning = CpuLearning;

/*
 * Pli — mini-synthé WebAudio (aucun asset externe) : papier, encre, étoiles.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.PliAudio = factory(root);
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  var ctx = null, enabled = true, noiseBuf = null;

  function ensure() {
    if (!ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function noise(c) {
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate * 0.25, c.sampleRate);
      var data = noiseBuf.getChannelData(0);
      for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }

  // froissement de papier : bruit bref filtré passe-bande + envelope
  function fold() {
    if (!enabled) return;
    try {
      var c = ensure();
      if (!c) return;
      var src = c.createBufferSource();
      src.buffer = noise(c);
      var f = c.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.8;
      var g = c.createGain();
      var t = c.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      src.connect(f); f.connect(g); g.connect(c.destination);
      src.start(t); src.stop(t + 0.2);
    } catch (e) { /* audio indisponible : silence */ }
  }

  function tone(freq, dur, type, gain, when) {
    if (!enabled) return;
    try {
      var c = ensure();
      if (!c) return;
      var t = c.currentTime + (when || 0);
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain || 0.1, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + dur + 0.05);
    } catch (e) { /* silence */ }
  }

  return {
    setEnabled: function (v) { enabled = !!v; },
    isEnabled: function () { return enabled; },
    unlock: function () { ensure(); },
    fold: fold,
    blocked: function () { tone(140, 0.1, 'triangle', 0.08); },
    merge: function () { tone(320, 0.12, 'sine', 0.07, 0.1); },
    ui: function () { tone(760, 0.045, 'sine', 0.05); },
    star: function (i) { tone(620 + i * 200, 0.12, 'sine', 0.08); },
    win: function () {
      [523, 659, 784].forEach(function (f, i) { tone(f, 0.18, 'sine', 0.08, i * 0.1); });
      tone(1046, 0.3, 'sine', 0.05, 0.32);
    }
  };
});

// audio.js — synthesized WebAudio sound effects and engine hum. No audio files.
var AU_AUDIO = (function () {
  var ctx = null, master = null, engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null;
  var muted = false;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return; var c = ensure(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.2, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(c.currentTime + dur);
  }

  function noise(dur, vol, lowpass) {
    if (muted) return; var c = ensure(); if (!c) return;
    var len = Math.floor(c.sampleRate * dur);
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = c.createBufferSource(); src.buffer = buf;
    var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass || 1200;
    var g = c.createGain(); g.gain.value = vol || 0.3;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  }

  function shoot() { noise(0.12, 0.5, 2500); tone(160, 0.08, 'square', 0.12, 60); }
  function enemyShoot() { noise(0.1, 0.25, 1800); }
  function hit() { tone(220, 0.1, 'sawtooth', 0.15, 90); }
  function pickup() { tone(660, 0.09, 'sine', 0.2); setTimeout(function () { tone(990, 0.12, 'sine', 0.2); }, 90); }
  function missionDone() {
    var notes = [523, 659, 784, 1047];
    notes.forEach(function (n, i) { setTimeout(function () { tone(n, 0.18, 'triangle', 0.22); }, i * 120); });
  }
  function busted() { tone(400, 0.5, 'sawtooth', 0.2, 120); }
  function denied() { tone(140, 0.18, 'square', 0.15, 100); }
  function carDoor() { noise(0.08, 0.2, 900); tone(180, 0.07, 'triangle', 0.12, 120); }
  function crash() { noise(0.25, 0.4, 700); }

  // Continuous engine hum whose pitch follows speed; siren wail while wanted.
  function setEngine(speedFrac, wanted) {
    if (muted) { stopLoops(); return; }
    var c = ensure(); if (!c) return;
    if (!engineOsc) {
      engineOsc = c.createOscillator(); engineOsc.type = 'sawtooth';
      engineGain = c.createGain(); engineGain.gain.value = 0;
      var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
      engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
    }
    engineOsc.frequency.setValueAtTime(50 + speedFrac * 140, c.currentTime);
    engineGain.gain.setValueAtTime(0.02 + speedFrac * 0.05, c.currentTime);
    if (wanted > 0) {
      if (!sirenOsc) {
        sirenOsc = c.createOscillator(); sirenOsc.type = 'sine';
        sirenGain = c.createGain(); sirenGain.gain.value = 0.03;
        sirenOsc.connect(sirenGain); sirenGain.connect(master); sirenOsc.start();
      }
      sirenOsc.frequency.setValueAtTime(650 + Math.sin(c.currentTime * 3) * 250, c.currentTime);
    } else if (sirenOsc) {
      try { sirenOsc.stop(); } catch (e) {}
      sirenOsc = null; sirenGain = null;
    }
  }
  function stopLoops() {
    if (engineOsc) { try { engineOsc.stop(); } catch (e) {} engineOsc = null; engineGain = null; }
    if (sirenOsc) { try { sirenOsc.stop(); } catch (e) {} sirenOsc = null; sirenGain = null; }
  }
  function toggleMute() { muted = !muted; if (muted) stopLoops(); return muted; }
  function isMuted() { return muted; }

  return { ensure: ensure, shoot: shoot, enemyShoot: enemyShoot, hit: hit, pickup: pickup,
    missionDone: missionDone, busted: busted, denied: denied, carDoor: carDoor, crash: crash,
    setEngine: setEngine, stopLoops: stopLoops, toggleMute: toggleMute, isMuted: isMuted };
})();

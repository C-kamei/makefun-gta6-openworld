// Solmar Bay — sound, all synthesized with WebAudio: no audio files.
// A low engine hum that follows speed, a two-tone siren when wanted, gun
// shots, pickup blips, mission jingles and a lazy bassline for the drive.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let musicTimer = null;
  let muted = false;
  let musicOn = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Engine: a quiet sawtooth whose pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a sine that alternates two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 660;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  /** Short blip: a sine that slides from one pitch to another. */
  function blip(freqA, freqB, dur, vol, type = 'sine') {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqA, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqB), t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** A burst of filtered noise: gunshots, crashes, skids. */
  function noise(dur, vol, filterFreq = 1200) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  // A lazy bassline: A minor walk, one note every half beat, very quiet.
  const BASSLINE = [55, 0, 55, 65.41, 0, 55, 49, 0, 55, 0, 55, 65.41, 82.41, 0, 73.42, 0];
  let bassStep = 0;

  function startMusic() {
    if (musicOn || !ensure()) return;
    musicOn = true;
    musicTimer = window.setInterval(() => {
      if (muted || !ctx) return;
      const freq = BASSLINE[bassStep % BASSLINE.length];
      bassStep += 1;
      if (freq > 0) blip(freq, freq * 0.995, 0.32, 0.12, 'triangle');
    }, 300);
  }

  return {
    /** Call on the first user gesture; starts the engine + music quietly. */
    unlock() {
      if (ensure()) startMusic();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    /** Engine pitch and volume follow the car's speed (0 when on foot). */
    engine(speed, driving) {
      if (!ctx || muted) return;
      const target = driving ? 0.05 + Math.min(0.1, Math.abs(speed) / 560 * 0.1) : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(52 + Math.abs(speed) * 0.22, ctx.currentTime, 0.08);
    },
    /** Siren wails while wanted; silent when clean. */
    siren(wanted, dt) {
      if (!ctx || muted) return;
      sirenTimer += dt;
      const on = wanted > 0;
      sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.2);
      if (on) sirenOsc.frequency.setTargetAtTime(Math.sin(sirenTimer * 5.2) > 0 ? 715 : 540, ctx.currentTime, 0.05);
    },
    shoot() {
      noise(0.14, 0.5, 2400);
      blip(220, 60, 0.08, 0.18, 'square');
    },
    enemyShoot() {
      noise(0.12, 0.22, 1800);
    },
    hit() {
      blip(320, 180, 0.09, 0.25, 'square');
    },
    pickup() {
      blip(660, 990, 0.12, 0.25);
    },
    crash() {
      noise(0.3, 0.5, 500);
    },
    bust() {
      blip(440, 110, 0.7, 0.3, 'sawtooth');
    },
    missionDone() {
      blip(523, 523, 0.12, 0.25);
      window.setTimeout(() => blip(659, 659, 0.12, 0.25), 120);
      window.setTimeout(() => blip(784, 784, 0.22, 0.28), 240);
    },
    click() {
      blip(880, 880, 0.05, 0.15);
    },
  };
}

// Sound, synthesized only — no audio files are loaded. Engine hum follows the car's
// speed, sirens wail while the police chase, gunshots crack, and two radio stations play
// a looping groove (bass, hats and keys) built from oscillators. Everything starts on
// the first user gesture, and M mutes it all.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let radioTimer = null;
  let station = 0;
  let muted = false;
  let step = 0;

  const STATIONS = [
    { name: 'SOLARA FM — Sunset Groove', bpm: 96, bass: [45, 45, 48, 43], keys: [69, 72, 76, 74] },
    { name: 'BAY 104 — Night Drive', bpm: 112, bass: [41, 41, 44, 46], keys: [65, 68, 72, 70] },
  ];

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
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
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

  function tone(freq, dur, type, vol, when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ctx || muted) return;
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

  function radioTick() {
    if (!ctx || muted) return;
    const st = STATIONS[station];
    const beat = 60 / st.bpm / 2;
    const midi = (m) => 440 * 2 ** ((m - 69) / 12);
    const bassNote = st.bass[step % st.bass.length];
    tone(midi(bassNote - 12), beat * 0.9, 'triangle', 0.22);
    if (step % 2 === 0) tone(midi(st.keys[step % st.keys.length]), beat * 1.4, 'sine', 0.08);
    noise(0.03, 0.05, 6000);
    step += 1;
    radioTimer = window.setTimeout(radioTick, beat * 1000);
  }

  return {
    ensure,
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    stationName() {
      return STATIONS[station].name;
    },
    nextStation() {
      station = (station + 1) % STATIONS.length;
      step = 0;
      return STATIONS[station].name;
    },
    setEngine(speedNorm) {
      if (!ctx || !engineOsc) return;
      engineOsc.frequency.value = 50 + speedNorm * 160;
      engineGain.gain.value = muted ? 0 : 0.05 + speedNorm * 0.08;
    },
    setSiren(on, time) {
      if (!ctx || !sirenOsc) return;
      if (!on) {
        sirenGain.gain.value = 0;
        return;
      }
      sirenOsc.frequency.value = 660 + Math.sin(time * 5) * 220;
      sirenGain.gain.value = muted ? 0 : 0.045;
    },
    gunshot() {
      noise(0.14, 0.5, 3200);
      tone(180, 0.08, 'square', 0.18);
    },
    punch() {
      noise(0.08, 0.3, 900);
    },
    crash() {
      noise(0.3, 0.4, 500);
    },
    click() {
      tone(880, 0.06, 'sine', 0.12);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.15);
      tone(990, 0.12, 'sine', 0.15, 0.09);
    },
    missionDone() {
      tone(523, 0.14, 'sine', 0.18);
      tone(659, 0.14, 'sine', 0.18, 0.12);
      tone(784, 0.22, 'sine', 0.2, 0.24);
    },
    startRadio() {
      if (!ctx || radioTimer !== null) return;
      step = 0;
      radioTick();
    },
    stopRadio() {
      if (radioTimer !== null) {
        window.clearTimeout(radioTimer);
        radioTimer = null;
      }
    },
  };
}

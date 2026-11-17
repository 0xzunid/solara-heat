// Synthesized sound for SOLARA HEAT: no audio files, everything is built
// from WebAudio oscillators and filtered noise at run time. Every call is a
// guarded no-op until the player first interacts (browsers block audio
// before a gesture), so the game never crashes headless or muted.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let sirenNodes = null;
  let engineNodes = null;
  let musicTimer = 0;
  let musicStep = 0;
  let musicOn = false;

  // A lazy bassline in A minor: root notes per bar, hats on the off-beat.
  const BASS = [55, 55, 65.41, 49, 55, 55, 82.41, 65.41];
  const STEP_SECONDS = 0.21;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
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
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  function musicNote() {
    if (!ctx || muted || !musicOn) return;
    const root = BASS[musicStep % BASS.length];
    tone(root, STEP_SECONDS * 1.8, 'triangle', 0.16);
    if (musicStep % 2 === 1) tone(root * 2, STEP_SECONDS * 0.9, 'sine', 0.05);
    if (musicStep % 4 === 2) noise(0.03, 0.05, 6000);
    musicStep += 1;
  }

  return {
    /** Call from the first key/click: creates the context and starts music. */
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      musicOn = true;
    },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = muted ? 0 : 0.5;
      if (muted) this.siren(false);
      return muted;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      noise(0.12, 0.5, 2600);
      tone(180, 0.08, 'square', 0.18, 60);
    },
    punch() {
      noise(0.08, 0.35, 900);
    },
    crash() {
      noise(0.25, 0.5, 500);
      tone(90, 0.2, 'sawtooth', 0.2, 40);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.25);
      setTimeout(() => tone(990, 0.12, 'sine', 0.25), 70);
    },
    mission() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.28), i * 95));
    },
    busted() {
      [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'sawtooth', 0.2), i * 140));
    },
    engine(level) {
      if (!ctx || muted) return;
      if (!engineNodes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = 55;
        gain.gain.value = 0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 320;
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        osc.start();
        engineNodes = { osc, gain };
      }
      const t = ctx.currentTime;
      engineNodes.osc.frequency.setTargetAtTime(52 + level * 130, t, 0.08);
      engineNodes.gain.gain.setTargetAtTime(level > 0.03 ? 0.05 + level * 0.05 : 0, t, 0.1);
    },
    /** Two-tone police siren while wanted; call with false to stop it. */
    siren(on) {
      if (!ctx) return;
      if (!on) {
        if (sirenNodes) {
          try { sirenNodes.osc.stop(); } catch { /* already stopped */ }
          sirenNodes = null;
        }
        return;
      }
      if (muted || sirenNodes) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 720;
      gain.gain.value = 0.045;
      const lfo = ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 1.6;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      lfo.start();
      sirenNodes = { osc, lfo };
    },
    update(dt) {
      if (!ctx || !musicOn) return;
      musicTimer += dt;
      while (musicTimer >= STEP_SECONDS) {
        musicTimer -= STEP_SECONDS;
        musicNote();
      }
    },
  };
}

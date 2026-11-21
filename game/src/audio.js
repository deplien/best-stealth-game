// Every sound in the museum is synthesised with WebAudio — no audio files. Soft ticks for
// footsteps (the guards' placed in the stereo field by where the guard stands, so a player
// can hear a patrol coming before its light arrives), a bright ping for a thrown coin, a
// two-note sting when a guard grows suspicious, the alarm, and small chimes for the diamond
// and the door. The context opens on the first key or click, as browsers require.

export function createAudio() {
  let ctx = null;
  let master = null;

  /** Open the audio context; call on any first input. Safe to call again. */
  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    ctx = new AudioCtor();
    master = ctx.createGain();
    master.gain.value = 0.45;
    // A gentle compressor at the end of the chain keeps layered pings and stings polite.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -18;
    limiter.ratio.value = 6;
    master.connect(limiter).connect(ctx.destination);
  }

  /** One oscillator note with a quick attack and an exponential fade. */
  function tone(freq, dur, { type = 'sine', gain = 0.2, slideTo = null, delay = 0 } = {}) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(amp).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  /** A short burst of filtered noise: the tick of a shoe on marble. */
  function tick(gain, pan, freq = 1800) {
    if (!ctx) return;
    const dur = 0.045;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / data.length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 1.1;
    const amp = ctx.createGain();
    amp.gain.value = gain;
    source.connect(filter).connect(amp);
    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      amp.connect(panner).connect(master);
    } else {
      amp.connect(master);
    }
    source.start();
  }

  return {
    unlock,
    /** The burglar's own step: quieter and duller while crouched. */
    playPlayerFootstep(crouched) {
      tick(crouched ? 0.05 : 0.11, 0, crouched ? 1200 : 1700);
    },
    /**
     * The guards' steps, panned and faded by each guard's position relative to the player:
     * a patrol behind a case to the left sounds left and faint long before it is seen.
     */
    playGuardFootstepsPannedByDistance(guards, player, dt) {
      if (!ctx) return;
      for (const guard of guards) {
        if (!guard.moving) continue;
        guard.stepTimer -= dt;
        if (guard.stepTimer > 0) continue;
        guard.stepTimer = 0.37;
        const dx = guard.x - player.x;
        const dist = Math.hypot(dx, guard.y - player.y);
        if (dist > 430) continue;
        const gain = 0.16 * (1 - dist / 430);
        tick(gain, dx / 300, 1500);
      }
    },
    /** A coin hitting marble: bright, high, and impossible for a guard to ignore. */
    playCoinPing() {
      tone(2637, 0.35, { type: 'sine', gain: 0.16 });
      tone(3520, 0.22, { type: 'sine', gain: 0.08, delay: 0.02 });
    },
    /** Two low notes, close together: a guard has seen something. */
    playSuspicionSting() {
      tone(196, 0.16, { type: 'triangle', gain: 0.22 });
      tone(185, 0.22, { type: 'triangle', gain: 0.22, delay: 0.11 });
    },
    /** The caught alarm: three rising square pulses. */
    playAlarm() {
      for (let index = 0; index < 3; index += 1) {
        tone(620, 0.16, { type: 'square', gain: 0.1, delay: index * 0.19 });
        tone(466, 0.16, { type: 'square', gain: 0.1, delay: index * 0.19 + 0.09 });
      }
    },
    /** The diamond leaves its pedestal: a small glass arpeggio. */
    playGemChime() {
      tone(1319, 0.3, { gain: 0.14 });
      tone(1760, 0.35, { gain: 0.12, delay: 0.07 });
      tone(2637, 0.45, { gain: 0.1, delay: 0.14 });
    },
    /** The exit door: a soft, low, successful chord. */
    playExitChime() {
      tone(392, 0.4, { type: 'triangle', gain: 0.16 });
      tone(587, 0.5, { type: 'triangle', gain: 0.14, delay: 0.09 });
    },
  };
}

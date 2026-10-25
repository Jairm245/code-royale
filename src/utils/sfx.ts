/*
  Code Royale audio — synthesized in the browser (no files to
  download), routed through one mixer:

    sfx ─┐
         ├─ master (mute) ─ compressor ─ speakers
    music┘   (music ducks while the host voice is speaking)

  Public API (unchanged): playSfx(name), unlockAudio()
  New: startMusic(mood), stopMusic(), setVoiceActive(on),
       setMuted(on), isMuted()
*/

type SoundName =
  | "countdown"
  | "correct"
  | "incorrect"
  | "coach"
  | "whoosh"
  | "complete"
  | "lag"
  | "firewall"
  | "fifty"
  | "reveal"
  | "timeup"
  | "join"
  | "open";

export type MusicMood = "lobby" | "question" | "results" | "off";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

let muted = readMuted();
let voiceActive = false;
let mood: MusicMood = "off";

const MOOD_VOLUME: Record<MusicMood, number> = {
  lobby: 0.42,
  question: 0.3,
  results: 0.4,
  off: 0,
};

function readMuted() {
  try {
    return localStorage.getItem("cr-muted") === "1";
  } catch {
    return false;
  }
}

function getContext() {
  if (ctx) {
    return ctx;
  }

  const AudioContextClass =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) {
    return null;
  }

  ctx = new AudioContextClass();

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -16;
  compressor.ratio.value = 4;
  compressor.connect(ctx.destination);

  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.9;
  master.connect(compressor);

  sfxBus = ctx.createGain();
  sfxBus.gain.value = 0.9;
  sfxBus.connect(master);

  musicBus = ctx.createGain();
  musicBus.gain.value = 0;
  musicBus.connect(master);

  /* one shared second of white noise for hats, whooshes, snaps */
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);

  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }

  return ctx;
}

export async function unlockAudio() {
  const context = getContext();

  if (context && context.state === "suspended") {
    try {
      await context.resume();
    } catch {
      /* browser refused; the next user gesture will retry */
    }
  }
}

/* any first tap/click anywhere unlocks audio (browsers require a gesture) */
if (typeof window !== "undefined") {
  const unlockOnce = () => {
    void unlockAudio().then(() => applyMusicLevel());
  };

  window.addEventListener("pointerdown", unlockOnce, { passive: true });
  window.addEventListener("keydown", unlockOnce);
}

/* ========================================
   MIXER CONTROLS
======================================== */

export function isMuted() {
  return muted;
}

export function setMuted(next: boolean) {
  muted = next;

  try {
    localStorage.setItem("cr-muted", next ? "1" : "0");
  } catch {
    /* per-viewer preference only */
  }

  if (ctx && master) {
    master.gain.setTargetAtTime(next ? 0 : 0.9, ctx.currentTime, 0.05);
  }
}

export function setVoiceActive(active: boolean) {
  voiceActive = active;
  applyMusicLevel();
}

function applyMusicLevel() {
  if (!ctx || !musicBus) {
    return;
  }

  const target = MOOD_VOLUME[mood] * (voiceActive ? 0.28 : 1);
  musicBus.gain.setTargetAtTime(target, ctx.currentTime, voiceActive ? 0.08 : 0.4);
}

/* ========================================
   VOICES (building blocks)
======================================== */

function env(
  gain: GainNode,
  start: number,
  peak: number,
  attack: number,
  decay: number
) {
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
}

function osc(
  bus: AudioNode,
  type: OscillatorType,
  frequency: number,
  start: number,
  peak: number,
  attack: number,
  decay: number,
  options: { endFrequency?: number; detune?: number; filter?: number } = {}
) {
  const context = ctx!;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.detune.value = options.detune ?? 0;

  if (options.endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, options.endFrequency), start + attack + decay);
  }

  env(gain, start, peak, attack, decay);

  if (options.filter) {
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = options.filter;
    oscillator.connect(filter);
    filter.connect(gain);
  } else {
    oscillator.connect(gain);
  }

  gain.connect(bus);
  oscillator.start(start);
  oscillator.stop(start + attack + decay + 0.05);
}

function noiseHit(
  bus: AudioNode,
  start: number,
  peak: number,
  decay: number,
  filterType: BiquadFilterType,
  frequency: number,
  options: { q?: number; endFrequency?: number; attack?: number } = {}
) {
  const context = ctx!;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();

  source.buffer = noiseBuffer;
  filter.type = filterType;
  filter.frequency.setValueAtTime(frequency, start);
  filter.Q.value = options.q ?? 0.8;

  if (options.endFrequency) {
    filter.frequency.exponentialRampToValueAtTime(options.endFrequency, start + (options.attack ?? 0.005) + decay);
  }

  env(gain, start, peak, options.attack ?? 0.004, decay);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(bus);
  source.start(start, Math.random() * 0.5);
  source.stop(start + (options.attack ?? 0.005) + decay + 0.05);
}

/* a soft bell: fundamental + slightly inharmonic partial */
function bell(bus: AudioNode, frequency: number, start: number, peak: number, decay = 0.9) {
  osc(bus, "sine", frequency, start, peak, 0.004, decay);
  osc(bus, "sine", frequency * 2.76, start, peak * 0.22, 0.003, decay * 0.45);
  osc(bus, "triangle", frequency * 2, start, peak * 0.18, 0.004, decay * 0.6);
}

/* a brass-ish stab: three detuned saws through a closing lowpass */
function brass(bus: AudioNode, frequencies: number[], start: number, peak: number, length = 0.42) {
  const context = ctx!;

  for (const frequency of frequencies) {
    for (const detune of [-9, 0, 8]) {
      const oscillator = context.createOscillator();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();

      oscillator.type = "sawtooth";
      oscillator.frequency.value = frequency;
      oscillator.detune.value = detune;
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(600, start);
      filter.frequency.exponentialRampToValueAtTime(3200, start + 0.06);
      filter.frequency.exponentialRampToValueAtTime(900, start + length);
      env(gain, start, peak / (frequencies.length * 2.2), 0.025, length);
      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(bus);
      oscillator.start(start);
      oscillator.stop(start + length + 0.1);
    }
  }
}

function note(semitonesFromA4: number) {
  return 440 * 2 ** (semitonesFromA4 / 12);
}

/* ========================================
   SOUND EFFECTS
======================================== */

export async function playSfx(name: SoundName) {
  const context = getContext();

  if (!context || !sfxBus) {
    return;
  }

  if (context.state === "suspended") {
    await unlockAudio();
  }

  const bus = sfxBus;
  const t = context.currentTime + 0.01;

  switch (name) {
    case "reveal": {
      /* the question sting: timpani hit + brass chord + cymbal swell */
      osc(bus, "sine", 110, t, 0.5, 0.005, 0.5, { endFrequency: 70 });
      noiseHit(bus, t, 0.12, 0.9, "highpass", 6000, { attack: 0.02 });
      brass(bus, [note(-4), note(0), note(3), note(7)], t + 0.02, 0.55, 0.6);
      break;
    }

    case "open": {
      /* answers unlocked: a bright two-note "go" */
      bell(bus, note(15), t, 0.16, 0.4);
      bell(bus, note(22), t + 0.09, 0.18, 0.6);
      break;
    }

    case "countdown": {
      /* clock tick: woodblock */
      osc(bus, "sine", 1650, t, 0.22, 0.002, 0.07);
      noiseHit(bus, t, 0.06, 0.03, "bandpass", 3000, { q: 3 });
      break;
    }

    case "timeup": {
      /* the buzzer */
      osc(bus, "sawtooth", 98, t, 0.22, 0.01, 0.65, { filter: 900 });
      osc(bus, "sawtooth", 104, t, 0.18, 0.01, 0.65, { filter: 900 });
      osc(bus, "square", 49, t, 0.12, 0.01, 0.6, { filter: 400 });
      break;
    }

    case "correct": {
      [0, 4, 7, 12].forEach((step, index) => bell(bus, note(15 + step), t + index * 0.075, 0.2, 0.8));
      noiseHit(bus, t + 0.25, 0.05, 0.8, "highpass", 8000);
      break;
    }

    case "incorrect": {
      osc(bus, "square", 220, t, 0.12, 0.01, 0.18, { filter: 1200, endFrequency: 200 });
      osc(bus, "square", 165, t + 0.2, 0.12, 0.01, 0.32, { filter: 1000, endFrequency: 140 });
      break;
    }

    case "whoosh": {
      noiseHit(bus, t, 0.16, 0.45, "bandpass", 400, { q: 1.2, endFrequency: 4200, attack: 0.18 });
      break;
    }

    case "coach": {
      bell(bus, note(10), t, 0.16, 0.6);
      bell(bus, note(17), t + 0.12, 0.14, 0.8);
      break;
    }

    case "complete": {
      /* fanfare: I – IV – V – I */
      brass(bus, [note(-9), note(-5), note(-2)], t, 0.5, 0.22);
      brass(bus, [note(-4), note(0), note(3)], t + 0.24, 0.5, 0.22);
      brass(bus, [note(-2), note(2), note(5)], t + 0.48, 0.5, 0.22);
      brass(bus, [note(-9), note(-5), note(-2), note(3)], t + 0.74, 0.65, 0.9);
      osc(bus, "sine", 98, t + 0.74, 0.45, 0.005, 0.6, { endFrequency: 60 });
      noiseHit(bus, t + 0.74, 0.12, 1.4, "highpass", 6500, { attack: 0.01 });
      break;
    }

    case "lag": {
      /* glitch zap */
      for (let i = 0; i < 5; i += 1) {
        osc(bus, "square", 900 - i * 140, t + i * 0.045, 0.08, 0.002, 0.04, { filter: 2400 });
      }

      osc(bus, "sawtooth", 600, t + 0.22, 0.12, 0.005, 0.35, { endFrequency: 60, filter: 1800 });
      break;
    }

    case "firewall": {
      osc(bus, "sawtooth", 180, t, 0.1, 0.12, 0.3, { endFrequency: 520, filter: 1500 });
      bell(bus, note(19), t + 0.3, 0.16, 0.7);
      break;
    }

    case "fifty": {
      noiseHit(bus, t, 0.12, 0.08, "highpass", 5000);
      noiseHit(bus, t + 0.12, 0.12, 0.08, "highpass", 5000);
      bell(bus, note(12), t + 0.24, 0.14, 0.5);
      break;
    }

    case "join": {
      osc(bus, "sine", 520, t, 0.14, 0.004, 0.12, { endFrequency: 880 });
      bell(bus, note(19), t + 0.08, 0.12, 0.5);
      break;
    }
  }
}

/* ========================================
   MUSIC — a small step sequencer
   4 bars of F major game-show groove at 104 BPM:
   Fmaj7 | Dm7 | Gm7 | C7
   Moods change which parts play; volume follows the mood
   and ducks under the host voice.
======================================== */

const BPM = 104;
const STEP = 60 / BPM / 4;
const LOOKAHEAD = 0.12;

/* chord tones as semitones from A4 */
const CHORDS = [
  { root: -16, tones: [-4, 0, 3, 7] }, /* Fmaj7 */
  { root: -19, tones: [-7, -4, 0, 3] }, /* Dm7 */
  { root: -14, tones: [-2, 1, 5, 8] }, /* Gm7 */
  { root: -21, tones: [-9, -5, -2, 1] }, /* C7 */
];

let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let nextStepTime = 0;
let step = 0;

function scheduleStep(stepIndex: number, time: number) {
  const bus = musicBus;

  if (!bus || mood === "off") {
    return;
  }

  const bar = Math.floor(stepIndex / 16) % 4;
  const beatStep = stepIndex % 16;
  const chord = CHORDS[bar];
  const groove = mood !== "question";

  /* kick on 1 and 3 */
  if (beatStep === 0 || beatStep === 8) {
    osc(bus, "sine", 120, time, groove ? 0.55 : 0.35, 0.003, 0.28, { endFrequency: 45 });
  }

  /* snap on 2 and 4 (groove moods) */
  if (groove && (beatStep === 4 || beatStep === 12)) {
    noiseHit(bus, time, 0.13, 0.12, "bandpass", 1800, { q: 1.4 });
  }

  /* hats: 8ths in groove, quiet 16ths for tension */
  if (groove ? beatStep % 2 === 0 : true) {
    const accent = beatStep % 4 === 2;
    noiseHit(bus, time, groove ? (accent ? 0.06 : 0.035) : 0.022, 0.04, "highpass", 8000);
  }

  /* bass */
  if (groove) {
    const pattern: Record<number, number> = { 0: 0, 3: 12, 6: 7, 8: 0, 11: 12, 14: 10 };

    if (beatStep in pattern) {
      osc(bus, "triangle", note(chord.root + pattern[beatStep]), time, 0.32, 0.005, STEP * 2.2, { filter: 900 });
    }
  } else if (beatStep % 2 === 0) {
    /* tension: pulsing root 8ths */
    osc(bus, "triangle", note(chord.root), time, 0.24, 0.005, STEP * 1.4, { filter: 600 });
  }

  /* electric-piano stabs on the off-beats */
  if (groove && (beatStep === 2 || beatStep === 10 || (beatStep === 7 && bar % 2 === 1))) {
    for (const tone of chord.tones) {
      osc(bus, "triangle", note(tone), time, 0.07, 0.006, STEP * 2.5, { filter: 2200 });
      osc(bus, "sine", note(tone + 12), time, 0.025, 0.004, STEP * 1.5);
    }
  }

  /* tension pad: one held chord per bar */
  if (!groove && beatStep === 0) {
    for (const tone of chord.tones.slice(0, 3)) {
      osc(bus, "sine", note(tone), time, 0.05, 0.4, STEP * 15, { filter: 1200 });
    }
  }

  /* results sparkle: bell arpeggio at the end of the loop */
  if (mood === "results" && bar === 3 && beatStep >= 12 && beatStep % 1 === 0) {
    bell(bus, note(chord.tones[beatStep - 12] + 24), time, 0.05, 0.4);
  }
}

function runScheduler() {
  if (!ctx) {
    return;
  }

  while (nextStepTime < ctx.currentTime + LOOKAHEAD) {
    scheduleStep(step, nextStepTime);
    nextStepTime += STEP;
    step = (step + 1) % 64;
  }
}

export function startMusic(next: MusicMood) {
  const context = getContext();

  if (!context) {
    return;
  }

  if (next === mood && schedulerTimer) {
    return;
  }

  mood = next;
  applyMusicLevel();

  if (next === "off") {
    return;
  }

  if (!schedulerTimer) {
    nextStepTime = context.currentTime + 0.1;
    step = 0;
    schedulerTimer = setInterval(runScheduler, 25);
  }
}

export function stopMusic() {
  mood = "off";
  applyMusicLevel();

  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

/* don't burn CPU (or battery) scheduling notes in a hidden tab */
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && schedulerTimer) {
      clearInterval(schedulerTimer);
      schedulerTimer = null;
    } else if (!document.hidden && mood !== "off" && !schedulerTimer && ctx) {
      nextStepTime = ctx.currentTime + 0.1;
      schedulerTimer = setInterval(runScheduler, 25);
    }
  });
}

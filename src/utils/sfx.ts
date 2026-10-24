type SoundName =
  | "countdown"
  | "correct"
  | "incorrect"
  | "coach"
  | "whoosh"
  | "complete"
  | "lag"
  | "firewall"
  | "fifty";

let audioContext:
  | AudioContext
  | null = null;

function getAudioContext() {
  if (audioContext) {
    return audioContext;
  }

  const AudioContextClass =
    window.AudioContext ??
    (
      window as typeof window & {
        webkitAudioContext?:
          typeof AudioContext;
      }
    ).webkitAudioContext;

  if (!AudioContextClass) {
    return null;
  }

  audioContext =
    new AudioContextClass();

  return audioContext;
}

export async function unlockAudio() {
  const ctx =
    getAudioContext();

  if (!ctx) {
    return;
  }

  if (
    ctx.state ===
    "suspended"
  ) {
    try {
      await ctx.resume();
    } catch {
      // Ignore browser audio
      // permission failures.
    }
  }
}

/* ========================================
   LOW-LEVEL TONE
======================================== */

function tone(
  frequency: number,
  duration: number,
  options?: {
    type?:
      OscillatorType;

    volume?: number;

    delay?: number;

    endFrequency?:
      number;
  }
) {
  const ctx =
    getAudioContext();

  if (!ctx) {
    return;
  }

  const oscillator =
    ctx.createOscillator();

  const gain =
    ctx.createGain();

  const start =
    ctx.currentTime +
    (options?.delay ??
      0);

  const end =
    start +
    duration;

  oscillator.type =
    options?.type ??
    "sine";

  oscillator.frequency
    .setValueAtTime(
      frequency,
      start
    );

  if (
    options?.endFrequency
  ) {
    oscillator.frequency
      .exponentialRampToValueAtTime(
        Math.max(
          1,
          options.endFrequency
        ),
        end
      );
  }

  const volume =
    options?.volume ??
    0.12;

  gain.gain
    .setValueAtTime(
      0.0001,
      start
    );

  gain.gain
    .exponentialRampToValueAtTime(
      volume,
      start + 0.015
    );

  gain.gain
    .exponentialRampToValueAtTime(
      0.0001,
      end
    );

  oscillator.connect(
    gain
  );

  gain.connect(
    ctx.destination
  );

  oscillator.start(
    start
  );

  oscillator.stop(
    end + 0.02
  );
}

/* ========================================
   NOISE / WHOOSH
======================================== */

function noise(
  duration: number,
  volume = 0.05
) {
  const ctx =
    getAudioContext();

  if (!ctx) {
    return;
  }

  const buffer =
    ctx.createBuffer(
      1,
      ctx.sampleRate *
        duration,
      ctx.sampleRate
    );

  const data =
    buffer.getChannelData(
      0
    );

  for (
    let i = 0;
    i < data.length;
    i += 1
  ) {
    data[i] =
      Math.random() *
        2 -
      1;
  }

  const source =
    ctx.createBufferSource();

  const filter =
    ctx.createBiquadFilter();

  const gain =
    ctx.createGain();

  source.buffer =
    buffer;

  filter.type =
    "bandpass";

  filter.frequency.value =
    1100;

  gain.gain
    .setValueAtTime(
      volume,
      ctx.currentTime
    );

  gain.gain
    .exponentialRampToValueAtTime(
      0.0001,
      ctx.currentTime +
        duration
    );

  source.connect(
    filter
  );

  filter.connect(
    gain
  );

  gain.connect(
    ctx.destination
  );

  source.start();
}

/* ========================================
   PUBLIC SOUND EFFECTS
======================================== */

export async function playSfx(
  sound: SoundName
) {
  const ctx =
    getAudioContext();

  if (!ctx) {
    return;
  }

  if (
    ctx.state ===
    "suspended"
  ) {
    try {
      await ctx.resume();
    } catch {
      return;
    }
  }

  switch (sound) {
    /* 5...4...3... */
    case "countdown":
      tone(
        620,
        0.08,
        {
          type:
            "square",

          volume:
            0.045,

          endFrequency:
            480,
        }
      );
      break;

    /* Somebody got it */
    case "correct":
      tone(
        523,
        0.12,
        {
          volume:
            0.08,
        }
      );

      tone(
        659,
        0.12,
        {
          delay:
            0.1,

          volume:
            0.08,
        }
      );

      tone(
        784,
        0.2,
        {
          delay:
            0.2,

          volume:
            0.1,
        }
      );
      break;

    /* Nobody got it */
    case "incorrect":
      tone(
        330,
        0.15,
        {
          type:
            "triangle",

          volume:
            0.07,
        }
      );

      tone(
        246,
        0.25,
        {
          delay:
            0.12,

          type:
            "triangle",

          volume:
            0.08,
        }
      );
      break;

    /* AI Coach entrance */
    case "coach":
      tone(
        440,
        0.18,
        {
          type:
            "sine",

          volume:
            0.05,

          endFrequency:
            700,
        }
      );

      tone(
        880,
        0.22,
        {
          delay:
            0.14,

          volume:
            0.055,
        }
      );
      break;

    /* Coach scene change */
    case "whoosh":
      noise(
        0.2,
        0.035
      );

      tone(
        300,
        0.18,
        {
          volume:
            0.025,

          endFrequency:
            700,
        }
      );
      break;

    /* Coach finished */
    case "complete":
      tone(
        659,
        0.12,
        {
          volume:
            0.06,
        }
      );

      tone(
        784,
        0.12,
        {
          delay:
            0.1,

          volume:
            0.07,
        }
      );

      tone(
        1047,
        0.25,
        {
          delay:
            0.2,

          volume:
            0.08,
        }
      );
      break;

    /* Lag Spike */
    case "lag":
      tone(
        180,
        0.32,
        {
          type:
            "sawtooth",

          volume:
            0.06,

          endFrequency:
            70,
        }
      );

      noise(
        0.16,
        0.025
      );
      break;

    /* Firewall */
    case "firewall":
      tone(
        400,
        0.12,
        {
          volume:
            0.05,
        }
      );

      tone(
        800,
        0.25,
        {
          delay:
            0.08,

          volume:
            0.07,
        }
      );
      break;

    /* 50/50 */
    case "fifty":
      tone(
        700,
        0.1,
        {
          volume:
            0.05,
        }
      );

      tone(
        700,
        0.1,
        {
          delay:
            0.15,

          volume:
            0.05,
        }
      );
      break;
  }
}
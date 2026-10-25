import { toSpeakable } from "./speakable";
import { setVoiceActive } from "./sfx";

let activeAudio:
  HTMLAudioElement | null =
  null;

let playbackToken = 0;

/*
  If streamed speech hasn't started playing within this
  time, give up on it and let the caller fall back to the
  browser voice instead of leaving the screen waiting.
*/
const VOICE_START_TIMEOUT_MS =
  3200;

/*
  Prefetched clips, keyed by stream URL. A clip requested
  while the previous question/scene is still on screen is
  usually fully buffered by the time it is needed, so it
  starts instantly.
*/
const voiceCache =
  new Map<
    string,
    HTMLAudioElement
  >();

const MAX_CACHED_CLIPS =
  12;

export function prefetchStreamingVoice(
  text: string,
  sceneType: string
) {
  try {
    const url =
      getStreamingVoiceUrl(
        text,
        sceneType
      );

    if (
      voiceCache.has(url)
    ) {
      return;
    }

    const audio =
      new Audio(url);

    audio.preload =
      "auto";

    audio.onerror =
      () => {
        voiceCache.delete(
          url
        );
      };

    audio.load();
    voiceCache.set(
      url,
      audio
    );

    while (
      voiceCache.size >
      MAX_CACHED_CLIPS
    ) {
      const oldest =
        voiceCache.keys().next()
          .value;

      if (
        oldest ===
        undefined
      ) {
        break;
      }

      voiceCache.delete(
        oldest
      );
    }
  } catch {
    /* prefetch is best-effort */
  }
}

function takeCachedAudio(
  url: string
) {
  const cached =
    voiceCache.get(url);

  voiceCache.delete(url);

  if (
    cached &&
    !cached.error
  ) {
    cached.onerror =
      null;
    return cached;
  }

  return undefined;
}

const MAX_STREAM_TEXT_CHARS =
  1200;

export type GeneratedVoiceOptions = {
  onStart?:
    () => void;

  onEnd?:
    () => void;

  onError?:
    (
      error:
        unknown
    ) => void;

  /*
    0 -> 1 playback progress.

    Streaming MP3 duration is not always available
    immediately, so the player begins with a text-
    based duration estimate and automatically uses
    the real audio duration if the browser exposes it.
  */
  onProgress?:
    (
      progress:
        number,

      currentTime:
        number,

      duration:
        number
    ) => void;
};

function getConvexSiteUrl() {
  const viteMeta =
    import.meta as
      ImportMeta & {
        env?: {
          VITE_CONVEX_URL?:
            string;

          VITE_CONVEX_SITE_URL?:
            string;
        };
      };

  /*
    Prefer an explicit HTTP-actions URL when one
    exists.
  */
  const explicitSiteUrl =
    viteMeta.env
      ?.VITE_CONVEX_SITE_URL;

  if (explicitSiteUrl) {
    return explicitSiteUrl.replace(
      /\/$/,
      ""
    );
  }

  /*
    Standard Convex Vite projects normally expose
    VITE_CONVEX_URL. Convert the normal
    *.convex.cloud API URL to the *.convex.site
    HTTP-actions URL.
  */
  const convexUrl =
    viteMeta.env
      ?.VITE_CONVEX_URL;

  if (convexUrl) {
    const normalized =
      convexUrl.replace(
        /\/$/,
        ""
      );

    if (
      normalized.endsWith(
        ".convex.cloud"
      )
    ) {
      return normalized.replace(
        /\.convex\.cloud$/,
        ".convex.site"
      );
    }
  }

  /*
    Fallback for the current Code Royale Convex
    deployment.
  */
  return "https://oceanic-snail-433.convex.site";
}

export function getStreamingVoiceUrl(
  text:
    string,

  sceneType:
    string = "coach"
) {
  /* say "equals", not "equals equals" */
  const narration =
    toSpeakable(
      text.trim()
    );

  if (!narration) {
    throw new Error(
      "Narration is empty."
    );
  }

  if (
    narration.length >
    MAX_STREAM_TEXT_CHARS
  ) {
    throw new Error(
      `Narration is too long for streaming voice (${narration.length} chars).`
    );
  }

  const url =
    new URL(
      "/voice",
      getConvexSiteUrl()
    );

  url.searchParams.set(
    "text",
    narration
  );

  url.searchParams.set(
    "sceneType",
    sceneType
  );

  url.searchParams.set(
    "v",
    "2"
  );

  return url.toString();
}

export async function playGeneratedVoice(
  url:
    string,

  options:
    GeneratedVoiceOptions =
      {},

  estimatedDurationSeconds:
    number = 12
) {
  stopGeneratedVoice();

  const token =
    ++playbackToken;

  const audio =
    takeCachedAudio(
      url
    ) ??
    new Audio(
      url
    );

  let started =
    false;

  let startTimer:
    ReturnType<
      typeof setTimeout
    > | undefined;

  activeAudio =
    audio;

  audio.preload =
    "auto";

  let progressAnimation:
    number | null =
    null;

  function stopProgressLoop() {
    if (
      progressAnimation !==
      null
    ) {
      cancelAnimationFrame(
        progressAnimation
      );

      progressAnimation =
        null;
    }
  }

  function getDuration() {
    if (
      Number.isFinite(
        audio.duration
      ) &&
      audio.duration >
        0
    ) {
      return audio.duration;
    }

    return Math.max(
      1,
      estimatedDurationSeconds
    );
  }

  function reportProgress() {
    if (
      token !==
      playbackToken
    ) {
      return;
    }

    const duration =
      getDuration();

    /*
      Keep streaming progress below 1 until
      onended fires. That prevents the visual
      timeline from completing before narration.
    */
    const progress =
      Math.min(
        0.985,
        Math.max(
          0,
          audio.currentTime /
            duration
        )
      );

    options.onProgress?.(
      progress,
      audio.currentTime,
      duration
    );

    progressAnimation =
      requestAnimationFrame(
        reportProgress
      );
  }

  const cleanup =
    () => {
      stopProgressLoop();
      setVoiceActive(false);
      if (
        activeAudio ===
        audio
      ) {
        activeAudio =
          null;
      }
    };

  audio.onplaying =
    () => {
      if (
        token !==
        playbackToken
      ) {
        return;
      }

      started =
        true;

      setVoiceActive(true);

      if (startTimer) {
        clearTimeout(
          startTimer
        );
      }

      options.onStart?.();

      stopProgressLoop();

      options.onProgress?.(
        0,
        audio.currentTime,
        getDuration()
      );

      progressAnimation =
        requestAnimationFrame(
          reportProgress
        );
    };

  audio.onended =
    () => {
      if (
        token !==
        playbackToken
      ) {
        cleanup();
        return;
      }

      stopProgressLoop();

      options.onProgress?.(
        1,
        audio.currentTime,
        getDuration()
      );

      cleanup();

      options.onEnd?.();
    };

  audio.onerror =
    () => {
      if (
        token !==
        playbackToken
      ) {
        cleanup();
        return;
      }

      cleanup();

      options.onError?.(
        new Error(
          "Generated voice playback failed."
        )
      );
    };

  startTimer =
    setTimeout(
      () => {
        if (
          started ||
          token !==
            playbackToken
        ) {
          return;
        }

        /* invalidate this playback, then hand over to the fallback */
        playbackToken += 1;
        audio.pause();
        cleanup();

        options.onError?.(
          new Error(
            "Voice took too long to start."
          )
        );
      },
      VOICE_START_TIMEOUT_MS
    );

  try {
    await audio.play();
  } catch (
    error
  ) {
    if (startTimer) {
      clearTimeout(
        startTimer
      );
    }

    cleanup();

    if (
      token ===
      playbackToken
    ) {
      options.onError?.(
        error
      );
    }

    throw error;
  }
}

function estimateSpeechDuration(
  text:
    string,

  sceneType:
    string
) {
  const words =
    text
      .trim()
      .split(
        /\s+/
      )
      .filter(
        Boolean
      )
      .length;

  const punctuationPauses =
    (
      text.match(
        /[.!?;:]/g
      ) ??
      []
    ).length;

  /*
    Slightly conservative estimate so visuals
    never race ahead of the narration.
  */
  const wordsPerSecond =
    sceneType ===
      "question"
      ? 2.65
      : 2.35;

  return Math.max(
    2.5,
    words /
      wordsPerSecond +
      punctuationPauses *
        0.16
  );
}

export async function playStreamingVoice(
  text:
    string,

  sceneType:
    string,

  options:
    GeneratedVoiceOptions =
      {}
) {
  const url =
    getStreamingVoiceUrl(
      text,
      sceneType
    );

  return playGeneratedVoice(
    url,
    options,
    estimateSpeechDuration(
      text,
      sceneType
    )
  );
}

export function stopGeneratedVoice() {
  playbackToken += 1;
  setVoiceActive(false);

  if (
    !activeAudio
  ) {
    return;
  }

  activeAudio.pause();

  try {
    activeAudio.currentTime =
      0;
  } catch {
    // Some streaming media cannot seek before metadata loads.
  }

  activeAudio.onplaying =
    null;

  activeAudio.onended =
    null;

  activeAudio.onerror =
    null;

  activeAudio =
    null;
}
